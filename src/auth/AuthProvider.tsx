import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, usernameToEmail, type Profile } from "../lib/supabase";

type Aal = string | null; // "aal1" | "aal2"

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** aktuelles und erreichbares Authentisierungs-Level (MFA) */
  aal: { current: Aal; next: Aal };
  /** Admin hat Start-/Reset-Passwort vergeben -> User muss es aendern */
  mustChangePassword: boolean;
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshAal: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [aal, setAal] = useState<{ current: Aal; next: Aal }>({ current: null, next: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshAal = useCallback(async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setAal({ current: data?.currentLevel ?? null, next: data?.nextLevel ?? null });
  }, []);

  // Profil (Username + Rolle) und MFA-Level laden, sobald sich die Session aendert
  const userId = session?.user.id;
  const accessToken = session?.access_token;
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setAal({ current: null, next: null });
      return;
    }
    setLoading(true);
    Promise.all([
      supabase
        .from("profiles")
        .select("id, username, role, created_at")
        .eq("id", userId)
        .single()
        .then(({ data }) => setProfile(data as Profile | null)),
      refreshAal(),
    ]).finally(() => setLoading(false));
  }, [userId, accessToken, refreshAal]);

  const signIn = async (username: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    // bewusst generisch: verraet nicht, ob der Username existiert
    return error ? "Username oder Passwort falsch" : null;
  };

  const signOut = async () => {
    // beendet alle Sessions des Users (auch auf anderen Geraeten)
    await supabase.auth.signOut({ scope: "global" });
  };

  const mustChangePassword = session?.user.app_metadata?.must_change_password === true;

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, aal, mustChangePassword, signIn, signOut, refreshAal }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von <AuthProvider> verwendet werden");
  return ctx;
}
