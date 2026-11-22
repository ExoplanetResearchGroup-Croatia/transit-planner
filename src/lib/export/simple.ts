/** CSV, iCalendar and plan JSON exporters. */
import type { Job, Plan } from './model';
import { formatDec, formatRa } from './model';
import { formatDateTime } from '../astro/tz';

const iso = (ms: number) => new Date(Math.round(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(Number(v.toFixed(6))) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_COLUMNS = [
  'name', 'host', 'night', 'ra_deg', 'dec_deg', 'ra_hms', 'dec_dms', 'mag', 'mag_band', 'depth_ppt', 'duration_h',
  'start_utc', 'obs_start_utc', 'ingress_utc', 'mid_utc', 'egress_utc', 'obs_end_utc',
  'start_local', 'obs_start_local', 'ingress_local', 'mid_local', 'egress_local', 'obs_end_local',
  'sigma_min', 'coverage', 'alt_mid_deg', 'moon_sep_deg', 'meridian_flip_utc', 'exposure_s', 'exoclock_priority', 'source', 'score', 'warnings',
] as const;

export function buildCsv(plan: Plan): string {
  const tz = plan.site.tz;
  const rows = [...plan.jobs]
    .sort((a, b) => a.startMs - b.startMs)
    .map((j) =>
      [
        j.name, j.host, j.night, j.ra, j.dec, formatRa(j.ra), formatDec(j.dec).replace('−', '-'), j.mag, j.magBand, j.depthPpt, j.durationH,
        iso(j.startMs), iso(j.obsStartMs), iso(j.ingressMs), iso(j.midMs), iso(j.egressMs), iso(j.obsEndMs),
        formatDateTime(j.startMs, tz), formatDateTime(j.obsStartMs, tz), formatDateTime(j.ingressMs, tz), formatDateTime(j.midMs, tz),
        formatDateTime(j.egressMs, tz), formatDateTime(j.obsEndMs, tz),
        j.sigmaMin === null ? '' : Number(j.sigmaMin.toFixed(2)), j.coverage, Number(j.altMid.toFixed(1)), Number(j.moonSepDeg.toFixed(1)),
        j.flipMs === null ? '' : iso(j.flipMs), j.exposureS, j.priority, j.source, Number(j.score.toFixed(4)), j.warnings.join(' '),
      ].map(csvCell).join(','),
    );
  return `${CSV_COLUMNS.join(',')}\r\n${rows.join('\r\n')}\r\n`;
}

/** RFC 5545 text escaping */
function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      len = 0;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const icsDate = (ms: number) => iso(ms).replace(/[-:]/g, '');

export function buildIcs(plan: Plan): string {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TransitPlanner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  const stamp = icsDate(Date.parse(plan.generated));
  for (const j of [...plan.jobs].sort((a, b) => a.startMs - b.startMs)) {
    const desc = [
      `Ingress ${iso(j.ingressMs)}, mid ${iso(j.midMs)}, egress ${iso(j.egressMs)} (UTC)`,
      `Observe ${iso(j.obsStartMs)} to ${iso(j.obsEndMs)}; slew/center from ${iso(j.startMs)}`,
      `RA ${formatRa(j.ra)}, Dec ${formatDec(j.dec).replace('−', '-')}`,
      `Depth ${j.depthPpt.toFixed(2)} ppt, duration ${j.durationH.toFixed(2)} h, mag ${j.mag ?? '?'} ${j.magBand ?? ''}`,
      j.sigmaMin !== null ? `Ephemeris uncertainty ±${j.sigmaMin.toFixed(1)} min` : 'Ephemeris uncertainty unknown',
      j.warnings.length ? `Warnings: ${j.warnings.join(', ')}` : '',
    ].filter(Boolean).join('\n');
    L.push(
      'BEGIN:VEVENT',
      `UID:${j.id.replace(/[^A-Za-z0-9@._-]/g, '_')}@transit-planner`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(j.startMs)}`,
      `DTEND:${icsDate(j.obsEndMs)}`,
      `SUMMARY:${icsText(`Transit: ${j.name}`)}`,
      `LOCATION:${icsText(`${plan.site.name} (${plan.site.lat.toFixed(4)}, ${plan.site.lon.toFixed(4)})`)}`,
      `DESCRIPTION:${icsText(desc)}`,
      'END:VEVENT',
    );
  }
  L.push('END:VCALENDAR');
  return `${L.map(fold).join('\r\n')}\r\n`;
}

export function buildPlanJson(plan: Plan): string {
  return JSON.stringify(
    {
      format: 'transit-planner-plan',
      formatVersion: 1,
      ...plan,
      jobs: plan.jobs.map((j: Job) => ({
        ...j,
        startUtc: iso(j.startMs),
        obsStartUtc: iso(j.obsStartMs),
        ingressUtc: iso(j.ingressMs),
        midUtc: iso(j.midMs),
        egressUtc: iso(j.egressMs),
        obsEndUtc: iso(j.obsEndMs),
      })),
    },
    null,
    2,
  );
}
