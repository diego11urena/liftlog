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

/** Plain status message: `toast('Saved')`. */
export const toast = (msg: string) => window.dispatchEvent(new CustomEvent('toast', { detail: msg }))

export default function App() {
  const [tab, setTab] = useState<Tab>('Workout')
  const [date, setDate] = useState(() => dateKey(Date.now()))
  const [msg, setMsg] = useState<string | null>(null)

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
    <div className="phone-fixed inset-y-0 flex flex-col bg-bg">
      <main key={tab} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        {tab === 'Profile' && <Profile onJump={(k) => { setDate(k); setTab('Workout') }} />}
        {tab === 'Workout' && <WorkoutTab date={date} setDate={setDate} />}
        {tab === 'Stats' && <Stats />}
      </main>

      {msg && (
        <div role="status" className="pop phone-fixed top-[calc(1rem+env(safe-area-inset-top))] z-[70] flex justify-center px-4">
          <span className="rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-bg shadow-lg">{msg}</span>
        </div>
      )}
      <nav className="relative z-40 shrink-0 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {TABS.map((t) => (
            <button key={t.name} onClick={() => setTab(t.name)} aria-current={tab === t.name ? 'page' : undefined}
              className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${tab === t.name ? 'text-accent' : 'text-muted'}`}>
              <Icon name={t.icon} className="size-6" />
              {t.name}
            </button>
          ))}
        </div>
      </nav>
      <AskHost />
    </div>
  )
}
