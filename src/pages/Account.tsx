import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { callAdminApi, PASSWORD_MIN } from "../lib/adminApi";
import { useAuth } from "../auth/AuthProvider";
import Mfa from "./Mfa";

// Eigenes Passwort aendern (Pflicht nach Start-/Reset-Passwort) und MFA verwalten.
export default function Account({ forced = false }: { forced?: boolean }) {
  const { aal, signOut } = useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showMfa, setShowMfa] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) return setMsg({ text: "Passwörter stimmen nicht überein", ok: false });
    setBusy(true);
    setMsg(null);
    try {
      await callAdminApi({ action: "changeOwnPassword", password: pw });
      // neues JWT holen, damit must_change_password=false im Token steht
      await supabase.auth.refreshSession();
      setPw("");
      setPw2("");
      setMsg({ text: "Passwort geändert", ok: true });
    } catch (err) {
      setMsg({ text: (err as Error).message, ok: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={forced ? "card narrow" : "card"}>
      <h2>{forced ? "Neues Passwort festlegen" : "Konto"}</h2>
      {forced && (
        <p className="muted">
          Dein Passwort wurde vom Admin vergeben. Bitte lege jetzt ein eigenes fest.
        </p>
      )}
      <form onSubmit={onSubmit}>
        <label>
          Neues Passwort (min. {PASSWORD_MIN} Zeichen)
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            minLength={PASSWORD_MIN}
            maxLength={72}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          Wiederholen
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            minLength={PASSWORD_MIN}
            maxLength={72}
            autoComplete="new-password"
            required
          />
        </label>
        {msg && <p className={msg.ok ? "success" : "error"}>{msg.text}</p>}
        <button disabled={busy}>{busy ? "…" : "Passwort ändern"}</button>
        {forced && (
          <button type="button" className="secondary" onClick={signOut}>Logout</button>
        )}
      </form>

      {!forced && (
        <section className="section">
          <h3>Zwei-Faktor-Anmeldung</h3>
          {aal.next === "aal2" ? (
            <p className="success">Aktiv ✔</p>
          ) : showMfa ? (
            <Mfa embedded />
          ) : (
            <button className="secondary" onClick={() => setShowMfa(true)}>
              Authenticator-App einrichten
            </button>
          )}
        </section>
      )}
    </main>
  );
}
