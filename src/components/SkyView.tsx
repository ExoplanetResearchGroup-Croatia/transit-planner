/**
 * Aladin Lite sky view with the camera field of view. Loaded on demand (the
 * library is ~2.6 MB with WebAssembly) and only after the user asks for it,
 * because it fetches images from the CDS servers.
 */
import { useEffect, useRef, useState } from 'react';
import { S } from '../strings';
import { Button } from './ui';

/** FOV rectangle corners (north up) by inverse gnomonic projection. */
export function fovCorners(raDeg: number, decDeg: number, wDeg: number, hDeg: number): [number, number][] {
  const d2r = Math.PI / 180;
  const ra0 = raDeg * d2r;
  const dec0 = decDeg * d2r;
  const pts: [number, number][] = [
    [-wDeg / 2, -hDeg / 2],
    [wDeg / 2, -hDeg / 2],
    [wDeg / 2, hDeg / 2],
    [-wDeg / 2, hDeg / 2],
  ];
  return pts.map(([xd, yd]) => {
    const x = -xd * d2r; // east to the left on the sky
    const y = yd * d2r;
    const rho = Math.hypot(x, y);
    const c = Math.atan(rho);
    const dec = rho === 0 ? dec0 : Math.asin(Math.cos(c) * Math.sin(dec0) + (y * Math.sin(c) * Math.cos(dec0)) / rho);
    const ra = ra0 + Math.atan2(x * Math.sin(c), rho * Math.cos(dec0) * Math.cos(c) - y * Math.sin(dec0) * Math.sin(c));
    return [((ra / d2r) % 360 + 360) % 360, dec / d2r];
  });
}

/**
 * Aladin Lite sends a usage ping (survey, field, target and page URL) to CDS
 * on start-up, with no option to turn it off. TransitPlanner promises no
 * analytics, so those requests are answered locally and never leave the browser.
 */
let loggerBlocked = false;
function blockAladinLogger() {
  if (loggerBlocked) return;
  loggerBlocked = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/AladinLiteLogger/')) return Promise.resolve(new Response(null, { status: 204 }));
    return original(input, init);
  };
}

export function SkyView({ ra, dec, fov }: { ra: number; dec: number; fov: { w: number; h: number } | null }) {
  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!on || !el.current) return;
    let cancelled = false;
    let refit: number | undefined;
    (async () => {
      try {
        blockAladinLogger();
        const A = (await import('aladin-lite')).default as unknown as AladinApi;
        await A.init;
        if (cancelled || !el.current) return;
        el.current.innerHTML = '';
        // Aladin's fov is the horizontal width; fit the camera frame in both directions with margin
        const aspect = el.current.clientWidth / Math.max(1, el.current.clientHeight);
        const span = fov ? Math.max(fov.w, fov.h * aspect) * 1.35 : 1;
        const aladin = A.aladin(el.current, {
          survey: 'P/DSS2/color',
          fov: Math.min(10, Math.max(0.1, span)),
          target: `${ra} ${dec}`,
          showReticle: true,
          showLayersControl: false,
          showGotoControl: false,
          showFullscreenControl: false,
          showShareControl: false,
          showFrame: false,
          showCooGrid: false,
          showProjectionControl: false,
          showZoomControl: true,
        });
        if (fov) {
          const overlay = A.graphicOverlay({ color: '#f0b54a', lineWidth: 2 });
          aladin.addOverlay(overlay);
          overlay.add(A.polygon(fovCorners(ra, dec, fov.w, fov.h), { color: '#f0b54a', lineWidth: 2 }));
        }
        // Aladin may reset the zoom while it falls back to a HiPS mirror; re-apply it
        const view = Math.min(10, Math.max(0.1, span));
        aladin.setFoV(view);
        refit = window.setTimeout(() => aladin.setFoV(view), 2500);
      } catch (e) {
        setErr(String(e));
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(refit);
    };
  }, [on, ra, dec, fov]);

  if (!on)
    return (
      <Button size="sm" onClick={() => setOn(true)}>
        {S.results.skyLoad}
      </Button>
    );
  return (
    <div>
      <div ref={el} className="sky-view h-72 w-full overflow-hidden rounded-md border border-line bg-black" />
      <p className="mt-1 text-xs text-faint">{err ?? S.results.skyHint}</p>
    </div>
  );
}

interface AladinApi {
  init: Promise<void>;
  aladin: (el: HTMLElement, opts: Record<string, unknown>) => { addOverlay: (o: unknown) => void; setFoV: (deg: number) => void };
  graphicOverlay: (opts: Record<string, unknown>) => { add: (shape: unknown) => void };
  polygon: (pts: [number, number][], opts?: Record<string, unknown>) => unknown;
}
