/**
 * Builds the static catalog snapshot served with the site:
 *   public/data/catalog.json       NASA Exoplanet Archive (pscomppars) merged with ExoClock
 *   public/data/toi.json           TESS TOI candidates (PC/APC), optional in the UI
 *   public/data/catalog-meta.json  version + counts, fetched first by the client
 *
 * Replaces the Netlify scheduled function from the original plan: GitHub Pages
 * is static, so a GitHub Actions workflow (.github/workflows/refresh-catalog.yml)
 * runs this script and commits the result. Neither NASA nor ExoClock send CORS
 * headers (checked 2026-11-21), so browsers cannot query them directly anyway.
 *
 * On any failure of NASA or ExoClock the script exits non-zero and leaves the
 * existing snapshot untouched (the committed snapshot is the fallback). A TOI
 * failure keeps the previous toi.json.
 *
 * Usage: npm run catalog:build [-- --cache DIR]   (--cache reuses raw downloads, for development)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fromExoClock, fromNasa, fromToi, isReject, mergeSources, packCatalog, type Reject } from '../src/lib/catalog/normalize';
import type { CatalogFile, CatalogSourceInfo, Target } from '../src/lib/catalog/types';
import { checkCatalogFile } from '../src/lib/catalog/check';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = `${root}public/data/`;
const cacheArg = process.argv.indexOf('--cache');
const cacheDir = cacheArg > 0 ? process.argv[cacheArg + 1] : null;

const TAP = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const NASA_QUERY =
  'select pl_name,hostname,ra,dec,sy_vmag,sy_gaiamag,sy_tmag,pl_tranmid,pl_tranmiderr1,pl_tranmiderr2,' +
  'pl_orbper,pl_orbpererr1,pl_orbpererr2,pl_trandur,pl_trandep,pl_ratror,pl_rade,st_rad,pl_tranmid_reflink ' +
  'from pscomppars where tran_flag=1';
const TOI_QUERY =
  "select toi,tid,tfopwg_disp,ra,dec,st_tmag,pl_tranmid,pl_tranmiderr1,pl_tranmiderr2,pl_orbper,pl_orbpererr1,pl_orbpererr2,pl_trandurh,pl_trandep " +
  "from toi where tfopwg_disp='PC' or tfopwg_disp='APC'";
const EXOCLOCK_URL = 'https://www.exoclock.space/database/planets_json';

async function fetchJson(url: string, label: string, timeoutMs: number): Promise<unknown> {
  const cacheFile = cacheDir ? `${cacheDir}/${label}.json` : null;
  if (cacheFile && existsSync(cacheFile)) {
    console.log(`${label}: using cache ${cacheFile}`);
    return JSON.parse(readFileSync(cacheFile, 'utf8'));
  }
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const t0 = Date.now();
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': 'transit-planner-catalog-builder' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const data = JSON.parse(text);
      console.log(`${label}: ${(text.length / 1e6).toFixed(2)} MB in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
      if (cacheFile) {
        mkdirSync(cacheDir!, { recursive: true });
        writeFileSync(cacheFile, text);
      }
      return data;
    } catch (e) {
      lastErr = e;
      console.warn(`${label}: attempt ${attempt} failed: ${String(e)}`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  throw new Error(`${label}: giving up (${String(lastErr)})`);
}

function normalizeAll<T>(rows: T[], fn: (r: T) => Target | Reject, label: string): Target[] {
  const out: Target[] = [];
  const reasons = new Map<string, number>();
  for (const r of rows) {
    const t = fn(r);
    if (isReject(t)) reasons.set(t.reason, (reasons.get(t.reason) ?? 0) + 1);
    else out.push(t);
  }
  const dropped = [...reasons.entries()].map(([k, v]) => `${k}: ${v}`).join(', ');
  console.log(`${label}: ${out.length} usable of ${rows.length}${dropped ? ` (dropped ${dropped})` : ''}`);
  return out;
}

function writeJson(name: string, data: unknown) {
  writeFileSync(`${outDir}${name}`, JSON.stringify(data));
  console.log(`wrote public/data/${name}`);
}

/**
 * Catalog files are written with one row per line so that git stores small
 * deltas, and they are only rewritten when the data changed (ignoring the
 * timestamp). Returns the file that is current after the call.
 */
