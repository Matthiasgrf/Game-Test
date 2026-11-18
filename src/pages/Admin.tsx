import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase, type Profile, type Role } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

// Alle Admin-Aktionen laufen ueber die Edge Function "admin-users".
// supabase.functions.invoke schickt automatisch das JWT des eingeloggten Users mit.
async function callAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) msg = (await ctx.json()).error ?? msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data as T;
}

export default function Admin() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");

  const load = useCallback(async () => {
    try {
      const { users } = await callAdmin<{ users: Profile[] }>({ action: "list" });
      setUsers(users);
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<unknown>, okText: string) => {
    setMsg(null);
    try {
      await fn();
      setMsg({ text: okText, ok: true });
      await load();
    } catch (e) {
      setMsg({ text: (e as Error).message, ok: false });
    }
  };

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await callAdmin({ action: "create", username, password, role });
      setUsername("");
      setPassword("");
      setRole("user");
    }, `User "${username}" angelegt`);
  };

  const onReset = (u: Profile) => {
    const pw = window.prompt(`Neues Passwort für ${u.username} (min. 8 Zeichen):`);
    if (pw) run(() => callAdmin({ action: "resetPassword", userId: u.id, password: pw }), "Passwort geändert");
  };

  const onDelete = (u: Profile) => {
    if (window.confirm(`User "${u.username}" wirklich löschen?`)) {
      run(() => callAdmin({ action: "delete", userId: u.id }), `User "${u.username}" gelöscht`);
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
        <input
          placeholder="Passwort (min. 8)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          autoComplete="new-password"
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Rolle">
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
        <button>Anlegen</button>
      </form>

      {msg && <p className={msg.ok ? "success" : "error"}>{msg.text}</p>}

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
                <button className="secondary" onClick={() => onReset(u)}>Passwort</button>
                {u.id !== profile?.id && (
                  <button className="danger" onClick={() => onDelete(u)}>Löschen</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
