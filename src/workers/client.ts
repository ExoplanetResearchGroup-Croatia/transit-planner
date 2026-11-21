import type { Target } from '../lib/catalog/types';
import type { PlanRequest, PlanResult } from '../lib/transits/types';

let worker: Worker | null = null;
let nextId = 1;
const sent = new Set<string>();
const pending = new Map<number, { resolve: (r: PlanResult) => void; reject: (e: Error) => void; onProgress?: (f: number) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./compute.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev) => {
      const m = ev.data;
      const p = pending.get(m.id);
      if (!p) return;
      if (m.type === 'progress') p.onProgress?.(m.total ? m.done / m.total : 0);
      else if (m.type === 'result') {
        pending.delete(m.id);
        p.resolve(m.result);
      } else if (m.type === 'error') {
        pending.delete(m.id);
        p.reject(new Error(m.message));
      }
    };
  }
  return worker;
}

/** Send a target set to the worker once (structured clone is the expensive part). */
export function provideTargets(key: string, targets: Target[]) {
  if (sent.has(key)) return;
  getWorker().postMessage({ type: 'targets', key, targets });
  sent.add(key);
}

export function computePlan(req: PlanRequest, keys: string[], onProgress?: (f: number) => void): Promise<PlanResult> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ type: 'run', id, keys, req });
  });
}
