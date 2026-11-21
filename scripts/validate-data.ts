/**
 * Build-time data check. A bad equipment entry or a malformed catalog snapshot
 * fails `npm run build` (and CI).
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateEquipment } from '../src/lib/equipment/validate';
import { checkCatalogFile } from '../src/lib/catalog/check';

const root = fileURLToPath(new URL('..', import.meta.url));
let failed = false;

const eqPath = `${root}public/data/equipment.json`;
const eq = JSON.parse(readFileSync(eqPath, 'utf8'));
const res = validateEquipment(eq);
for (const i of res.issues) console.log(`${i.level === 'error' ? 'ERROR  ' : 'warning'} ${i.path}: ${i.message}`);
if (!res.valid) {
  failed = true;
  console.error('equipment.json: INVALID');
} else console.log(`equipment.json: OK (${res.issues.length} warning(s))`);

for (const name of ['catalog.json', 'toi.json']) {
  const p = `${root}public/data/${name}`;
  if (!existsSync(p)) {
    console.error(`${name}: missing (run npm run catalog:build)`);
    failed = true;
    continue;
  }
  const problems = checkCatalogFile(JSON.parse(readFileSync(p, 'utf8')));
  if (problems.length) {
    failed = true;
    console.error(`${name}: INVALID\n  ${problems.slice(0, 20).join('\n  ')}`);
  } else console.log(`${name}: OK`);
}

if (failed) process.exit(1);
