import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";

export default function Login() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(await signIn(username, password));
    setBusy(false);
  };

  return (
    <main className="card narrow">
      <h1>Game-Test</h1>
      <p className="muted">Zugangsdaten erhältst du vom Admin.</p>
      <form onSubmit={onSubmit}>
        <label>
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Passwort
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? "…" : "Einloggen"}</button>
      </form>
    </main>
  );
}
