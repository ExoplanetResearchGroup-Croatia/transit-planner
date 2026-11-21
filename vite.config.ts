import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

/**
 * GitHub Pages cannot send HTTP headers, so the Content Security Policy is
 * delivered as a <meta> tag. It is only added to production builds because the
 * Vite dev server injects inline scripts for hot reload.
 *
 * Aladin Lite (sky view) is bundled from npm, needs WebAssembly, and loads
 * HiPS image tiles from CDS and from the official HiPS mirrors it falls back
 * to (needed: on 2026-11-21 the DSS survey returned 404 on alasky and the
 * alaskybis mirror did not answer, while ESA/IRSA/CSIRO served it).
 * Aladin's usage logger (alasky.unistra.fr/cgi/AladinLiteLogger) is deliberately
 * NOT allowed; SkyView.tsx also drops those requests before they are made.
 */
const CDS_HOSTS = [
  'https://alasky.cds.unistra.fr',
  'https://alaskybis.cds.unistra.fr',
  'https://aladin.cds.unistra.fr',
  'https://alasky.u-strasbg.fr',
  'https://cds.unistra.fr',
  'https://simbad.cds.unistra.fr',
  'https://skies.esac.esa.int',
  'https://irsa.ipac.caltech.edu',
  'https://casda.csiro.au',
  'https://stpubdata.s3.us-east-1.amazonaws.com',
].join(' ');

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${CDS_HOSTS}`,
  // data: — Aladin Lite fetches its own WebAssembly module from a data: URL
  `connect-src 'self' data: ${CDS_HOSTS}`,
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspMeta(): Plugin {
  return {
    name: 'transit-planner-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  // Relative base: the same build works at a GitHub Pages project path
  // (/transit-planner/), at a custom domain root, and from `vite preview`.
  base: './',
  plugins: [react(), tailwindcss(), cspMeta()],
  build: {
    target: 'es2022',
    // Aladin Lite (~2.6 MB) is a lazily loaded chunk, fetched only when the sky view is opened.
    chunkSizeWarningLimit: 2800,
    rollupOptions: {
      input: {
        main: `${root}index.html`,
        builder: `${root}builder.html`,
      },
    },
  },
  worker: { format: 'es' },
});
