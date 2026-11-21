import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import { S } from '../../strings';
import { Badge, Button, Card, Checkbox, StepHeader } from '../../components/ui';
import { NightGantt } from '../../components/charts';
import { findConflicts, suggestSchedule } from '../../lib/schedule/schedule';
import { useTimeFmt } from '../hooks';
import { EventDetail } from './ResultsStep';

const MAX_ROWS = 60;

export function ScheduleStep() {
  const result = useStore((s) => s.result);
  const selected = useStore((s) => s.selected);
  const set = useStore((s) => s.set);
  const toggle = useStore((s) => s.toggleSelected);
  const mount = useStore((s) => s.mount);
  const detailId = useStore((s) => s.detailId);
  const f = useTimeFmt();
  const [showAll, setShowAll] = useState(true);
  const gap = mount.overheadMin + mount.autofocusMin;

  const sel = useMemo(() => new Set(selected), [selected]);
  const events = useMemo(() => result?.events ?? [], [result]);
  const conflicts = useMemo(() => findConflicts(events.filter((e) => sel.has(e.id)), gap), [events, sel, gap]);
  const nConflictPairs = [...conflicts.values()].reduce((a, v) => a + v.length, 0) / 2;

  if (!result) return <StepHeader title={S.schedule.title} intro={S.schedule.empty} />;

  return (
    <div>
      <StepHeader
        title={S.schedule.title}
        intro={`${S.results.selectedCount(selected.length)} · ${f.zone()}`}
        actions={
          <>
            <Badge tone={nConflictPairs ? 'bad' : 'ok'}>{nConflictPairs ? S.schedule.conflicts(nConflictPairs) : S.schedule.noConflicts}</Badge>
            <Button variant="ghost" size="sm" onClick={() => set({ selected: [] })}>
              {S.schedule.clear}
            </Button>
            <Button variant="primary" title={S.schedule.suggestHint} onClick={() => set({ selected: suggestSchedule(events, gap) })}>
              {S.schedule.suggest}
            </Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted">
        <Checkbox checked={showAll} onChange={setShowAll} label={S.schedule.showAll} />
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded-sm bg-accent-2/40" /> {S.schedule.legendBaseline}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded-sm bg-accent" /> {S.schedule.legendTransit}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded-sm border-2 border-bad" /> {S.schedule.legendConflict}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t border-dashed border-muted" /> {S.schedule.legendMoon}
        </span>
        <span>
          {S.schedule.gap}: {gap} min
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {result.nights.map((night) => {
          const all = events.filter((e) => e.night === night.date).sort((a, b) => a.obsStartMs - b.obsStartMs);
          const shown = (showAll ? all : all.filter((e) => sel.has(e.id))).slice(0, MAX_ROWS);
          const nSel = all.filter((e) => sel.has(e.id)).length;
          return (
            <Card
              key={night.date}
              title={
                <span>
                  {night.date} <span className="font-normal text-muted">· {nSel} / {all.length}</span>
                </span>
              }
            >
              {shown.length === 0 ? (
                <p className="text-sm text-muted">{night.status === 'no-darkness' ? S.time.noDarkness : S.schedule.empty}</p>
              ) : (
                <div className="-mx-2 overflow-x-auto">
                  <NightGantt
                    night={night}
                    tz={f.tz}
                    gapMin={gap}
                    rows={shown.map((e) => ({ event: e, selected: sel.has(e.id), conflict: conflicts.has(e.id) }))}
                    onToggle={toggle}
                    onOpen={(id) => set({ detailId: id })}
                  />
                  {showAll && all.length > MAX_ROWS && <p className="px-2 text-xs text-faint">+{all.length - MAX_ROWS} more (see the table)</p>}
                </div>
              )}
            </Card>
          );
        })}
      </div>
      <EventDetail event={events.find((e) => e.id === detailId) ?? null} onClose={() => set({ detailId: null })} />
    </div>
  );
}