function writeCatalogIfChanged(name: string, file: CatalogFile): CatalogFile {
  const path = `${outDir}${name}`;
  if (existsSync(path)) {
    const prev = JSON.parse(readFileSync(path, 'utf8')) as CatalogFile;
    const same =
      JSON.stringify(prev.fields) === JSON.stringify(file.fields) &&
      JSON.stringify(prev.rows) === JSON.stringify(file.rows) &&
      JSON.stringify(prev.sources.map((s) => [s.id, s.count])) === JSON.stringify(file.sources.map((s) => [s.id, s.count]));
    if (same) {
      console.log(`public/data/${name}: unchanged`);
      return prev;
    }
  }
  const { rows, ...head } = file;
  const text = `${JSON.stringify(head).slice(0, -1)},"rows":[\n${rows.map((r) => JSON.stringify(r)).join(',\n')}\n]}\n`;
  JSON.parse(text); // sanity
  writeFileSync(path, text);
  console.log(`wrote public/data/${name} (${rows.length} rows)`);
  return file;
}

async function main() {
  const generated = new Date().toISOString();
  const today = generated.slice(0, 10);

  const nasaRows = (await fetchJson(`${TAP}?query=${encodeURIComponent(NASA_QUERY)}&format=json`, 'nasa', 180_000)) as Record<string, unknown>[];
  const ecRaw = (await fetchJson(EXOCLOCK_URL, 'exoclock', 420_000)) as Record<string, Record<string, unknown>>;
  const nasa = normalizeAll(nasaRows, fromNasa, 'NASA pscomppars');
  const exoclock = normalizeAll(Object.values(ecRaw), fromExoClock, 'ExoClock');
  if (nasa.length < 1000) throw new Error(`NASA returned only ${nasa.length} usable rows; refusing to overwrite snapshot`);
  if (exoclock.length < 100) throw new Error(`ExoClock returned only ${exoclock.length} usable rows; refusing to overwrite snapshot`);

  const { targets, stats } = mergeSources(nasa, exoclock);
  console.log(`merge: ${JSON.stringify(stats)} -> ${targets.length} targets`);

  const sources: CatalogSourceInfo[] = [
    { id: 'nasa', name: 'NASA Exoplanet Archive, Planetary Systems Composite Parameters', url: 'https://exoplanetarchive.ipac.caltech.edu/', retrieved: today, count: nasa.length },
    { id: 'exoclock', name: 'ExoClock project', url: 'https://www.exoclock.space/', retrieved: today, count: exoclock.length },
  ];
  const catalog = packCatalog(targets, sources, generated);
  const problems = checkCatalogFile(catalog);
  if (problems.length) throw new Error(`catalog failed checks:\n${problems.slice(0, 20).join('\n')}`);

  let toiFile: ReturnType<typeof packCatalog> | null = null;
  try {
    const toiRows = (await fetchJson(`${TAP}?query=${encodeURIComponent(TOI_QUERY)}&format=json`, 'toi', 180_000)) as Record<string, unknown>[];
    const known = new Set(targets.map((t) => t.id));
    const toi = normalizeAll(toiRows, fromToi, 'TOI').filter((t) => !known.has(t.id));
    toiFile = packCatalog(toi, [{ id: 'toi', name: 'NASA Exoplanet Archive, TESS Project Candidates (TOI)', url: 'https://exoplanetarchive.ipac.caltech.edu/', retrieved: today, count: toi.length }], generated);
    const tp = checkCatalogFile(toiFile);
    if (tp.length) throw new Error(tp.slice(0, 5).join('; '));
  } catch (e) {
    console.warn(`TOI refresh failed, keeping previous toi.json: ${String(e)}`);
    toiFile = null;
  }

  const catCurrent = writeCatalogIfChanged('catalog.json', catalog);
  const toiCurrent: CatalogFile = toiFile ? writeCatalogIfChanged('toi.json', toiFile) : JSON.parse(readFileSync(`${outDir}toi.json`, 'utf8'));
  const meta = {
    generated: catCurrent.generated > toiCurrent.generated ? catCurrent.generated : toiCurrent.generated,
    catalog: { count: catCurrent.rows.length, generated: catCurrent.generated },
    toi: { count: toiCurrent.rows.length, generated: toiCurrent.generated },
    sources: [...catCurrent.sources, ...toiCurrent.sources],
  };
  const metaPath = `${outDir}catalog-meta.json`;
  if (!existsSync(metaPath) || readFileSync(metaPath, 'utf8') !== JSON.stringify(meta)) writeJson('catalog-meta.json', meta);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
