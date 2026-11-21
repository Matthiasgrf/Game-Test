import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!url || !key) {
  throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY fehlen (.env.local)");
}

export const supabase = createClient(url, key);

// Supabase Auth arbeitet mit E-Mails. Wir zeigen dem User nur einen Username
// und bilden ihn intern auf eine Pseudo-E-Mail ab.
export const EMAIL_DOMAIN = "game-test.local";
export const usernameToEmail = (username: string) =>
  `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;

export type Role = "admin" | "user";
export interface Profile {
  id: string;
  username: string;
  role: Role;
  created_at: string;
}

export interface Group {
  id: number;
  name: string;
}
