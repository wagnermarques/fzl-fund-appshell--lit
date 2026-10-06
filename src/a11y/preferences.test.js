import { describe, expect, it, vi } from 'vitest'
import { resolveAccessibility } from './config.js'
import { applyPreferences, createPreferences, readPreferences, sanitizePreferences } from './preferences.js'

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

const KEY = 'meuapp:a11y:preferences'
const ALL = resolveAccessibility()

function setup(storage = memoryStorage(), config = ALL) {
  const root = fakeRoot()
  return { storage, root, prefs: createPreferences({ config, key: KEY, storage, root }) }
}

describe('createPreferences', () => {
  it('sem nada salvo, valem os padrões do app', () => {
    expect(readPreferences(memoryStorage(), KEY, ALL)).toEqual({ theme: 'system', font: 'system', textScale: 1 })
  })

  it('salva com o prefixo do app, aplica e avisa os inscritos', () => {
    const { storage, root, prefs: service } = setup()
    const listener = vi.fn()
    const unsubscribe = service.subscribe(listener)

    const prefs = service.set({ theme: 'high-contrast-dark', textScale: 1.5 })
    unsubscribe()

    expect(prefs).toEqual({ theme: 'high-contrast-dark', font: 'system', textScale: 1.5 })
    expect(JSON.parse(storage.data[KEY])).toEqual(prefs)
    expect(root.attrs['data-theme']).toBe('high-contrast-dark')
    expect(root.attrs['data-font']).toBeUndefined()
    expect(root.styleProps['--a11y-text-scale']).toBe('1.5')
    expect(listener).toHaveBeenCalledWith(prefs)
  })

  it('set muda só o que foi pedido', () => {
    const { prefs } = setup()
    prefs.set({ font: 'atkinson' })
    expect(prefs.set({ theme: 'dark' })).toEqual({
      theme: 'dark',
      font: 'atkinson',
      textScale: 1,
    })
  })

  it('valor fora da config é erro', () => {
    const { prefs } = setup()
    expect(() => prefs.set({ theme: 'sepia' })).toThrow(/sepia/)
    expect(() => prefs.set({ textScale: 3 })).toThrow(/textScale/)
  })

  it('reset volta aos padrões e limpa o <html>', () => {
    const { storage, root, prefs } = setup()
    prefs.set({ theme: 'dark', font: 'opendyslexic', textScale: 2 })
    expect(prefs.reset()).toEqual({ theme: 'system', font: 'system', textScale: 1 })
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
    expect(readPreferences(memoryStorage({ [KEY]: '{não é json' }), KEY, ALL)).toEqual({
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
    const { prefs } = setup(broken)
    expect(prefs.get()).toEqual({ theme: 'system', font: 'system', textScale: 1 })
    expect(() => prefs.set({ theme: 'dark' })).not.toThrow()
    expect(() => prefs.reset()).not.toThrow()
  })

  it('com a acessibilidade desligada, nada salvo é aplicado', () => {
    const storage = memoryStorage({ [KEY]: JSON.stringify({ theme: 'dark', font: 'atkinson', textScale: 2 }) })
    expect(readPreferences(storage, KEY, resolveAccessibility(false))).toEqual({
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

  it('key como função é lida a cada acesso (prefixo que só existe depois do import)', () => {
    const storage = memoryStorage()
    let prefix = 'a'
    const prefs = createPreferences({ key: () => `${prefix}:a11y`, storage, root: fakeRoot() })
    prefs.set({ theme: 'dark' })
    prefix = 'b'
    expect(prefs.get().theme).toBe('system')
    expect(Object.keys(storage.data)).toEqual(['a:a11y'])
  })

  it('apply aplica o que está salvo sem avisar os inscritos', () => {
    const { storage, root, prefs } = setup(memoryStorage({ [KEY]: JSON.stringify({ theme: 'dark', font: 'system', textScale: 1 }) }))
    const listener = vi.fn()
    prefs.subscribe(listener)
    prefs.apply()
    expect(root.attrs['data-theme']).toBe('dark')
    expect(listener).not.toHaveBeenCalled()
    expect(storage.data[KEY]).toBeDefined()
  })
})
