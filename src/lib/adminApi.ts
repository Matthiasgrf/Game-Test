import { supabase } from "./supabase";

// Ruft die Edge Function "admin-users" auf. supabase.functions.invoke schickt
// automatisch das JWT des eingeloggten Users mit; die Function prueft Rolle + MFA.
export async function callAdminApi<T = unknown>(body: Record<string, unknown>): Promise<T> {
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

export const PASSWORD_MIN = 12;

// Zufaelliges Startpasswort (kryptografisch sicher), ohne verwechselbare Zeichen
export function generatePassword(length = 16): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_";
  const out: string[] = [];
  const buf = new Uint32Array(1);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    // Rejection Sampling gegen Modulo-Bias
    if (buf[0] < Math.floor(2 ** 32 / chars.length) * chars.length) {
      out.push(chars[buf[0] % chars.length]);
    }
  }
  return out.join("");
}
