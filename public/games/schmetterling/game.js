/* Flatter, der Schmetterling – Spiellogik (Regeln: docs/GAME_STANDARD.md).

   Ablauf: Start → Flatter fliegt über eine 3D-Blumenwiese (Three.js) → Münzen sammeln, durch Herzen fliegen,
   Quallen schnappen, Einhörner finden (dann hilft der Fuchs und frisst Quallen) → 4 Zauberblumen mit Aufgaben:
   2 × Tier-Memory (5 × 4 Karten) und 2 × Labyrinth → alle gelöst = Gewinn-Bildschirm mit Punkten.

   Punkte (mehr ist besser, bei Gleichstand zählt die kürzere Zeit):
     Münze 10 · Herz 20 · Qualle 25 (auch die vom Fuchs) · Einhorn 50
     Memory bis 150 (150, ab 11 Zügen 5 weniger je Zug, mindestens 50)
     Labyrinth bis 150 (100 + 50 bei kurzem Weg, + 25 bei mittlerem Weg)
   Quallen, die Flatter berühren, ohne geschnappt zu werden, kosten ein Herz – Punkte gehen nie verloren.
   Sind alle Herzen weg, ruht Flatter kurz aus und bekommt 3 Herzen zurück (kein Spielende, kein Zeitdruck). */
import { startKit, createLoop, createQuality, board } from '../shared/kit/kit.js';

const THREE = window.THREE;
const $ = (id) => document.getElementById(id);
const TEST = /[?&]test\b/.test(location.search);

/* ---------- Einstellungen ---------- */
const WELT_R = 62;            // Radius der Wiese, auf der Flatter fliegen kann
const FLUG_Y = 2.3;           // Flughöhe
const TEMPO = 7.5;            // Fluggeschwindigkeit (Einheiten/s)
const DREHEN = 2.4;           // Drehgeschwindigkeit (rad/s)
const HERZ_MAX = 5;
const FUCHS_ZEIT = 60;        // so lange hilft der Fuchs (s)
const PUNKTE = { muenze: 10, herz: 20, qualle: 25, einhorn: 50 };
const ANZAHL = { muenzen: 40, herzen: 8, quallen: 12, einhoerner: 3 };
const AUFGABEN = ['memory', 'labyrinth', 'memory', 'labyrinth'];
const MAX_PUNKTE = ANZAHL.muenzen * PUNKTE.muenze + ANZAHL.herzen * PUNKTE.herz + ANZAHL.quallen * PUNKTE.qualle
  + ANZAHL.einhoerner * PUNKTE.einhorn + AUFGABEN.length * 150;
const TIERE = ['🐶', '🐱', '🐰', '🐻', '🦁', '🐸', '🐵', '🐼', '🐷', '🐮', '🐯', '🐨', '🦊', '🐔', '🐧', '🐢', '🐘', '🦒', '🐴', '🐭'];
const TIER_NAMEN = { '🐶': 'Hund', '🐱': 'Katze', '🐰': 'Hase', '🐻': 'Bär', '🦁': 'Löwe', '🐸': 'Frosch', '🐵': 'Affe', '🐼': 'Panda',
  '🐷': 'Schwein', '🐮': 'Kuh', '🐯': 'Tiger', '🐨': 'Koala', '🦊': 'Fuchs', '🐔': 'Huhn', '🐧': 'Pinguin', '🐢': 'Schildkröte',
  '🐘': 'Elefant', '🦒': 'Giraffe', '🐴': 'Pferd', '🐭': 'Maus' };

/* Fokus von versteckten Knöpfen nehmen, sonst landet die Leertaste dort statt beim Schnappen */
const fokusWeg = () => { const a = document.activeElement; if (a && a !== document.body && a.blur) a.blur(); };
const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
const mischen = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const winkelDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/* ---------- Kit ---------- */
const kit = startKit({
  key: 'schmetterling',
  orientation: 'any',
  pause: () => { S.pausiertSeit = performance.now(); loop.pause(); },
  resume: () => { S.start += performance.now() - S.pausiertSeit; loop.resume(); fokusWeg(); },
});
const { input, sound, viewport } = kit;

/* ---------- Zustand ---------- */
const S = {
  phase: 'menu',        // menu | play | memory | labyrinth | geschafft | ende
  punkte: 0,
  liste: { muenzen: 0, herzen: 0, quallen: 0, fuchs: 0, einhoerner: 0, memory: 0, labyrinth: 0 },
  herzen: 3,
  geloest: 0,
  start: 0,
  pausiertSeit: 0,
  sekunden: 0,
  zeit: 0,
  schnapp: 0,           // > 0: Flatter schnappt gerade
  schnappPause: 0,
  unverwundbar: 0,
  ausruhen: 0,
  fuchs: 0,             // verbleibende Zeit des Fuchses
  aufgabe: -1,          // Nummer der offenen Zauberblume
};

/* ===================================================================================
   3D-Welt
   =================================================================================== */
const canvas = $('szene');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) {
  $('fehler3d').hidden = false;
  document.querySelector('[data-action="start"]').disabled = true;
}
const quality = renderer ? createQuality({ renderer, maxPixelRatio: 2, onChange: (s) => { if (s >= 2) wolken.visible = false; } }) : null;
if (renderer) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

const scene = new THREE.Scene();
const HIMMEL = 0xbfe6ff;
scene.fog = new THREE.Fog(HIMMEL, 55, 150);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
scene.add(new THREE.HemisphereLight(0xfff6ff, 0x6fae4a, 0.85));
const sonne = new THREE.DirectionalLight(0xfff1d6, 0.55);
sonne.position.set(30, 60, 20);
scene.add(sonne);

/* Himmel: große Kugel mit Farbverlauf */
{
  const geo = new THREE.SphereGeometry(300, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { oben: { value: new THREE.Color(0x5fb8ff) }, unten: { value: new THREE.Color(0xfde8ff) } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 oben; uniform vec3 unten; varying float h; void main(){ gl_FragColor = vec4(mix(unten, oben, smoothstep(-0.05, 0.45, h)), 1.0); }',
  });
  scene.add(new THREE.Mesh(geo, mat));
}

const mats = {};
const lambert = (color, extra = {}) => {
  const k = color + JSON.stringify(extra);
  return mats[k] || (mats[k] = new THREE.MeshLambertMaterial({ color, ...extra }));
};
const kugel = (r, color, x, y, z, parent, seg = 14) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7 | 0)), typeof color === 'number' ? lambert(color) : color);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};
const zylinder = (rt, rb, h, color, x, y, z, parent, seg = 10) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof color === 'number' ? lambert(color) : color);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};

/* Mehrere Formen zu einer Geometrie mit Farben je Ecke verschmelzen (wenige Zeichenaufrufe) */
function verschmelzen(teile) {
  const pos = [], nor = [], col = [];
  for (const t of teile) {
    const g = t.geo.index ? t.geo.toNonIndexed() : t.geo;
    g.applyMatrix4(t.matrix);
    const P = g.attributes.position.array, N = g.attributes.normal.array, c = new THREE.Color(t.color);
    for (let i = 0; i < P.length; i += 3) {
      pos.push(P[i], P[i + 1], P[i + 2]); nor.push(N[i], N[i + 1], N[i + 2]);
      const v = t.vary ? 1 + (Math.random() - 0.5) * t.vary : 1;
      col.push(c.r * v, c.g * v, c.b * v);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
const matrix = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz));
const farbMat = new THREE.MeshLambertMaterial({ vertexColors: true });

/* Weicher runder Schatten (Textur), unter allen Figuren */
const schattenTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, 'rgba(20,50,10,0.55)'); grad.addColorStop(1, 'rgba(20,50,10,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const schattenMat = new THREE.MeshBasicMaterial({ map: schattenTex, transparent: true, depthWrite: false });
const schattenGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function schatten(groesse) {
  const m = new THREE.Mesh(schattenGeo, schattenMat);
  m.scale.set(groesse, 1, groesse);
  m.position.y = 0.03;
  m.renderOrder = 1;
  scene.add(m);
  return m;
}

/* Glitzer-Sterne (für Einsammeln und Zauberblumen) */
const glitzerTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,240,170,0.9)'); grad.addColorStop(1, 'rgba(255,200,240,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 6 : 30; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
  g.fill();
  return new THREE.CanvasTexture(c);
})();
const funken = [];
for (let i = 0; i < 40; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glitzerTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.visible = false;
  scene.add(s);
  funken.push({ s, t: 0, v: new THREE.Vector3() });
}
let funkeNr = 0;
function glitzern(pos, n = 10, farbe = 0xffffff) {
  for (let i = 0; i < n; i++) {
    const f = funken[funkeNr++ % funken.length];
    f.s.visible = true; f.t = 0.8;
    f.s.position.copy(pos);
    f.s.material.color.setHex(farbe);
    f.v.set(rnd(-3, 3), rnd(1, 4), rnd(-3, 3));
  }
}

