// Statische HTML-Spiele unter public/games/. Vite kopiert public/ unveraendert
// in den Build, die Spiele laufen eigenstaendig im iframe.
export interface StaticGame {
  id: string;
  title: string;
  description: string;
  source: string; // Herkunft (Repository / Datei)
  file: string; // Pfad relativ zur App (base "./")
}

export const staticGames: StaticGame[] = [
  {
    id: "getreide-3d-adaptiv",
    title: "3D Getreide-Abenteuer (adaptiv)",
    description:
      "10 Stationen rund ums Getreide. Steuerung per Tastatur (PC) oder Tippen (Tablet/Handy).",
    source: "3c-Sachunterricht · index.html",
    file: "games/3c-sachunterricht/getreide-3d-adaptiv.html",
  },
  {
    id: "getreide-v2",
    title: "3D Getreide-Abenteuer (Version 2)",
    description: "Frühere Fassung des Getreide-Spiels für die 3. Klasse, Steuerung per Tastatur.",
    source: "3c-Sachunterricht · getreide-spiel-v2.html",
    file: "games/3c-sachunterricht/getreide-v2.html",
  },
];
