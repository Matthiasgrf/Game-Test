/* Elisabeth von Thüringen – 3D-Szene mit Three.js (../shared/vendor/three-r128.min.js).
   Nur das Zeichnen: Spielzustand, Stationen, Fragen und Bewegung stehen in index.html.
   createScene(canvas, { stations, trees }) baut die Welt und gibt zurück:
     resize(w, h)                     Größe (CSS-Pixel)
     draw({ player, cam, done, time, moving, target })   ein Bild zeichnen
     groundAt(clientX, clientY)       Punkt auf der Wiese unter dem Finger/Mauszeiger ({x, z} oder null)
     setDetail(stufe)                 0 = alles, 1 = ohne Schatten, 2 = ohne Blumen und Wolken (schwache Geräte)
     renderer                         für die Detailstufe des Kits (createQuality)
   Welt: Wiese x −19…19, z −13…17 (Stationen in vier Reihen), dahinter Hügel und Wald, im Norden (−z) die
   Wartburg auf ihrem Berg. Die Kamera folgt Elisabeth schräg von hinten; auf schmalen Bildschirmen (Handy
   hochkant) steht sie weiter weg, damit links und rechts genug Wiese zu sehen ist. */
/* global THREE */

const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const lerp = (a, b, t) => a + (b - a) * t;

/* Höhe des Geländes: die Spielwiese ist flach, nach außen steigen sanfte Hügel an; der Wartburg-Berg im Norden */
const BURG = { x: 2, z: -42 };
function heightAt(x, z) {
  const dx = Math.max(0, Math.abs(x) - 24), dz = Math.max(0, -z - 18);   /* vorn (zur Kamera hin) bleibt es flach */
  const e = Math.min(1, Math.hypot(dx, dz) / 16);
  let h = e * e * (4 + 2.4 * Math.sin(x * 0.09) + 2 * Math.cos(z * 0.11 + x * 0.03) + 1.2 * Math.sin((x + z) * 0.21));
  const r = Math.hypot(x - BURG.x, z - BURG.z);                             /* Burgberg mit flacher Kuppe */
  h += 12 * (r < 9 ? 1 : r > 24 ? 0 : 0.5 + 0.5 * Math.cos(((r - 9) / 15) * Math.PI));
  return h;
}

/* mehrere Geometrien (schon an ihrem Platz) zu einer zusammenfassen – ein Zeichenaufruf statt vieler */
function mergeGeometries(list) {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) {
    const arr = new Float32Array(total * 3);
    let o = 0;
    for (const g of parts) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  return out;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

/* Abzeichen über einer Station: Nummer im roten Kreis, erledigt ✓ im grünen Kreis */
function badgeTexture(text, done) {
  return canvasTexture(128, 128, (g) => {
    g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2);
    g.fillStyle = done ? '#16a34a' : '#e11d48'; g.fill();
    g.lineWidth = 9; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 62px "Trebuchet MS", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 68);
  });
}

