import { beforeEach, describe, expect, it } from 'vitest'
import { analyticsService, gtagSrc, isGaCookie, pageViewParams, safePageLocation } from './analytics-service.js'

const BASE = 'https://exemplo.com/app/'

/** Janela/documento de mentira: o serviço nunca toca em globais direto,
 *  então dá pra verificar exatamente o que iria pro gtag. Tudo que o gtag
 *  recebe vira uma entrada no dataLayer (é assim que a tag do Google lê),
 *  então é de lá que os testes leem — não de um espião no lugar do
 *  window.gtag, que o próprio serviço substitui ao instalar a tag. */
function fakeEnv() {
  const scripts = []
  const win = { location: { origin: 'https://exemplo.com', pathname: '/app/', hostname: 'app.exemplo.com' } }
  // document.cookie de mentira: cada atribuição fica registrada em `writes`.
  const writes = []
  const doc = {
    createElement: () => ({}),
    head: { appendChild: (el) => scripts.push(el) },
    get cookie() {
      return 'legisreader_ga=GA1.1; legisreader_ga_ABC123=GS1.1; outro=1'
    },
    set cookie(value) {
      writes.push(value)
    },
  }
  return { win, doc, scripts, writes }
}

/** As chamadas do gtag, já como arrays comuns (o dataLayer guarda objetos
 *  `arguments`). */
function calls(win) {
  return [...(win.dataLayer ?? [])].map((args) => [...args])
}

function events(win) {
  return calls(win).filter(([kind]) => kind === 'event')
}

// Os testes de page_view/track partem do GA4 já liberado; o fluxo de
// consentimento tem o seu próprio describe lá embaixo.
const ga4 = { provider: 'ga4', id: 'G-ABC123', params: {}, requireConsent: false }
const ga4WithConsent = { ...ga4, requireConsent: true }

beforeEach(() => analyticsService.reset())

describe('safePageLocation', () => {
  it('remonta a URL a partir da rota resolvida', () => {
    const route = { segments: ['livro', '42'], query: { q: 'gênesis' } }
    expect(safePageLocation(BASE, route)).toBe('https://exemplo.com/app/#/livro/42?q=g%C3%AAnesis')
  })

  it('descarta tokens da query — eles nunca podem chegar ao Google', () => {
    const route = { segments: ['conta'], query: { access_token: 'segredo', token: 'x', ok: '1' } }
    const url = safePageLocation(BASE, route)
    expect(url).not.toContain('segredo')
    expect(url).toBe('https://exemplo.com/app/#/conta?ok=1')
  })

  it('aguenta uma rota sem segments/query', () => {
    expect(safePageLocation(BASE, {})).toBe('https://exemplo.com/app/#/')
  })
})

describe('pageViewParams', () => {
  it('manda o nome da rota separado, para agregar por tela', () => {
    const route = { name: 'livro', segments: ['livro', '42'], query: {} }
    expect(pageViewParams({ route, title: 'LegisReader', baseUrl: BASE })).toEqual({
      page_location: 'https://exemplo.com/app/#/livro/42',
      page_title: 'LegisReader — livro',
      route_name: 'livro',
    })
  })
})

describe('analyticsService.init', () => {
  it('não liga nada quando o provider é "none"', () => {
    const { win, doc, scripts } = fakeEnv()
    expect(analyticsService.init({ provider: 'none' }, { win, doc })).toBe(false)
    expect(scripts).toHaveLength(0)
  })

  it('carrega o gtag do id do app e desliga o page_view automático', () => {
    const { win, doc, scripts } = fakeEnv()
    expect(analyticsService.init({ ...ga4, cookiePrefix: 'legisreader' }, { win, doc })).toBe(true)

    expect(scripts[0].src).toBe(gtagSrc('G-ABC123'))
    const config = calls(win).find(([kind]) => kind === 'config')
    expect(config[1]).toBe('G-ABC123')
    // send_page_view: false é o que faz o SPA funcionar — sem isso o gtag
    // conta só a carga inicial e ignora toda navegação por hash.
    expect(config[2].send_page_view).toBe(false)
    // Prefixo de cookie próprio: dois apps na mesma origem não podem
    // compartilhar sessão nem usuário no GA4.
    expect(config[2].cookie_prefix).toBe('legisreader')
  })

  it('não recarrega o script quando chamado de novo com o mesmo id', () => {
    const { win, doc, scripts } = fakeEnv()
    analyticsService.init(ga4, { win, doc })
    analyticsService.init(ga4, { win, doc })
    expect(scripts).toHaveLength(1)
  })
})

describe('analyticsService.trackPageView', () => {
  it('manda um page_view por rota — inclusive a primeira', () => {
    const { win, doc } = fakeEnv()
    analyticsService.init(ga4, { win, doc })

    analyticsService.trackPageView({ name: 'home', segments: [], query: {} }, 'App', { win })
    analyticsService.trackPageView({ name: 'livro', segments: ['livro', '1'], query: {} }, 'App', { win })

    expect(events(win).map(([, name]) => name)).toEqual(['page_view', 'page_view'])
    expect(events(win).map(([, , params]) => params.route_name)).toEqual(['home', 'livro'])
  })

  it('fica em silêncio quando o analytics não foi ligado', () => {
    const { win } = fakeEnv()
    expect(analyticsService.trackPageView({ name: 'home' }, 'App', { win })).toBe(false)
    expect(events(win)).toHaveLength(0)
  })
})

