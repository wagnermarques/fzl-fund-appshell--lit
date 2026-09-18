import { beforeEach, describe, expect, it } from 'vitest'
import { analyticsService, gtagSrc, pageViewParams, safePageLocation } from './analytics-service.js'

const BASE = 'https://exemplo.com/app/'

/** Janela/documento de mentira: o serviço nunca toca em globais direto,
 *  então dá pra verificar exatamente o que iria pro gtag. Tudo que o gtag
 *  recebe vira uma entrada no dataLayer (é assim que a tag do Google lê),
 *  então é de lá que os testes leem — não de um espião no lugar do
 *  window.gtag, que o próprio serviço substitui ao instalar a tag. */
function fakeEnv() {
  const scripts = []
  const win = { location: { origin: 'https://exemplo.com', pathname: '/app/' } }
  const doc = {
    createElement: () => ({}),
    head: { appendChild: (el) => scripts.push(el) },
  }
  return { win, doc, scripts }
}

/** As chamadas do gtag, já como arrays comuns (o dataLayer guarda objetos
 *  `arguments`). */
function calls(win) {
  return [...(win.dataLayer ?? [])].map((args) => [...args])
}

function events(win) {
  return calls(win).filter(([kind]) => kind === 'event')
}

const ga4 = { provider: 'ga4', id: 'G-ABC123', params: {} }

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
