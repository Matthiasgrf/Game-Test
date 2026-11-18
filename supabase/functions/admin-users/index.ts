// Edge Function: admin-users
// Nur Admins duerfen User auflisten, anlegen, loeschen und Passwoerter setzen.
// Der Service-Role-Key ist in Edge Functions automatisch als Env-Variable
// verfuegbar und verlaesst niemals den Server.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAIL_DOMAIN = "game-test.local";
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validPassword(pw: unknown): pw is string {
  return typeof pw === "string" && pw.length >= 8 && pw.length <= 72;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // 1) Aufrufer identifizieren
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: "Nicht eingeloggt" }, 401);
  const caller = userData.user;

  // 2) Admin-Rolle pruefen
  const { data: profile } = await admin
    .from("profiles").select("role").eq("id", caller.id).single();
  if (profile?.role !== "admin") return json({ error: "Nur fuer Admins" }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungueltiges JSON" }, 400);
  }

  try {
    switch (body.action) {
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
        if (!validPassword(body.password)) {
          return json({ error: "Passwort: mindestens 8 Zeichen" }, 400);
        }
        const { data, error } = await admin.auth.admin.createUser({
          email: `${username}@${EMAIL_DOMAIN}`,
          password: body.password,
          email_confirm: true,
          user_metadata: { username },
          app_metadata: { role }, // vom Trigger in profiles.role uebernommen
        });
        if (error) throw error;
        return json({ user: { id: data.user.id, username, role } }, 201);
      }

      case "resetPassword": {
        const userId = String(body.userId ?? "");
        if (!validPassword(body.password)) {
          return json({ error: "Passwort: mindestens 8 Zeichen" }, 400);
        }
        const { error } = await admin.auth.admin.updateUserById(userId, {
          password: body.password,
        });
        if (error) throw error;
        return json({ ok: true });
      }

      case "delete": {
        const userId = String(body.userId ?? "");
        if (userId === caller.id) {
          return json({ error: "Du kannst dich nicht selbst loeschen" }, 400);
        }
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) throw error;
        return json({ ok: true });
      }

      default:
        return json({ error: "Unbekannte Aktion" }, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 400);
  }
});
