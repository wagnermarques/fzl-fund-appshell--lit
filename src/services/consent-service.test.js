import { describe, expect, it, vi } from 'vitest'
import { consentService, readConsent } from './consent-service.js'

function memoryStorage(initial = {}) {
  const data = { ...initial }
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => (data[k] = String(v)),
    data,
  }
}

const KEY = `${__APP_STORAGE_PREFIX__}:consent:analytics`

describe('consentService', () => {
  it('sem nada salvo, o usuário ainda não respondeu', () => {
    expect(readConsent(memoryStorage())).toBe(null)
  })

  it('guarda a escolha com o prefixo do app', () => {
    const storage = memoryStorage()
    consentService.set('granted', storage)
    expect(storage.data[KEY]).toBe('granted')
    expect(consentService.get(storage)).toBe('granted')
  })

  it('valor estranho no storage conta como "não respondeu"', () => {
    expect(readConsent(memoryStorage({ [KEY]: 'talvez' }))).toBe(null)
  })

  it('storage que explode não derruba o app', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceeded')
      },
    }
    expect(readConsent(broken)).toBe(null)
    expect(() => consentService.set('denied', broken)).not.toThrow()
  })

  it('avisa os inscritos a cada escolha', () => {
    const fn = vi.fn()
    const off = consentService.subscribe(fn)
    consentService.set('denied', memoryStorage())
    off()
    consentService.set('granted', memoryStorage())
    expect(fn.mock.calls).toEqual([['denied']])
  })

  it('recusa valor inválido', () => {
    expect(() => consentService.set('sim', memoryStorage())).toThrow(/inválido/)
  })
})
