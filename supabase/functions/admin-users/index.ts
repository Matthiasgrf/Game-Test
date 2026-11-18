// Edge Function: admin-users
//
// Admin-Aktionen (list, create, resetPassword, delete):
//   - nur fuer Rolle 'admin' UND MFA-Sitzung (JWT-Claim aal = 'aal2')
//   - Aktionen gegen andere Admins sind gesperrt (nur per Supabase-Dashboard)
//   - jede Aktion landet in public.admin_audit_log
// Self-Service (changeOwnPassword):
//   - jeder eingeloggte User; setzt das eigene Passwort und loescht das
//     Flag app_metadata.must_change_password
//
// Der Service-Role-Key ist in Edge Functions automatisch als Env-Variable
// verfuegbar und verlaesst niemals den Server.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type User } from "npm:@supabase/supabase-js@2.119.1";

const EMAIL_DOMAIN = "game-test.local";
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PW_MIN = 12;
const PW_MAX = 72; // bcrypt-Limit

// Erlaubte Browser-Origins (kommagetrennt). Ueberschreibbar per Secret
// ALLOWED_ORIGINS im Supabase-Dashboard.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://matthiasgrf.github.io,http://localhost:5173")
  .split(",").map((o) => o.trim()).filter(Boolean);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function validPassword(pw: unknown): pw is string {
  return typeof pw === "string" && pw.length >= PW_MIN && pw.length <= PW_MAX;
}
const PW_ERROR = `Passwort: ${PW_MIN}-${PW_MAX} Zeichen`;

// Payload eines (bereits von getUser verifizierten) JWT lesen
function jwtClaims(token: string): Record<string, unknown> {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), "=")));
  } catch {
    return {};
  }
}

const hasVerifiedFactor = (u: User) => (u.factors ?? []).some((f) => f.status === "verified");

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // 1) Aufrufer identifizieren (Signatur + Ablauf prueft der Auth-Server)
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "Nicht eingeloggt" }, 401);
  const caller = userData.user;
  const aal = jwtClaims(token).aal;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungueltiges JSON" }, 400);
  }
  const action = String(body.action ?? "");

  const audit = async (success: boolean, targetId?: string, detail?: string) => {
    const { error } = await admin.from("admin_audit_log").insert({
      actor_id: caller.id,
      action,
      target_id: targetId ?? null,
      success,
      detail: detail ?? null,
    });
    if (error) console.error("audit log failed", error);
  };

  // Rolle eines Users aus profiles lesen (null = existiert nicht)
  const roleOf = async (id: string) => {
    const { data } = await admin.from("profiles").select("role").eq("id", id).maybeSingle();
    return (data?.role as string | undefined) ?? null;
  };

  try {
    // ---------- Self-Service ------------------------------------------
    if (action === "changeOwnPassword") {
      // Wer MFA eingerichtet hat, muss die Aenderung mit aal2 machen
      if (hasVerifiedFactor(caller) && aal !== "aal2") {
        return json({ error: "MFA-Bestaetigung erforderlich" }, 403);
      }
      if (!validPassword(body.password)) return json({ error: PW_ERROR }, 400);
      const { error } = await admin.auth.admin.updateUserById(caller.id, {
        password: body.password,
        app_metadata: { ...caller.app_metadata, must_change_password: false },
      });
      if (error) throw error;
      await audit(true, caller.id);
      return json({ ok: true });
    }

    // ---------- Admin-Aktionen ----------------------------------------
    if ((await roleOf(caller.id)) !== "admin") {
      await audit(false, undefined, "not admin");
      return json({ error: "Nur fuer Admins" }, 403);
    }
    if (aal !== "aal2") {
      await audit(false, undefined, "aal1");
      return json({ error: "Admin-Aktionen erfordern MFA" }, 403);
    }

    switch (action) {
      case "list": {
        const { data, error } = await admin
          .from("profiles")
          .select("id, username, role, created_at")
          .order("created_at");
        if (error) throw error;
        return json({ users: data });
      }

      case "create": {
        const username = String(body.username ?? "").trim().toLowerCase();
        const role = body.role === "admin" ? "admin" : "user";
        if (!USERNAME_RE.test(username)) {
          return json({ error: "Username: 3-20 Zeichen, nur a-z, 0-9, _" }, 400);
        }
        if (!validPassword(body.password)) return json({ error: PW_ERROR }, 400);
        const { data, error } = await admin.auth.admin.createUser({
          email: `${username}@${EMAIL_DOMAIN}`,
          password: body.password,
          email_confirm: true,
          user_metadata: { username },
          // role: vom Trigger in profiles.role uebernommen
          // must_change_password: User muss das Start-Passwort beim ersten Login aendern
          app_metadata: { role, must_change_password: true },
        });
        if (error) {
          if (error.code === "email_exists" || error.status === 422) {
            await audit(false, undefined, `exists: ${username}`);
            return json({ error: "Username existiert bereits" }, 409);
          }
          throw error;
        }
        await audit(true, data.user.id, `${username} (${role})`);
        return json({ user: { id: data.user.id, username, role } }, 201);
      }

      case "resetPassword": {
        const userId = String(body.userId ?? "");
        if (!UUID_RE.test(userId)) return json({ error: "Ungueltige User-ID" }, 400);
        if (userId === caller.id) {
          return json({ error: "Eigenes Passwort bitte unter 'Konto' aendern" }, 400);
        }
        const targetRole = await roleOf(userId);
        if (!targetRole) return json({ error: "User nicht gefunden" }, 404);
        if (targetRole === "admin") {
          await audit(false, userId, "target is admin");
          return json({ error: "Passwoerter anderer Admins nur im Supabase-Dashboard" }, 403);
        }
        if (!validPassword(body.password)) return json({ error: PW_ERROR }, 400);
        const { data: target, error: getErr } = await admin.auth.admin.getUserById(userId);
        if (getErr) throw getErr;
        const { error } = await admin.auth.admin.updateUserById(userId, {
          password: body.password,
          app_metadata: { ...target.user.app_metadata, must_change_password: true },
        });
        if (error) throw error;
        await audit(true, userId);
        return json({ ok: true });
      }

      case "delete": {
        const userId = String(body.userId ?? "");
        if (!UUID_RE.test(userId)) return json({ error: "Ungueltige User-ID" }, 400);
        if (userId === caller.id) {
          return json({ error: "Du kannst dich nicht selbst loeschen" }, 400);
        }
        const targetRole = await roleOf(userId);
        if (!targetRole) return json({ error: "User nicht gefunden" }, 404);
        if (targetRole === "admin") {
          await audit(false, userId, "target is admin");
          return json({ error: "Admins koennen nur im Supabase-Dashboard geloescht werden" }, 403);
        }
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) throw error;
        await audit(true, userId);
        return json({ ok: true });
      }

      default:
        return json({ error: "Unbekannte Aktion" }, 400);
    }
  } catch (e) {
    // Details nur ins Server-Log, nach aussen eine generische Meldung
    console.error(`admin-users ${action} failed`, e);
    await audit(false, undefined, "internal error");
    return json({ error: "Aktion fehlgeschlagen" }, 500);
  }
});