/* ---------- Wiese, Hügel, Bäume, Blumen, Wolken ---------- */
{
  const geo = new THREE.PlaneGeometry(440, 440, 110, 110);
  geo.rotateX(-Math.PI / 2);
  const P = geo.attributes.position, col = [];
  const a = new THREE.Color(0x7cc95a), b = new THREE.Color(0x5fae45), hell = new THREE.Color(0xb5dc6a), dunkel = new THREE.Color(0x3f8f3a), c = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), z = P.getZ(i);
    c.copy(a).lerp(b, 0.5 + 0.5 * Math.sin(x * 0.11) * Math.cos(z * 0.13));
    c.lerp(hell, Math.max(0, Math.sin(x * 0.045 + 1) * Math.sin(z * 0.05)) * 0.45);   // sonnige, gelbliche Flecken
    c.lerp(dunkel, Math.max(0, Math.cos(x * 0.07) * Math.sin(z * 0.06 + 2)) * 0.35);  // schattige Senken
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(geo, farbMat));

  /* Hügel am Rand */
  const teile = [];
  for (let i = 0; i < 16; i++) {
    const w = i / 16 * Math.PI * 2 + rnd(-0.1, 0.1), r = WELT_R + rnd(16, 30);
    teile.push({ geo: new THREE.SphereGeometry(1, 16, 10), matrix: matrix(Math.sin(w) * r, -3, Math.cos(w) * r, rnd(18, 30), rnd(8, 15), rnd(18, 30)), color: i % 2 ? 0x6cbf4f : 0x58a83f, vary: 0.08 });
  }
  /* Bäume außerhalb der Flugfläche und ein paar darin */
  const baum = (x, z, s) => {
    teile.push({ geo: new THREE.CylinderGeometry(0.28, 0.4, 2.6, 7), matrix: matrix(x, 1.3 * s, z, s, s, s), color: 0x8a5a33 });
    teile.push({ geo: new THREE.SphereGeometry(1.5, 10, 8), matrix: matrix(x, 3.3 * s, z, s, s, s), color: 0x3f9c3a, vary: 0.15 });
    teile.push({ geo: new THREE.SphereGeometry(1.1, 10, 8), matrix: matrix(x + 0.7 * s, 4.1 * s, z + 0.2 * s, s, s, s), color: 0x4fb246, vary: 0.15 });
    teile.push({ geo: new THREE.SphereGeometry(1.0, 10, 8), matrix: matrix(x - 0.6 * s, 4.0 * s, z - 0.3 * s, s, s, s), color: 0x47a840, vary: 0.15 });
  };
  for (let i = 0; i < 30; i++) {
    const w = rnd(0, Math.PI * 2), r = WELT_R + rnd(3, 18);
    baum(Math.sin(w) * r, Math.cos(w) * r, rnd(1.1, 1.8));
  }
  scene.add(new THREE.Mesh(verschmelzen(teile), farbMat));
}
const baeume = [];   // Bäume in der Wiese (Flatter fliegt um die Stämme herum)
const blumenFarben = [0xff6fb5, 0xffd43b, 0xffffff, 0xb197fc, 0xff8787, 0x74c0fc];
{
  const teile = [];
  for (let i = 0; i < 9; i++) {
    const w = i / 9 * Math.PI * 2 + rnd(0, 0.5), r = rnd(14, 52), x = Math.sin(w) * r, z = Math.cos(w) * r, s = rnd(1, 1.4);
    baeume.push({ x, z, r: 1.4 * s });
    teile.push({ geo: new THREE.CylinderGeometry(0.28, 0.42, 3.2, 7), matrix: matrix(x, 1.6 * s, z, s, s, s), color: 0x8a5a33 });
    teile.push({ geo: new THREE.SphereGeometry(1.8, 12, 9), matrix: matrix(x, 4.4 * s, z, s, s, s), color: 0x3f9c3a, vary: 0.15 });
    teile.push({ geo: new THREE.SphereGeometry(1.3, 10, 8), matrix: matrix(x + 0.9 * s, 5.3 * s, z + 0.3 * s, s, s, s), color: 0x55b84b, vary: 0.15 });
    teile.push({ geo: new THREE.SphereGeometry(1.2, 10, 8), matrix: matrix(x - 0.8 * s, 5.0 * s, z - 0.4 * s, s, s, s), color: 0x48aa41, vary: 0.15 });
    /* rote Äpfel */
    for (let k = 0; k < 4; k++) teile.push({ geo: new THREE.SphereGeometry(0.16, 6, 5), matrix: matrix(x + rnd(-1.4, 1.4) * s, rnd(3.6, 5) * s, z + rnd(-1.4, 1.4) * s), color: 0xe03131 });
  }
  /* Blumen: Stiel + Blüte, viele in wenigen Zeichenaufrufen */
  for (let i = 0; i < 260; i++) {
    const w = rnd(0, Math.PI * 2), r = Math.sqrt(Math.random()) * (WELT_R + 8), x = Math.sin(w) * r, z = Math.cos(w) * r, h = rnd(0.35, 0.8);
    teile.push({ geo: new THREE.CylinderGeometry(0.03, 0.03, h, 4), matrix: matrix(x, h / 2, z), color: 0x2f9e44 });
    const farbe = blumenFarben[i % blumenFarben.length];
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2;
      teile.push({ geo: new THREE.SphereGeometry(0.11, 6, 4), matrix: matrix(x + Math.cos(a) * 0.12, h, z + Math.sin(a) * 0.12, 1, 0.45, 1), color: farbe, vary: 0.1 });
    }
    teile.push({ geo: new THREE.SphereGeometry(0.08, 6, 4), matrix: matrix(x, h + 0.03, z), color: 0xffd43b });
  }
  /* Grasbüschel */
  for (let i = 0; i < 220; i++) {
    const w = rnd(0, Math.PI * 2), r = Math.sqrt(Math.random()) * (WELT_R + 10);
    teile.push({ geo: new THREE.ConeGeometry(0.18, rnd(0.4, 0.8), 4), matrix: matrix(Math.sin(w) * r, 0.25, Math.cos(w) * r, 1, 1, 1, rnd(0, 3)), color: 0x4f9e36, vary: 0.2 });
  }
  scene.add(new THREE.Mesh(verschmelzen(teile), farbMat));
}
const wolken = new THREE.Group();
{
  const teile = [];
  for (let i = 0; i < 12; i++) {
    const w = i / 12 * Math.PI * 2, r = rnd(70, 120), x = Math.sin(w) * r, z = Math.cos(w) * r, y = rnd(22, 34);
    for (let k = 0; k < 4; k++) teile.push({ geo: new THREE.SphereGeometry(rnd(3, 5), 10, 8), matrix: matrix(x + k * 3.2 - 5, y + rnd(-1, 1), z + rnd(-1.5, 1.5), 1, 0.65, 1), color: 0xffffff });
  }
  wolken.add(new THREE.Mesh(verschmelzen(teile), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x777777, fog: false })));
  scene.add(wolken);
}

/* ---------- Flatter, der Schmetterling ---------- */
/* Flügel als Form (Shape) mit gemalter Textur: Verlauf, Punkte, dunkler Rand */
function fluegelGeo(punkte) {
  const form = new THREE.Shape();
  form.moveTo(punkte[0][0], punkte[0][1]);
  for (let i = 1; i < punkte.length; i += 3) form.bezierCurveTo(...punkte[i], ...punkte[i + 1], ...punkte[i + 2]);
  const geo = new THREE.ShapeGeometry(form, 16);
  geo.computeBoundingBox();
  const bb = geo.boundingBox, P = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < P.count; i++) uv.setXY(i, (P.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (P.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
  return { geo, bb, form };
}
function fluegelTex({ form, bb }, farben, punkteFarbe) {
  const W = 256, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const X = (x) => (x - bb.min.x) / (bb.max.x - bb.min.x) * W;
  const Y = (y) => (1 - (y - bb.min.y) / (bb.max.y - bb.min.y)) * H;
  g.beginPath();
  for (const p of form.getPoints(40)) g.lineTo(X(p.x), Y(p.y));
  g.closePath();
  const grad = g.createRadialGradient(X(0), Y(0), 10, X(0), Y(0), W * 1.05);
  farben.forEach((f, i) => grad.addColorStop(i / (farben.length - 1), f));
  g.fillStyle = grad; g.fill();
  g.save(); g.clip();
  /* Adern */
  g.strokeStyle = 'rgba(60,20,80,0.35)'; g.lineWidth = 4;
  for (const p of form.getPoints(10).filter((_, i) => i % 2)) { g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(p.x * 0.85), Y(p.y * 0.85)); g.stroke(); }
  /* Punkte nahe am Rand */
  for (const p of form.getPoints(16).slice(2, -2)) {
    g.fillStyle = punkteFarbe;
    g.beginPath(); g.arc(X(p.x * 0.8), Y(p.y * 0.8), 9, 0, Math.PI * 2); g.fill();
  }
  const auge = form.getPoints(8)[4];
  g.fillStyle = '#3b1f5c'; g.beginPath(); g.arc(X(auge.x * 0.55), Y(auge.y * 0.55), 22, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffe066'; g.beginPath(); g.arc(X(auge.x * 0.55), Y(auge.y * 0.55), 13, 0, Math.PI * 2); g.fill();
  g.restore();
  g.lineWidth = 12; g.strokeStyle = '#3b1f5c'; g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 2;
  return tex;
}
/* Form in Flügel-Koordinaten: x nach außen, y nach hinten (wird zu -z gedreht → vorne ist y negativ) */
const OBEN = fluegelGeo([[0, 0.1], [0.2, -0.9], [1.4, -1.35], [1.55, -0.7], [1.65, -0.25], [1.2, 0.15], [0, 0.18]]);
const UNTEN = fluegelGeo([[0, 0.05], [0.5, 0.05], [1.25, 0.2], [1.1, 0.75], [0.95, 1.25], [0.25, 1.1], [0, 0.4]]);
const fluegelMat = (tex) => new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, alphaTest: 0.4, emissive: 0x331133 });
const flatter = new THREE.Group();
const fluegel = [];
{
  const matO = fluegelMat(fluegelTex(OBEN, ['#fff3b0', '#ff9ad5', '#c86bfa', '#7a4bd6'], '#ffffff'));
  const matU = fluegelMat(fluegelTex(UNTEN, ['#fff3b0', '#ffb86b', '#ff6fb5', '#c43d8f'], '#ffffff'));
  for (const seite of [1, -1]) {
    const pivot = new THREE.Group();
    for (const [teil, mat] of [[OBEN, matO], [UNTEN, matU]]) {
      const m = new THREE.Mesh(teil.geo, mat);
      m.rotation.x = -Math.PI / 2;      // Form liegt flach: y → -z
      pivot.add(m);
    }
    pivot.scale.x = seite;               // linke Seite gespiegelt
    pivot.position.set(seite * 0.07, 0.05, 0);
    flatter.add(pivot);
    fluegel.push({ pivot, seite });
  }
  /* Körper, Kopf mit großen Augen, Fühler */
  const koerperMat = new THREE.MeshLambertMaterial({ color: 0x5b2c83 });
  const koerper = kugel(0.16, koerperMat, 0, 0, -0.25, flatter); koerper.scale.set(1, 1, 4.2);
  for (let i = 0; i < 4; i++) { const ring = kugel(0.165, 0xffd43b, 0, 0, -0.35 - i * 0.18, flatter, 10); ring.scale.set(1, 1, 0.25); }
  kugel(0.24, koerperMat, 0, 0.08, 0.42, flatter);
  for (const s of [1, -1]) {
    kugel(0.1, 0xffffff, s * 0.11, 0.17, 0.57, flatter, 10);
    kugel(0.055, 0x1b1b2f, s * 0.12, 0.18, 0.65, flatter, 8);
    kugel(0.05, 0xff8fb8, s * 0.17, 0.02, 0.6, flatter, 8);
    const fuehler = zylinder(0.018, 0.018, 0.7, 0x3b1f5c, s * 0.12, 0.55, 0.62, flatter, 5);
    fuehler.rotation.set(0.5, 0, -s * 0.35);
    kugel(0.07, 0xff6fb5, s * 0.25, 0.86, 0.8, flatter, 8);
  }
  flatter.scale.setScalar(0.85);
  scene.add(flatter);
}
const flatterSchatten = schatten(2.4);
const F = { x: 0, z: 0, rot: 0, y: FLUG_Y, tempo: 0 };

