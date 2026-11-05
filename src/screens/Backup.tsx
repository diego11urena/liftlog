import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { toast } from '../App'
import { db } from '../db'
import { backupCode, fmtCode, restoreBackup } from '../sync'

const useCode = () => {
  const [code, setCode] = useState('')
  const stored = useLiveQuery(async () => (await db.settings.get('backupCode'))?.value as string | undefined, [])
  useEffect(() => { void backupCode().then(setCode) }, [stored])
  return code
}

const copy = async (code: string) => {
  try { await navigator.clipboard.writeText(fmtCode(code)); toast('Code copied') }
  catch { toast('Press and hold the code to copy it') }
}

const CodeBox = ({ code }: { code: string }) => (
  <div className="num select-all rounded-[14px] bg-panel px-3 py-3 text-center text-[15px] font-semibold leading-6 tracking-wide [-webkit-user-select:all]">{fmtCode(code)}</div>
)

const RESULT = {
  bad: "That doesn't look like a recovery code. It has 24 letters and numbers.",
  empty: 'No backup found for that code. Check it and try again.',
  offline: "Couldn't reach your backup. Check your connection and try again.",
}

function RestoreForm({ onDone }: { onDone?: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async () => {
    setBusy(true); setError('')
    const r = await restoreBackup(text)
    setBusy(false)
    if (r === 'ok') { toast('Your workouts are back'); setText(''); onDone?.() } else setError(RESULT[r])
  }
  return (
    <div className="space-y-2">
      <input className="field num text-center" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" aria-label="Recovery code" autoCapitalize="characters" autoCorrect="off" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn-accent w-full" disabled={!text.trim() || busy} onClick={run}>{busy ? 'Restoring…' : 'Restore workouts'}</button>
    </div>
  )
}

/** Settings: backup status, this phone's code, and restoring from another code. */
export function BackupBox() {
  const code = useCode()
  const at = useLiveQuery(async () => ((await db.settings.get('sync'))?.value as { backedUpAt?: number } | undefined)?.backedUpAt, [])
  return (
    <div className="card space-y-3 p-[18px]">
      <div>
        <h3 className="font-semibold">Automatic backup</h3>
        <p className="num text-sm text-muted">{at ? `Last backed up ${new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Not backed up yet'}</p>
      </div>
      <p className="text-sm text-muted">Your recovery code brings your workouts back if you delete the app or change phones. Keep it private: anyone with it can read your workouts.</p>
      <CodeBox code={code} />
      <button className="btn-ghost min-h-11 w-full text-sm" onClick={() => copy(code)}>Copy code</button>
      <h4 className="pt-1 text-sm font-semibold">Restore from a code</h4>
      <RestoreForm />
    </div>
  )
}

/** Shown once per phone: the backup is only worth anything if the code is kept somewhere else. */
export function BackupPrompt() {
  const code = useCode()
  const [restoring, setRestoring] = useState(false)
  const saved = () => db.settings.put({ key: 'backupCodeSaved', value: true })
  return (
    <div className="phone-fixed inset-y-0 z-50 grid place-items-center overflow-y-auto p-6" role="dialog" aria-modal aria-label="Save your recovery code">
      <div className="absolute inset-0 bg-scrim" />
      <div className="pop relative w-full space-y-3 rounded-[28px] bg-card p-5 text-center">
        {restoring ? (
          <>
            <h2 className="text-[22px] font-semibold">Restore your workouts</h2>
            <p className="text-sm text-muted">Enter the recovery code you saved.</p>
            <RestoreForm />
            <button className="btn-ghost min-h-11 w-full text-sm" onClick={() => setRestoring(false)}>Back</button>
          </>
        ) : (
          <>
            <h2 className="text-[22px] font-semibold">Save your recovery code</h2>
            <p className="text-sm text-muted">Your workouts now back up automatically. If you delete the app or change phones, this code brings them back. Save it in Notes or your password manager.</p>
            <CodeBox code={code} />
            <button className="btn-ghost min-h-11 w-full text-sm" onClick={() => copy(code)}>Copy code</button>
            <button className="btn-accent w-full" onClick={saved}>I saved it</button>
            <button className="min-h-11 w-full text-sm font-semibold text-acc-t" onClick={() => setRestoring(true)}>I already have a code</button>
          </>
        )}
      </div>
    </div>
  )
}