describe('analyticsService.track', () => {
  it('manda o evento de domínio do app', () => {
    const { win, doc } = fakeEnv()
    analyticsService.init(ga4, { win, doc })
    analyticsService.track('livro_aberto', { id: '42' }, { win })
    expect(events(win)).toEqual([['event', 'livro_aberto', { id: '42' }]])
  })

  it('fica em silêncio sem analytics ligado', () => {
    const { win } = fakeEnv()
    expect(analyticsService.track('x', {}, { win })).toBe(false)
  })
})

describe('analyticsService — consentimento', () => {
  const home = { name: 'home', segments: [], query: {} }

  it('sem resposta do usuário não baixa o gtag.js nem manda nada', () => {
    const { win, doc, scripts } = fakeEnv()
    expect(analyticsService.init(ga4WithConsent, { win, doc })).toBe(false)
    expect(analyticsService.needsConsent()).toBe(true)
    expect(analyticsService.trackPageView(home, 'App', { win })).toBe(false)
    expect(analyticsService.track('x', {}, { win })).toBe(false)
    expect(scripts).toHaveLength(0)
    expect(win.dataLayer).toBeUndefined()
  })

  it('com consentimento já salvo liga direto na carga', () => {
    const { win, doc, scripts } = fakeEnv()
    expect(analyticsService.init(ga4WithConsent, { win, doc, consent: 'granted' })).toBe(true)
    expect(scripts).toHaveLength(1)
  })

  it('consentimento negado e salvo continua desligado', () => {
    const { win, doc, scripts } = fakeEnv()
    expect(analyticsService.init(ga4WithConsent, { win, doc, consent: 'denied' })).toBe(false)
    expect(scripts).toHaveLength(0)
  })

  it('o default do Consent Mode vem antes do config, com anúncios sempre negados', () => {
    const { win, doc } = fakeEnv()
    analyticsService.init(ga4WithConsent, { win, doc, consent: 'granted' })
    const kinds = calls(win).map(([kind]) => kind)
    expect(kinds.indexOf('consent')).toBeLessThan(kinds.indexOf('config'))
    expect(calls(win)[0]).toEqual([
      'consent',
      'default',
      { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' },
    ])
  })

  it('ao aceitar, liga e conta a tela em que o usuário já estava', () => {
    const { win, doc, scripts } = fakeEnv()
    analyticsService.init(ga4WithConsent, { win, doc })
    analyticsService.trackPageView(home, 'App', { win })

    expect(analyticsService.setConsent('granted', { win, doc })).toBe(true)
    expect(scripts).toHaveLength(1)
    expect(events(win).map(([, name, params]) => [name, params.route_name])).toEqual([['page_view', 'home']])
  })

  it('ao revogar, avisa o gtag, para de mandar e apaga os cookies _ga do app', () => {
    const { win, doc, writes } = fakeEnv()
    analyticsService.init({ ...ga4WithConsent, cookiePrefix: 'legisreader' }, { win, doc, consent: 'granted' })

    expect(analyticsService.setConsent('denied', { win, doc })).toBe(false)
    expect(calls(win).at(-1)).toEqual([
      'consent',
      'update',
      { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' },
    ])
    expect(analyticsService.track('x', {}, { win })).toBe(false)

    const deleted = new Set(writes.map((w) => w.split('=')[0]))
    expect(deleted).toEqual(new Set(['legisreader_ga', 'legisreader_ga_ABC123']))
    // Tenta o host e cada domínio pai — o gtag grava no mais alto que der.
    expect(writes.some((w) => w.includes('domain=.exemplo.com'))).toBe(true)
  })

  it('aceitar de novo depois de revogar não recarrega o script', () => {
    const { win, doc, scripts } = fakeEnv()
    analyticsService.init(ga4WithConsent, { win, doc, consent: 'granted' })
    analyticsService.setConsent('denied', { win, doc })
    analyticsService.setConsent('granted', { win, doc })
    expect(scripts).toHaveLength(1)
    expect(calls(win).at(-1)[0]).toBe('consent')
    expect(calls(win).at(-1)[2].analytics_storage).toBe('granted')
  })

  it('requireConsent: false não pede consentimento', () => {
    const { win, doc } = fakeEnv()
    analyticsService.init(ga4, { win, doc })
    expect(analyticsService.needsConsent()).toBe(false)
  })
})

describe('isGaCookie', () => {
  it('reconhece só os cookies do GA4 com o prefixo do app', () => {
    expect(isGaCookie('_ga')).toBe(true)
    expect(isGaCookie('_ga_ABC123')).toBe(true)
    expect(isGaCookie('legisreader_ga', 'legisreader')).toBe(true)
    expect(isGaCookie('_ga', 'legisreader')).toBe(false)
    expect(isGaCookie('outroapp_ga', 'legisreader')).toBe(false)
    expect(isGaCookie('_gat')).toBe(false)
  })
})
