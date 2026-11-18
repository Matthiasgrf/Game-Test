import { useCallback, useEffect, useState, type FormEvent } from "react";
import { type Profile, type Role } from "../lib/supabase";
import { callAdminApi, generatePassword, PASSWORD_MIN } from "../lib/adminApi";
import { useAuth } from "../auth/AuthProvider";

// Alle Admin-Aktionen laufen ueber die Edge Function "admin-users"
// (prueft serverseitig Rolle 'admin' + MFA und schreibt ein Audit-Log).
// Start-/Reset-Passwoerter werden zufaellig erzeugt, einmalig angezeigt und
// muessen vom User beim naechsten Login geaendert werden.
export default function Admin() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [msg, setMsg] = useState<{ text: string; ok: boolean; pw?: string } | null>(null);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Role>("user");

  const load = useCallback(async () => {
    try {
      const { users } = await callAdminApi<{ users: Profile[] }>({ action: "list" });
      setUsers(users);
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<unknown>, okText: string, pw?: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ text: okText, ok: true, pw });
      await load();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    }
  };

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    const pw = generatePassword();
    const name = username;
    run(async () => {
      await callAdminApi({ action: "create", username: name, password: pw, role });
      setUsername("");
      setRole("user");
    }, `User "${name}" angelegt. Start-Passwort (wird nur jetzt angezeigt):`, pw);
  };

  const onReset = (u: Profile) => {
    if (!window.confirm(`Neues Start-Passwort für ${u.username} erzeugen?`)) return;
    const pw = generatePassword();
    run(
      () => callAdminApi({ action: "resetPassword", userId: u.id, password: pw }),
      `Passwort für "${u.username}" zurückgesetzt. Start-Passwort (wird nur jetzt angezeigt):`,
      pw,
    );
  };

  const onDelete = (u: Profile) => {
    if (window.confirm(`User "${u.username}" wirklich löschen?`)) {
      run(() => callAdminApi({ action: "delete", userId: u.id }), `User "${u.username}" gelöscht`);
    }
  };

  return (
    <main className="card">
      <h2>Benutzerverwaltung</h2>

      <form onSubmit={onCreate} className="row wrap">
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          pattern="[a-z0-9_]{3,20}"
          title="3–20 Zeichen: a-z, 0-9, _"
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Rolle">
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <button>Anlegen</button>
      </form>
      <p className="muted small">
        Das Start-Passwort ({PASSWORD_MIN}+ Zeichen) wird automatisch erzeugt. Der User muss es
        beim ersten Login ändern. Admins müssen zusätzlich eine Authenticator-App einrichten.
      </p>

      {msg && (
        <p className={msg.ok ? "success" : "error"}>
          {msg.text}
          {msg.pw && (
            <>
              {" "}
              <code className="temp-pw">{msg.pw}</code>
            </>
          )}
        </p>
      )}

      <table>
        <thead>
          <tr><th>Username</th><th>Rolle</th><th>Angelegt</th><th></th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.role}</td>
              <td>{new Date(u.created_at).toLocaleDateString("de-DE")}</td>
              <td className="actions">
                {/* Aktionen gegen Admins (inkl. sich selbst) sind serverseitig gesperrt */}
                {u.role !== "admin" && u.id !== profile?.id && (
                  <>
                    <button className="secondary" onClick={() => onReset(u)}>Passwort</button>
                    <button className="danger" onClick={() => onDelete(u)}>Löschen</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
