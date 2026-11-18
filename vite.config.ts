import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Content-Security-Policy als <meta>-Tag: GitHub Pages erlaubt keine eigenen
// HTTP-Header. Nur im Production-Build, weil der Vite-Dev-Server Inline-Skripte
// (React Refresh) nutzt. Hinweis: frame-ancestors/X-Frame-Options lassen sich
// per <meta> nicht setzen.
function csp(supabaseUrl: string): Plugin {
  const host = supabaseUrl ? new URL(supabaseUrl).host : "";
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:", // data: fuer den MFA-QR-Code
    `connect-src 'self' https://${host} wss://${host}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: policy }, injectTo: "head" },
      { tag: "meta", attrs: { name: "referrer", content: "no-referrer" }, injectTo: "head" },
    ],
  };
}

// Relative Asset-Pfade: funktioniert lokal und unter
// https://<user>.github.io/Game-Test/ (HashRouter braucht kein Server-Routing).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  return {
    plugins: [react(), csp(env.VITE_SUPABASE_URL ?? "")],
    base: "./",
  };
});
