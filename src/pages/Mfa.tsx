import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

// Zweiter Faktor (TOTP, z. B. Google Authenticator / 1Password / Aegis).
// - Faktor vorhanden -> Code abfragen (Challenge)
// - kein Faktor      -> QR-Code anzeigen und Faktor einrichten (Enrollment)
// Admins kommen ohne aal2 nicht an der App vorbei; normale User koennen MFA
// freiwillig unter "Konto" einrichten.
export default function Mfa({ embedded = false }: { embedded?: boolean }) {
  const { refreshAal, signOut, profile } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode ruft Effekte doppelt auf
    started.current = true;
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return setError(error.message);
      const verified = data.totp[0];
      if (verified) {
        setFactorId(verified.id);
        return;
      }
      // abgebrochene Einrichtungen aufraeumen
      for (const f of data.all.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: en, error: enErr } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Game-Test",
      });
      if (enErr) return setError(enErr.message);
      setFactorId(en.id);
      setQr(en.totp.qr_code);
      setSecret(en.totp.secret);
    })();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    setCode("");
    if (error) setError("Code ungültig – bitte erneut versuchen");
    else await refreshAal();
  };

  return (
    <main className={embedded ? "" : "card narrow"}>
      <h2>Zwei-Faktor-Anmeldung</h2>
      {qr ? (
        <>
          <p className="muted">
            {profile?.role === "admin" && !embedded
              ? "Für Admin-Konten ist ein zweiter Faktor Pflicht. "
              : ""}
            Scanne den QR-Code mit einer Authenticator-App und gib den 6-stelligen Code ein.
          </p>
          <img src={qr} alt="QR-Code für die Authenticator-App" width={180} height={180} />
          <p className="muted small">
            Manuell: <code>{secret}</code>
          </p>
        </>
      ) : (
        <p className="muted">Bitte den Code aus deiner Authenticator-App eingeben.</p>
      )}
      <form onSubmit={onSubmit}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete="one-time-code"
          aria-label="6-stelliger Code"
          required
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <button disabled={busy || !factorId}>{busy ? "…" : "Bestätigen"}</button>
        {!embedded && (
          <button type="button" className="secondary" onClick={signOut}>
            Abbrechen / Logout
          </button>
        )}
      </form>
    </main>
  );
}