/* ---------- Münzen (ein Zeichenaufruf für alle) ---------- */
const muenzMat = new THREE.MeshPhongMaterial({ color: 0xffd43b, specular: 0xfff3b0, shininess: 60, emissive: 0xa86f00 });
const muenzGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20).rotateX(Math.PI / 2);
const muenzMesh = new THREE.InstancedMesh(muenzGeo, muenzMat, ANZAHL.muenzen);
scene.add(muenzMesh);
let muenzen = [];

/* ---------- Herzen zum Durchfliegen ---------- */
const herzForm = (() => {
  const s = new THREE.Shape();
  const herz = (sh, k) => {
    sh.moveTo(0, -1.0 * k);
    sh.bezierCurveTo(-0.2 * k, -0.75 * k, -1.1 * k, -0.35 * k, -1.05 * k, 0.25 * k);
    sh.bezierCurveTo(-1.0 * k, 0.85 * k, -0.25 * k, 1.0 * k, 0, 0.5 * k);
    sh.bezierCurveTo(0.25 * k, 1.0 * k, 1.0 * k, 0.85 * k, 1.05 * k, 0.25 * k);
    sh.bezierCurveTo(1.1 * k, -0.35 * k, 0.2 * k, -0.75 * k, 0, -1.0 * k);
  };
  herz(s, 1);
  const loch = new THREE.Path();
  herz(loch, 0.68);
  s.holes.push(loch);
  return s;
})();
const herzGeo = new THREE.ExtrudeGeometry(herzForm, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.07, bevelSegments: 3, curveSegments: 14 });
herzGeo.center();
const herzMat = new THREE.MeshStandardMaterial({ color: 0xff4f9a, emissive: 0x7a0838, roughness: 0.35, metalness: 0.1 });
let herzen = [];

/* ---------- Quallen ---------- */
const quallenFarben = [0xff9ad5, 0xb197fc, 0x74c0fc, 0xffa8a8];
function neueQualle() {
  const g = new THREE.Group();
  const farbe = quallenFarben[Math.floor(Math.random() * quallenFarben.length)];
  const hut = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhongMaterial({ color: farbe, emissive: farbe, emissiveIntensity: 0.25, transparent: true, opacity: 0.85, shininess: 80, side: THREE.DoubleSide }));
  hut.scale.y = 0.9;
  g.add(hut);
  const rand = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.08, 6, 18), lambert(farbe));
  rand.rotation.x = Math.PI / 2;
  g.add(rand);
  for (const s of [1, -1]) {
    kugel(0.13, 0xffffff, s * 0.25, 0.28, 0.55, g, 8);
    kugel(0.07, 0x1b1b2f, s * 0.25, 0.29, 0.66, g, 6);
    kugel(0.08, 0xff6f9a, s * 0.45, 0.12, 0.5, g, 6);
  }
  const arme = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const arm = new THREE.Group();
    arm.position.set(Math.cos(a) * 0.45, -0.05, Math.sin(a) * 0.45);
    const t = zylinder(0.05, 0.025, 1.1, farbe, 0, -0.55, 0, arm, 5);
    t.material = lambert(farbe, { transparent: true, opacity: 0.8 });
    g.add(arm);
    arme.push(arm);
  }
  scene.add(g);
  return { g, arme, schatten: schatten(1.6) };
}
let quallen = [];

/* ---------- Einhörner ---------- */
function neuesEinhorn() {
  const g = new THREE.Group();
  const weiss = 0xfdfbff;
  const k = kugel(0.7, weiss, 0, 1.25, 0, g, 14); k.scale.set(0.85, 0.75, 1.35);
  for (const [x, z] of [[0.35, 0.55], [-0.35, 0.55], [0.35, -0.55], [-0.35, -0.55]]) {
    zylinder(0.13, 0.11, 1.0, weiss, x, 0.5, z, g, 8);
    zylinder(0.14, 0.14, 0.14, 0xc9a2ff, x, 0.06, z, g, 8);
  }
  const hals = zylinder(0.25, 0.32, 0.9, weiss, 0, 1.75, 0.8, g, 10); hals.rotation.x = 0.55;
  const kopf = kugel(0.36, weiss, 0, 2.2, 1.12, g, 12); kopf.scale.set(0.9, 0.9, 1.3);
  kugel(0.2, 0xffd6ec, 0, 2.08, 1.48, g, 10);
  for (const s of [1, -1]) {
    kugel(0.07, 0x1b1b2f, s * 0.22, 2.32, 1.3, g, 8);
    const ohr = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 6), lambert(weiss));
    ohr.position.set(s * 0.17, 2.55, 0.98); g.add(ohr);
  }
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.6, 10), new THREE.MeshStandardMaterial({ color: 0xffd43b, metalness: 0.6, roughness: 0.25, emissive: 0x7a5a00 }));
  horn.position.set(0, 2.7, 1.25); horn.rotation.x = 0.45; g.add(horn);
  const regenbogen = [0xff6b6b, 0xffa94d, 0xffe066, 0x69db7c, 0x74c0fc, 0xb197fc];
  regenbogen.forEach((f, i) => {
    kugel(0.17, f, 0, 2.45 - i * 0.16, 0.85 - i * 0.12, g, 8);
    kugel(0.17, f, 0, 1.35 - i * 0.12, -0.95 - i * 0.08, g, 8);
  });
  scene.add(g);
  return { g, schatten: schatten(2.6) };
}
let einhoerner = [];

/* ---------- Fuchs (Helfer) ---------- */
const fuchs = new THREE.Group();
const fuchsBeine = [];
const fuchsSchwanz = new THREE.Group();
{
  const orange = 0xf08c2e, weiss = 0xfff4e6, dunkel = 0x3a2416;
  const k = kugel(0.5, orange, 0, 0.75, 0, fuchs, 14); k.scale.set(0.8, 0.75, 1.35);
  const bauch = kugel(0.4, weiss, 0, 0.6, 0.15, fuchs, 12); bauch.scale.set(0.75, 0.6, 1.1);
  for (const [x, z] of [[0.22, 0.4], [-0.22, 0.4], [0.22, -0.4], [-0.22, -0.4]]) {
    const bein = new THREE.Group(); bein.position.set(x, 0.55, z);
    zylinder(0.08, 0.07, 0.5, orange, 0, -0.25, 0, bein, 6);
    kugel(0.09, dunkel, 0, -0.5, 0.03, bein, 6);
    fuchs.add(bein); fuchsBeine.push(bein);
  }
  const kopf = kugel(0.38, orange, 0, 1.15, 0.65, fuchs, 14); kopf.scale.set(1, 0.9, 1);
  const schnauze = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 10), lambert(weiss));
  schnauze.rotation.x = Math.PI / 2; schnauze.position.set(0, 1.07, 1.05); fuchs.add(schnauze);
  kugel(0.06, dunkel, 0, 1.08, 1.28, fuchs, 8);
  for (const s of [1, -1]) {
    const ohr = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.35, 6), lambert(orange));
    ohr.position.set(s * 0.2, 1.5, 0.6); ohr.rotation.z = -s * 0.2; fuchs.add(ohr);
    kugel(0.065, dunkel, s * 0.14, 1.25, 0.95, fuchs, 8);
    kugel(0.025, 0xffffff, s * 0.12, 1.28, 0.99, fuchs, 6);
  }
  const schwanz = kugel(0.26, orange, 0, 0, -0.45, fuchsSchwanz, 12); schwanz.scale.set(1, 1, 2.2);
  kugel(0.18, weiss, 0, 0.05, -0.95, fuchsSchwanz, 10);
  fuchsSchwanz.position.set(0, 0.95, -0.5);
  fuchsSchwanz.rotation.x = -0.6;
  fuchs.add(fuchsSchwanz);
  fuchs.scale.setScalar(1.25);
  fuchs.visible = false;
  scene.add(fuchs);
}
const fuchsSchatten = schatten(2);
fuchsSchatten.visible = false;
const FX = { x: 0, z: 0, rot: 0, sprung: 0, ziel: null, frisst: 0, schritt: 0 };

