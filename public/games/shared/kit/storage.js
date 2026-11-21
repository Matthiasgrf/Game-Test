/* Speicher-Schicht – die einzige Stelle, die weiß, wohin Ergebnisse, Spielstände und Einstellungen gehen.
   Heute: läuft das Spiel in der App (iframe), gehen sie über game-test.js an die App und von dort in die
   Datenbank (Supabase, pro Spieler). Allein geöffnet (ohne App) landet alles in localStorage.
   Soll später etwas anderes speichern, wird nur diese Datei ausgetauscht – die Spiele bleiben gleich.

   const store = createStorage('mein-spiel', { saveKey: 'mein_spiel_v1' });
   store.saveScore({ points, maxPoints?, seconds?, variant? })   Ergebnis für die Bestenliste (am Spielende)
   await store.getScores({ variant? })                           eigene Ergebnisse [{ points, maxPoints, seconds, variant }]
   store.saveProgress(daten) / store.loadProgress()             Spielstand (Objekt). Damit er pro Spieler in der
                                                                Datenbank landet: "saveKey" in games.json eintragen.
   store.setting(name, standard) / store.setSetting(name, wert)  kleine Einstellungen nur auf diesem Gerät

   Regeln: Highscores nie in den Spielstand (sie gehören in saveScore). Keine persönlichen Daten speichern. */

const read = (key) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
};

export function createStorage(gameKey, { saveKey = `${gameKey}:stand` } = {}) {
  const GT = () => window.GameTest;
  const embedded = () => !!(GT() && GT().embedded);
  const localScores = `${gameKey}:ergebnisse`;
  const settingsKey = `${gameKey}:einstellungen`;

  return {
    get embedded() { return embedded(); },

    saveScore(result) {
      const r = {
        points: Math.max(0, Math.round(result.points)),
        maxPoints: result.maxPoints == null ? undefined : Math.round(result.maxPoints),
        seconds: result.seconds == null ? undefined : Math.max(0, Math.round(result.seconds)),
        variant: result.variant || undefined,
      };
      if (embedded()) { GT().reportScore(r); return; }
      const list = read(localScores) || [];
      list.push({ ...r, at: new Date().toISOString() });
      write(localScores, list.slice(-50));
    },

    async getScores({ variant } = {}) {
      let list;
      if (embedded() && GT().getScores) list = await GT().getScores();
      else list = read(localScores) || [];
      return list.filter((s) => variant === undefined || (s.variant || '') === variant);
    },

    saveProgress(data) {
      write(saveKey, data);
      if (embedded() && GT().saveState) GT().saveState(data);
    },

    loadProgress() { return read(saveKey); },

    setting(name, fallback) {
      const s = read(settingsKey) || {};
      return name in s ? s[name] : fallback;
    },
    setSetting(name, value) {
      const s = read(settingsKey) || {};
      s[name] = value;
      write(settingsKey, s);
    },
  };
}
