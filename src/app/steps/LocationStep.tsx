import { useRef, useState } from 'react';
import { useStore, type SiteProfile } from '../../state/store';
import { S } from '../../strings';
import { Button, Card, Field, NumInput, Select, StepHeader, TextInput, Badge } from '../../components/ui';
import { guessTimeZone, isValidTimeZone, listTimeZones, zoneAbbreviation } from '../../lib/astro/tz';
import { parseHorizonCsv } from '../../lib/transits/horizon';

const newId = () => `site-${Date.now().toString(36)}`;

export function blankSite(): SiteProfile {
  return { id: newId(), name: 'My site', lat: NaN, lon: NaN, elevation: 0, tz: 'UTC', horizon: [] };
}

export const siteValid = (s: SiteProfile | null) =>
  !!s && Number.isFinite(s.lat) && Number.isFinite(s.lon) && Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180 && isValidTimeZone(s.tz);

export function LocationStep() {
  const sites = useStore((s) => s.sites);
  const activeId = useStore((s) => s.activeSiteId);
  const upsert = useStore((s) => s.upsertSite);
  const del = useStore((s) => s.deleteSite);
  const set = useStore((s) => s.set);
  const site = sites.find((s) => s.id === activeId) ?? null;
  const [geo, setGeo] = useState<'idle' | 'busy' | 'error'>('idle');
  const [horizonText, setHorizonText] = useState<string | null>(null);
  const [horizonErr, setHorizonErr] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const zones = listTimeZones();

  const edit = (patch: Partial<SiteProfile>) => {
    const base = site ?? blankSite();
    const next = { ...base, ...patch };
    // follow the coordinates with the time zone unless the user picked one
    if ((patch.lat !== undefined || patch.lon !== undefined) && Number.isFinite(next.lat) && Number.isFinite(next.lon) && (base.tz === 'UTC' || base.tz === guessTimeZone(base.lat, base.lon)))
      next.tz = guessTimeZone(next.lat, next.lon);
    upsert(next);
  };

  const locate = () => {
    if (!navigator.geolocation) return setGeo('error');
    setGeo('busy');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = Number(p.coords.latitude.toFixed(5));
        const lon = Number(p.coords.longitude.toFixed(5));
        edit({ lat, lon, elevation: Math.round(p.coords.altitude ?? site?.elevation ?? 0), tz: guessTimeZone(lat, lon) });
        setGeo('idle');
      },
      () => setGeo('error'),
      { enableHighAccuracy: false, timeout: 15000 },
    );
  };

  const applyHorizon = (text: string) => {
    const r = parseHorizonCsv(text);
    setHorizonErr(r.errors);
    edit({ horizon: r.points });
  };

  const hText = horizonText ?? (site?.horizon ?? []).map((p) => `${p.az},${p.alt}`).join('\n');

  return (
    <div>
      <StepHeader title={S.location.title} intro={S.location.intro} />
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card title={S.location.profiles}>
          <ul className="flex flex-col gap-1">
            {sites.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => set({ activeSiteId: s.id })}
                  className={`w-full rounded-md px-2.5 py-1.5 text-left text-sm ${s.id === activeId ? 'bg-panel-2 text-fg ring-1 ring-line' : 'text-muted hover:text-fg'}`}
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="num text-xs text-faint">{Number.isFinite(s.lat) ? `${s.lat.toFixed(3)}, ${s.lon.toFixed(3)}` : '—'}</div>
                </button>
              </li>
            ))}
          </ul>
          <Button size="sm" className="mt-3 w-full" onClick={() => upsert(blankSite())}>
            + {S.location.newProfile}
          </Button>
        </Card>

        <div className="flex flex-col gap-4">
          <Card
            title={site?.name ?? S.location.newProfile}
            actions={
              <>
                <Button size="sm" variant="primary" onClick={locate} disabled={geo === 'busy'}>
                  {geo === 'busy' ? S.location.locating : S.location.useMyLocation}
                </Button>
                {site && (
                  <Button size="sm" variant="danger" onClick={() => del(site.id)}>
                    {S.location.deleteProfile}
                  </Button>
                )}
              </>
            }
          >
            {geo === 'error' && <p className="mb-3 text-sm text-warn">{S.location.geoError}</p>}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Field label={S.location.name} className="xl:col-span-1">
                <TextInput value={site?.name ?? ''} onChange={(v) => edit({ name: v })} />
              </Field>
              <Field label={S.location.lat} hint={S.location.latHint}>
                <NumInput value={site && Number.isFinite(site.lat) ? site.lat : null} onChange={(v) => edit({ lat: v ?? NaN })} step={0.0001} min={-90} max={90} unit="°" />
              </Field>
              <Field label={S.location.lon} hint={S.location.lonHint}>
                <NumInput value={site && Number.isFinite(site.lon) ? site.lon : null} onChange={(v) => edit({ lon: v ?? NaN })} step={0.0001} min={-180} max={180} unit="°" />
              </Field>
              <Field label={S.location.elevation}>
                <NumInput value={site?.elevation ?? 0} onChange={(v) => edit({ elevation: v ?? 0 })} step={1} unit="m" />
              </Field>
              <Field label={S.location.tz} hint={S.location.tzHint}>
                <Select value={site?.tz ?? 'UTC'} onChange={(v) => edit({ tz: v })} options={[...new Set(['UTC', site?.tz ?? 'UTC', ...zones])].map((z) => ({ value: z, label: z }))} />
              </Field>
            </div>
            {site && siteValid(site) && (
              <p className="mt-3 text-xs text-muted">
                <Badge tone="info">{zoneAbbreviation(Date.now(), site.tz)}</Badge> <span className="ml-1">{site.tz}</span>
              </p>
            )}
            {site && !siteValid(site) && <p className="mt-3 text-sm text-warn">{S.location.invalid}</p>}
          </Card>

          <Card
            title={
              <span>
                {S.location.horizon} <span className="font-normal text-muted">· {(site?.horizon ?? []).length} {S.location.horizonPoints}</span>
              </span>
            }
            actions={
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const t = await f.text();
                    setHorizonText(t);
                    applyHorizon(t);
                    e.target.value = '';
                  }}
                />
                <Button size="sm" onClick={() => fileRef.current?.click()}>
                  {S.location.horizonImport}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setHorizonText('');
                    applyHorizon('');
                  }}
                >
                  {S.location.horizonClear}
                </Button>
              </>
            }
          >
            <p className="mb-2 text-xs text-muted">{S.location.horizonHint}</p>
            <textarea
              className="num h-28 w-full rounded-md border border-line bg-bg p-2 text-xs text-fg focus:border-accent focus:outline-none"
              placeholder={'0,15\n90,20\n180,10\n270,25'}
              value={hText}
              disabled={!site}
              onChange={(e) => setHorizonText(e.target.value)}
              onBlur={() => horizonText !== null && applyHorizon(horizonText)}
            />
            {horizonErr.length > 0 && <p className="mt-1 text-xs text-warn">{horizonErr.slice(0, 3).join('; ')}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
