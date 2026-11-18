# Security-Review: Game-Test (Fokus Login)

Stand: 2026-11-18 · Geprüft: `src/**`, `supabase/migrations/*`, `supabase/functions/admin-users`,
`.github/workflows/*`, Live-Projekt per Supabase-Advisor.

## Reifegrad (Skala 1–5, angelehnt an OWASP ASVS)

| Bereich | vorher | nachher | Was hat sich geändert |
|---|---|---|---|
| Autorisierung / RLS | 4 | 4–5 | Datensparsamkeit: nur eigene Profile/Scores lesbar, Highscores per Funktion |
| Secrets-Management | 4 | 4 | unverändert gut (Service-Role-Key nur serverseitig) |
| Authentifizierung (Login) | 2 | 3–4 | MFA-Pflicht für Admins, 12+ Zeichen, Zufalls-Startpasswörter mit Änderungspflicht; *Leaked-Password-Schutz/CAPTCHA = Dashboard-Einstellung* |
| Session-Management | 2–3 | 3 | CSP gegen XSS-Token-Diebstahl, globaler Logout; Token weiterhin in `localStorage` (Supabase-Standard für SPAs) |
| Datenintegrität (Spiel) | 1 | 4 | Spiel-Logik und Score-Vergabe in der DB, Rate-Limit 30 Runden/h |
| Logging / Audit | 1 | 3 | `admin_audit_log` für alle Admin- und Passwort-Aktionen inkl. abgelehnter Versuche |
| Supply Chain / CI | 2 | 3 | Least-Privilege pro Job, `npm audit`, Dependabot, CodeQL, gepinnter Edge-Import |
| **Gesamt** | **≈ 2,5** | **≈ 3,5** | |

## Befunde und Status

| # | Schwere | Befund | Status |
|---|---|---|---|
| 1 | Hoch | Kein MFA, auch nicht für Admins | ✅ Admin-Aktionen erfordern `aal2`; MFA-Gate im Frontend |
| 2 | Hoch | Passwort-Policy nur ≥ 8; Leaked Password Protection aus (Advisor-WARN) | ✅ ≥ 12 im Code · ⚠️ Dashboard-Schalter manuell (README Schritt 4) |
| 3 | Hoch | Highscores fälschbar (Client meldet Versuche) | ✅ `start_round()`/`guess()` serverseitig, kein direkter Insert mehr |
| 4 | Mittel | Brute-Force/Spraying; Usernamen + Rollen für alle sichtbar | ✅ Profile nur eigene Zeile · ⚠️ CAPTCHA optional (README Schritt 6) |
| 5 | Mittel | Kein CSP, Token in `localStorage` | ✅ CSP-Meta im Build · ℹ️ `localStorage` bleibt (SPA ohne Backend) |
| 6 | Mittel | Admin kennt/vergibt Klartext-Passwörter, `window.prompt` | ✅ Zufallspasswort, einmalig angezeigt, Änderungspflicht |
| 7 | Mittel | Keine Audit-Logs | ✅ `admin_audit_log` |
| 8 | Mittel | Admin kann andere Admins löschen/übernehmen | ✅ serverseitig gesperrt (nur Dashboard) |
| 9 | Niedrig | Rohe Fehlermeldungen nach außen | ✅ generisch, Details nur im Function-Log |
| 10 | Niedrig | CORS `*` | ✅ Allowlist (`ALLOWED_ORIGINS`) |
| 11 | Niedrig | `userId` nicht validiert | ✅ UUID-Prüfung, 404 bei unbekanntem User |
| 12 | Niedrig | CI-Rechte zu breit, Imports ungepinnt | ✅ Rechte pro Job, Edge-Import exakt gepinnt · ℹ️ Actions noch per Tag (Dependabot aktualisiert) |
| 13 | Niedrig | Score-Spam | ✅ nur noch über Spiel, 30 Runden/h |

### Bereits vorher gut
- `verify_jwt` aktiv + eigener `getUser`-Check, Rolle aus der DB, Self-Delete verhindert.
- Signups aus; Rolle nur über `app_metadata`; Trigger `security definer` mit leerem `search_path`.
- Login-Fehlermeldung verrät nicht, ob ein Username existiert.

## Offene Punkte / Restrisiko
- Dashboard: Leaked Password Protection, Passwortregeln, ggf. CAPTCHA (siehe README).
- Bestehende Admins müssen beim nächsten Login MFA einrichten – vorher sind Admin-Aktionen gesperrt.
- Bestehende User haben kein `must_change_password` – sie behalten ihr Passwort.
- GitHub Actions per Commit-SHA pinnen (höchste Supply-Chain-Stufe).
- CodeQL läuft bei privaten Repos nur mit GitHub Advanced Security.
