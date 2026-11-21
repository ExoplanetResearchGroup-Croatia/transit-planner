import { useStore } from '../../state/store';
import { S } from '../../strings';
import { Button, Card, Checkbox, Field, Hint, NumInput, Segmented, StepHeader } from '../../components/ui';
import { DEFAULT_FILTERS } from '../../state/defaults';
import type { CoverageRequirement, FlipPolicy } from '../../lib/transits/types';
import { altitudeForAirmass } from '../../lib/astro/coords';

function Range({ label, min, max, onMin, onMax, step, unit, allowEmptyMax }: { label: string; min: number; max: number | null; onMin: (v: number) => void; onMax: (v: number | null) => void; step: number; unit?: string; allowEmptyMax?: boolean }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <NumInput value={min} onChange={(v) => onMin(v ?? 0)} step={step} unit={unit} placeholder={S.filters.min} />
        <span className="text-faint">–</span>
        <NumInput value={max} onChange={onMax} step={step} unit={unit} allowEmpty={allowEmptyMax} placeholder={allowEmptyMax ? S.filters.none : S.filters.max} />
      </div>
    </Field>
  );
}

export function FiltersStep() {
  const mode = useStore((s) => s.mode);
  const f = useStore((s) => s.filters[s.mode]);
  const setF = useStore((s) => s.setFilters);
  const mountType = useStore((s) => s.mount.type);

  return (
    <div>
      <StepHeader
        title={S.filters.title}
        intro={mode === 'photometry' ? S.header.photometryHint : S.header.showcaseHint}
        actions={
          <Button size="sm" variant="ghost" onClick={() => setF(DEFAULT_FILTERS[mode])}>
            {S.filters.reset}
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Target">
          <div className="grid gap-3 sm:grid-cols-2">
            <Range label={S.filters.magnitude} min={f.magMin} max={f.magMax} onMin={(v) => setF({ magMin: v })} onMax={(v) => setF({ magMax: v ?? 20 })} step={0.5} />
            <Range label={S.filters.depth} min={f.depthMinPpt} max={f.depthMaxPpt} onMin={(v) => setF({ depthMinPpt: v })} onMax={(v) => setF({ depthMaxPpt: v })} step={0.5} unit="ppt" allowEmptyMax />
            <Range label={S.filters.duration} min={f.durationMinH} max={f.durationMaxH} onMin={(v) => setF({ durationMinH: v })} onMax={(v) => setF({ durationMaxH: v ?? 24 })} step={0.25} unit="h" />
            <Field label={S.filters.maxSigma}>
              <NumInput value={f.maxSigmaMin} onChange={(v) => setF({ maxSigmaMin: v })} allowEmpty step={5} unit="min" placeholder={S.filters.none} />
            </Field>
          </div>
          <Checkbox className="mt-3" checked={f.allowUnknownSigma} onChange={(v) => setF({ allowUnknownSigma: v })} label={S.filters.unknownSigma} />
          <div className="mt-4 border-t border-line pt-3">
            <span className="text-xs font-medium text-muted">{S.filters.sources}</span>
            <div className="mt-2 flex flex-col gap-1.5">
              <Checkbox checked={f.sources.exoclock} onChange={(v) => setF({ sources: { ...f.sources, exoclock: v } })} label={S.filters.exoclock} />
              <Checkbox checked={f.sources.nasa} onChange={(v) => setF({ sources: { ...f.sources, nasa: v } })} label={S.filters.nasa} />
              <Checkbox checked={f.sources.toi} onChange={(v) => setF({ sources: { ...f.sources, toi: v } })} label={S.filters.toi} />
              <Checkbox checked={f.needsObservations} onChange={(v) => setF({ needsObservations: v })} label={S.filters.needsObs} />
            </div>
          </div>
        </Card>

        <Card title="Observability">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={S.filters.minAlt}>
              <NumInput value={f.minAlt} onChange={(v) => setF({ minAlt: Math.min(85, Math.max(0, v ?? 0)) })} step={1} unit="°" />
            </Field>
            <Field label={S.filters.maxAirmass} hint={f.maxAirmass ? `≈ ${altitudeForAirmass(f.maxAirmass).toFixed(1)}° altitude` : undefined}>
              <NumInput value={f.maxAirmass} onChange={(v) => setF({ maxAirmass: v && v >= 1 ? v : null })} allowEmpty step={0.1} placeholder={S.filters.none} />
            </Field>
            <Field label={S.filters.moonSep} hint={S.filters.moonHint}>
              <NumInput value={f.moonMinSepDeg} onChange={(v) => setF({ moonMinSepDeg: Math.max(0, v ?? 0) })} step={5} unit="°" />
            </Field>
            <Field label={S.filters.moonIllum} hint={S.filters.moonHint}>
              <NumInput value={Math.round(f.moonMaxIllum * 100)} onChange={(v) => setF({ moonMaxIllum: Math.min(1, Math.max(0, (v ?? 100) / 100)) })} step={5} unit="%" />
            </Field>
          </div>
          <div className="mt-4 grid gap-3 border-t border-line pt-3">
            <Field label={S.filters.coverage}>
              <Segmented<CoverageRequirement>
                size="sm"
                value={f.coverage}
                onChange={(v) => setF({ coverage: v })}
                options={[
                  { value: 'full', label: 'Full', title: S.filters.coverageFull },
                  { value: 'transit', label: 'Transit', title: S.filters.coverageTransit },
                  { value: 'partial', label: 'Partial', title: S.filters.coveragePartial },
                ]}
              />
            </Field>
            {f.coverage === 'partial' && (
              <Field label={S.filters.minFraction}>
                <NumInput value={Math.round(f.minTransitFraction * 100)} onChange={(v) => setF({ minTransitFraction: Math.min(1, Math.max(0.05, (v ?? 50) / 100)) })} step={5} unit="%" className="w-32" />
              </Field>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <Field label={S.filters.baseline}>
                <Segmented
                  size="sm"
                  value={f.baselineMode}
                  onChange={(v) => setF({ baselineMode: v })}
                  options={[
                    { value: 'fixed', label: S.filters.baselineFixed },
                    { value: 'proportional', label: S.filters.baselineProp },
                  ]}
                />
              </Field>
              {f.baselineMode === 'fixed' ? (
                <NumInput value={f.baselineMin} onChange={(v) => setF({ baselineMin: Math.max(0, v ?? 0) })} step={5} unit="min" className="w-28" />
              ) : (
                <NumInput value={f.baselineFactor} onChange={(v) => setF({ baselineFactor: Math.max(0, v ?? 0) })} step={0.1} unit="×T" className="w-28" />
              )}
              <Field label={S.filters.widen} hint={S.filters.widenHint}>
                <NumInput value={f.widenSigma} onChange={(v) => setF({ widenSigma: Math.max(0, v ?? 0) })} step={0.5} unit="σ" className="w-24" />
              </Field>
            </div>
            <Field label={S.filters.flip} hint={S.filters.flipHint}>
              <div className="flex items-center gap-2">
                <Segmented<FlipPolicy>
                  size="sm"
                  value={f.flipPolicy}
                  onChange={(v) => setF({ flipPolicy: v })}
                  options={[
                    { value: 'avoid', label: S.filters.flipAvoid },
                    { value: 'flag', label: S.filters.flipFlag },
                    { value: 'allow', label: S.filters.flipAllow },
                  ]}
                />
                {mountType !== 'gem' && (
                  <span className="text-xs text-faint">
                    n/a <Hint text={S.filters.flipHint} />
                  </span>
                )}
              </div>
            </Field>
          </div>
        </Card>
      </div>
    </div>
  );
}
