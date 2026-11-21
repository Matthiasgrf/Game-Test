#!/usr/bin/env node
/* Die schnellen Checks wie im Workflow „Spiele prüfen“, lokal in einem Befehl (npm run test:schnell):
   TypeScript, check.js, was hat sich seit dem Abzweig von main geändert (auch nicht eingecheckt),
   dann – außer bei reiner Doku – alle Seiten auf dem Handy laden und nur die geänderten Spiele durchspielen.
   Vor dem Pull Request zusätzlich npm test (alles, alle Größen) laufen lassen. */
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib.js';

const run = (cmd, args) => {
  console.log(`\n▶ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
};

try {
  run('npx', ['tsc', '-b']);
  run('node', ['tools/check.js']);
  const result = JSON.parse(execFileSync('node', ['tools/geaendert.js'], { cwd: ROOT, encoding: 'utf8' }));
  console.log(`\nGeändert: ${result.dateien ?? 'unbekannt'} Dateien (${result.basis}) – ${result.alle ? 'betrifft alle Spiele' : result.spiele.join(', ') || 'keine Spiele'}`);
  if (!result.browser) {
    console.log('✓ Nur Doku/Datenbank geändert – keine Browser-Tests nötig.');
    process.exit(0);
  }
  run('node', ['tools/smoke.js', '--groesse', 'handy']);
  if (result.durchspielen.length) run('node', ['tools/spieltest.js', result.durchspielen.join(',')]);
  else console.log('\nKeine Durchspiel-Tests betroffen.');
} catch {
  process.exit(1);
}
