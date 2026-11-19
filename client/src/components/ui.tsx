import { useEffect, type ReactNode } from 'react'

export function Modal({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-700 bg-zinc-900 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <h2 className="font-display text-lg text-amber-200">{title}</h2>
          <button className="-mr-1 rounded px-2 text-2xl leading-none text-zinc-400 hover:text-zinc-100" onClick={onClose} aria-label="Zavřít">
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3 text-sm leading-relaxed text-zinc-200">{children}</div>
        {footer && <div className="border-t border-zinc-800 px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Section({ title, right, children }: { title: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

// The visual language for what can be tapped, used everywhere on the sheet:
// - rolls dice: amber (or red/orange for damage) border, tinted fill and a die icon (RollButton, Stat with onClick)
// - opens a text: a chevron at the end of the row (More)
// - plain number: no border, flat (Stat without onClick)

/** A small d20 outline. */
export function DieIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <polygon points="50,4 92,28 92,72 50,96 8,72 8,28" fill="none" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" />
      <polygon points="50,26 74,66 26,66" fill="currentColor" opacity=".85" />
    </svg>
  )
}

/** "Opens a detail" marker at the end of a tappable row. */
export function More() {
  return (
    <span aria-hidden="true" className="shrink-0 pl-1 text-lg leading-none text-zinc-500">
      ›
    </span>
  )
}

const ROLL_TONE = {
  amber: 'border-amber-700/70 bg-amber-950/40 text-amber-50 hover:border-amber-500 active:bg-amber-900/60',
  red: 'border-red-800/80 bg-red-950/50 text-red-50 hover:border-red-500 active:bg-red-900/60',
  crit: 'border-orange-600/80 bg-orange-950/50 text-orange-100 hover:border-orange-400 active:bg-orange-900/60',
  green: 'border-emerald-800/80 bg-emerald-950/50 text-emerald-50 hover:border-emerald-500 active:bg-emerald-900/60',
}
const ROLL_CAPTION = { amber: 'text-amber-400/90', red: 'text-red-300/90', crit: 'text-orange-300', green: 'text-emerald-300/90' }

/** A button that rolls dice. `caption` says what the roll is ("útok", "zranění"). */
export function RollButton({ onClick, caption, children, tone = 'amber', className = '', title }: {
  onClick: () => void
  caption?: string
  children: ReactNode
  tone?: keyof typeof ROLL_TONE
  className?: string
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex shrink-0 flex-col items-center justify-center rounded-lg border px-2.5 py-1 ${ROLL_TONE[tone]} ${className}`}
    >
      {caption && <span className={`text-[9px] font-semibold uppercase leading-tight tracking-wide ${ROLL_CAPTION[tone]}`}>{caption}</span>}
      <span className="flex items-center gap-1 font-bold tabular-nums">
        <DieIcon className="h-3.5 w-3.5 opacity-70" />
        {children}
      </span>
    </button>
  )
}

export function Stat({ label, value, onClick, sub }: { label: string; value: ReactNode; onClick?: () => void; sub?: ReactNode }) {
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="relative flex min-w-0 flex-col items-center rounded-lg border border-amber-700/70 bg-amber-950/40 px-2 py-2 hover:border-amber-500 active:bg-amber-900/60"
      >
        <DieIcon className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-amber-500/80" />
        <span className="text-2xl font-bold tabular-nums text-zinc-50">{value}</span>
        <span className="text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-amber-300/90">{label}</span>
        {sub && <span className="text-[10px] text-zinc-500">{sub}</span>}
      </button>
    )
  }
  return (
    <div className="flex min-w-0 flex-col items-center rounded-lg bg-zinc-900/40 px-2 py-2">
      <span className="text-2xl font-bold tabular-nums text-zinc-50">{value}</span>
      <span className="text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-zinc-400">{label}</span>
      {sub && <span className="text-[10px] text-zinc-500">{sub}</span>}
    </div>
  )
}

/** Paragraphs from plain text with blank-line or single-newline breaks; **bold** markers from Open5e kept as bold. */
export function Prose({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text
        .split(/\n+/)
        .filter((p) => p.trim())
        .map((p, i) => (
          <p key={i}>
            {p.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
              part.startsWith('**') && part.endsWith('**') ? (
                <strong key={j} className="text-zinc-50">
                  {part.slice(2, -2).replace(/_([^_]+)_/g, '$1')}
                </strong>
              ) : (
                part.replace(/_([^_]+)_/g, '$1')
              )
            )}
          </p>
        ))}
    </div>
  )
}

export function Pips({ total, used, onChange, label }: { total: number; used: number; onChange: (used: number) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label={label}>
      {Array.from({ length: total }, (_, i) => {
        const isUsed = i < used
        return (
          <button
            key={i}
            aria-label={`${label} ${i + 1}${isUsed ? ' (použito)' : ''}`}
            // Tap a free pip to spend up to it, tap a spent one to give it (and later ones) back.
            onClick={() => onChange(isUsed ? i : i + 1)}
            className={`h-6 w-6 rounded-full border-2 ${isUsed ? 'border-zinc-600 bg-zinc-800' : 'border-amber-500 bg-amber-500/80'}`}
          />
        )
      })}
    </div>
  )
}

export function Button({ children, onClick, kind = 'default', className = '', type = 'button', disabled }: {
  children: ReactNode
  onClick?: () => void
  kind?: 'default' | 'primary' | 'danger' | 'ghost'
  className?: string
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  const styles = {
    default: 'border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700',
    primary: 'bg-amber-600 text-zinc-950 hover:bg-amber-500 font-semibold',
    danger: 'border border-red-800 bg-red-950 text-red-200 hover:bg-red-900',
    ghost: 'text-zinc-300 hover:bg-zinc-800',
  }[kind]
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`rounded-lg px-3 py-2 text-sm disabled:opacity-50 ${styles} ${className}`}>
      {children}
    </button>
  )
}
