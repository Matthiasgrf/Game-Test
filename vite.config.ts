import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative Asset-Pfade: funktioniert lokal und unter
// https://<user>.github.io/Game-Test/ (HashRouter braucht kein Server-Routing).
export default defineConfig({
  plugins: [react()],
  base: "./",
});