export function createScene(canvas, { stations, trees }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));   /* scharf auf iPad/iPhone, höchstens 2 */
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = canvasTexture(2, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#2f8fe6'); gr.addColorStop(0.6, '#86c9f7'); gr.addColorStop(1, '#dff3ff');
    g.fillStyle = gr; g.fillRect(0, 0, 2, 256);
  });
  scene.fog = new THREE.Fog(0xcfe9fb, 55, 150);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 400);
  let width = 1, height = 1;

  /* ---------- Licht ---------- */
  scene.add(new THREE.HemisphereLight(0xe3f4ff, 0x5b8c3a, 0.72));
  const sun = new THREE.DirectionalLight(0xfff0d0, 0.9);
  sun.position.set(-20, 34, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 100 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

  /* ---------- Gelände mit leicht wechselndem Grün ---------- */
  const groundGeo = new THREE.PlaneGeometry(320, 320, 96, 96);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const light = new THREE.Color(0x7ed957), dark = new THREE.Color(0x4fae45), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const n = 0.5 + 0.25 * Math.sin(x * 0.35 + z * 0.12) + 0.25 * Math.sin(z * 0.41 - x * 0.17);
    tmp.copy(dark).lerp(light, Math.min(1, Math.max(0, n - h * 0.02)));
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  ground.receiveShadow = true;
  scene.add(ground);

  /* ---------- Sandweg von Station zu Station ---------- */
  const pathMat = lambert(0xead08c, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const rimMat = lambert(0xc9a35f, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const pathPoints = stations.map((s) => [s.x, s.z]);
  for (const [w, mat, y] of [[2.1, rimMat, 0.02], [1.7, pathMat, 0.03]]) {
    const pieces = [];
    pathPoints.forEach(([x, z], i) => {
      const dot = new THREE.CircleGeometry(w / 2, 24);
      dot.rotateX(-Math.PI / 2); dot.translate(x, y, z);
      pieces.push(dot);
      if (i === 0) return;
      const [px, pz] = pathPoints[i - 1];
      const seg = new THREE.PlaneGeometry(Math.hypot(x - px, z - pz), w);
      seg.rotateX(-Math.PI / 2);
      seg.rotateY(-Math.atan2(z - pz, x - px));
      seg.translate((x + px) / 2, y, (z + pz) / 2);
      pieces.push(seg);
    });
    const weg = new THREE.Mesh(mergeGeometries(pieces), mat);
    weg.receiveShadow = true;
    scene.add(weg);
  }

  /* ---------- Bäume (Laubbäume und Tannen), Büsche – als Instanzen, damit es wenige Zeichenaufrufe sind ---------- */
  const spots = trees.map(([x, z], i) => ({ x, z, s: 1, kind: i % 3 === 0 ? 'tanne' : 'laub' }));
  for (let i = 0; spots.length < 150 && i < 900; i++) {
    const a = rnd(i) * Math.PI * 2, r = 27 + rnd(i + 500) * 70;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.9 + 2;
    if (Math.abs(x) < 23 && z > -17) continue;                                 /* nicht auf die Wiese und nicht vor die Kamera */
    if (z > 20 && Math.abs(x) < 48) continue;
    if (Math.hypot(x - BURG.x, z - BURG.z) < 12) continue;                     /* der Burgberg bleibt frei */
    if (spots.some((p) => Math.hypot(p.x - x, p.z - z) < 4.5)) continue;
    spots.push({ x, z, s: 0.9 + rnd(i + 900) * 0.7, kind: rnd(i + 77) < 0.45 ? 'tanne' : 'laub' });
  }
  const laub = spots.filter((p) => p.kind === 'laub'), tannen = spots.filter((p) => p.kind === 'tanne');
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const place = (mesh, i, x, y, z, s, sy = s, rotY = 0) => {
    q.setFromEuler(new THREE.Euler(0, rotY, 0));
    mesh.setMatrixAt(i, m4.compose(v.set(x, y, z), q, sc.set(s, sy, s)));
  };
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.32, 1, 7), lambert(0x7a4a24), spots.length);
  spots.forEach((p, i) => place(trunks, i, p.x, heightAt(p.x, p.z) + 0.8 * p.s, p.z, p.s, 1.6 * p.s));
  const blobs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), lambert(0xffffff, { flatShading: true }), laub.length * 3);
  const greens = [0x3f9c3a, 0x4caf50, 0x5fbf4a, 0x2e8b3d, 0x6cc24a];
  laub.forEach((p, i) => {
    const y = heightAt(p.x, p.z);
    [[-0.55, 2.3, 0, 1.0], [0.6, 2.4, 0.2, 1.05], [0, 3.1, -0.1, 1.15]].forEach(([dx, dy, dz, r], k) => {
      place(blobs, i * 3 + k, p.x + dx * p.s, y + dy * p.s, p.z + dz * p.s, r * p.s, r * p.s * 0.92, rnd(i * 3 + k) * 3);
      blobs.setColorAt(i * 3 + k, tmp.set(greens[Math.floor(rnd(i * 7 + k) * greens.length)]));
    });
  });
  const cones = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 8), lambert(0xffffff, { flatShading: true }), tannen.length * 3);
  tannen.forEach((p, i) => {
    const y = heightAt(p.x, p.z);
    [[1.9, 1.35, 1.6], [2.9, 1.05, 1.4], [3.8, 0.7, 1.2]].forEach(([dy, r, hgt], k) => {
      place(cones, i * 3 + k, p.x, y + dy * p.s, p.z, r * p.s, hgt * p.s, rnd(i + k) * 3);
      cones.setColorAt(i * 3 + k, tmp.set(k === 2 ? 0x2f7d3a : 0x276b33));
    });
  });
  for (const m of [trunks, blobs, cones]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }

  /* Blumen auf der Wiese (weiß, gelb, rosa, lila) */
  const flowerSpots = [];
  for (let i = 0; flowerSpots.length < 170 && i < 2000; i++) {
    const x = -26 + rnd(i * 3) * 52, z = -20 + rnd(i * 3 + 1) * 44;
    if (stations.some((s) => Math.hypot(s.x - x, s.z - z) < 2.2)) continue;
    flowerSpots.push([x, z, i]);
  }
  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 0), lambert(0xffffff), flowerSpots.length);
  const flowerColors = [0xffffff, 0xffe066, 0xff8fb1, 0xc59bff, 0xffffff];
  flowerSpots.forEach(([x, z, i], k) => {
    place(flowers, k, x, heightAt(x, z) + 0.12, z, 1);
    flowers.setColorAt(k, tmp.set(flowerColors[Math.floor(rnd(i + 5) * flowerColors.length)]));
  });
  scene.add(flowers);

  /* ---------- Die Wartburg auf ihrem Berg ---------- */
  const burg = new THREE.Group();
  const by = heightAt(BURG.x, BURG.z);
  burg.position.set(BURG.x, by - 0.6, BURG.z);
  burg.scale.setScalar(0.62);
  const stone = lambert(0xd8ccb6), stoneDark = lambert(0xb9aa90), roofMat = lambert(0xb5402e), roofDark = lambert(0x8f2f22);
  const fachwerk = canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = '#f5efe2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#6b3a1c'; g.lineWidth = 7;
    g.strokeRect(4, 4, w - 8, h - 8);
    for (let x = 0; x <= w; x += 42) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    for (let x = 0; x < w; x += 84) { g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + 42, h); g.stroke(); }
    g.fillStyle = '#3d5a80';
    for (let x = 12; x < w - 20; x += 42) g.fillRect(x, 16, 18, 26);
  });
  const box = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; burg.add(m); return m;
  };
  const roof = (w, h, d, x, y, z, mat = roofMat) => {
    const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    geo.translate(0, 0, -d / 2);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.y = Math.PI / 2; m.position.set(x, y, z); m.castShadow = true; burg.add(m); return m;
  };
  box(30, 3.2, 14, stoneDark, 0, 1.6, 0);                          /* Burgmauer als Sockel */
  box(15, 4.2, 6, stone, -3, 5.3, 1.5);                              /* Palas unten Stein */
  const ober = box(15, 3, 6, new THREE.MeshLambertMaterial({ map: fachwerk }), -3, 8.9, 1.5);
  ober.castShadow = true;
  roof(6.6, 3.6, 15.6, -3, 10.4, 1.5);
  box(8, 5, 5, stone, 8, 5.7, -1);                                   /* Nebengebäude */
  roof(5.6, 2.6, 8.6, 8, 8.2, -1, roofDark);
  const turm = new THREE.Mesh(new THREE.BoxGeometry(3.6, 15, 3.6), stone);   /* Bergfried */
  turm.position.set(-12, 10.5, -1.5); turm.castShadow = true; burg.add(turm);
  const spitze = new THREE.Mesh(new THREE.ConeGeometry(3.2, 5, 4), roofMat);
  spitze.position.set(-12, 20.5, -1.5); spitze.rotation.y = Math.PI / 4; burg.add(spitze);
  const kreuz = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6, 0.25), lambert(0xf2c230));
  kreuz.position.set(-12, 23.6, -1.5); burg.add(kreuz);
  const quer = new THREE.Mesh(new THREE.BoxGeometry(1, 0.25, 0.25), lambert(0xf2c230));
  quer.position.set(-12, 23.9, -1.5); burg.add(quer);
  for (let i = 0; i < 9; i++) box(1, 1, 1, stoneDark, -14 + i * 3.4, 3.7, 6.8);   /* Zinnen */
  scene.add(burg);
  const burgSchild = new THREE.Sprite(new THREE.SpriteMaterial({
    map: canvasTexture(512, 128, (g) => {
      g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.roundRect ? g.roundRect(8, 16, 496, 96, 48) : g.rect(8, 16, 496, 96); g.fill();
      g.fillStyle = '#7c2d12'; g.font = 'bold 64px "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('🏰 Wartburg', 256, 68);
    }),
    depthWrite: false,
  }));
  burgSchild.scale.set(12, 3, 1);
  burgSchild.position.set(BURG.x - 2, by + 18, BURG.z);
  scene.add(burgSchild);

  /* ---------- Wolken ---------- */
  const puffs = [];
  for (let c = 0; c < 10; c++) for (let k = 0; k < 5; k++) puffs.push({ c, k });
  const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), lambert(0xffffff, { emissive: 0x55606a }), puffs.length);
  scene.add(clouds);

  /* ---------- Stationen: Steinsockel, Ring, Lichtsäule, schwebende Rose, Nummer – als Instanzen ---------- */
  const n = stations.length;
  const inst = (geo, mat, count = n) => { const m = new THREE.InstancedMesh(geo, mat, count); scene.add(m); return m; };
  const saeuleGeo = new THREE.CylinderGeometry(0.95, 1.05, 4.5, 24, 1, true);
  saeuleGeo.translate(0, 2.25, 0);
  const sockel = inst(new THREE.CylinderGeometry(1.25, 1.4, 0.24, 24), lambert(0xe2d8c6));
  sockel.castShadow = true; sockel.receiveShadow = true;
  const ringe = inst(new THREE.TorusGeometry(1.05, 0.1, 6, 32), new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x3a2a00, shininess: 80 }));
  const saeulen = inst(saeuleGeo, new THREE.MeshBasicMaterial({
    color: 0xffe27a, transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  }));
  const blueten = inst(new THREE.IcosahedronGeometry(0.36, 1), new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x3a0610, flatShading: true, shininess: 60 }));
  blueten.castShadow = true;
  const blaetter = inst(new THREE.ConeGeometry(0.18, 0.5, 5), lambert(0x2f8f3a), n * 3);
  const dummy = new THREE.Object3D(), blatt = new THREE.Object3D();
  stations.forEach((st, i) => {
    dummy.position.set(st.x, 0.12, st.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    sockel.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 0.26; dummy.rotation.x = Math.PI / 2; dummy.updateMatrix();
    ringe.setMatrixAt(i, dummy.matrix);
  });
  const view = stations.map((st, idx) => {
    const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTexture(String(idx + 1), false), depthWrite: false }));
    badge.scale.set(1.25, 1.25, 1);
    badge.position.set(st.x, 2.75, st.z);
    scene.add(badge);
    return { st, badge, done: null, idx };
  });
  const gold = new THREE.Color(0xf5b301), gruen = new THREE.Color(0x22c55e), rot = new THREE.Color(0xe11d48), rosa = new THREE.Color(0xff6f91);

  /* ---------- Elisabeth ---------- */
  const figur = new THREE.Group();
  const kleid = lambert(0x2563eb), kleidDunkel = lambert(0x1e40af), haut = lambert(0xf6d2b0), mantel = lambert(0xd63a3a, { side: THREE.DoubleSide });
  const kronenGold = new THREE.MeshPhongMaterial({ color: 0xffcc22, emissive: 0x6a4a00, shininess: 90 });
  const teil = (geo, mat, x, y, z, parent = figur) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  teil(new THREE.CylinderGeometry(0.26, 0.78, 1.35, 20), kleid, 0, 0.68, 0);                          /* Rock */
  teil(new THREE.CylinderGeometry(0.21, 0.27, 0.62, 14), kleidDunkel, 0, 1.62, 0);                    /* Oberteil */
  const umhang = teil(new THREE.CylinderGeometry(0.33, 0.84, 1.8, 20, 1, true, Math.PI * 0.45, Math.PI * 1.1), mantel, 0, 1.02, -0.05);
  umhang.castShadow = true;
  teil(new THREE.SphereGeometry(0.3, 18, 14), haut, 0, 2.1, 0);                                         /* Kopf */
  teil(new THREE.SphereGeometry(0.33, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), lambert(0xa8642b), 0, 2.14, -0.04);   /* Haare */
  teil(new THREE.CylinderGeometry(0.2, 0.28, 0.75, 12, 1, true, Math.PI * 0.75, Math.PI * 1.5), lambert(0xa8642b, { side: THREE.DoubleSide }), 0, 1.78, -0.06);
  for (const x of [-0.11, 0.11]) teil(new THREE.SphereGeometry(0.045, 8, 6), lambert(0x1f2937), x, 2.13, 0.27);   /* Augen */
  teil(new THREE.SphereGeometry(0.05, 8, 6), lambert(0xf28c8c), 0, 2.02, 0.29);                           /* Mund/Wangen-Punkt */
  const krone = new THREE.Group(); krone.position.set(0, 2.38, 0); figur.add(krone);
  teil(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 14, 1, true), kronenGold, 0, 0, 0, krone).material.side = THREE.DoubleSide;
  for (let k = 0; k < 5; k++) {
    const z = teil(new THREE.ConeGeometry(0.05, 0.16, 5), kronenGold, Math.cos(k * 1.257) * 0.2, 0.13, Math.sin(k * 1.257) * 0.2, krone);
    z.castShadow = false;
  }
  const arme = [-1, 1].map((sgn) => {
    const schulter = new THREE.Group(); schulter.position.set(0.3 * sgn, 1.86, 0); figur.add(schulter);
    teil(new THREE.CylinderGeometry(0.08, 0.1, 0.62, 8), kleid, 0, -0.3, 0, schulter);
    teil(new THREE.SphereGeometry(0.08, 8, 6), haut, 0, -0.64, 0, schulter);
    return schulter;
  });
  /* Korb mit Brot und Rosen am rechten Arm – das Rosenwunder */
  const korb = new THREE.Group(); korb.position.set(0, -0.72, 0.12); arme[1].add(korb);
  teil(new THREE.CylinderGeometry(0.24, 0.17, 0.22, 12), lambert(0x9a6b33), 0, 0, 0, korb);
  for (let k = 0; k < 4; k++) teil(new THREE.SphereGeometry(0.08, 8, 6), lambert(k % 2 ? 0xe11d48 : 0xd9a05b), Math.cos(k * 1.6) * 0.12, 0.13, Math.sin(k * 1.6) * 0.1, korb);
  scene.add(figur);
  const schatten = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
  schatten.rotation.x = -Math.PI / 2; schatten.position.y = 0.04; scene.add(schatten);

  const ziel = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.48, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
  ziel.rotation.x = -Math.PI / 2; ziel.position.y = 0.06; ziel.visible = false; scene.add(ziel);

  /* ---------- Kamera ---------- */
  function placeCamera(cam) {
    const aspect = width / height;
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const breite = aspect < 1 ? 17 : 24 + 6 * Math.min(1, aspect - 1);     /* sichtbare Breite bei der Figur */
    const d = Math.max(14, Math.min(34, breite / (2 * aspect * t)));
    const neigung = 0.3;                                                    /* ~17°: Horizont, Himmel und Wartburg im Bild */
    const vorn = aspect < 1 ? 9 : 3;                                        /* hochkant mehr Wiese vor Elisabeth zeigen */
    camera.position.set(cam.x, Math.sin(neigung) * d + 1.2, cam.z + Math.cos(neigung) * d);
    camera.lookAt(cam.x, aspect < 1 ? 1 : 3.2, cam.z - vorn);              /* quer: Horizont tiefer, Burg unter der Anzeige */
  }

  /* ---------- Antippen: Punkt auf der Wiese ---------- */
  const ray = new THREE.Raycaster(), ebene = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function groundAt(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera({ x: ((cx - r.left) / r.width) * 2 - 1, y: -((cy - r.top) / r.height) * 2 + 1 }, camera);
    if (!ray.ray.intersectPlane(ebene, hit)) return null;
    if (hit.distanceTo(camera.position) > 120) return null;
    return { x: hit.x, z: hit.z };
  }

  let lastX = null, lastZ = null, richtung = 0;
  function draw({ player, cam, done, time, moving, target }) {
    /* Wolken ziehen langsam */
    puffs.forEach(({ c, k }, i) => {
      const x = ((c * 47 + time * (0.6 + rnd(c) * 0.5)) % 260) - 130;
      const y = 34 + rnd(c + 30) * 16, z = -75 + rnd(c + 60) * 55;
      const s = (3 + rnd(i) * 2.4) * (k === 2 ? 1.4 : 1);
      place(clouds, i, x + (k - 2) * 3.1, y + (k === 2 ? 1.2 : rnd(i + 3)), z + rnd(i + 9) * 2, s, s * 0.62);
    });
    clouds.instanceMatrix.needsUpdate = true;

    /* Stationen */
    view.forEach((v) => {
      const { st, idx } = v;
      const isDone = done.has(idx);
      if (isDone !== v.done) {
        v.done = isDone;
        v.badge.material.map.dispose();
        v.badge.material.map = badgeTexture(isDone ? '✓' : String(idx + 1), isDone);
        ringe.setColorAt(idx, isDone ? gruen : gold);
        blueten.setColorAt(idx, isDone ? rosa : rot);
        ringe.instanceColor.needsUpdate = true;
        blueten.instanceColor.needsUpdate = true;
      }
      const bob = Math.sin(time * 2.6 + idx) * 0.16;
      dummy.position.set(st.x, 1.55 + bob, st.z); dummy.rotation.set(0, time * 1.2 + idx, 0); dummy.scale.set(1, 0.8, 1); dummy.updateMatrix();
      blueten.setMatrixAt(idx, dummy.matrix);
      dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      for (let k = 0; k < 3; k++) {
        blatt.position.set(Math.cos(k * 2.1) * 0.28, -0.26, Math.sin(k * 2.1) * 0.28);
        blatt.rotation.set(Math.sin(k * 2.1) * 1.6, 0, -Math.cos(k * 2.1) * 1.6);
        blatt.updateMatrix();
        blaetter.setMatrixAt(idx * 3 + k, m4.multiplyMatrices(dummy.matrix, blatt.matrix));
      }
      dummy.position.set(st.x, 0, st.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(isDone ? 0 : 1); dummy.updateMatrix();
      saeulen.setMatrixAt(idx, dummy.matrix);
      v.badge.position.y = 2.75 + bob;
    });
    blueten.instanceMatrix.needsUpdate = true;
    blaetter.instanceMatrix.needsUpdate = true;
    saeulen.instanceMatrix.needsUpdate = true;
    ringe.instanceMatrix.needsUpdate = true;
    saeulen.material.opacity = 0.2 + 0.08 * Math.sin(time * 3);

    /* Elisabeth: dreht sich in Laufrichtung, wippt und schwingt die Arme */
    if (lastX !== null) {
      const dx = player.x - lastX, dz = player.z - lastZ;
      if (Math.hypot(dx, dz) > 0.002) {
        const soll = Math.atan2(dx, dz);
        let diff = soll - richtung;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        richtung += diff * 0.25;
      }
    }
    lastX = player.x; lastZ = player.z;
    const schritt = Math.sin(player.walkAnim);
    figur.position.set(player.x, moving ? Math.abs(schritt) * 0.14 : Math.sin(time * 2) * 0.015, player.z);
    figur.rotation.y = richtung;
    figur.rotation.z = moving ? schritt * 0.04 : 0;
    arme[0].rotation.x = moving ? schritt * 0.7 : 0.08;
    arme[1].rotation.x = moving ? -schritt * 0.35 - 0.5 : -0.5;
    schatten.position.x = player.x; schatten.position.z = player.z;

    ziel.visible = !!target;
    if (target) {
      ziel.position.x = target.x; ziel.position.z = target.z;
      const s = 1 + 0.15 * Math.sin(time * 6);
      ziel.scale.set(s, s, 1);
    }

    placeCamera(cam);
    renderer.render(scene, camera);
  }

  return {
    renderer,
    resize(w, h) {
      width = Math.max(1, w); height = Math.max(1, h);
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    draw,
    groundAt,
    setDetail(stufe) {
      sun.castShadow = stufe < 1;
      flowers.visible = stufe < 2;
      clouds.visible = stufe < 2;
    },
  };
}
