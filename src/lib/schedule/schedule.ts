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
