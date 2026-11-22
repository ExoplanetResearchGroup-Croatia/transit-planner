import type { CatalogFile } from './types';
import { CATALOG_FIELDS } from './types';

/** Structural check of a catalog snapshot. Returns a list of problems (empty = OK). */
export function checkCatalogFile(f: Partial<CatalogFile>): string[] {
  const p: string[] = [];
  if (f.format !== 'transit-planner-catalog') p.push('format is not "transit-planner-catalog"');
  if (f.formatVersion !== 1) p.push('formatVersion is not 1');
  if (!f.generated || Number.isNaN(Date.parse(f.generated))) p.push('generated is not a timestamp');
  if (!Array.isArray(f.fields)) return [...p, 'fields missing'];
  for (const need of CATALOG_FIELDS) if (!f.fields.includes(need)) p.push(`field "${need}" missing`);
  if (!Array.isArray(f.rows) || f.rows.length === 0) return [...p, 'rows missing or empty'];
  const at = (name: string) => f.fields!.indexOf(name as never);
  const [ra, dec, per, dur, dep, t0, name] = ['ra', 'dec', 'period', 'durationH', 'depthPpt', 't0', 'name'].map(at);
  f.rows.forEach((r, i) => {
    if (!Array.isArray(r) || r.length !== f.fields!.length) {
      p.push(`row ${i}: wrong length`);
      return;
    }
    const bad = (cond: boolean, what: string) => cond && p.push(`row ${i} (${String(r[name])}): ${what}`);
    bad(!(typeof r[ra] === 'number' && r[ra] >= 0 && r[ra] < 360), 'ra out of range');
    bad(!(typeof r[dec] === 'number' && r[dec] >= -90 && r[dec] <= 90), 'dec out of range');
    bad(!(typeof r[per] === 'number' && r[per] > 0), 'period not positive');
    bad(!(typeof r[dur] === 'number' && r[dur] > 0 && r[dur] < 72), 'duration out of range');
    bad(!(typeof r[dep] === 'number' && r[dep] > 0), 'depth not positive');
    bad(!(typeof r[t0] === 'number' && r[t0] > 2400000), 'T0 not a BJD');
  });
  return p;
}
