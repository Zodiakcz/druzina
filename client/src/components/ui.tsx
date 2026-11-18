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

export function Stat({ label, value, onClick, sub }: { label: string; value: ReactNode; onClick?: () => void; sub?: ReactNode }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`flex min-w-0 flex-col items-center rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-2 ${onClick ? 'active:bg-zinc-800 hover:border-amber-700/60' : ''}`}
    >
      <span className="text-2xl font-bold tabular-nums text-zinc-50">{value}</span>
      <span className="text-center text-[10px] font-semibold uppercase leading-tight tracking-wide text-zinc-400">{label}</span>
      {sub && <span className="text-[10px] text-zinc-500">{sub}</span>}
    </Tag>
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
                  {part.slice(2, -2)}
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
