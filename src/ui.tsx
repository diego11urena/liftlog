import { useEffect, useRef, useState, type ReactNode } from 'react'
import { addDays, dateKey } from './lib'

// Original stroke icons (24×24).
const PATHS = {
  chevL: 'M15 18l-6-6 6-6', chevR: 'M9 18l6-6-6-6', chevD: 'M6 9l6 6 6-6', plus: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6 6 18',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z',
  bell: 'M9 8.5a3 3 0 0 1 6 0M8 8.5h8l1.6 3.2A6.2 6.2 0 1 1 6.4 11.7Z', // kettlebell
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4Z', grip: 'M5 9h14M5 15h14',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  info: 'M12 11v6M12 7.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  repeat: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9Z',
  timer: 'M12 9v4l2 2M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM10 2h4',
  dumbbell: 'M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12',
  calendar: 'M4 6h16v14H4ZM4 10h16M8 3v4M16 3v4',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  stats: 'M5 20V11M12 20V4M19 20v-7',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  check: 'M5 12l5 5L20 7', pin: 'M12 16v5M8 3h8l-1 6 3 4H6l3-4-1-6Z',
} as const
export type IconName = keyof typeof PATHS

export function Icon({ name, className = 'size-5', fill }: { name: IconName; className?: string; fill?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={name === 'dots' ? 3.5 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  )
}

/** 46px circle with a 1.5px outline (ink by default; pass text-danger for a danger one). `onInk` for dark panels. */
export function RoundBtn({ icon, label, onClick, className = '', disabled, onInk }: { icon: IconName; label: string; onClick?: () => void; className?: string; disabled?: boolean; onInk?: boolean }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`relative grid shrink-0 place-items-center rounded-full border-[1.5px] active:scale-95 disabled:opacity-30 before:absolute before:-inset-0.5 before:content-[''] ${onInk ? 'size-11 border-[#ffffff3a] text-onink' : `size-[46px] border-current ${/\btext-/.test(className) ? '' : 'text-fg'}`} ${className}`}>
      <Icon name={icon} className="size-[22px]" />
    </button>
  )
}

/** Back chevron · centered title · optional right slot. */
export function TopBar({ title, onBack, right, sub }: { title: ReactNode; onBack?: () => void; right?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="sticky top-0 z-30 grid grid-cols-[46px_1fr_auto] items-center gap-2 bg-bg/95 px-[18px] pb-3 pt-[calc(28px+env(safe-area-inset-top))] backdrop-blur">
      {onBack ? <RoundBtn icon="chevL" label="Back" onClick={onBack} /> : <span />}
      <div className="min-w-0 text-center">
        <h1 className="truncate text-[22px] font-semibold leading-tight">{title}</h1>
        {sub && <div className="truncate text-xs text-muted">{sub}</div>}
      </div>
      <div className="flex min-w-[46px] justify-end gap-2">{right}</div>
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, className = '' }: { value: T; options: readonly T[]; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={`flex rounded-full bg-panel p-[3px] ${className}`} role="tablist">
      {options.map((o) => (
        <button key={o} role="tab" aria-selected={value === o} onClick={() => onChange(o)}
          className={`min-h-9 flex-1 rounded-full px-3 text-sm font-semibold transition ${value === o ? 'bg-fg text-on-accent' : 'text-muted'}`}>{o}</button>
      ))}
    </div>
  )
}

export const Spinner = ({ className = 'size-6' }: { className?: string }) => (
  <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} role="status" aria-label="Loading" />
)

/** Full-screen dim + spinner, used while saving. */
export const Busy = () => (
  <div className="phone-fixed inset-y-0 z-[60] grid place-items-center bg-scrim"><Spinner className="size-10 text-acc-t" /></div>
)

