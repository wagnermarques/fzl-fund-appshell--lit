import { describe, expect, it, vi } from 'vitest'
import { resolveAccessibility } from '../accessibility-config.js'
import {
  accessibilityConfig,
  accessibilityService,
  applyPreferences,
  readPreferences,
  sanitizePreferences,
} from './accessibility-service.js'

function memoryStorage(initial = {}) {
  const data = { ...initial }
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => (data[k] = String(v)),
    removeItem: (k) => delete data[k],
    data,
  }
}

/** O suficiente de um <html> para applyPreferences. */
function fakeRoot() {
  const attrs = {}
  const style = {}
  return {
    setAttribute: (k, v) => (attrs[k] = v),
    removeAttribute: (k) => delete attrs[k],
    style: {
      setProperty: (k, v) => (style[k] = v),
      removeProperty: (k) => delete style[k],
    },
    attrs,
    styleProps: style,
  }
}

const KEY = `${__APP_STORAGE_PREFIX__}:a11y:preferences`

describe('accessibilityService', () => {
  it('a demo habilita tudo (appshell.config.js via preset)', () => {
    expect(accessibilityConfig).toEqual(resolveAccessibility())
  })

  it('sem nada salvo, valem os padrões do app', () => {
    expect(readPreferences(memoryStorage())).toEqual({ theme: 'system', font: 'system', textScale: 1 })
  })

  it('salva com o prefixo do app, aplica e avisa os inscritos', () => {
    const storage = memoryStorage()
    const root = fakeRoot()
    const listener = vi.fn()
    const unsubscribe = accessibilityService.subscribe(listener)

    const prefs = accessibilityService.set({ theme: 'high-contrast-dark', textScale: 1.5 }, storage, root)
    unsubscribe()

    expect(prefs).toEqual({ theme: 'high-contrast-dark', font: 'system', textScale: 1.5 })
    expect(JSON.parse(storage.data[KEY])).toEqual(prefs)
    expect(root.attrs['data-theme']).toBe('high-contrast-dark')
    expect(root.attrs['data-font']).toBeUndefined()
    expect(root.styleProps['--app-text-scale']).toBe('1.5')
    expect(listener).toHaveBeenCalledWith(prefs)
  })

  it('set muda só o que foi pedido', () => {
    const storage = memoryStorage()
    accessibilityService.set({ font: 'atkinson' }, storage, fakeRoot())
    expect(accessibilityService.set({ theme: 'dark' }, storage, fakeRoot())).toEqual({
      theme: 'dark',
      font: 'atkinson',
      textScale: 1,
    })
  })

  it('valor fora da config é erro', () => {
    expect(() => accessibilityService.set({ theme: 'sepia' }, memoryStorage(), fakeRoot())).toThrow(/sepia/)
    expect(() => accessibilityService.set({ textScale: 3 }, memoryStorage(), fakeRoot())).toThrow(/textScale/)
  })

  it('reset volta aos padrões e limpa o <html>', () => {
    const storage = memoryStorage()
    const root = fakeRoot()
    accessibilityService.set({ theme: 'dark', font: 'opendyslexic', textScale: 2 }, storage, root)
    expect(accessibilityService.reset(storage, root)).toEqual({ theme: 'system', font: 'system', textScale: 1 })
    expect(storage.data[KEY]).toBeUndefined()
    expect(root.attrs).toEqual({})
    expect(root.styleProps).toEqual({})
  })

  it('storage adulterado ou com opção que o app tirou volta ao padrão, campo a campo', () => {
    const only = resolveAccessibility({ fonts: ['atkinson'], themes: ['dark'] })
    expect(sanitizePreferences({ theme: 'high-contrast-light', font: 'atkinson', textScale: 9 }, only)).toEqual({
      theme: 'system',
      font: 'atkinson',
      textScale: 1,
    })
    expect(readPreferences(memoryStorage({ [KEY]: '{não é json' }))).toEqual({
      theme: 'system',
      font: 'system',
      textScale: 1,
    })
  })

  it('storage que explode não derruba o app', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceeded')
      },
      removeItem: () => {
        throw new Error('SecurityError')
      },
    }
    expect(readPreferences(broken)).toEqual({ theme: 'system', font: 'system', textScale: 1 })
    expect(() => accessibilityService.set({ theme: 'dark' }, broken, fakeRoot())).not.toThrow()
    expect(() => accessibilityService.reset(broken, fakeRoot())).not.toThrow()
  })

  it('com a acessibilidade desligada, nada salvo é aplicado', () => {
    const storage = memoryStorage({ [KEY]: JSON.stringify({ theme: 'dark', font: 'atkinson', textScale: 2 }) })
    expect(readPreferences(storage, resolveAccessibility(false))).toEqual({
      theme: 'system',
      font: 'system',
      textScale: 1,
    })
  })

  it('"system" remove os atributos, para o CSS seguir o sistema operacional', () => {
    const root = fakeRoot()
    applyPreferences({ theme: 'dark', font: 'atkinson', textScale: 2 }, root)
    applyPreferences({ theme: 'system', font: 'system', textScale: 1 }, root)
    expect(root.attrs).toEqual({})
    expect(root.styleProps).toEqual({})
  })
})
