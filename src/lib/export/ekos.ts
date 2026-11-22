/**
 * Ekos/KStars scheduler export.
 *
 * Format reference (see docs/export-formats.md):
 *  - .esl writer: KStars stable-3.8.5 SchedulerProcess::saveScheduler (SchedulerList version 2.2);
 *    stable-3.7.9 writes version 2.1 with the same <Job> block and older Startup/Shutdown blocks.
 *  - .esl reader: SchedulerUtils::createJob. Start/finish times are parsed with
 *    QDateTime::fromString(value, Qt::ISODate). KStars itself writes them without a
 *    UTC offset, i.e. as local time of the KStars computer; we do the same.
 *  - .esq writer: KStars stable-3.8.5 SequenceJob::saveTo (SequenceQueue version 2.6),
 *    checked against the KStars test fixture Tests/ekos/scheduler/3x30s_Red.esq.
 */
import type { Job } from './model';
import { wallClock } from '../astro/tz';

export const EKOS_FORMATS = {
  '2.2': 'KStars 3.8.x (SchedulerList 2.2)',
  '2.1': 'KStars 3.7.x (SchedulerList 2.1)',
} as const;
export type EkosFormat = keyof typeof EKOS_FORMATS;

export interface EkosOptions {
  format: EkosFormat;
  /** IANA zone of the KStars computer's clock (normally the site zone) */
  tz: string;
  profile: string;
  /** absolute path of the .esq on the KStars computer */
  sequencePath: string;
  group: string;
  minAltitude: number;
  moonSeparation: number | null;
  enforceTwilight: boolean;
  enforceArtificialHorizon: boolean;
  steps: { track: boolean; focus: boolean; align: boolean; guide: boolean };
}

export const DEFAULT_EKOS_OPTIONS: Omit<EkosOptions, 'tz'> = {
  format: '2.2',
  profile: 'Default',
  sequencePath: '/home/user/transits/transit.esq',
  group: 'Transits',
  minAltitude: 0,
  moonSeparation: null,
  enforceTwilight: false,
  enforceArtificialHorizon: false,
  steps: { track: true, focus: true, align: true, guide: true },
};

/** XML escaping as done by KStars' entityXML for text content. */
export function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
}