/* ---------- Zauberblumen (Aufgaben) ---------- */
function symbolTex(text, farbe) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 56, 8, 64, 64, 62);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, farbe);
  g.fillStyle = grad; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
  g.lineWidth = 6; g.strokeStyle = '#ffffff'; g.stroke();
  g.font = '64px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 70);
  return new THREE.CanvasTexture(c);
}
const SYMBOL = { memory: symbolTex('🃏', '#c86bfa'), labyrinth: symbolTex('🌀', '#4dabf7'), fertig: symbolTex('✅', '#51cf66') };
let blumen = [];
function neueZauberblume(art, x, z, farbe) {
  const g = new THREE.Group();
  zylinder(0.18, 0.25, 3.2, 0x2f9e44, 0, 1.6, 0, g, 8);
  for (const s of [1, -1]) {
    const blatt = kugel(0.5, 0x40c057, s * 0.55, 1.0, 0, g, 10); blatt.scale.set(1.3, 0.25, 0.6); blatt.rotation.z = s * 0.4;
  }
  const kopf = new THREE.Group(); kopf.position.y = 3.3; kopf.rotation.x = -0.25; g.add(kopf);
  const blatMat = new THREE.MeshLambertMaterial({ color: farbe, emissive: farbe, emissiveIntensity: 0.25 });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), blatMat);
    b.scale.set(0.55, 0.22, 1.1); b.position.set(Math.sin(a) * 0.85, 0, Math.cos(a) * 0.85); b.rotation.y = a;
    kopf.add(b);
  }
  kugel(0.5, new THREE.MeshLambertMaterial({ color: 0xffd43b, emissive: 0x806000, emissiveIntensity: 0.4 }), 0, 0.1, 0, kopf, 14).scale.y = 0.5;
  const symbol = new THREE.Sprite(new THREE.SpriteMaterial({ map: SYMBOL[art], depthTest: true }));
  symbol.scale.set(1.8, 1.8, 1);
  symbol.position.y = 5.3;
  g.add(symbol);
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.4, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }));
  ring.position.y = 0.05;
  g.add(ring);
  g.position.set(x, 0, z);
  scene.add(g);
  return { art, x, z, g, kopf, symbol, ring, geloest: false };
}

/* ---------- neue Runde: alles verteilen ---------- */
function frei(x, z, abstand, liste) {
  if (Math.hypot(x, z) < 6) return false;
  for (const b of baeume) if (Math.hypot(b.x - x, b.z - z) < b.r + abstand) return false;
  for (const o of liste) if (Math.hypot(o.x - x, o.z - z) < abstand + (o.r || 0)) return false;
  return true;
}
function platz(rMin, rMax, abstand, liste) {
  for (let v = 0; v < 400; v++) {
    const w = rnd(0, Math.PI * 2), r = rnd(rMin, rMax), x = Math.sin(w) * r, z = Math.cos(w) * r;
    if (frei(x, z, abstand, liste)) return { x, z };
  }
  return { x: rnd(-20, 20), z: rnd(-20, 20) };
}
function weltAufbauen() {
  for (const b of blumen) scene.remove(b.g);
  for (const h of herzen) scene.remove(h.m);
  for (const q of quallen) { scene.remove(q.g); scene.remove(q.schatten); }
  for (const e of einhoerner) { scene.remove(e.g); scene.remove(e.schatten); }
  const belegt = [];
  /* Zauberblumen: auf vier Himmelsrichtungen verteilt */
  const start = rnd(0, Math.PI * 2);
  blumen = AUFGABEN.map((art, i) => {
    let p;
    for (let v = 0; v < 60; v++) {
      const w = start + i * Math.PI / 2 + rnd(-0.4, 0.4), r = rnd(22, 46);
      p = { x: Math.sin(w) * r, z: Math.cos(w) * r };
      if (frei(p.x, p.z, 5, belegt)) break;
    }
    belegt.push({ ...p, r: 4 });
    return neueZauberblume(art, p.x, p.z, [0xff6fb5, 0x74c0fc, 0xffa94d, 0xb197fc][i]);
  });
  /* Einhörner weiter draußen */
  einhoerner = [];
  for (let i = 0; i < ANZAHL.einhoerner; i++) {
    const p = platz(18, WELT_R - 6, 6, belegt);
    belegt.push({ ...p, r: 3 });
    const e = neuesEinhorn();
    e.x = p.x; e.z = p.z; e.rot = rnd(0, Math.PI * 2); e.weg = false;
    e.g.position.set(p.x, 0, p.z); e.g.rotation.y = e.rot;
    e.schatten.position.set(p.x, 0.03, p.z);
    einhoerner.push(e);
  }
  /* Münzen in kleinen Bögen zu je 5 */
  muenzen = [];
  while (muenzen.length < ANZAHL.muenzen) {
    const p = platz(7, WELT_R - 4, 3, belegt);
    const w = rnd(0, Math.PI * 2), bogen = rnd(-0.25, 0.25);
    for (let k = 0; k < 5 && muenzen.length < ANZAHL.muenzen; k++) {
      const x = p.x + Math.sin(w + bogen * k) * k * 1.8, z = p.z + Math.cos(w + bogen * k) * k * 1.8;
      muenzen.push({ x, z, y: FLUG_Y + Math.sin(k * 0.9) * 0.4, weg: false });
    }
    belegt.push({ ...p, r: 5 });
  }
  /* Herzen */
  herzen = [];
  for (let i = 0; i < ANZAHL.herzen; i++) {
    const p = platz(8, WELT_R - 4, 4, belegt);
    belegt.push({ ...p, r: 2 });
    const m = new THREE.Mesh(herzGeo, herzMat);
    m.scale.setScalar(1.25);
    m.position.set(p.x, FLUG_Y + 0.2, p.z);
    m.rotation.y = rnd(0, Math.PI);
    scene.add(m);
    herzen.push({ x: p.x, z: p.z, m, weg: false });
  }
  /* Quallen schweben um ihren Platz herum */
  quallen = [];
  for (let i = 0; i < ANZAHL.quallen; i++) {
    const p = platz(14, WELT_R - 5, 4, belegt);
    const q = neueQualle();
    Object.assign(q, { x: p.x, z: p.z, hx: p.x, hz: p.z, phase: rnd(0, 6), weg: false, fall: 0 });
    quallen.push(q);
  }
}

/* ===================================================================================
   Steuerung
   =================================================================================== */
