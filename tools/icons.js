#!/usr/bin/env node
/* Erzeugt die App-Icons (Home-Bildschirm, PWA) aus public/icons/icon.svg:
   icon-192.png, icon-512.png (Manifest) und apple-touch-icon.png (180×180, iPhone/iPad).
   Aufruf: node tools/icons.js */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, launchBrowser } from './lib.js';

const DIR = path.join(ROOT, 'public/icons');
const svg = fs.readFileSync(path.join(DIR, 'icon.svg'), 'utf8');
const browser = await launchBrowser();
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: path.join(DIR, name) });
  await page.close();
  console.log(`✓ public/icons/${name} (${size}×${size})`);
}
await browser.close();
