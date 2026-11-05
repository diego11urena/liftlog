import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from './db'
import { dateKey } from './lib'
import Profile from './screens/Profile'
import Stats from './screens/Stats'
import WorkoutTab from './screens/WorkoutTab'
import { AskHost, Icon, NameModal, type IconName } from './ui'

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
  // a browser can't read the device's name, so each phone asks once (null = never asked; undefined = still loading)
  const asked = useLiveQuery(async () => (await db.settings.get('name')) ?? null, [])
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
      <main key={tab} className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain ${nav ? 'pb-[calc(76px+env(safe-area-inset-bottom))]' : ''}`}>
        {tab === 'Profile' && <Profile onJump={(k) => { setDate(k); setTab('Workout') }} />}
        {tab === 'Workout' && <WorkoutTab date={date} setDate={setDate} />}
        {tab === 'Stats' && <Stats />}
      </main>

      {msg && (
        <div role="status" className="pop phone-fixed top-[calc(1rem+env(safe-area-inset-top))] z-[70] flex justify-center px-4">
          <span className="rounded-full bg-fg px-5 py-2.5 text-sm font-semibold text-onink shadow-lg">{msg}</span>
        </div>
      )}
      {/* 76px + the home-indicator inset, pinned to the bottom of the frame (absolute inside the fixed frame, so it
          follows the frame's lvh height). Content above gets the same bottom padding. */}
      {nav && <nav className="absolute inset-x-0 bottom-0 z-40 flex h-[calc(76px+env(safe-area-inset-bottom))] border-t border-line bg-card px-2 pb-[env(safe-area-inset-bottom)]">
        {TABS.map((t) => (
          <button key={t.name} onClick={() => setTab(t.name)} aria-current={tab === t.name ? 'page' : undefined}
            className={`relative flex h-full w-full flex-col items-center justify-center gap-1 text-[0.6875rem] ${tab === t.name ? 'font-bold text-fg' : 'font-semibold text-muted'}`}>
            {tab === t.name && <span className="absolute inset-x-0 top-0 mx-auto h-[3px] w-7 rounded-b-full bg-accent" />}
            <Icon name={t.icon} className="size-[22px]" />
            {t.name}
          </button>
        ))}
      </nav>}
      {asked === null && (
        <NameModal title="What's your name?" help="Used in your greeting. You can change it later in Settings." cta="Continue" placeholder="Your name"
          onConfirm={(name) => void db.settings.put({ key: 'name', value: name })} onClose={() => void db.settings.put({ key: 'name', value: '' })} />
      )}
      <AskHost />
    </div>
  )
}