/** Local wall-clock time "YYYY-MM-DDTHH:MM:SS" (Qt::ISODate without offset). */
export function isoLocal(ms: number, tz: string): string {
  const w = wallClock(ms, tz);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${w.year}-${p(w.month)}-${p(w.day)}T${p(w.hour)}:${p(w.minute)}:${p(w.second)}`;
}

/** QLocale::c().toString(double) uses 6 significant digits; we keep more precision (the reader accepts any). */
const num = (x: number, digits = 6) => String(Number(x.toFixed(digits)));

export function buildEsl(jobs: Job[], o: EkosOptions): string {
  const L: string[] = [];
  L.push('<?xml version="1.0" encoding="UTF-8"?>');
  L.push(`<SchedulerList version='${o.format}'>`);
  L.push(`<Profile>${xmlEscape(o.profile)}</Profile>`);
  for (const j of [...jobs].sort((a, b) => a.startMs - b.startMs)) {
    L.push('<Job>');
    L.push("<JobType lead='true'/>");
    L.push(`<Name>${xmlEscape(j.name)}</Name>`);
    L.push(`<Group>${xmlEscape(o.group)}</Group>`);
    L.push('<Coordinates>');
    L.push(`<J2000RA>${num(j.ra / 15, 7)}</J2000RA>`);
    L.push(`<J2000DE>${num(j.dec, 6)}</J2000DE>`);
    L.push('</Coordinates>');
    L.push('<PositionAngle>0</PositionAngle>');
    L.push(`<Sequence>${xmlEscape(o.sequencePath)}</Sequence>`);
    L.push('<StartupCondition>');
    L.push(`<Condition value='${isoLocal(j.startMs, o.tz)}'>At</Condition>`);
    L.push('</StartupCondition>');
    L.push('<Constraints>');
    if (o.minAltitude > 0) L.push(`<Constraint value='${num(o.minAltitude, 2)}'>MinimumAltitude</Constraint>`);
    if (o.moonSeparation && o.moonSeparation > 0) L.push(`<Constraint value='${num(o.moonSeparation, 2)}'>MoonSeparation</Constraint>`);
    if (o.enforceTwilight) L.push('<Constraint>EnforceTwilight</Constraint>');
    if (o.enforceArtificialHorizon) L.push('<Constraint>EnforceArtificialHorizon</Constraint>');
    L.push('</Constraints>');
    L.push('<CompletionCondition>');
    L.push(`<Condition value='${isoLocal(j.obsEndMs, o.tz)}'>At</Condition>`);
    L.push('</CompletionCondition>');
    L.push('<Steps>');
    if (o.steps.track) L.push('<Step>Track</Step>');
    if (o.steps.focus) L.push('<Step>Focus</Step>');
    if (o.steps.align) L.push('<Step>Align</Step>');
    if (o.steps.guide) L.push('<Step>Guide</Step>');
    L.push('</Steps>');
    L.push('</Job>');
  }
  L.push("<SchedulerAlgorithm value='1'/>");
  L.push("<ErrorHandlingStrategy value='0'>");
  L.push('<delay>0</delay>');
  L.push('</ErrorHandlingStrategy>');
  if (o.format === '2.2') {
    L.push("<StartupProcedure enabled='false'>");
    L.push('</StartupProcedure>');
    L.push("<ShutdownProcedure enabled='false'>");
    L.push('</ShutdownProcedure>');
  } else {
    L.push('<StartupProcedure>');
    L.push('</StartupProcedure>');
    L.push('<ShutdownProcedure>');
    L.push('</ShutdownProcedure>');
  }
  L.push('</SchedulerList>');
  return `${L.join('\n')}\n`;
}

export interface EsqOptions {
  observer: string;
  exposureS: number;
  /** filter name exactly as configured in the filter wheel; empty = no filter element */
  filter: string;
  binning: number;
  frameW: number;
  frameH: number;
  temperature: number | null;
  /** Mono or Color */
  format: 'Mono' | 'Color';
  count: number;
  fitsDirectory: string;
}

/**
 * Starter capture sequence. Dithering and in-sequence refocusing are disabled
 * on purpose (they move stars on the detector and hurt differential photometry).
 * With a finish-at completion condition, Ekos repeats the sequence until the
 * finish time, so the count only sets the length of one pass.
 */
export function buildEsq(o: EsqOptions): string {
  const L: string[] = [];
  L.push('<?xml version="1.0" encoding="UTF-8"?>');
  L.push("<SequenceQueue version='2.6'>");
  L.push(`<Observer>${xmlEscape(o.observer)}</Observer>`);
  L.push("<GuideDeviation enabled='false'>2</GuideDeviation>");
  L.push("<GuideStartDeviation enabled='false'>2</GuideStartDeviation>");
  L.push("<HFRCheck enabled='false'>");
  L.push('<HFRDeviation>0.5</HFRDeviation>');
  L.push('<HFRCheckAlgorithm>0</HFRCheckAlgorithm>');
  L.push('<HFRCheckThreshold>10</HFRCheckThreshold>');
  L.push('<HFRCheckFrames>1</HFRCheckFrames>');
  L.push('</HFRCheck>');
  L.push("<RefocusOnTemperatureDelta enabled='false'>1</RefocusOnTemperatureDelta>");
  L.push("<RefocusEveryN enabled='false'>60</RefocusEveryN>");
  L.push("<RefocusOnMeridianFlip enabled='false'/>");
  L.push('<Job>');
  L.push(`<Exposure>${num(o.exposureS, 3)}</Exposure>`);
  L.push(`<Format>${o.format}</Format>`);
  L.push('<Encoding>FITS</Encoding>');
  L.push('<Binning>');
  L.push(`<X>${o.binning}</X>`);
  L.push(`<Y>${o.binning}</Y>`);
  L.push('</Binning>');
  L.push('<Frame>');
  L.push('<X>0</X>');
  L.push('<Y>0</Y>');
  L.push(`<W>${o.frameW}</W>`);
  L.push(`<H>${o.frameH}</H>`);
  L.push('</Frame>');
  if (o.temperature !== null) L.push(`<Temperature force='true'>${num(o.temperature, 1)}</Temperature>`);
  if (o.filter) L.push(`<Filter>${xmlEscape(o.filter)}</Filter>`);
  L.push('<Type>Light</Type>');
  L.push(`<Count>${Math.max(1, Math.round(o.count))}</Count>`);
  L.push('<Delay>0</Delay>');
  L.push('<GuideDitherPerJob>-1</GuideDitherPerJob>');
  L.push(`<FITSDirectory>${xmlEscape(o.fitsDirectory)}</FITSDirectory>`);
  L.push('<PlaceholderFormat>/%t/%T/%F/%t_%T_%F_%e_%D</PlaceholderFormat>');
  L.push('<PlaceholderSuffix>3</PlaceholderSuffix>');
  L.push('<UploadMode>0</UploadMode>');
  L.push('<Properties>');
  L.push('</Properties>');
  L.push('<Calibration>');
  L.push('<PreAction>');
  L.push('<Type>1</Type>');
  L.push('</PreAction>');
  L.push("<FlatDuration dark='false'>");
  L.push('<Type>Manual</Type>');
  L.push('</FlatDuration>');
  L.push('</Calibration>');
  L.push('</Job>');
  L.push('</SequenceQueue>');
  return `${L.join('\n')}\n`;
}
