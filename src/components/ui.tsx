/** Small UI primitives (Tailwind + Radix). */
import * as Tooltip from '@radix-ui/react-tooltip';
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' };
export function Button({ variant = 'secondary', size = 'md', className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-accent text-accent-fg hover:brightness-110',
        variant === 'secondary' && 'border border-line bg-panel-2 text-fg hover:border-faint',
        variant === 'ghost' && 'text-muted hover:bg-panel-2 hover:text-fg',
        variant === 'danger' && 'border border-bad/40 text-bad hover:bg-bad/10',
        className,
      )}
    />
  );
}

export function Hint({ text }: { text: string }) {
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>
        <button type="button" aria-label={text} className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-line text-[10px] text-muted hover:text-fg">
          i
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="top" sideOffset={6} className="z-50 max-w-xs rounded-md border border-line bg-panel-2 px-3 py-2 text-xs leading-relaxed text-fg shadow-xl">
          {text}
          <Tooltip.Arrow className="fill-panel-2" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function Field({ label, hint, children, error, className }: { label: string; hint?: string; children: ReactNode; error?: string | null; className?: string }) {
  return (
    <label className={cx('flex flex-col gap-1', className)}>
      <span className="flex items-center text-xs font-medium text-muted">
        {label}
        {hint && <Hint text={hint} />}
      </span>
      {children}
      {error && <span className="text-xs text-bad">{error}</span>}
    </label>
  );
}

const inputCls = 'h-9 w-full rounded-md border border-line bg-bg px-2.5 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none';
export { inputCls };

export function TextInput(p: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; id?: string }) {
  return <input id={p.id} className={cx(inputCls, p.className)} value={p.value} placeholder={p.placeholder} onChange={(e) => p.onChange(e.target.value)} />;
}

/** Number input that keeps the raw text while typing and reports parsed numbers (null when empty). */
export function NumInput({
  value,
  onChange,
  step,
  min,
  max,
  unit,
  placeholder,
  className,
  allowEmpty = false,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  placeholder?: string;
  className?: string;
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value));
  useEffect(() => {
    const parsed = text.trim() === '' ? null : Number(text);
    if (parsed !== value) setText(value === null || value === undefined ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cx('relative', className)}>
      <input
        type="number"
        inputMode="decimal"
        className={cx(inputCls, 'num pr-9')}
        value={text}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          const t = e.target.value.trim();
          if (t === '') {
            if (allowEmpty) onChange(null);
            return;
          }
          const n = Number(t);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
      {unit && <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-faint">{unit}</span>}
    </div>
  );
}

export function Select<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <select className={cx(inputCls, 'pr-8', className)} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md', label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; title?: string }[]; size?: 'sm' | 'md'; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-bg p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded px-2.5 font-medium transition-colors',
            size === 'sm' ? 'h-6 text-xs' : 'h-8 text-sm',
            value === o.value ? 'bg-panel-2 text-fg shadow-sm ring-1 ring-line' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Checkbox({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; className?: string }) {
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input type="checkbox" className="h-4 w-4 accent-[var(--c-accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-lg border border-line bg-panel', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          {title && <h3 className="text-sm font-semibold tracking-tight">{title}</h3>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Badge({ tone = 'neutral', children, title }: { tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'accent' | 'info'; children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] leading-none font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-panel-2 text-muted ring-1 ring-line',
        tone === 'ok' && 'bg-ok/15 text-ok',
        tone === 'warn' && 'bg-warn/15 text-warn',
        tone === 'bad' && 'bg-bad/15 text-bad',
        tone === 'accent' && 'bg-accent/15 text-accent',
        tone === 'info' && 'bg-accent-2/15 text-accent-2',
      )}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] tracking-wide text-faint uppercase">{label}</span>
      <span className="num text-sm text-fg">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

export function StepHeader({ title, intro, actions }: { title: string; intro?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {intro && <p className="mt-0.5 max-w-3xl text-sm text-muted">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function download(name: string, content: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function readFileText(file: File): Promise<string> {
  return file.text();
}
