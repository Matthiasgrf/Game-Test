import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase, type Category, type Group, type Profile, type Role } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";
import { GAMES } from "../games/catalog";
import AdminTabs from "./AdminTabs";

// Tabellen user_groups / game_groups: Schreiben ist per RLS nur Admins erlaubt.
const pairKey = (a: string | number, b: string | number) => `${a}|${b}`;

async function check(p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p;
  if (error) throw new Error(error.message);
}

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
  const [newGroups, setNewGroups] = useState<Set<number>>(new Set());
  const [groups, setGroups] = useState<Group[]>([]);
  const [userGroups, setUserGroups] = useState<Set<string>>(new Set()); // "userId|groupId"
  const [gameGroups, setGameGroups] = useState<Set<string>>(new Set()); // "gameKey|groupId"
  const [groupName, setGroupName] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [gameCategory, setGameCategory] = useState<Map<string, number>>(new Map()); // gameKey → categoryId
  const [catName, setCatName] = useState("");
  const [catEmoji, setCatEmoji] = useState("");

  const load = useCallback(async () => {
    try {
      const [{ users }, g, ug, gg, c, gc] = await Promise.all([
        callAdmin<{ users: Profile[] }>({ action: "list" }),
        supabase.from("groups").select("id, name").order("name"),
        supabase.from("user_groups").select("user_id, group_id"),
        supabase.from("game_groups").select("game_key, group_id"),
        supabase.from("categories").select("id, name, emoji, sort_order").order("sort_order").order("name"),
        supabase.from("game_categories").select("game_key, category_id"),
      ]);
      const err = g.error ?? ug.error ?? gg.error ?? c.error ?? gc.error;
      if (err) throw new Error(err.message);
      setUsers(users);
      setGroups((g.data ?? []) as Group[]);
      setUserGroups(new Set((ug.data ?? []).map((r) => pairKey(r.user_id, r.group_id))));
      setGameGroups(new Set((gg.data ?? []).map((r) => pairKey(r.game_key, r.group_id))));
      setCategories((c.data ?? []) as Category[]);
      setGameCategory(new Map((gc.data ?? []).map((r) => [r.game_key as string, r.category_id as number])));
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
      const { user } = await callAdmin<{ user: { id: string } }>({ action: "create", username, password, role });
      if (newGroups.size) {
        await check(supabase.from("user_groups").insert(
          [...newGroups].map((group_id) => ({ user_id: user.id, group_id })),
        ));
      }
      setUsername("");
      setPassword("");
      setRole("user");
      setNewGroups(new Set());
    }, `User "${username}" angelegt`);
  };

  const toggleUserGroup = (u: Profile, g: Group) => {
    const on = userGroups.has(pairKey(u.id, g.id));
    run(
      () => check(on
        ? supabase.from("user_groups").delete().eq("user_id", u.id).eq("group_id", g.id)
        : supabase.from("user_groups").insert({ user_id: u.id, group_id: g.id })),
      `${u.username} ${on ? "aus" : "zu"} „${g.name}“ ${on ? "entfernt" : "hinzugefügt"}`,
    );
  };

  const toggleGameGroup = (gameKey: string, title: string, g: Group) => {
    const on = gameGroups.has(pairKey(gameKey, g.id));
    run(
      () => check(on
        ? supabase.from("game_groups").delete().eq("game_key", gameKey).eq("group_id", g.id)
        : supabase.from("game_groups").insert({ game_key: gameKey, group_id: g.id })),
      `${title} für „${g.name}“ ${on ? "gesperrt" : "freigegeben"}`,
    );
  };

  const onCreateGroup = (e: FormEvent) => {
    e.preventDefault();
    const name = groupName.trim();
    run(async () => {
      await check(supabase.from("groups").insert({ name }));
      setGroupName("");
    }, `Gruppe „${name}“ angelegt`);
  };

  const onDeleteGroup = (g: Group) => {
    if (window.confirm(`Gruppe „${g.name}“ löschen? Alle Zuordnungen dieser Gruppe gehen verloren.`)) {
      run(() => check(supabase.from("groups").delete().eq("id", g.id)), `Gruppe „${g.name}“ gelöscht`);
    }
  };

  const catLabel = (c: Category) => `${c.emoji ? c.emoji + " " : ""}${c.name}`;

  const setCategory = (gameKey: string, title: string, value: string) => {
    const cat = categories.find((c) => String(c.id) === value);
    run(
      () => check(cat
        ? supabase.from("game_categories").upsert({ game_key: gameKey, category_id: cat.id })
        : supabase.from("game_categories").delete().eq("game_key", gameKey)),
      cat ? `${title} → „${cat.name}“` : `${title} hat keine Kategorie mehr`,
    );
  };

  const onCreateCategory = (e: FormEvent) => {
    e.preventDefault();
    const name = catName.trim();
    const sort_order = Math.max(0, ...categories.map((c) => c.sort_order)) + 10;
    run(async () => {
      await check(supabase.from("categories").insert({ name, emoji: catEmoji.trim(), sort_order }));
      setCatName("");
      setCatEmoji("");
    }, `Kategorie „${name}“ angelegt`);
  };

  const onDeleteCategory = (c: Category) => {
    if (window.confirm(`Kategorie „${c.name}“ löschen? Ihre Spiele haben dann keine Kategorie mehr.`)) {
      run(() => check(supabase.from("categories").delete().eq("id", c.id)), `Kategorie „${c.name}“ gelöscht`);
    }
  };

  const chips = (isOn: (g: Group) => boolean, onToggle: (g: Group) => void) => (
    <div className="chips">
      {groups.map((g) => (
        <button
          key={g.id}
          type="button"
          className={isOn(g) ? "chip on" : "chip"}
          aria-pressed={isOn(g)}
          onClick={() => onToggle(g)}
        >
          {g.name}
        </button>
      ))}
    </div>
  );

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
      <AdminTabs />
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
        {groups.length > 0 && (
          <div className="form-groups">
            <span className="muted">Gruppen:</span>
            {chips(
              (g) => newGroups.has(g.id),
              (g) => setNewGroups((s) => {
                const n = new Set(s);
                if (n.has(g.id)) n.delete(g.id); else n.add(g.id);
                return n;
              }),
            )}
          </div>
        )}
      </form>

      {msg && <p className={msg.ok ? "success" : "error"}>{msg.text}</p>}

      <table>
        <thead>
          <tr><th>Username</th><th>Rolle</th><th>Gruppen</th><th>Angelegt</th><th></th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.role}</td>
              <td>{chips((g) => userGroups.has(pairKey(u.id, g.id)), (g) => toggleUserGroup(u, g))}</td>
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

      <h2 className="section">Gruppen &amp; Spiele</h2>
      <p className="muted">
        Ein Spieler sieht ein Spiel, wenn er in mindestens einer Gruppe ist, für die das Spiel
        freigegeben ist. Admins sehen immer alle Spiele.
      </p>

      <form onSubmit={onCreateGroup} className="row wrap">
        <input
          placeholder="Neue Gruppe, z.B. Klasse-3c"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          maxLength={40}
          required
        />
        <button>Gruppe anlegen</button>
      </form>

      <table>
        <thead>
          <tr><th>Spiel</th><th>Kategorie</th><th>Freigegeben für</th></tr>
        </thead>
        <tbody>
          {GAMES.map((game) => (
            <tr key={game.key}>
              <td>{game.emoji} {game.title}</td>
              <td>
                <select
                  className="admin-select"
                  aria-label={`Kategorie für ${game.title}`}
                  value={gameCategory.get(game.key) ?? ""}
                  onChange={(e) => setCategory(game.key, game.title, e.target.value)}
                >
                  <option value="">– keine –</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{catLabel(c)}</option>)}
                </select>
              </td>
              <td>{chips((g) => gameGroups.has(pairKey(game.key, g.id)), (g) => toggleGameGroup(game.key, game.title, g))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table>
        <thead>
          <tr><th>Gruppe</th><th>Mitglieder</th><th></th></tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.id}>
              <td>{g.name}</td>
              <td className="muted">
                {users.filter((u) => userGroups.has(pairKey(u.id, g.id))).map((u) => u.username).join(", ") || "–"}
              </td>
              <td className="actions">
                <button className="danger" onClick={() => onDeleteGroup(g)}>Löschen</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="section">Kategorien</h2>
      <p className="muted">
        Die Übersicht zeigt die Spiele nach Kategorien (z. B. Schulfächer). Die Kategorie eines Spiels
        stellst du oben in der Tabelle der Spiele ein.
      </p>

      <form onSubmit={onCreateCategory} className="row wrap">
        <input
          placeholder="Emoji, z.B. 🎨"
          value={catEmoji}
          onChange={(e) => setCatEmoji(e.target.value)}
          maxLength={10}
          className="emoji-input"
          aria-label="Emoji"
        />
        <input
          placeholder="Neue Kategorie, z.B. Kunst"
          value={catName}
          onChange={(e) => setCatName(e.target.value)}
          maxLength={40}
          required
        />
        <button>Kategorie anlegen</button>
      </form>

      <table>
        <thead>
          <tr><th>Kategorie</th><th>Spiele</th><th></th></tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}>
              <td>{catLabel(c)}</td>
              <td className="muted">
                {GAMES.filter((g) => gameCategory.get(g.key) === c.id).map((g) => g.title).join(", ") || "–"}
              </td>
              <td className="actions">
                <button className="danger" onClick={() => onDeleteCategory(c)}>Löschen</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
