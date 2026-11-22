import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fromExoClock, fromNasa, fromToi, isReject, mergeSources, mmagToPpt, normName, packCatalog, parseRefLink, parseSexagesimal, unpackCatalog } from '../src/lib/catalog/normalize';
import { checkCatalogFile } from '../src/lib/catalog/check';
import type { Target } from '../src/lib/catalog/types';

// Records copied verbatim from the upstream services on 2026-11-21.
const NASA_ROW = {
  pl_name: 'Kepler-257 d', hostname: 'Kepler-257', ra: 297.3159994, dec: 46.0232642, sy_vmag: 15.652, sy_gaiamag: 15.4215, sy_tmag: 14.7942,
  pl_tranmid: 2455022.02052, pl_tranmiderr1: 0.00102, pl_tranmiderr2: -0.00102, pl_orbper: 24.664551, pl_orbpererr1: 0.000051, pl_orbpererr2: -0.000051,
  pl_trandur: 2.655, pl_trandep: 0.26249, pl_ratror: 0.0519, tran_flag: 1,
  pl_tranmid_reflink: '<a refstr=ROWE_ET_AL__2014 href=https://ui.adsabs.harvard.edu/abs/2014ApJ...784...45R/abstract target=ref> Rowe et al. 2014</a>',
};
const EXOCLOCK_ENTRY = {
  name: '55Cnce', priority: 'high', total_observations_recent: 0, current_oc_min: 0.0, depth_r_mmag: 0.45, duration_hours: 1.56,
  ephem_mid_time: 2459554.20747, ephem_mid_time_e1: 0.0001, ephem_mid_time_e2: -0.0001, ephem_mid_time_format: 'BJD_TDB',
  ephem_period: 0.73654635, ephem_period_e1: 1.4e-7, ephem_period_e2: -1.4e-7, ephem_parameters_ref: 'OSF.IO', star: '55Cnc',
  ra_j2000: '08:52:35.8113', dec_j2000: '+28:19:50.956', v_mag: 5.96, r_mag: 5.4, gaia_g_mag: 5.714, min_telescope_inches: 71.29,
  t0_bjd_tdb: 2459554.20747, t0_unc: 0.0001, period_days: 0.73654635, period_unc: 1.4e-7,
};
const TOI_ROW = {
  toi: '1032.01', tid: 146589986, tfopwg_disp: 'PC', ra: 159.221506, dec: -42.541639, st_tmag: 9.7611, pl_tranmid: 2459283.828685,
  pl_tranmiderr1: 0.000897, pl_orbper: 5.6643704, pl_orbpererr1: 0.0000109, pl_trandurh: 3.8087395, pl_trandep: 3491.8232968,
};

describe('normalization', () => {
  it('names and sexagesimal', () => {
    expect(normName('55 Cnc e')).toBe(normName('55Cnce'));
    expect(normName('WASP-12 b')).toBe('wasp-12b');
    expect(parseSexagesimal('08:52:35.8113') * 15).toBeCloseTo(133.149214, 5);
    expect(parseSexagesimal('-00:30:00')).toBeCloseTo(-0.5, 9);
    expect(parseRefLink(NASA_ROW.pl_tranmid_reflink)).toBe('Rowe et al. 2014');
  });
  it('NASA row: percent depth -> ppt', () => {
    const t = fromNasa(NASA_ROW) as Target;
    expect(isReject(t)).toBe(false);
    expect(t.depthPpt).toBeCloseTo(2.6249, 4);
    expect(t.t0Err).toBeCloseTo(0.00102);
    expect(t.source).toBe('nasa');
  });
  it('NASA row without depth falls back to (Rp/Rs)^2 and flags it', () => {
    const t = fromNasa({ ...NASA_ROW, pl_trandep: null }) as Target;
    expect(t.depthPpt).toBeCloseTo(0.0519 ** 2 * 1000, 4);
    expect(t.depthEstimated).toBe(true);
    expect(isReject(fromNasa({ ...NASA_ROW, pl_trandur: null }))).toBe(true);
  });
  it('ExoClock entry: mmag -> ppt, BJD_TDB only', () => {
    const t = fromExoClock(EXOCLOCK_ENTRY) as Target;
    expect(t.depthPpt).toBeCloseTo(mmagToPpt(0.45), 6);
    expect(t.depthPpt).toBeCloseTo(0.4144, 3);
    expect(t.priority).toBe('high');
    expect(t.ra).toBeCloseTo(133.14921, 4);
    expect(isReject(fromExoClock({ ...EXOCLOCK_ENTRY, ephem_mid_time_format: 'HJD_UTC' }))).toBe(true);
  });
  it('TOI row: ppm -> ppt, Tmag only', () => {
    const t = fromToi(TOI_ROW) as Target;
    expect(t.name).toBe('TOI-1032.01');
    expect(t.depthPpt).toBeCloseTo(3.4918, 3);
    expect(t.vmag).toBeNull();
    expect(t.tmag).toBeCloseTo(9.7611);
  });
});

describe('merge', () => {
  const nasa55 = fromNasa({ ...NASA_ROW, pl_name: '55 Cnc e', hostname: '55 Cnc', ra: 133.1492, dec: 28.3308, pl_orbper: 0.7365474, sy_tmag: 4.9 }) as Target;
  const kepler = fromNasa(NASA_ROW) as Target;
  const ec = fromExoClock(EXOCLOCK_ENTRY) as Target;
  it('ExoClock ephemeris takes precedence, NASA name/host kept', () => {
    const { targets, stats } = mergeSources([nasa55, kepler], [ec]);
    expect(stats.matchedByName).toBe(1);
    expect(stats.nasaOnly).toBe(1);
    const m = targets.find((t) => t.id === '55cnce')!;
    expect(m.name).toBe('55 Cnc e');
    expect(m.source).toBe('exoclock');
    expect(m.t0).toBe(EXOCLOCK_ENTRY.t0_bjd_tdb);
    expect(m.tmag).toBe(4.9);
  });
  it('falls back to position + period matching', () => {
    const renamed = { ...ec, id: 'rho1cnce', name: 'rho1 Cnc e' };
    const { stats } = mergeSources([nasa55], [renamed]);
    expect(stats.matchedByPosition).toBe(1);
  });
  it('pack/unpack round trip passes the structural check', () => {
    const file = packCatalog([nasa55, kepler, ec], [], '2026-11-21T00:00:00Z');
    expect(checkCatalogFile(file)).toEqual([]);
    const back = unpackCatalog(file);
    expect(back[1].name).toBe('Kepler-257 d');
    expect(back[1].period).toBeCloseTo(24.664551, 9);
  });
});

describe('committed snapshot', () => {
  it('public/data/catalog.json and toi.json are valid', () => {
    for (const f of ['catalog.json', 'toi.json']) {
      const data = JSON.parse(readFileSync(new URL(`../public/data/${f}`, import.meta.url), 'utf8'));
      expect(checkCatalogFile(data)).toEqual([]);
    }
  });
});