const joy = { x: 0, y: 0, id: null };
const joyEl = $('joy'), knopf = $('joy-knopf');
function joyMove(e) {
  const r = joyEl.getBoundingClientRect();
  let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2);
  const l = Math.hypot(dx, dy);
  if (l > 1) { dx /= l; dy /= l; }
  joy.x = dx; joy.y = dy;
  knopf.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
}
function joyEnde(e) {
  if (e && e.pointerId !== joy.id) return;
  joy.id = null; joy.x = joy.y = 0; knopf.style.transform = '';
}
joyEl.addEventListener('pointerdown', (e) => { joy.id = e.pointerId; try { joyEl.setPointerCapture(e.pointerId); } catch { /* Test */ } joyMove(e); e.preventDefault(); });
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) joyMove(e); });
joyEl.addEventListener('pointerup', joyEnde);
joyEl.addEventListener('pointercancel', joyEnde);
const schnappKnopf = $('schnapp');
schnappKnopf.addEventListener('pointerdown', (e) => { e.preventDefault(); schnappKnopf.classList.add('gt-on'); schnappen(); });
['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => schnappKnopf.addEventListener(n, () => schnappKnopf.classList.remove('gt-on')));
schnappKnopf.addEventListener('contextmenu', (e) => e.preventDefault());
input.on('aktion', () => { if (S.phase === 'play') schnappen(); });
const tot = (v) => (Math.abs(v) < 0.18 ? 0 : v);
let testEingabe = null;

function schnappen() {
  if (S.phase !== 'play' || S.schnappPause > 0 || S.ausruhen > 0) return;
  S.schnapp = 0.45;
  S.schnappPause = 0.6;
  sound.beep(520, 0.08, 'square', 0.08);
}

/* ===================================================================================
   Anzeigen
   =================================================================================== */
const hinweisEl = $('hinweis');
let hinweisTimer = 0;
function hinweis(text, ms = 2200) {
  hinweisEl.textContent = text;
  hinweisEl.classList.add('zeigen');
  clearTimeout(hinweisTimer);
  hinweisTimer = setTimeout(() => hinweisEl.classList.remove('zeigen'), ms);
}
const plusEl = $('punkt-plus');
function punkte(n, art, wo) {
  S.punkte += n;
  if (art) S.liste[art] += n;
  plusEl.textContent = `+${n}`;
  plusEl.classList.remove('zeigen'); void plusEl.offsetWidth; plusEl.classList.add('zeigen');
  if (wo) glitzern(wo, 10, 0xfff0a0);
  hud();
}
function hud() {
  $('hud-punkte').textContent = `⭐ ${S.punkte}`;
  const schmal = viewport.width < 560;
  $('hud-herzen').textContent = S.herzen <= 0 ? '💤' : schmal ? `❤️ ${S.herzen}` : '❤️'.repeat(S.herzen);
  $('hud-herzen').setAttribute('aria-label', `${S.herzen} Herzen`);
  $('hud-aufgaben').textContent = `🌸 ${S.geloest}/${AUFGABEN.length}`;
  const fx = $('hud-fuchs');
  fx.hidden = S.fuchs <= 0;
  fx.textContent = `🦊 ${Math.ceil(S.fuchs)}`;
}
function spielzeit() { return Math.round((performance.now() - S.start) / 1000); }

/* ===================================================================================
   Spiel-Logik (Blumenwiese)
   =================================================================================== */
const vorne = new THREE.Vector3();
function updateFlug(dt) {
  S.zeit += dt;
  S.schnapp = Math.max(0, S.schnapp - dt);
  S.schnappPause = Math.max(0, S.schnappPause - dt);
  S.unverwundbar = Math.max(0, S.unverwundbar - dt);

  /* Eingaben: Pfeiltasten / Steuerknüppel – vor, zurück, drehen */
  let vor = 0, dreh = 0;
  if (S.ausruhen > 0) {
    S.ausruhen -= dt;
    if (S.ausruhen <= 0) { S.herzen = 3; hud(); hinweis('Flatter ist wieder fit! ❤️❤️❤️'); S.unverwundbar = 2; }
  } else if (testEingabe) {
    vor = testEingabe.vor || 0; dreh = testEingabe.dreh || 0;
  } else {
    vor = (input.down('hoch') ? 1 : 0) - (input.down('runter') ? 0.6 : 0) - tot(joy.y);
    dreh = (input.down('links') ? 1 : 0) - (input.down('rechts') ? 1 : 0) - tot(joy.x) * 0.9;
    vor = Math.max(-0.6, Math.min(1, vor));
  }
  F.rot += dreh * DREHEN * dt;
  const ziel = vor * TEMPO * (S.schnapp > 0 ? 1.6 : 1);
  F.tempo += (ziel - F.tempo) * Math.min(1, dt * 5);
  F.x += Math.sin(F.rot) * F.tempo * dt;
  F.z += Math.cos(F.rot) * F.tempo * dt;
  /* am Rand sanft zurück, um Baumstämme herum */
  const r = Math.hypot(F.x, F.z);
  if (r > WELT_R) { F.x *= WELT_R / r; F.z *= WELT_R / r; }
  for (const b of baeume) {
    const d = Math.hypot(F.x - b.x, F.z - b.z), min = 0.9;
    if (d < min) { F.x = b.x + (F.x - b.x) / (d || 1) * min; F.z = b.z + (F.z - b.z) / (d || 1) * min; }
  }
  F.y = FLUG_Y + Math.sin(S.zeit * 2.2) * 0.18 - (S.ausruhen > 0 ? 1.4 : 0);

  /* Münzen */
  for (const m of muenzen) {
    if (m.weg) continue;
    if (Math.hypot(m.x - F.x, m.z - F.z) < 1.3) {
      m.weg = true;
            punkte(PUNKTE.muenze, 'muenzen', new THREE.Vector3(m.x, m.y, m.z));
      sound.beep(988, 0.07, 'square', 0.07); sound.beep(1319, 0.12, 'square', 0.07, 0.06);
    }
  }
  /* Herzen: durchfliegen */
  for (const h of herzen) {
    if (h.weg) continue;
    if (Math.hypot(h.x - F.x, h.z - F.z) < 1.5) {
      h.weg = true; h.m.visible = false;
      if (S.herzen < HERZ_MAX && S.ausruhen <= 0) S.herzen++;
      punkte(PUNKTE.herz, 'herzen', h.m.position);
      glitzern(h.m.position, 14, 0xff9ad5);
      sound.melody([[784, 0.08], [988, 0.08], [1175, 0.16]]);
      hinweis('❤️ Herz eingesammelt!', 1200);
    }
  }
  /* Einhörner */
  for (const e of einhoerner) {
    if (e.weg) continue;
    if (Math.hypot(e.x - F.x, e.z - F.z) < 2.4) {
      e.weg = true;
      punkte(PUNKTE.einhorn, 'einhoerner', new THREE.Vector3(e.x, 2.5, e.z));
      glitzern(new THREE.Vector3(e.x, 2, e.z), 24, 0xffe8ff);
      sound.melody([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.1], [1319, 0.25]]);
      fuchsKommt();
    }
  }
  /* Quallen */
  for (const q of quallen) {
    if (q.weg) {
      if (q.fall > 0) { q.fall -= dt; q.g.scale.setScalar(Math.max(0.01, q.fall / 0.4)); if (q.fall <= 0) { q.g.visible = false; q.schatten.visible = false; } }
      continue;
    }
    q.phase += dt;
    const dx = F.x - q.x, dz = F.z - q.z, d = Math.hypot(dx, dz);
    if (d < 9 && S.ausruhen <= 0) {            // langsam auf Flatter zu
      q.x += dx / d * 1.6 * dt; q.z += dz / d * 1.6 * dt;
    } else {                                    // um den eigenen Platz schweben
      q.x += (q.hx + Math.sin(q.phase * 0.4) * 3 - q.x) * dt * 0.5;
      q.z += (q.hz + Math.cos(q.phase * 0.33) * 3 - q.z) * dt * 0.5;
    }
    q.y = FLUG_Y + 0.4 + Math.sin(q.phase * 1.7) * 0.35;
    if (S.schnapp > 0 && d < 2.3) { quallWeg(q, 'quallen'); continue; }
    if (d < 1.1 && S.unverwundbar <= 0 && S.ausruhen <= 0) autsch(q);
  }
  if (S.fuchs > 0) updateFuchs(dt);

  /* Zauberblumen */
  for (let i = 0; i < blumen.length; i++) {
    const b = blumen[i];
    if (!b.geloest && Math.hypot(b.x - F.x, b.z - F.z) < 2.3) { aufgabeOeffnen(i); return; }
  }
}
function quallWeg(q, wer) {
  q.weg = true; q.fall = 0.4;
  punkte(PUNKTE.qualle, wer, new THREE.Vector3(q.x, q.y, q.z));
  glitzern(new THREE.Vector3(q.x, q.y, q.z), 12, 0xd0b0ff);
  sound.melody([[392, 0.06], [523, 0.06], [659, 0.12]], 'square', 0.1);
  if (wer === 'quallen') hinweis('😋 Mjam! Qualle geschnappt!', 1200);
}
function autsch(q) {
  S.herzen = Math.max(0, S.herzen - 1);
  S.unverwundbar = 2;
  const d = Math.hypot(F.x - q.x, F.z - q.z) || 1;
  F.x += (F.x - q.x) / d * 2.5; F.z += (F.z - q.z) / d * 2.5;
  F.tempo = 0;
  sound.falsch();
  if (S.herzen === 0) { S.ausruhen = 2.5; hinweis('💤 Flatter ruht sich kurz aus …', 2400); }
  else hinweis('Autsch! Schnapp die Qualle lieber 😋', 1600);
  hud();
}

