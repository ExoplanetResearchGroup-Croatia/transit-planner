/**
 * Compute worker: transit prediction for thousands of targets x up to 14 nights
 * runs here so the UI stays responsive.
 *
 * Messages in:  { type: 'targets', key, targets }   (sent once per catalog set)
 *               { type: 'run', id, key, req }
 * Messages out: { type: 'progress', id, done, total }
 *               { type: 'result', id, result } | { type: 'error', id, message }
 */
import { runPlan } from '../lib/transits/compute';
import type { Target } from '../lib/catalog/types';
import type { PlanRequest } from '../lib/transits/types';

const sets = new Map<string, Target[]>();

type In = { type: 'targets'; key: string; targets: Target[] } | { type: 'run'; id: number; keys: string[]; req: PlanRequest };

self.onmessage = (ev: MessageEvent<In>) => {
  const msg = ev.data;
  if (msg.type === 'targets') {
    sets.set(msg.key, msg.targets);
    return;
  }
  try {
    const targets = msg.keys.flatMap((k) => sets.get(k) ?? []);
    const result = runPlan(msg.req, targets, (done, total) => self.postMessage({ type: 'progress', id: msg.id, done, total }));
    self.postMessage({ type: 'result', id: msg.id, result });
  } catch (e) {
    self.postMessage({ type: 'error', id: msg.id, message: e instanceof Error ? e.message : String(e) });
  }
};
