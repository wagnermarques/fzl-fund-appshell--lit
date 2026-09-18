import { describe, expect, it } from 'vitest'
import { validateConfig } from './create-app-shell.js'

const noop = () => {}
const base = { mount: '#app', home: noop, title: 'App' }

describe('validateConfig', () => {
  it('aceita a config mínima e preenche os opcionais', () => {
    expect(validateConfig(base)).toEqual({
      mount: '#app',
      routes: [],
      home: noop,
      title: 'App',
      drawer: { sections: [], shellSections: { conta: true, config: true } },
      headerActions: null,
      footerItems: null,
      analytics: { provider: 'none' },
      auth: null,
    })
  })

  it('aceita um elemento como mount, não só um seletor', () => {
    const el = {}
    expect(validateConfig({ ...base, mount: el }).mount).toBe(el)
  })

  it('passa as rotas do app adiante quando válidas', () => {
    const route = { name: 'busca', match: noop, render: noop }
    expect(validateConfig({ ...base, routes: [route] }).routes).toEqual([route])
  })

  it('recusa config ausente ou não-objeto', () => {
    expect(() => validateConfig()).toThrow(/config é obrigatório/)
    expect(() => validateConfig('x')).toThrow(/config é obrigatório/)
  })

  it('recusa mount ausente', () => {
    expect(() => validateConfig({ ...base, mount: undefined })).toThrow(/"mount"/)
  })

  it('recusa home ausente ou que não seja função', () => {
    expect(() => validateConfig({ ...base, home: undefined })).toThrow(/"home"/)
    expect(() => validateConfig({ ...base, home: 'x' })).toThrow(/"home"/)
  })

  it('recusa title ausente ou vazio', () => {
    expect(() => validateConfig({ ...base, title: undefined })).toThrow(/"title"/)
    expect(() => validateConfig({ ...base, title: '' })).toThrow(/"title"/)
  })

  it('recusa rota sem name', () => {
    expect(() => validateConfig({ ...base, routes: [{ match: noop, render: noop }] })).toThrow(/precisa de "name"/)
  })

  it('recusa nomes de rota duplicados', () => {
    const routes = [
      { name: 'busca', match: noop, render: noop },
      { name: 'busca', match: noop, render: noop },
    ]
    expect(() => validateConfig({ ...base, routes })).toThrow(/duplicado "busca"/)
  })

  it('recusa rota sem match', () => {
    expect(() => validateConfig({ ...base, routes: [{ name: 'busca', render: noop }] })).toThrow(
      /"busca" precisa de "match"/,
    )
  })

  it('recusa rota sem render', () => {
    expect(() => validateConfig({ ...base, routes: [{ name: 'busca', match: noop }] })).toThrow(
      /"busca" precisa de "render"/,
    )
  })

  it('recusa headerActions/footerItems que não sejam função', () => {
    expect(() => validateConfig({ ...base, headerActions: 'x' })).toThrow(/"headerActions"/)
    expect(() => validateConfig({ ...base, footerItems: 'x' })).toThrow(/"footerItems"/)
  })

  it('aceita uma seção do drawer com items', () => {
    const drawer = { sections: [{ id: 'normas', label: 'Normas', items: [{ label: 'Favoritos', href: '#/fav' }] }] }
    expect(validateConfig({ ...base, drawer }).drawer.sections).toEqual(drawer.sections)
  })

  it('aceita uma seção do drawer com render', () => {
    const drawer = { sections: [{ id: 'normas', label: 'Normas', render: noop }] }
    expect(validateConfig({ ...base, drawer }).drawer.sections).toEqual(drawer.sections)
  })

  it('recusa seção do drawer sem id', () => {
    const drawer = { sections: [{ label: 'Normas', items: [] }] }
    expect(() => validateConfig({ ...base, drawer })).toThrow(/precisa de "id"/)
  })

  it('recusa ids de seção duplicados', () => {
    const drawer = {
      sections: [
        { id: 'normas', label: 'Normas', items: [] },
        { id: 'normas', label: 'Normas 2', items: [] },
      ],
    }
    expect(() => validateConfig({ ...base, drawer })).toThrow(/duplicado "normas"/)
  })

  it('recusa seção sem label', () => {
    const drawer = { sections: [{ id: 'normas', items: [] }] }
    expect(() => validateConfig({ ...base, drawer })).toThrow(/"normas" precisa de "label"/)
  })

  it('recusa seção com items e render ao mesmo tempo, ou nenhum dos dois', () => {
    const comOsDois = { sections: [{ id: 'normas', label: 'Normas', items: [], render: noop }] }
    const comNenhum = { sections: [{ id: 'normas', label: 'Normas' }] }
    expect(() => validateConfig({ ...base, drawer: comOsDois })).toThrow(/"items" ou "render"/)
    expect(() => validateConfig({ ...base, drawer: comNenhum })).toThrow(/"items" ou "render"/)
  })

  it('recusa shellSections com chave desconhecida', () => {
    const drawer = { shellSections: { contaa: false } }
    expect(() => validateConfig({ ...base, drawer })).toThrow(/shellSections não reconhece "contaa"/)
  })

  it('preenche shellSections com os padrões e aceita sobrescrever só uma', () => {
    expect(validateConfig({ ...base, drawer: { shellSections: { config: false } } }).drawer.shellSections).toEqual({
      conta: true,
      config: false,
    })
  })
})