/* ---------- Fuchs ---------- */
function fuchsKommt() {
  const neu = S.fuchs <= 0;
  S.fuchs = neu ? FUCHS_ZEIT : S.fuchs + FUCHS_ZEIT;
  if (neu) {
    FX.x = F.x - Math.sin(F.rot) * 3; FX.z = F.z - Math.cos(F.rot) * 3; FX.rot = F.rot; FX.sprung = 0; FX.ziel = null;
    fuchs.visible = true; fuchsSchatten.visible = true;
  }
  hinweis('🦄 Einhorn gefunden! Der Fuchs hilft dir jetzt 🦊', 2600);
  hud();
}
function updateFuchs(dt) {
  const vorher = Math.ceil(S.fuchs);
  S.fuchs -= dt;
  if (Math.ceil(S.fuchs) !== vorher) hud();
  if (S.fuchs <= 0) { fuchs.visible = false; fuchsSchatten.visible = false; hinweis('🦊 Der Fuchs ruht sich aus. Tschüss!', 1800); hud(); return; }
  /* Ziel: die nächste Qualle in der Nähe – sonst ein Stück vor Flatter */
  if (!FX.ziel || FX.ziel.weg) {
    FX.ziel = null;
    let best = 14;
    for (const q of quallen) {
      if (q.weg) continue;
      const d = Math.min(Math.hypot(q.x - FX.x, q.z - FX.z), Math.hypot(q.x - F.x, q.z - F.z) + 2);
      if (d < best) { best = d; FX.ziel = q; }
    }
  }
  let zx, zz, tempo;
  if (FX.ziel) { zx = FX.ziel.x; zz = FX.ziel.z; tempo = 10; }
  else { zx = F.x + Math.sin(F.rot) * 4; zz = F.z + Math.cos(F.rot) * 4; tempo = Math.min(11, 2 + Math.hypot(zx - FX.x, zz - FX.z) * 2); }
  const dx = zx - FX.x, dz = zz - FX.z, d = Math.hypot(dx, dz);
  if (d > 0.3) {
    const schritt = Math.min(d, tempo * dt);
    FX.x += dx / d * schritt; FX.z += dz / d * schritt;
    FX.rot += winkelDiff(FX.rot, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
    FX.schritt += schritt * 3;
  }
  if (FX.ziel && d < 1.6 && FX.sprung <= 0) FX.sprung = 0.5;
  if (FX.sprung > 0) {
    FX.sprung -= dt;
    if (FX.ziel && FX.sprung < 0.25 && !FX.ziel.weg) { quallWeg(FX.ziel, 'fuchs'); hinweis('🦊 Der Fuchs hat eine Qualle gefressen!', 1400); FX.ziel = null; }
  }
}

/* ---------- Bewegen und Zeichnen der Welt ---------- */
const kamZiel = new THREE.Vector3(), kamBlick = new THREE.Vector3(), mtx = new THREE.Matrix4(), quat = new THREE.Quaternion(), skala = new THREE.Vector3(), posV = new THREE.Vector3();
const yAchse = new THREE.Vector3(0, 1, 0);
function weltAnimieren(dt) {
  const t = S.zeit;
  /* Flatter */
  flatter.position.set(F.x, F.y, F.z);
  flatter.rotation.set(-0.12 + (S.schnapp > 0 ? -0.25 : 0), F.rot, 0);
  const schlag = S.phase === 'play' && Math.abs(F.tempo) > 0.5 ? 13 : 7;
  for (const w of fluegel) w.pivot.rotation.z = w.seite * (0.25 + Math.sin(t * schlag) * 0.75);
  flatter.visible = !(S.unverwundbar > 0 && Math.floor(t * 10) % 2 === 0);
  flatterSchatten.position.set(F.x, 0.03, F.z);
  /* Münzen drehen sich */
  muenzen.forEach((m, i) => {
    quat.setFromAxisAngle(yAchse, t * 2.5 + i * 0.3);
    skala.setScalar(m.weg ? 0.0001 : 1);
    posV.set(m.x, m.y + Math.sin(t * 2 + i) * 0.1, m.z);
    muenzMesh.setMatrixAt(i, mtx.compose(posV, quat, skala));
  });
  muenzMesh.instanceMatrix.needsUpdate = true;
  for (const h of herzen) { h.m.rotation.y += dt * 0.8; h.m.position.y = FLUG_Y + 0.2 + Math.sin(t * 1.5 + h.x) * 0.15; }
  for (const q of quallen) {
    if (!q.g.visible) continue;
    q.g.position.set(q.x, q.y, q.z);
    q.g.rotation.y = Math.atan2(F.x - q.x, F.z - q.z);
    const puls = 1 + Math.sin(q.phase * 3) * 0.08;
    if (!q.weg) q.g.scale.set(puls, 2 - puls, puls);
    q.arme.forEach((a, i) => { a.rotation.x = Math.sin(q.phase * 3 + i) * 0.35; a.rotation.z = Math.cos(q.phase * 2.5 + i) * 0.25; });
    q.schatten.position.set(q.x, 0.03, q.z);
  }
  for (const e of einhoerner) {
    if (e.weg) {
      if (e.g.visible) { e.g.position.y += dt * 6; e.g.scale.multiplyScalar(Math.max(0, 1 - dt * 2.5)); if (e.g.scale.x < 0.05) { e.g.visible = false; e.schatten.visible = false; } }
      continue;
    }
    e.g.position.y = Math.abs(Math.sin(t * 2 + e.x)) * 0.25;
    e.g.rotation.y = e.rot + Math.sin(t * 0.5 + e.z) * 0.4;
    if (Math.random() < dt * 3) glitzern(new THREE.Vector3(e.x + rnd(-1, 1), rnd(1, 3), e.z + rnd(-1, 1)), 1, 0xffd6f5);
  }
  for (const b of blumen) {
    b.kopf.rotation.y += dt * (b.geloest ? 0.3 : 0.8);
    b.symbol.position.y = 5.3 + Math.sin(t * 2 + b.x) * 0.2;
    b.ring.material.opacity = b.geloest ? 0.25 : 0.4 + Math.sin(t * 3) * 0.25;
    b.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
  }
  if (fuchs.visible) {
    const hoch = FX.sprung > 0 ? Math.sin((0.5 - FX.sprung) / 0.5 * Math.PI) * 1.6 : 0;
    fuchs.position.set(FX.x, hoch, FX.z);
    fuchs.rotation.y = FX.rot;
    fuchsBeine.forEach((b, i) => { b.rotation.x = Math.sin(FX.schritt + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.7; });
    fuchsSchwanz.rotation.y = Math.sin(t * 6) * 0.35;
    fuchsSchatten.position.set(FX.x, 0.03, FX.z);
  }
  for (const f of funken) {
    if (!f.s.visible) continue;
    f.t -= dt;
    if (f.t <= 0) { f.s.visible = false; continue; }
    f.s.position.addScaledVector(f.v, dt);
    f.v.y -= dt * 4;
    f.s.material.opacity = Math.min(1, f.t * 2);
    f.s.scale.setScalar(0.35 + f.t * 0.4);
  }
  wolken.rotation.y += dt * 0.01;
}
function kamera(dt, sofort = false) {
  if (S.phase === 'menu') {
    const a = S.zeit * 0.25;
    camera.position.set(F.x + Math.sin(a) * 6, FLUG_Y + 1.6, F.z + Math.cos(a) * 6);
    camera.lookAt(F.x, FLUG_Y, F.z);
    return;
  }
  const hoch = camera.aspect < 1;
  const abstand = hoch ? 8.5 : 6.8, hoehe = hoch ? 4.2 : 3.4;
  kamZiel.set(F.x - Math.sin(F.rot) * abstand, F.y + hoehe, F.z - Math.cos(F.rot) * abstand);
  if (sofort) camera.position.copy(kamZiel);
  else camera.position.lerp(kamZiel, 1 - Math.pow(0.02, dt));
  kamBlick.set(F.x + Math.sin(F.rot) * 3, F.y + 0.6, F.z + Math.cos(F.rot) * 3);
  camera.lookAt(kamBlick);
}
/* Kompass: Pfeil zur nächsten ungelösten Zauberblume (relativ zur Blickrichtung) */
const kompassPfeil = $('kompass-pfeil');
function kompass() {
  if (S.phase !== 'play') return;
  let best = null, bd = Infinity;
  for (const b of blumen) { if (b.geloest) continue; const d = Math.hypot(b.x - F.x, b.z - F.z); if (d < bd) { bd = d; best = b; } }
  $('kompass').hidden = !best;
  if (!best) return;
  const w = winkelDiff(F.rot, Math.atan2(best.x - F.x, best.z - F.z));
  kompassPfeil.style.transform = `rotate(${-w}rad)`;
  $('kompass-text').textContent = `${best.art === 'memory' ? '🃏' : '🌀'} ${Math.round(bd)} m`;
}

/* ===================================================================================
   Aufgabe 1: Tier-Memory (5 × 4 Karten, 10 Paare)
   =================================================================================== */
const M = { karten: [], offen: [], paare: 0, zuege: 0, sperre: false };
const memRaster = $('mem-raster');
function memoryStart() {
  const tiere = mischen(TIERE.slice()).slice(0, 10);
  M.karten = mischen([...tiere, ...tiere]).map((tier) => ({ tier, fertig: false }));
  M.offen = []; M.paare = 0; M.zuege = 0; M.sperre = false;
  memRaster.innerHTML = '';
  M.karten.forEach((k, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mem-karte';
    b.setAttribute('aria-label', `Karte ${i + 1}`);
    b.innerHTML = `<span class="mem-innen"><span class="mem-seite mem-ruecken" aria-hidden="true">🦋</span><span class="mem-seite mem-vorne" aria-hidden="true">${k.tier}</span></span>`;
    b.addEventListener('click', () => memoryKlick(i));
    k.el = b;
    memRaster.appendChild(b);
  });
  $('mem-rueckmeldung').textContent = 'Finde immer zwei gleiche Tiere!';
  memoryAnzeige();
  memoryGroesse();
}
function memoryAnzeige() {
  $('mem-paare').textContent = `Paare ${M.paare}/10`;
  $('mem-zuege').textContent = `Züge ${M.zuege}`;
}
function memoryGroesse() {
  const w = viewport.width, h = viewport.height;
  const quer = w >= h;
  const cols = quer ? 5 : 4, rows = 20 / cols, gap = Math.min(10, Math.max(5, Math.round(Math.min(w, h) / 70)));
  const platzB = Math.min(w - 40, 820 - 24), platzH = h - (quer ? 120 : 150) - 20;
  const kw = Math.floor(Math.max(44, Math.min((platzB - gap * (cols - 1)) / cols, (platzH - gap * (rows - 1)) / rows, 130)));
  memRaster.style.setProperty('--mem-cols', cols);
  memRaster.style.setProperty('--mem-w', `${kw}px`);
  memRaster.style.setProperty('--mem-gap', `${gap}px`);
}
function memoryKlick(i) {
  const k = M.karten[i];
  if (M.sperre || k.fertig || M.offen.includes(i) || S.phase !== 'memory') return;
  k.el.classList.add('offen');
  k.el.setAttribute('aria-label', `Karte ${i + 1}: ${TIER_NAMEN[k.tier] || 'Tier'}`);
  M.offen.push(i);
  sound.beep(660, 0.06, 'triangle', 0.08);
  if (M.offen.length < 2) return;
  M.zuege++;
  const [a, b] = M.offen.map((n) => M.karten[n]);
  if (a.tier === b.tier) {
    a.fertig = b.fertig = true;
    a.el.classList.add('fertig'); b.el.classList.add('fertig');
    M.offen = [];
    M.paare++;
    sound.richtig();
    $('mem-rueckmeldung').textContent = `Super! ${TIER_NAMEN[a.tier] || ''} gefunden ${a.tier}`;
    memoryAnzeige();
    if (M.paare === 10) setTimeout(memoryFertig, 500);
  } else {
    M.sperre = true;
    $('mem-rueckmeldung').textContent = 'Nicht gleich – merk dir die Tiere! 🙂';
    memoryAnzeige();
    setTimeout(() => {
      for (const n of M.offen) { M.karten[n].el.classList.remove('offen'); M.karten[n].el.setAttribute('aria-label', `Karte ${n + 1}`); }
      M.offen = []; M.sperre = false;
    }, TEST ? 250 : 900);
  }
}
function memoryFertig() {
  const p = Math.max(50, 150 - Math.max(0, M.zuege - 10) * 5);
  aufgabeGeschafft(p, 'memory', `Du hast alle 10 Tier-Paare gefunden – in ${M.zuege} Zügen.`, '🃏🎉');
}

/* ===================================================================================
   Aufgabe 2: Labyrinth – Flatter fliegt zur Blume
   =================================================================================== */
const labCanvas = $('lab-canvas');
const lctx = labCanvas.getContext('2d');
const L = { n: 7, wand: null, x: 0, y: 0, ax: 0, ay: 0, schritte: 0, kurz: 0, fertig: false, halt: 0, zeit: 0, spur: [] };
/* Labyrinth erzeugen (Tiefensuche): wand[y][x] = { n, o, s, w } true = Wand */
function labyrinthErzeugen(n) {
  const wand = Array.from({ length: n }, () => Array.from({ length: n }, () => ({ n: true, o: true, s: true, w: true })));
  const besucht = Array.from({ length: n }, () => Array(n).fill(false));
  const stapel = [[0, 0]];
  besucht[0][0] = true;
  const R = { n: [0, -1, 's'], o: [1, 0, 'w'], s: [0, 1, 'n'], w: [-1, 0, 'o'] };
  while (stapel.length) {
    const [x, y] = stapel[stapel.length - 1];
    const nb = Object.entries(R).filter(([, [dx, dy]]) => x + dx >= 0 && y + dy >= 0 && x + dx < n && y + dy < n && !besucht[y + dy][x + dx]);
    if (!nb.length) { stapel.pop(); continue; }
    const [r, [dx, dy, gegen]] = nb[Math.floor(Math.random() * nb.length)];
    wand[y][x][r] = false;
    wand[y + dy][x + dx][gegen] = false;
    besucht[y + dy][x + dx] = true;
    stapel.push([x + dx, y + dy]);
  }
  return wand;
}
const RICHTUNG = { hoch: ['n', 0, -1], runter: ['s', 0, 1], links: ['w', -1, 0], rechts: ['o', 1, 0] };
function labyrinthWeg() {
  /* kürzester Weg von Flatter zur Blume (Breitensuche) – als Liste von Richtungen */
  const n = L.n, ziel = `${n - 1},${n - 1}`, vor = { [`${L.x},${L.y}`]: null }, q = [[L.x, L.y]];
  while (q.length) {
    const [x, y] = q.shift();
    if (`${x},${y}` === ziel) break;
    for (const [name, [w, dx, dy]] of Object.entries(RICHTUNG)) {
      const k = `${x + dx},${y + dy}`;
      if (L.wand[y][x][w] || k in vor) continue;
      vor[k] = [`${x},${y}`, name];
      q.push([x + dx, y + dy]);
    }
  }
  const weg = [];
  for (let k = ziel; vor[k]; k = vor[k][0]) weg.unshift(vor[k][1]);
  return weg;
}
function labyrinthStart(nr) {
  L.n = nr === 0 ? 7 : 9;
  L.wand = labyrinthErzeugen(L.n);
  L.x = L.y = 0; L.ax = L.ay = 0;
  L.schritte = 0; L.fertig = false; L.zeit = 0; L.spur = [[0, 0]];
  L.kurz = labyrinthWeg().length;
  $('lab-schritte').textContent = 'Schritte 0';
  labGroesse();
}
function labyrinthGehen(richtung) {
  if (S.phase !== 'labyrinth' || L.fertig) return;
  const [w, dx, dy] = RICHTUNG[richtung];
  if (L.wand[L.y][L.x][w]) { sound.beep(200, 0.06, 'sine', 0.06); L.wackeln = 0.2; return; }
  L.x += dx; L.y += dy; L.schritte++;
  L.spur.push([L.x, L.y]);
  $('lab-schritte').textContent = `Schritte ${L.schritte}`;
  sound.beep(740 + (L.schritte % 4) * 60, 0.04, 'triangle', 0.06);
  if (L.x === L.n - 1 && L.y === L.n - 1) {
    L.fertig = true;
    sound.gewonnen();
    setTimeout(labyrinthFertig, TEST ? 100 : 700);
  }
}
function labyrinthFertig() {
  const p = 100 + (L.schritte <= L.kurz + 4 ? 50 : L.schritte <= L.kurz * 2 ? 25 : 0);
  aufgabeGeschafft(p, 'labyrinth', `Flatter hat die Blume gefunden – in ${L.schritte} Schritten.`, '🌀🌷');
}
for (const r of Object.keys(RICHTUNG)) input.on(r, () => { if (S.phase === 'labyrinth') { labyrinthGehen(r); L.halt = -0.3; } });
input.touchButtons($('lab-kreuz'), [
  { action: 'hoch', label: '▲', title: 'nach oben' }, { action: 'links', label: '◀', title: 'nach links' },
  { action: 'runter', label: '▼', title: 'nach unten' }, { action: 'rechts', label: '▶', title: 'nach rechts' },
]);
input.swipe(labCanvas, (r) => labyrinthGehen(r));
/* Antippen: auf ein Feld in derselben Reihe oder Spalte – Flatter fliegt dorthin, solange keine Wand im Weg ist */
labCanvas.addEventListener('pointerup', (e) => {
  if (!L.feld) return;
  const r = labCanvas.getBoundingClientRect();
  const fx = Math.floor((e.clientX - r.left - L.feld.x) / L.feld.z), fy = Math.floor((e.clientY - r.top - L.feld.y) / L.feld.z);
  if (fx < 0 || fy < 0 || fx >= L.n || fy >= L.n || (fx !== L.x && fy !== L.y)) return;
  const richtung = fx > L.x ? 'rechts' : fx < L.x ? 'links' : fy > L.y ? 'runter' : 'hoch';
  const anzahl = Math.abs(fx - L.x) + Math.abs(fy - L.y);
  for (let i = 0; i < anzahl; i++) { const vorher = L.schritte; labyrinthGehen(richtung); if (L.schritte === vorher) break; }
});
let labView = { width: 1, height: 1, dpr: 1 };
function labGroesse() {
  const w = viewport.width, h = viewport.height, dpr = Math.min(window.devicePixelRatio || 1, 2);
  labCanvas.width = Math.round(w * dpr); labCanvas.height = Math.round(h * dpr);
  labView = { width: w, height: h, dpr };
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const quer = w >= h;
  /* Platz für Kopfzeile oben und das Steuerkreuz (Touch: unten rechts bzw. rechts daneben) */
  const rand = { top: 66, bottom: 14, left: 14, right: 14 };
  if (touch && quer) rand.right = 230;
  if (touch && !quer) rand.bottom = 160;
  const b = board(1, { ...rand, width: w, height: h });
  L.feld = { x: b.x, y: b.y, z: b.width / L.n, groesse: b.width };
}
function labZeichnen(dt) {
  const { width: w, height: h, dpr } = labView, g = lctx;
  L.zeit += dt;
  L.ax += (L.x - L.ax) * Math.min(1, dt * 18);
  L.ay += (L.y - L.ay) * Math.min(1, dt * 18);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  /* Garten-Hintergrund */
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#9fe3ff'); bg.addColorStop(0.35, '#e8fbff'); bg.addColorStop(0.36, '#a7e07d'); bg.addColorStop(1, '#6cbf4f');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const x = (i * 97) % w, y = h * 0.4 + ((i * 53) % (h * 0.6));
    g.fillStyle = ['#ff8fc7', '#ffe066', '#ffffff', '#c9a2ff'][i % 4];
    g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
  }
  const { x: ox, y: oy, z, groesse } = L.feld, n = L.n;
  /* Weg (Sand) mit Schatten */
  g.save();
  g.shadowColor = 'rgba(30,70,20,0.45)'; g.shadowBlur = 18; g.shadowOffsetY = 8;
  g.fillStyle = '#fbe7b8';
  g.beginPath(); g.roundRect ? g.roundRect(ox - 8, oy - 8, groesse + 16, groesse + 16, 18) : g.rect(ox - 8, oy - 8, groesse + 16, groesse + 16); g.fill();
  g.restore();
  /* Spur: wo Flatter schon war */
  g.fillStyle = 'rgba(255,170,215,0.45)';
  for (const [sx, sy] of L.spur) g.fillRect(ox + sx * z + z * 0.3, oy + sy * z + z * 0.3, z * 0.4, z * 0.4);
  /* Hecken: grüne runde Linien mit Licht oben */
  const dick = Math.max(6, z * 0.2);
  const linien = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const c = L.wand[y][x], X = ox + x * z, Y = oy + y * z;
    if (c.n) linien.push([X, Y, X + z, Y]);
    if (c.w) linien.push([X, Y, X, Y + z]);
    if (y === n - 1 && c.s) linien.push([X, Y + z, X + z, Y + z]);
    if (x === n - 1 && c.o) linien.push([X + z, Y, X + z, Y + z]);
  }
  g.lineCap = 'round';
  for (const [farbe, breite, dy] of [['rgba(20,60,10,0.35)', dick, dick * 0.35], ['#2f9e44', dick, 0], ['#69db7c', dick * 0.4, -dick * 0.18]]) {
    g.strokeStyle = farbe; g.lineWidth = breite;
    g.beginPath();
    for (const [a, b, c, d] of linien) { g.moveTo(a, b + dy); g.lineTo(c, d + dy); }
    g.stroke();
  }
  /* Ziel-Blume */
  const bx = ox + (n - 0.5) * z, by = oy + (n - 0.5) * z, br = z * 0.36 * (1 + Math.sin(L.zeit * 3) * 0.05);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + L.zeit * 0.5;
    const grad = g.createRadialGradient(bx + Math.cos(a) * br * 0.6, by + Math.sin(a) * br * 0.6, 1, bx + Math.cos(a) * br * 0.6, by + Math.sin(a) * br * 0.6, br * 0.55);
    grad.addColorStop(0, '#ffd1ec'); grad.addColorStop(1, '#e64ea6');
    g.fillStyle = grad; g.beginPath(); g.arc(bx + Math.cos(a) * br * 0.6, by + Math.sin(a) * br * 0.6, br * 0.5, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#ffd43b'; g.beginPath(); g.arc(bx, by, br * 0.38, 0, Math.PI * 2); g.fill();
  /* Flatter */
  const fx = ox + (L.ax + 0.5) * z + (L.wackeln > 0 ? Math.sin(L.zeit * 60) * 3 : 0), fy = oy + (L.ay + 0.5) * z;
  if (L.wackeln > 0) L.wackeln -= dt;
  schmetterling2d(g, fx, fy, z * 0.42, L.zeit);
}
/* Schmetterling für das Labyrinth: Flügel mit Verlauf, die schlagen */
function schmetterling2d(g, x, y, r, t) {
  const schlag = 0.6 + Math.abs(Math.sin(t * 8)) * 0.4;
  g.save(); g.translate(x, y);
  g.shadowColor = 'rgba(0,0,0,0.3)'; g.shadowBlur = 6; g.shadowOffsetY = 3;
  for (const s of [-1, 1]) {
    g.save(); g.scale(s * schlag, 1);
    const go = g.createRadialGradient(0, 0, 1, r * 0.6, -r * 0.4, r);
    go.addColorStop(0, '#fff3b0'); go.addColorStop(0.5, '#ff9ad5'); go.addColorStop(1, '#7a4bd6');
    g.fillStyle = go; g.strokeStyle = '#3b1f5c'; g.lineWidth = Math.max(1.5, r * 0.08);
    g.beginPath(); g.ellipse(r * 0.5, -r * 0.3, r * 0.55, r * 0.45, -0.5, 0, Math.PI * 2); g.fill(); g.stroke();
    const gu = g.createRadialGradient(0, 0, 1, r * 0.4, r * 0.4, r * 0.7);
    gu.addColorStop(0, '#fff3b0'); gu.addColorStop(1, '#ff6fb5');
    g.fillStyle = gu;
    g.beginPath(); g.ellipse(r * 0.38, r * 0.35, r * 0.38, r * 0.3, 0.6, 0, Math.PI * 2); g.fill(); g.stroke();
    g.restore();
  }
  g.shadowColor = 'transparent';
  g.fillStyle = '#5b2c83';
  g.beginPath(); g.ellipse(0, r * 0.05, r * 0.12, r * 0.55, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(0, -r * 0.55, r * 0.18, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff';
  for (const s of [-1, 1]) { g.beginPath(); g.arc(s * r * 0.08, -r * 0.58, r * 0.07, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

/* ===================================================================================
   Aufgaben öffnen und abschließen
   =================================================================================== */
function aufgabeOeffnen(i) {
  S.aufgabe = i;
  F.tempo = 0;
  joyEnde();
  input.clear();
  const b = blumen[i];
  sound.melody([[523, 0.08], [784, 0.12]]);
  steuerung(false);
  if (b.art === 'memory') {
    S.phase = 'memory';
    memoryStart();
    kit.show('memory');
    loop.setMaxFps(15);
  } else {
    S.phase = 'labyrinth';
    labyrinthStart(blumen.slice(0, i).filter((x) => x.art === 'labyrinth').length);
    kit.show('labyrinth');
    loop.setMaxFps(0);
  }
}
function aufgabeGeschafft(p, art, text, emoji) {
  S.phase = 'geschafft';
  const b = blumen[S.aufgabe];
  b.geloest = true;
  b.symbol.material.map = SYMBOL.fertig;
  S.geloest++;
  punkte(p, art);
  sound.gewonnen();
  $('geschafft-emoji').textContent = emoji;
  $('geschafft-text').textContent = text;
  $('geschafft-punkte').textContent = `+${p} Punkte ⭐`;
  $('geschafft-titel').textContent = S.geloest === AUFGABEN.length ? 'Alle Zauberblumen geschafft!' : 'Super gemacht!';
  kit.show('geschafft');
  loop.setMaxFps(15);
}
function weiter() {
  if (S.phase !== 'geschafft') return;
  const b = blumen[S.aufgabe];
  /* Flatter fliegt ein Stück von der Blume weg */
  const d = Math.hypot(F.x - b.x, F.z - b.z) || 1;
  F.x = b.x + (F.x - b.x) / d * 3.5; F.z = b.z + (F.z - b.z) / d * 3.5;
  F.rot = Math.atan2(F.x - b.x, F.z - b.z);
  glitzern(new THREE.Vector3(b.x, 4, b.z), 20, 0xfff0a0);
  if (S.geloest >= AUFGABEN.length) { spielEnde(); return; }
  S.phase = 'play';
  kit.show(null);
  fokusWeg();
  steuerung(true);
  loop.setMaxFps(0);
  kamera(0, true);
  hinweis(`Noch ${AUFGABEN.length - S.geloest} Zauberblume${AUFGABEN.length - S.geloest > 1 ? 'n' : ''}! Folge dem Pfeil 🌸`);
}

/* ===================================================================================
   Start, Ende, Spielschleife
   =================================================================================== */
function steuerung(an) {
  $('steuerung-links').hidden = !an;
  $('steuerung-rechts').hidden = !an;
  $('kompass').hidden = !an;
  if (!an) joyEnde();
}
function neueRunde() {
  weltAufbauen();
  Object.assign(S, { phase: 'play', punkte: 0, herzen: 3, geloest: 0, zeit: 0, schnapp: 0, schnappPause: 0, unverwundbar: 0, ausruhen: 0, fuchs: 0, aufgabe: -1 });
  S.liste = { muenzen: 0, herzen: 0, quallen: 0, fuchs: 0, einhoerner: 0, memory: 0, labyrinth: 0 };
  Object.assign(F, { x: 0, z: 0, rot: rnd(0, Math.PI * 2), tempo: 0 });
  fuchs.visible = false; fuchsSchatten.visible = false;
  S.start = performance.now();
  kit.show(null);
  fokusWeg();
  kit.setState('play');
  $('hud').hidden = false;
  steuerung(true);
  hud();
  kamera(0, true);
  loop.setMaxFps(0);
  hinweis('Finde die 4 Zauberblumen! Folge dem Pfeil 🌸', 2800);
}
function spielEnde() {
  S.phase = 'ende';
  S.sekunden = spielzeit();
  steuerung(false);
  const l = S.liste;
  $('ergebnis').textContent = `⭐ ${S.punkte} Punkte`;
  $('ergebnis-liste').innerHTML = [
    ['🪙 Münzen', l.muenzen], ['❤️ Herzen', l.herzen], ['😋 Quallen geschnappt', l.quallen], ['🦊 Quallen vom Fuchs', l.fuchs],
    ['🦄 Einhörner', l.einhoerner], ['🃏 Tier-Memory', l.memory], ['🌀 Labyrinth', l.labyrinth],
  ].map(([t, p]) => `${t}: <b>${p}</b>`).join('<br>');
  $('ergebnis-zeit').textContent = `Zeit: ${Math.floor(S.sekunden / 60)} min ${S.sekunden % 60} s`;
  kit.storage.saveScore({ points: S.punkte, maxPoints: MAX_PUNKTE, seconds: S.sekunden });
  sound.gewonnen();
  kit.setState('end');
  kit.show('ende');
  loop.setMaxFps(15);
}

const loop = createLoop({
  update(dt) {
    if (S.phase === 'play') { updateFlug(dt); kompass(); }
    else S.zeit += dt;
    if (S.phase === 'labyrinth') {
      /* Taste gedrückt halten: Flatter fliegt weiter */
      L.dt = (L.dt || 0) + dt;
      const r = Object.keys(RICHTUNG).find((k) => input.down(k));
      if (r) { L.halt += dt; if (L.halt > 0.16) { L.halt = 0; labyrinthGehen(r); } } else L.halt = 0;
      return;
    }
    weltAnimieren(dt);
    kamera(dt);
  },
  render() {
    if (S.phase === 'labyrinth') { labZeichnen(L.dt || 0); L.dt = 0; return; }
    if (renderer) renderer.render(scene, camera);
  },
});
let letzteZeit = performance.now();
const qualitaetMessen = () => {
  const jetzt = performance.now();
  if (quality && S.phase === 'play' && !kit.paused) quality.frame((jetzt - letzteZeit) / 1000);
  letzteZeit = jetzt;
  requestAnimationFrame(qualitaetMessen);
};

viewport.onResize(({ width, height }) => {
  if (renderer) renderer.setSize(width, height, false);
  canvas.style.width = '100%'; canvas.style.height = '100%';
  camera.aspect = width / Math.max(1, height);
  camera.fov = width < height ? 72 : 60;
  camera.updateProjectionMatrix();
  if (S.phase === 'memory') memoryGroesse();
  if (S.phase !== 'menu') hud();
  labGroesse();
  loop.renderOnce();
});

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-action]');
  if (!a) return;
  if (a.dataset.action === 'start' || a.dataset.action === 'nochmal') neueRunde();
  if (a.dataset.action === 'weiter') weiter();
});

/* Start-Bildschirm: Flatter schwebt, Kamera kreist langsam */
const touchGeraet = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
$('start-steuerung').textContent = touchGeraet
  ? '📱 Steuerknüppel links: fliegen · Knopf rechts: schnappen'
  : '💻 Pfeiltasten: fliegen · Leertaste: schnappen';
kit.storage.getScores().then((liste) => {
  if (!liste.length) return;
  const best = Math.max(...liste.map((s) => s.points));
  $('rekord').textContent = `🏆 Dein Rekord: ${best} Punkte`;
  $('rekord').hidden = false;
}).catch(() => {});
weltAufbauen();
kit.setState('menu');
kit.show('start');
loop.setMaxFps(20);
loop.start();
requestAnimationFrame(qualitaetMessen);

/* Zugang für den Durchspiel-Test (tools/spieltests/schmetterling.js) */
window.SPIEL = {
  state: () => ({
    phase: S.phase, punkte: S.punkte, herzen: S.herzen, geloest: S.geloest, fuchs: S.fuchs, liste: { ...S.liste },
    x: F.x, z: F.z, rot: F.rot, schnapp: S.schnapp, ausruhen: S.ausruhen,
  }),
  dinge: () => ({
    muenzen: muenzen.map((m) => ({ x: m.x, z: m.z, weg: m.weg })),
    herzen: herzen.map((h) => ({ x: h.x, z: h.z, weg: h.weg })),
    quallen: quallen.map((q) => ({ x: q.x, z: q.z, weg: q.weg })),
    einhoerner: einhoerner.map((e) => ({ x: e.x, z: e.z, weg: e.weg })),
    blumen: blumen.map((b) => ({ x: b.x, z: b.z, art: b.art, geloest: b.geloest })),
    fuchs: { x: FX.x, z: FX.z, sichtbar: fuchs.visible },
  }),
  /* Flatter versetzen (x, z, Blickrichtung) */
  teleport(x, z, rot = F.rot) { F.x = x; F.z = z; F.rot = rot; F.tempo = 0; kamera(0, true); },
  /* Qualle i an eine Stelle setzen (für den Fuchs-Test) */
  qualleNach(i, x, z) { const q = quallen[i]; q.x = q.hx = x; q.z = q.hz = z; },
  eingabe(v) { testEingabe = v; },
  memory: () => M.karten.map((k) => k.tier),
  labyrinthWeg,
  zeitraffer(n) { loop.timeScale = n; },
};
