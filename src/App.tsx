import { useEffect, useState } from 'react'
import { dateKey } from './lib'
import Profile from './screens/Profile'
import Stats from './screens/Stats'
import WorkoutTab from './screens/WorkoutTab'
import { AskHost, Icon, type IconName } from './ui'

const TABS: { name: 'Profile' | 'Workout' | 'Stats'; icon: IconName }[] = [
  { name: 'Profile', icon: 'person' }, { name: 'Workout', icon: 'dumbbell' }, { name: 'Stats', icon: 'stats' },
]
type Tab = (typeof TABS)[number]['name']

/** Screens without the tab bar (the exercise library) call `useHideTabs()`. */
export function useHideTabs() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('tabs', { detail: false }))
    return () => { window.dispatchEvent(new CustomEvent('tabs', { detail: true })) }
  }, [])
}

/** Plain status message: `toast('Saved')`. */
export const toast = (msg: string) => window.dispatchEvent(new CustomEvent('toast', { detail: msg }))

export default function App() {
  const [tab, setTab] = useState<Tab>('Workout')
  const [date, setDate] = useState(() => dateKey(Date.now()))
  const [msg, setMsg] = useState<string | null>(null)
  const [nav, setNav] = useState(true)
  useEffect(() => {
    const on = (e: Event) => setNav((e as CustomEvent<boolean>).detail)
    window.addEventListener('tabs', on)
    return () => window.removeEventListener('tabs', on)
  }, [])

  // iOS can leave the window scrolled after the keyboard closes; the window never scrolls on purpose, so reset it
  useEffect(() => {
    const reset = () => setTimeout(() => { if (!document.activeElement?.matches('input, textarea, select')) window.scrollTo(0, 0) }, 50)
    document.addEventListener('focusout', reset)
    return () => document.removeEventListener('focusout', reset)
  }, [])

  useEffect(() => {
    let t: number
    const on = (e: Event) => { setMsg((e as CustomEvent<string>).detail); clearTimeout(t); t = window.setTimeout(() => setMsg(null), 2000) }
    window.addEventListener('toast', on)
    return () => window.removeEventListener('toast', on)
  }, [])

  return (
    // Fixed full-screen frame: only <main> scrolls, the page never does, so the iOS keyboard can't
    // leave the layout shifted and the tab bar always sits at the bottom.
    <div className="app-frame phone-fixed inset-y-0 flex flex-col bg-bg">
      <main key={tab} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        {tab === 'Profile' && <Profile onJump={(k) => { setDate(k); setTab('Workout') }} />}
        {tab === 'Workout' && <WorkoutTab date={date} setDate={setDate} />}
        {tab === 'Stats' && <Stats />}
      </main>

      {msg && (
        <div role="status" className="pop phone-fixed top-[calc(1rem+env(safe-area-inset-top))] z-[70] flex justify-center px-4">
          <span className="rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-onink shadow-lg">{msg}</span>
        </div>
      )}
      {nav && <nav className="relative z-40 shrink-0 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {TABS.map((t) => (
            <button key={t.name} onClick={() => setTab(t.name)} aria-current={tab === t.name ? 'page' : undefined}
              className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${tab === t.name ? 'text-fg' : 'text-muted'}`}>
              {tab === t.name && <span className="absolute inset-x-0 top-0 mx-auto h-[3px] w-7 rounded-b-full bg-accent" />}
              <Icon name={t.icon} className="size-[22px]" />
              {t.name}
            </button>
          ))}
        </div>
      </nav>}
      <AskHost />
    </div>
  )
}
