import { useMemo } from 'react';
import { useStore } from '../../state/store';
import { S } from '../../strings';
import { Card, Checkbox, Field, NumInput, Segmented, StepHeader, cx, inputCls } from '../../components/ui';
import { usePlanRequest, useSite, useTimeFmt, tonightAt } from '../hooks';
import { computeNights, type DarknessDefinition } from '../../lib/astro/darkness';
import { siteValid } from './LocationStep';

export function TimeStep() {
  const site = useSite();
  const s = useStore();
  const req = usePlanRequest();
  const f = useTimeFmt();
  const nights = useMemo(
    () => (req && siteValid(site) ? computeNights(req.site, req.firstNight, req.nights, req.darkness) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [req?.site.lat, req?.site.lon, req?.site.tz, req?.firstNight, req?.nights, req?.darkness],
  );
  const tonight = site && siteValid(site) ? tonightAt(site.tz) : null;

  return (
    <div>
      <StepHeader title={S.time.title} intro={S.time.hint} />
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <Field label={S.time.start}>
            <div className="flex items-center gap-3">
              <input
                type="date"
                className={cx(inputCls, 'num w-44')}
                value={s.firstNight ?? tonight ?? ''}
                disabled={s.firstNight === null}
                onChange={(e) => e.target.value && s.set({ firstNight: e.target.value })}
              />
              <Checkbox checked={s.firstNight === null} onChange={(v) => s.set({ firstNight: v ? null : tonight })} label={S.time.tonight} />
            </div>
          </Field>
          <Field label={S.time.nights}>
            <NumInput value={s.nights} onChange={(v) => s.set({ nights: Math.round(Math.min(14, Math.max(1, v ?? 1))) })} min={1} max={14} step={1} className="w-28" />
          </Field>
          <Field label={S.time.darkness}>
            <Segmented<DarknessDefinition>
              value={s.darkness}
              onChange={(v) => s.set({ darkness: v })}
              options={[
                { value: 'astronomical', label: '−18°', title: S.time.astronomical },
                { value: 'nautical', label: '−12°', title: S.time.nautical },
                { value: 'civil', label: '−6°', title: S.time.civil },
              ]}
            />
          </Field>
        </div>
      </Card>

      <Card title={`${S.time.summary} · ${f.zone()}`} className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-faint">
                {[S.time.night, S.time.sunset, S.time.dusk, S.time.dawn, S.time.sunrise, S.time.darkHours, S.time.moon].map((h) => (
                  <th key={h} className="py-1.5 pr-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {nights.map((n) => {
                const unusable = n.status === 'no-darkness';
                return (
                  <tr key={n.date} className={cx('border-b border-line/60', unusable && 'opacity-40')}>
                    <td className="num py-1.5 pr-3">{n.date}</td>
                    <td className="num pr-3">{f.t(n.sunset)}</td>
                    <td className="num pr-3">{unusable ? '—' : f.t(n.darkStart)}</td>
                    <td className="num pr-3">{unusable ? '—' : f.t(n.darkEnd)}</td>
                    <td className="num pr-3">{f.t(n.sunrise)}</td>
                    <td className="num pr-3">
                      {unusable ? (
                        <span className="text-warn">{S.time.noDarkness}</span>
                      ) : n.status === 'continuous-darkness' ? (
                        S.time.continuous
                      ) : (
                        `${Math.floor(n.darkMinutes / 60)} h ${String(Math.round(n.darkMinutes % 60)).padStart(2, '0')} m`
                      )}
                    </td>
                    <td className="pr-3">
                      <MoonGlyph f={n.moonIllum} /> <span className="num text-xs text-muted">{Math.round(n.moonIllum * 100)} %</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function MoonGlyph({ f }: { f: number }) {
  // simple illuminated-fraction glyph: lit ellipse over a dark disc
  const rx = Math.abs(1 - 2 * f) * 6;
  return (
    <svg width="14" height="14" viewBox="-7 -7 14 14" className="inline align-[-2px]" aria-hidden>
      <circle r="6" fill="var(--c-panel-2)" stroke="var(--c-line)" />
      <path d={`M0,-6 A6,6 0 0,1 0,6 A${rx},6 0 0,${f > 0.5 ? 1 : 0} 0,-6`} fill="var(--c-muted)" />
    </svg>
  );
}