/** Bottom sheet with dimmed backdrop. `full` = full height. */
export function Sheet({ onClose, children, full, label }: { onClose: () => void; children: ReactNode; full?: boolean; label: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="phone-fixed inset-y-0 z-50 flex flex-col justify-end" role="dialog" aria-modal aria-label={label}>
      <button className="absolute inset-0 bg-scrim" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <div className={`slide-up relative flex flex-col overflow-y-auto rounded-t-[28px] bg-bg pb-[env(safe-area-inset-bottom)] ${full ? 'h-[94dvh]' : 'max-h-[85dvh]'}`}>
        {children}
      </div>
    </div>
  )
}

/** Small centered modal ("Workout Name"). */
export function NameModal({ initial = '', onConfirm, onClose, title = 'Workout Name', help = 'Name your workout. You can edit it later.', cta = 'Confirm Workout Name', placeholder = 'e.g. Leg Day' }: {
  initial?: string; onConfirm: (name: string) => void; onClose: () => void; title?: string; help?: string; cta?: string; placeholder?: string
}) {
  const [v, setV] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <div className="phone-fixed inset-y-0 z-50 grid place-items-center p-6" role="dialog" aria-modal aria-label={title}>
      <button className="absolute inset-0 bg-scrim" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <form className="pop relative w-full rounded-[28px] bg-card p-5 text-center" onSubmit={(e) => { e.preventDefault(); if (v.trim()) onConfirm(v.trim()) }}>
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-accent/15 text-acc-t"><Icon name="dumbbell" className="size-7" /></div>
        <h2 className="text-[22px] font-semibold">{title}</h2>
        <p className="mb-4 text-sm text-muted">{help}</p>
        <input ref={ref} className="field mb-4 text-center" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} maxLength={40} />
        <button className="btn-accent w-full" disabled={!v.trim()}>{cta}</button>
      </form>
    </div>
  )
}

/** Stat tile. inset = on a light card; paper = standalone; ink = on a dark panel. */
export const Tile = ({ label, value, tone = 'inset', big }: { label: string; value: ReactNode; tone?: 'inset' | 'paper' | 'ink'; big?: boolean }) => (
  <div className={`min-w-0 flex-1 px-3 py-3.5 text-center ${tone === 'inset' ? 'rounded-[18px] bg-panel' : tone === 'paper' ? 'rounded-[20px] border border-line bg-card' : 'rounded-[18px] bg-[#ffffff12]'}`}>
    <div className={`label ${tone === 'ink' ? 'text-muteink' : ''}`}>{label}</div>
    <div className={`num mt-1 whitespace-nowrap font-semibold ${big ? 'text-[30px]' : 'text-2xl'}`}>{value}</div>
  </div>
)

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export type DayStatus = 'done' | 'rest' | 'planned' | undefined

