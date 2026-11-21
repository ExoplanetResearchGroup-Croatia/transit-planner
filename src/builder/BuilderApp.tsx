import { useEffect, useMemo, useRef, useState } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { S } from '../strings';
import { Badge, Button, Card, Segmented, download } from '../components/ui';
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

  return (
    <Tooltip.Provider>
      <div className="min-h-screen">
        <header className="border-b border-line bg-bg">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-4 py-3">
            <a href="./" className="flex items-center gap-2">
              <img src="./favicon.svg" alt="" className="h-7 w-7" />
              <span className="text-sm font-semibold">
                {S.app.name} · {S.builder.title}
              </span>
            </a>
            <div className="ml-auto flex items-center gap-3">
              <Segmented size="sm" label={S.header.theme} value={theme} onChange={(t) => set({ theme: t })} options={[{ value: 'dark', label: S.header.dark }, { value: 'night', label: '●', title: S.header.night }]} />
              <a href="./" className="text-xs text-muted hover:text-fg">
                ← {S.app.backToPlanner}
              </a>
            </div>
          </div>
        </header>
        <main className="mx-auto grid max-w-[1200px] gap-4 px-4 py-5 lg:grid-cols-[1fr_420px]">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">{S.builder.intro}</p>
            <Card
              title={S.builder.template}
              actions={
                <>
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
                        setDraft(fileToDraft(JSON.parse(await f.text())));
                        setMsg(null);
                      } catch (err) {
                        setMsg(`JSON: ${String(err)}`);
                      }
                    }}
                  />
                  <Button size="sm" onClick={() => fileRef.current?.click()}>
                    {S.builder.importExisting}
                  </Button>
                </>
              }
            >
              <Segmented
                value={draft.kind}
                onChange={(k) => setDraft({ ...draft, kind: k })}
                options={[
                  { value: 'modular', label: S.builder.modularTpl },
                  { value: 'smart', label: S.builder.smartTpl },
                ]}
              />
            </Card>
            <Card>
              <EquipmentForm draft={draft} onChange={setDraft} />
            </Card>
            <Card title={S.builder.contribute}>
              <p className="mb-3 text-xs text-muted">{S.builder.contributeHint}</p>
              <a
                href={canContribute ? issueUrl() : undefined}
                target="_blank"
                rel="noreferrer noopener"
                aria-disabled={!canContribute}
                className={`inline-flex h-9 items-center rounded-md px-3.5 text-sm font-medium ${canContribute ? 'bg-accent text-accent-fg hover:brightness-110' : 'pointer-events-none border border-line text-faint'}`}
              >
                {S.builder.openIssue}
              </a>
              {draft.catalog && sources.length === 0 && <p className="mt-2 text-xs text-warn">{S.builder.needSource}</p>}
            </Card>
          </div>
          <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
            <Card title={S.builder.warnings} actions={<Badge tone={res.valid ? 'ok' : 'bad'}>{res.valid ? S.builder.valid : S.builder.invalid}</Badge>}>
              {res.issues.length === 0 && warnings.length === 0 ? (
                <p className="text-sm text-ok">{S.builder.noIssues}</p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-xs">
                  {res.issues.map((i) => (
                    <li key={i.path + i.message} className={i.level === 'error' ? 'text-bad' : 'text-warn'}>
                      <span className="font-medium">{i.path}</span> {i.message}
                    </li>
                  ))}
                  {warnings.map((w) => (
                    <li key={w} className="text-warn">
                      {w}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card
              title={S.builder.preview}
              actions={
                <>
                  <Button size="sm" onClick={() => navigator.clipboard.writeText(json).then(() => setMsg(S.builder.copied))}>
                    {S.builder.copy}
                  </Button>
                  <Button size="sm" variant="primary" disabled={!res.valid} onClick={() => download(`${draft.slug || 'equipment'}.json`, json, 'application/json')}>
                    {S.builder.download}
                  </Button>
                </>
              }
            >
              <pre className="num max-h-[50vh] overflow-auto rounded-md bg-bg p-3 text-[11px] leading-relaxed text-muted">{json}</pre>
              <Button
                className="mt-3 w-full"
                disabled={!res.valid}
                onClick={() => {
                  set({ userEquipment: addUserEntries(user, file) });
                  setMsg(S.builder.saved);
                }}
              >
                {S.builder.saveMine}
              </Button>
              {msg && <p className="mt-2 text-xs text-ok">{msg}</p>}
            </Card>
          </div>
        </main>
      </div>
    </Tooltip.Provider>
  );
}
