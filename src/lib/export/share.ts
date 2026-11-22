/**
 * Share links: the whole plan request plus the selected event ids, compressed
 * into the URL hash (#p=...). Nothing is sent to a server.
 */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

export const SHARE_VERSION = 1;

export interface SharePayload<S = unknown> {
  v: number;
  state: S;
  selected: string[];
}

export function encodeShare<S>(state: S, selected: string[]): string {
  return `p=${compressToEncodedURIComponent(JSON.stringify({ v: SHARE_VERSION, state, selected } satisfies SharePayload<S>))}`;
}

export function decodeShare<S>(hash: string): SharePayload<S> | null {
  const m = /(?:^|[#&])p=([^&]+)/.exec(hash);
  if (!m) return null;
  try {
    const json = decompressFromEncodedURIComponent(m[1]);
    if (!json) return null;
    const data = JSON.parse(json) as SharePayload<S>;
    return data.v === SHARE_VERSION ? data : null;
  } catch {
    return null;
  }
}