/** 7 day columns (Sun..Sat) with chevrons. Ring: solid ink = planned, dashed teal = rest; filled accent = completed. */
export function WeekStrip({ sunday, selected, onSelect, onWeek, status }: {
  sunday: number; selected?: string; onSelect: (key: string) => void; onWeek?: (dir: -1 | 1) => void; status: Record<string, DayStatus>
}) {
  const today = dateKey(Date.now())
  return (
    <div className="flex items-center justify-between">
      {onWeek && <button aria-label="Previous week" className="grid h-[46px] w-[26px] shrink-0 place-items-center text-muted" onClick={() => onWeek(-1)}><Icon name="chevL" /></button>}
      <div className="flex flex-1 justify-between">
        {LETTERS.map((l, i) => {
          const t = addDays(sunday, i), k = dateKey(t), st = status[k], sel = k === selected
          const ring = st === 'done' ? 'bg-accent text-on-accent' : st === 'rest' ? 'border-[1.5px] border-dashed border-rest text-rest'
            : st === 'planned' ? 'border-[1.5px] border-fg' : 'text-muted'
          return (
            <button key={k} onClick={() => onSelect(k)} aria-pressed={sel} aria-label={`${new Date(t).toDateString()}${st ? `, ${st}` : ''}${k === today ? ', today' : ''}`}
              className={`flex min-h-[72px] w-[42px] flex-col items-center gap-1 rounded-full py-1.5 ${sel ? 'border border-line bg-card shadow-[0_1px_3px_rgba(20,22,24,.12)]' : 'border border-transparent'}`}>
              <span className="num text-[11px] text-muted">{l}</span>
              <span className={`num grid size-[34px] place-items-center rounded-full text-[15px] font-semibold ${ring} ${k === today && !st ? 'underline decoration-fg/40 underline-offset-4' : ''}`}>
                {new Date(t).getDate()}
              </span>
              <span className={`size-1 rounded-full ${sel ? 'bg-fg' : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>
      {onWeek && <button aria-label="Next week" className="grid h-[46px] w-[26px] shrink-0 place-items-center text-muted" onClick={() => onWeek(1)}><Icon name="chevR" /></button>}
    </div>
  )
}

/** `marks[i]`: page i gets an accent dot (e.g. the exercise has a note waiting). */
export function Pager({ pages, index, onIndex, marks, accent }: { pages: ReactNode[]; index: number; onIndex: (i: number) => void; marks?: boolean[]; accent?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  // scroll to externally requested page
  useEffect(() => {
    const el = ref.current
    if (el && Math.abs(el.scrollLeft - index * el.clientWidth) > 4) el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
  }, [index, pages.length])
  const onScroll = () => {
    const el = ref.current!
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== index && i >= 0 && i < pages.length) onIndex(i)
  }
  return (
    <div>
      <div ref={ref} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
        {pages.map((p, i) => <div key={i} className="w-full shrink-0 snap-center px-[18px]">{p}</div>)}
      </div>
      {pages.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {pages.map((_, i) => (
            <button key={i} aria-label={`Page ${i + 1}${marks?.[i] ? ', has a note' : ''}`} onClick={() => onIndex(i)}
              className={`relative rounded-full before:absolute before:-inset-2 before:content-[''] ${marks?.[i] ? 'size-[11px] bg-accent' : i === index ? `h-2 w-[22px] ${accent ? 'bg-accent' : 'bg-fg'}` : 'size-2 bg-[#14161833]'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

type AskOpts = { title: string; message?: string; confirm?: string; cancel?: string; danger?: boolean }
type AskReq = AskOpts & { resolve: (ok: boolean) => void }

/** In-app replacement for window.confirm: `if (await ask({ title: 'Discard?', danger: true })) …` */
export const ask = (o: AskOpts) => new Promise<boolean>((resolve) => window.dispatchEvent(new CustomEvent<AskReq>('ask', { detail: { ...o, resolve } })))

/** Renders `ask()` dialogs. Mount once (App). */
export function AskHost() {
  const [q, setQ] = useState<AskReq | null>(null)
  useEffect(() => {
    const on = (e: Event) => setQ((e as CustomEvent<AskReq>).detail)
    window.addEventListener('ask', on)
    return () => window.removeEventListener('ask', on)
  }, [])
  useEffect(() => {
    if (!q) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { q.resolve(false); setQ(null) } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [q])
  if (!q) return null
  const done = (ok: boolean) => { q.resolve(ok); setQ(null) }
  return (
    <div className="phone-fixed inset-y-0 z-[80] grid place-items-center p-6" role="alertdialog" aria-modal aria-labelledby="ask-title">
      <button className="absolute inset-0 bg-scrim" aria-label="Cancel" tabIndex={-1} onClick={() => done(false)} />
      <div className="pop relative w-full rounded-[28px] bg-card p-5 text-center">
        <h2 id="ask-title" className="text-lg font-semibold">{q.title}</h2>
        {q.message && <p className="mt-1 text-sm text-muted">{q.message}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          {/* destructive dialogs focus Cancel, so a stray Enter can't delete anything */}
          <button autoFocus={q.danger} className="btn-ghost" onClick={() => done(false)}>{q.cancel ?? 'Cancel'}</button>
          <button autoFocus={!q.danger} className={q.danger ? 'btn bg-danger text-on-accent' : 'btn-accent'} onClick={() => done(true)}>{q.confirm ?? 'OK'}</button>
        </div>
      </div>
    </div>
  )
}
