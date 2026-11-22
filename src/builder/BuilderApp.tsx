import { useEffect, useMemo, useRef, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { S } from '../strings';
import { Badge, Button, CodeStrip, IconButton, Segmented, download } from '../components/ui';
import { Moon, Sun, ArrowLeft, ExternalLink } from 'lucide-react';
import { EquipmentForm, EMPTY_DRAFT, draftToFile, draftWarnings, fileToDraft, type Draft } from '../components/EquipmentForm';
import { validateEquipment } from '../lib/equipment/validate';
import { addUserEntries } from '../lib/equipment/library';
import { useStore } from '../state/store';
import type { EquipmentFile } from '../lib/equipment/types';
import { loadOfficialEquipment } from '../app/hooks';

const REPO_URL = 'https://github.com/ExoplanetResearchGroup-Croatia/transit-planner';

export function BuilderApp() {
  const [draft, setDraft] = useState<Draft>({ ...EMPTY_DRAFT });
  const [official, setOfficial] = useState<EquipmentFile | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // validation messages appear after the first edit, not on an untouched form
  const [touched, setTouched] = useState(false);
  const edit = (d: Draft) => {
    setDraft(d);
    setTouched(true);
  };
  const theme = useStore((s) => s.theme);
  const user = useStore((s) => s.userEquipment);
  const set = useStore((s) => s.set);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadOfficialEquipment().then(setOfficial).catch(() => setOfficial(null));
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const file = useMemo(() => draftToFile(draft), [draft]);
  const json = JSON.stringify(file, null, 2);
  const res = useMemo(() => validateEquipment(file, { resolveAgainst: official ?? undefined }), [file, official]);
  const warnings = draftWarnings(draft);
  const sources = draft.sources.split(/\s+/).filter(Boolean);
  const canContribute = draft.catalog && res.valid && sources.length > 0;

  const issueUrl = () => {
    const kind = draft.kind === 'smart' ? 'smart telescope' : 'setup';
    const body = [
      `Catalog contribution for **${draft.name}** (${kind}), created with the Equipment Builder.`,
      '',
      'Sources:',
      ...sources.map((s) => `- ${s}`),
      '',
      '```json',
      json.length > 5500 ? `${json.slice(0, 5500)}\n… (truncated, attach the downloaded file)` : json,
      '```',
    ].join('\n');
    return `${REPO_URL}/issues/new?labels=equipment&title=${encodeURIComponent(`Equipment: ${draft.name}`)}&body=${encodeURIComponent(body)}`;
  };

  const section = 'flex flex-col gap-4 border-t border-line pt-5';
  return (
    <Tooltip.Provider>
      <div className="min-h-screen">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-4 px-5 py-4">
            <a href="./" className="flex items-center gap-3" aria-label={S.app.name}>
              <img src="./favicon.svg" alt="" className="h-9 w-9" />
              <span className="caps text-fg">{S.app.name}</span>
              <CodeStrip size="sm" />
            </a>
            <div className="ml-auto flex items-center gap-3">
              <IconButton label={theme === 'night' ? S.rail.dayMode : S.rail.nightMode} active={theme === 'night'} onClick={() => set({ theme: theme === 'night' ? 'dark' : 'night' })}>
                {theme === 'night' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
              </IconButton>
              <Button size="md" icon={<ArrowLeft size={14} strokeWidth={1.5} />} onClick={() => (location.href = './')}>
                {S.app.backToPlanner}
              </Button>
            </div>
          </div>
        </header>
        <main className="mx-auto grid max-w-[1240px] gap-x-10 gap-y-8 px-5 pt-8 pb-12 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <h1 className="display text-[56px] text-fg">{S.builder.title}</h1>
              <p className="max-w-[62ch] text-sm text-muted">{S.builder.intro}</p>
            </div>
            <section className={section}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="caps text-fg">{S.builder.template}</h2>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    try {
                      edit(fileToDraft(JSON.parse(await f.text())));
                      setMsg(null);
                    } catch (err) {
                      setMsg(`JSON: ${String(err)}`);
                    }
                  }}
                />
                <Button size="sm" onClick={() => fileRef.current?.click()}>
                  {S.builder.importExisting}
                </Button>
              </div>
              <Segmented
                value={draft.kind}
                onChange={(k) => edit({ ...draft, kind: k })}
                options={[
                  { value: 'modular', label: S.builder.modularTpl },
                  { value: 'smart', label: S.builder.smartTpl },
                ]}
              />
            </section>
            <section className={section}>
              <EquipmentForm draft={draft} onChange={edit} />
            </section>
            <section className={section}>
              <h2 className="caps text-fg">{S.builder.contribute}</h2>
              <p className="max-w-[70ch] text-xs leading-relaxed text-muted">{S.builder.contributeHint}</p>
              <a
                href={canContribute ? issueUrl() : undefined}
                target="_blank"
                rel="noreferrer noopener"
                aria-disabled={!canContribute}
                className={`caps inline-flex h-10 items-stretch self-start border transition-colors duration-150 ${canContribute ? 'border-fg text-fg hover:bg-fg hover:text-bg' : 'pointer-events-none border-line text-faint'}`}
              >
                <span className="flex items-center gap-2 px-4">
                  <ExternalLink size={14} strokeWidth={1.5} />
                  {S.builder.openIssue}
                </span>
                {canContribute && <span aria-hidden className="w-4 bg-red" />}
              </a>
              {draft.catalog && sources.length === 0 && <p className="text-xs text-warn">{S.builder.needSource}</p>}
            </section>
          </div>
          <aside className="flex flex-col gap-8 lg:sticky lg:top-6 lg:self-start">
            <section className={section}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="caps text-fg">{S.builder.warnings}</h2>
                {touched && <Badge tone={res.valid ? 'ok' : 'bad'}>{res.valid ? S.builder.valid : S.builder.invalid}</Badge>}
              </div>
              {!touched ? (
                <p className="text-sm text-muted">{S.builder.untouched}</p>
              ) : res.issues.length === 0 && warnings.length === 0 ? (
                <p className="text-sm text-fg">{S.builder.noIssues}</p>
              ) : (
                <ul className="flex flex-col gap-2 text-xs leading-relaxed">
                  {res.issues.map((i) => (
                    <li key={i.path + i.message} className={i.level === 'error' ? 'text-bad' : 'text-warn'}>
                      <span className="text-fg">{i.path}</span> {i.message}
                    </li>
                  ))}
                  {warnings.map((w) => (
                    <li key={w} className="text-warn">
                      {w}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className={section}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="caps text-fg">{S.builder.preview}</h2>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => navigator.clipboard.writeText(json).then(() => setMsg(S.builder.copied))}>
                    {S.builder.copy}
                  </Button>
                  <Button size="sm" variant="primary" disabled={!res.valid} onClick={() => download(`${draft.slug || 'equipment'}.json`, json, 'application/json')}>
                    {S.builder.download}
                  </Button>
                </div>
              </div>
              <pre className="num max-h-[46vh] overflow-auto text-[11px] leading-relaxed text-muted">{json}</pre>
              <Button
                className="w-full"
                disabled={!res.valid}
                onClick={() => {
                  set({ userEquipment: addUserEntries(user, file) });
                  setMsg(S.builder.saved);
                }}
              >
                {S.builder.saveMine}
              </Button>
              {msg && <p className="text-xs text-fg">{msg}</p>}
            </section>
          </aside>
        </main>
      </div>
    </Tooltip.Provider>
  );
}
