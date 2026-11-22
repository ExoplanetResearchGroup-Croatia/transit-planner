/**
 * Scheduling: conflict detection and weighted interval scheduling.
 * Every job occupies [obsStart - gap, obsEnd], where gap = slew/center +
 * autofocus overhead. Two jobs conflict when their occupied intervals overlap.
 */
export interface Schedulable {
  id: string;
  obsStartMs: number;
  obsEndMs: number;
  score: number;
}

export function occupied(e: Schedulable, gapMin: number): [number, number] {
  return [e.obsStartMs - gapMin * 60_000, e.obsEndMs];
}

/** Ids of selected jobs that overlap another selected job (including the gap). */
export function findConflicts(selected: Schedulable[], gapMin: number): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const sorted = [...selected].sort((a, b) => a.obsStartMs - b.obsStartMs);
  for (let i = 0; i < sorted.length; i++) {
    const [, endI] = occupied(sorted[i], gapMin);
    for (let j = i + 1; j < sorted.length; j++) {
      const [startJ] = occupied(sorted[j], gapMin);
      if (startJ >= endI) break;
      const a = sorted[i].id;
      const b = sorted[j].id;
      out.set(a, [...(out.get(a) ?? []), b]);
      out.set(b, [...(out.get(b) ?? []), a]);
    }
  }
  return out;
}

export function overlaps(a: Schedulable, b: Schedulable, gapMin: number): boolean {
  const [as, ae] = occupied(a, gapMin);
  const [bs, be] = occupied(b, gapMin);
  return as < be && bs < ae;
}

/**
 * The plan the user sees: their manual picks (newest wins when two overlap),
 * minus their manual removals, filled with the best conflict-free set of the
 * remaining transits. Re-run after every recompute so the plan stays automatic
 * while respecting what the user changed by hand.
 */
export function planSelection<T extends Schedulable>(events: T[], gapMin: number, picks: string[], drops: string[], weight?: (e: T) => number): string[] {
  const byId = new Map(events.map((e) => [e.id, e]));
  const kept: T[] = [];
  for (let i = picks.length - 1; i >= 0; i--) {
    const e = byId.get(picks[i]);
    if (e && !kept.some((k) => overlaps(k, e, gapMin))) kept.push(e);
  }
  const dropSet = new Set(drops);
  const keptIds = new Set(kept.map((k) => k.id));
  const free = events.filter((e) => !keptIds.has(e.id) && !dropSet.has(e.id) && !kept.some((k) => overlaps(k, e, gapMin)));
  return [...kept.map((k) => k.id), ...suggestSchedule(free, gapMin, weight)];
}

/**
 * Weighted interval scheduling (dynamic programming, O(n log n)).
 * Returns the ids of a conflict-free subset with maximum total weight.
 */
export function suggestSchedule<T extends Schedulable>(candidates: T[], gapMin: number, weight: (e: T) => number = (e) => e.score): string[] {
  const jobs = candidates
    .map((e) => ({ e, s: occupied(e, gapMin)[0], f: e.obsEndMs, w: Math.max(0, weight(e)) }))
    .filter((j) => j.w > 0 && j.f > j.s)
    .sort((a, b) => a.f - b.f);
  const n = jobs.length;
  if (n === 0) return [];
  const finishes = jobs.map((j) => j.f);
  // p[i] = index of the last job that ends before job i starts (-1 if none)
  const p = jobs.map((j) => {
    let lo = 0;
    let hi = n - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (finishes[mid] <= j.s) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  });
  const best = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) {
    const take = jobs[i - 1].w + best[p[i - 1] + 1];
    best[i] = Math.max(best[i - 1], take);
  }
  const chosen: string[] = [];
  for (let i = n; i >= 1; ) {
    const take = jobs[i - 1].w + best[p[i - 1] + 1];
    if (take >= best[i - 1]) {
      chosen.push(jobs[i - 1].e.id);
      i = p[i - 1] + 1;
    } else i--;
  }
  return chosen.reverse();
}
