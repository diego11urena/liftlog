import { expect, test, vi } from 'vitest'
import { uuid } from './db'

test('uuid works without crypto.randomUUID (plain-http phone)', () => {
  const real = globalThis.crypto
  vi.stubGlobal('crypto', { getRandomValues: <T extends ArrayBufferView>(a: T) => real.getRandomValues(a as unknown as Uint8Array<ArrayBuffer>) as unknown as T })
  const ids = new Set(Array.from({ length: 500 }, uuid))
  vi.unstubAllGlobals()
  expect(ids.size).toBe(500)
  for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
})
