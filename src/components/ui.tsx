/**
 * UI primitives in the Pulsar Sleeve vocabulary: sharp hairline rectangles,
 * engraved caps labels, buttons with a coloured end block, square checks.
 * Controls stay standard HTML controls (Radix for dialog and tooltip).
 */
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Info, ChevronDown } from 'lucide-react';
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  /** colour of the end block (primary defaults to red) */
  block?: 'red' | 'blue' | 'yellow' | 'none';
  icon?: ReactNode;
};

const BLOCK: Record<string, string> = { red: 'bg-red', blue: 'bg-blue', yellow: 'bg-yellow' };

export function Button({ variant = 'secondary', size = 'md', block, icon, className, children, ...p }: BtnProps) {
  const endBlock = block ?? (variant === 'primary' ? 'red' : 'none');
  return (
    <button
      {...p}
      className={cx(
        'group relative inline-flex items-stretch border caps transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35',
        size === 'sm' ? 'h-8' : 'h-10',
        variant === 'primary' && 'border-fg text-fg hover:bg-fg hover:text-bg',
        variant === 'secondary' && 'border-line-strong text-fg hover:border-fg',
        variant === 'ghost' && 'border-transparent text-muted hover:text-fg',
        variant === 'danger' && 'border-line-strong text-red hover:border-red',
        className,
      )}
    >
      <span className={cx('flex flex-1 items-center justify-center gap-2', size === 'sm' ? 'px-3' : 'px-4')}>
        {icon}
        {children}
      </span>
      {endBlock !== 'none' && <span aria-hidden className={cx('w-3 shrink-0', size === 'md' && 'w-4', BLOCK[endBlock])} />}
    </button>
  );
}

export function IconButton({ label, children, className, active, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <Tooltip.Root delayDuration={200}>
      <Tooltip.Trigger asChild>
        <button
          {...p}
          aria-label={label}
          className={cx(
            'inline-flex h-10 w-10 items-center justify-center border transition-colors duration-150',
            active ? 'border-red text-red' : 'border-line-strong text-muted hover:border-fg hover:text-fg',
            className,
          )}
        >
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="right" sideOffset={8} className="z-50 border border-line-strong bg-panel px-2.5 py-1.5 caps text-fg">
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function Hint({ text }: { text: string }) {
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>
        <button type="button" aria-label={text} className="ml-1.5 inline-flex text-faint hover:text-fg">
          <Info size={12} strokeWidth={1.5} />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="top" sideOffset={6} className="z-[60] max-w-xs border border-line-strong bg-panel px-3 py-2 text-xs leading-relaxed text-fg">
          {text}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx('caps text-muted', className)}>{children}</span>;
}

/** Caps label; a trailing "(unit)" keeps its case so µm never turns into ΜM. */
export function CapsLabel({ text }: { text: string }) {
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      {m[1]}
      <span className="ml-1.5 tracking-normal normal-case">({m[2]})</span>
    </>
  );
}

export function Field({ label, hint, children, error, className }: { label: string; hint?: string; children: ReactNode; error?: string | null; className?: string }) {
  return (
    <label className={cx('flex flex-col gap-1.5', className)}>
      <span className="flex items-center caps text-muted">
        <CapsLabel text={label} />
        {hint && <Hint text={hint} />}
      </span>
      {children}
      {error && <span className="text-xs text-red">{error}</span>}
    </label>
  );
}

export const inputCls =
  'h-10 w-full border border-line-strong bg-transparent px-3 text-sm text-fg placeholder:text-faint transition-colors duration-150 hover:border-faint focus:border-fg focus:outline-none disabled:opacity-40';

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
        className={cx(inputCls, 'num', unit && 'pr-10')}
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
      {unit && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-faint">{unit}</span>}
    </div>
  );
}

export function Select<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div className={cx('relative', className)}>
      <select className={cx(inputCls, 'appearance-none pr-9')} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-panel text-fg">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} strokeWidth={1.5} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; title?: string }[];
  size?: 'sm' | 'md';
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex border border-line-strong">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'caps transition-colors duration-150',
            i > 0 && 'border-l border-line-strong',
            size === 'sm' ? 'h-8 px-3' : 'h-10 px-4',
            value === o.value ? 'bg-fg text-bg' : 'text-muted hover:text-fg',
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
    <label className={cx('inline-flex cursor-pointer items-center gap-2.5 text-sm text-fg', className)}>
      <input type="checkbox" className="tp-check" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** Hairline section with a caps title. Not a card: no fill, no radius. */
export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('border border-line', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          {title && <h3 className="caps text-fg">{title}</h3>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

const TONE: Record<string, string> = { neutral: 'bg-grey', ok: 'bg-fg', warn: 'bg-yellow', bad: 'bg-red', accent: 'bg-red', info: 'bg-blue' };

/** State tag: a coloured square plus caps text. */
export function Badge({ tone = 'neutral', children, title }: { tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'accent' | 'info'; children: ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center gap-1.5 text-[11px] leading-tight text-fg">
      <span aria-hidden className={cx('h-2 w-2 shrink-0', TONE[tone])} />
      <span>{children}</span>
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="caps text-muted">{label}</span>
      <span className="num text-sm text-fg">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

/** Five-block colour code: grey, blue, yellow, red, white. `on` lights the given blocks. */
export function CodeStrip({ on, className, size = 'md' }: { on?: ('grey' | 'blue' | 'yellow' | 'red' | 'white')[]; className?: string; size?: 'sm' | 'md' }) {
  const all = ['grey', 'blue', 'yellow', 'red', 'white'] as const;
  const cls = { grey: 'bg-grey', blue: 'bg-blue', yellow: 'bg-yellow', red: 'bg-red', white: 'bg-fg' };
  return (
    <span aria-hidden className={cx('inline-flex gap-1', className)}>
      {all.map((c) => (
        <span key={c} className={cx(size === 'sm' ? 'h-1.5 w-3' : 'h-2.5 w-6', !on || on.includes(c) ? cls[c] : 'bg-line-strong')} />
      ))}
    </span>
  );
}

/** Signal readout: ten blocks, `value` (0..1) of them lit; `alert` lights them red. */
export function Meter({ value, alert = false, label }: { value: number; alert?: boolean; label: string }) {
  const lit = Math.round(Math.max(0, Math.min(1, value)) * 10);
  return (
    <span role="img" aria-label={label} className="inline-flex gap-[3px]">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={cx('h-2.5 w-[7px]', i < lit ? (alert ? 'bg-red' : 'bg-fg') : 'bg-line-strong')} />
      ))}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <Dialog.Content
          className={cx(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[88vh] w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col border border-line-strong bg-bg focus:outline-none',
            wide ? 'max-w-[960px]' : 'max-w-[620px]',
          )}
        >
          <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <Dialog.Title className="display text-2xl text-fg">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label={`${title}: close`} className="inline-flex h-9 w-9 items-center justify-center border border-line-strong text-muted hover:border-fg hover:text-fg">
                <X size={16} strokeWidth={1.5} />
              </button>
            </Dialog.Close>
          </header>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