describe('validateConfig — analytics', () => {
  it('aceita o id do GA4 do app e assume provider "ga4"', () => {
    const analytics = validateConfig({ ...base, analytics: { id: 'G-ABC123' } }).analytics
    expect(analytics).toEqual({
      provider: 'ga4',
      id: 'G-ABC123',
      cookiePrefix: undefined,
      params: {},
      requireConsent: true,
      privacyUrl: undefined,
    })
  })

  it('passa cookiePrefix, params, requireConsent e privacyUrl adiante', () => {
    const analytics = {
      id: 'G-ABC123',
      cookiePrefix: 'legisreader',
      params: { debug_mode: true },
      requireConsent: false,
      privacyUrl: 'https://exemplo.com/privacidade',
    }
    expect(validateConfig({ ...base, analytics }).analytics).toEqual({ provider: 'ga4', ...analytics })
  })

  it('desliga quando não há id — o caso de VITE_GA4_MEASUREMENT_ID indefinida em dev', () => {
    expect(validateConfig({ ...base, analytics: { id: undefined } }).analytics).toEqual({ provider: 'none' })
    expect(validateConfig({ ...base, analytics: { id: '' } }).analytics).toEqual({ provider: 'none' })
  })

  it('desliga com provider "none", mesmo com id', () => {
    const analytics = { provider: 'none', id: 'G-ABC123' }
    expect(validateConfig({ ...base, analytics }).analytics).toEqual({ provider: 'none' })
  })

  it('recusa um id preenchido fora do formato do GA4', () => {
    expect(() => validateConfig({ ...base, analytics: { id: 'UA-12345-1' } })).toThrow(/Measurement ID/)
    expect(() => validateConfig({ ...base, analytics: { id: 'G ABC' } })).toThrow(/Measurement ID/)
  })

  it('recusa provider desconhecido', () => {
    expect(() => validateConfig({ ...base, analytics: { provider: 'plausible' } })).toThrow(/provider/)
  })

  it('recusa analytics que não seja objeto, e cookiePrefix/params de tipo errado', () => {
    expect(() => validateConfig({ ...base, analytics: 'G-ABC123' })).toThrow(/"analytics"/)
    expect(() => validateConfig({ ...base, analytics: { id: 'G-ABC123', cookiePrefix: 1 } })).toThrow(/cookiePrefix/)
    expect(() => validateConfig({ ...base, analytics: { id: 'G-ABC123', params: 'x' } })).toThrow(/params/)
    expect(() => validateConfig({ ...base, analytics: { id: 'G-ABC123', requireConsent: 'sim' } })).toThrow(
      /requireConsent/,
    )
    expect(() => validateConfig({ ...base, analytics: { id: 'G-ABC123', privacyUrl: 1 } })).toThrow(/privacyUrl/)
  })
})

describe('validateConfig — auth', () => {
  const minimal = { signIn: async () => ({}), signOut: async () => {} }

  it('aceita um provedor com só signIn e signOut', () => {
    expect(validateConfig({ ...base, auth: minimal }).auth).toBe(minimal)
  })

  it('aceita as operações opcionais de senha', () => {
    const auth = {
      ...minimal,
      signUp: noop,
      requestPasswordReset: noop,
      resetPassword: noop,
      changePassword: noop,
      init: noop,
      passwordMinLength: 8,
    }
    expect(validateConfig({ ...base, auth }).auth).toBe(auth)
  })

  it('recusa provedor que não é objeto ou sem signIn/signOut', () => {
    expect(() => validateConfig({ ...base, auth: 'x' })).toThrow(/"auth" deve ser um objeto/)
    expect(() => validateConfig({ ...base, auth: { signOut: noop } })).toThrow(/auth.signIn é obrigatório/)
    expect(() => validateConfig({ ...base, auth: { signIn: noop } })).toThrow(/auth.signOut é obrigatório/)
  })

  it('recusa operação opcional que não é função e passwordMinLength inválido', () => {
    expect(() => validateConfig({ ...base, auth: { ...minimal, resetPassword: true } })).toThrow(
      /auth.resetPassword deve ser uma função/,
    )
    expect(() => validateConfig({ ...base, auth: { ...minimal, passwordMinLength: 0 } })).toThrow(/passwordMinLength/)
  })
})
