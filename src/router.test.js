import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  NOT_FOUND,
  createRouter,
  href,
  isAuthCallbackHash,
  navigate,
  parseHash,
  pattern,
  resolveRoute,
} from './router.js'

describe('pattern', () => {
  it('casa só a raiz com padrão vazio', () => {
    expect(pattern('')([])).toEqual({})
    expect(pattern('')(['x'])).toBeNull()
  })

  it('casa segmentos literais exatamente', () => {
    const match = pattern('conta/entrar')
    expect(match(['conta', 'entrar'])).toEqual({})
    expect(match(['conta'])).toBeNull()
    expect(match(['conta', 'entrar', 'mais'])).toBeNull()
    expect(match(['conta', 'sair'])).toBeNull()
  })

  it('extrai :parametros de um segmento', () => {
    expect(pattern('livro/:id/:capitulo')(['livro', 'gn', '3'])).toEqual({ id: 'gn', capitulo: '3' })
    expect(pattern('livro/:id')(['livro'])).toBeNull()
  })

  it('*resto casa um ou mais segmentos no fim', () => {
    const match = pattern('br/*caminho')
    expect(match(['br', 'federal', 'decreto-lei', '1940-2848', 'art121'])).toEqual({
      caminho: 'federal/decreto-lei/1940-2848/art121',
    })
    expect(match(['br', 'x'])).toEqual({ caminho: 'x' })
    expect(match(['br'])).toBeNull()
    expect(match(['pt', 'x'])).toBeNull()
  })

  it('recusa *resto fora do fim', () => {
    expect(() => pattern('br/*caminho/art')).toThrow(/só pode aparecer no fim/)
  })
})

describe('parseHash', () => {
  it('separa segmentos e query', () => {
    expect(parseHash('#/busca?q=legitima+defesa&oc=2')).toEqual({
      segments: ['busca'],
      query: { q: 'legitima defesa', oc: '2' },
    })
  })

  it('aceita hash vazio, sem barra e com barras sobrando', () => {
    expect(parseHash('')).toEqual({ segments: [], query: {} })
    expect(parseHash('#')).toEqual({ segments: [], query: {} })
    expect(parseHash('#conta')).toEqual({ segments: ['conta'], query: {} })
    expect(parseHash('#//conta//entrar/')).toEqual({ segments: ['conta', 'entrar'], query: {} })
  })

  it('decodifica segmentos e tolera % malformado', () => {
    expect(parseHash('#/norma/1940%3B2848').segments).toEqual(['norma', '1940;2848'])
    expect(parseHash('#/norma/100%').segments).toEqual(['norma', '100%'])
  })
})

describe('resolveRoute', () => {
  it('resolve as rotas estruturais do shell', () => {
    expect(resolveRoute('#/').name).toBe('home')
    expect(resolveRoute('').name).toBe('home')
    expect(resolveRoute('#/conta').name).toBe('conta')
    expect(resolveRoute('#/conta/entrar').name).toBe('conta-entrar')
    expect(resolveRoute('#/conta/cadastro').name).toBe('conta-cadastro')
    expect(resolveRoute('#/conta/esqueci-senha').name).toBe('conta-esqueci-senha')
    expect(resolveRoute('#/conta/redefinir-senha?token=abc')).toMatchObject({
      name: 'conta-redefinir-senha',
      query: { token: 'abc' },
    })
    expect(resolveRoute('#/conta/alterar-senha').name).toBe('conta-alterar-senha')
    expect(resolveRoute('#/config/backend/servicos-rest').name).toBe('config-backend-servicos-rest')
    expect(resolveRoute('#/config/privacidade').name).toBe('config-privacidade')
    expect(resolveRoute('#/config/acessibilidade').name).toBe('config-acessibilidade')
  })

  it('devolve not-found em vez de cair na home', () => {
    const route = resolveRoute('#/nao/existe?x=1')
    expect(route).toEqual({ name: NOT_FOUND, params: {}, query: { x: '1' }, segments: ['nao', 'existe'] })
  })

  it('usa rotas do app com parâmetros e query', () => {
    const routes = [{ name: 'dispositivo', match: pattern('br/*caminho') }]
    expect(resolveRoute('#/br/federal/decreto-lei/1940-2848/art25?q=legitima+defesa&oc=2', routes)).toEqual({
      name: 'dispositivo',
      params: { caminho: 'federal/decreto-lei/1940-2848/art25' },
      query: { q: 'legitima defesa', oc: '2' },
      segments: ['br', 'federal', 'decreto-lei', '1940-2848', 'art25'],
    })
  })

  it('rotas do app têm prioridade sobre as do shell', () => {
    const routes = [{ name: 'minha-conta', match: pattern('conta') }]
    expect(resolveRoute('#/conta', routes).name).toBe('minha-conta')
    expect(resolveRoute('#/conta/entrar', routes).name).toBe('conta-entrar')
  })

  it('entre rotas do app, a primeira que casar vence', () => {
    const routes = [
      { name: 'especifica', match: pattern('busca/avancada') },
      { name: 'generica', match: pattern('busca/*resto') },
    ]
    expect(resolveRoute('#/busca/avancada', routes).name).toBe('especifica')
    expect(resolveRoute('#/busca/outra', routes).name).toBe('generica')
  })

  it('passa a query para match customizado', () => {
    const routes = [{ name: 'com-q', match: (segments, query) => (query.q ? { termo: query.q } : null) }]
    expect(resolveRoute('#/qualquer?q=furto', routes)).toMatchObject({ name: 'com-q', params: { termo: 'furto' } })
    expect(resolveRoute('#/qualquer', routes).name).toBe(NOT_FOUND)
  })

  it('trata callback de autenticação no hash como a página da conta', () => {
    expect(isAuthCallbackHash('#access_token=abc&type=signup')).toBe(true)
    expect(isAuthCallbackHash('#error_description=expired')).toBe(true)
    expect(isAuthCallbackHash('#/busca?q=access')).toBe(false)
    expect(resolveRoute('#access_token=abc&type=signup')).toEqual({ name: 'conta', params: {}, query: {}, segments: [] })
  })

  it('link de recuperação de senha do provedor abre a tela de nova senha, sem expor o token', () => {
    expect(resolveRoute('#access_token=abc&refresh_token=def&type=recovery')).toEqual({
      name: 'conta-redefinir-senha',
      params: {},
      query: {},
      segments: [],
    })
    expect(resolveRoute('#access_token=abc&type=recoveryx').name).toBe('conta')
  })
})

describe('href', () => {
  it('monta o hash com e sem query', () => {
    expect(href()).toBe('#/')
    expect(href('')).toBe('#/')
    expect(href('conta/entrar')).toBe('#/conta/entrar')
    expect(href('/busca/', { q: 'legitima defesa', oc: 2 })).toBe('#/busca?q=legitima+defesa&oc=2')
  })

  it('omite valores nulos e codifica segmentos', () => {
    expect(href('busca', { q: 'x', norma: undefined, escopo: null })).toBe('#/busca?q=x')
    expect(href('norma/1940;2848 a')).toBe('#/norma/1940%3B2848%20a')
  })

  it('é o inverso de parseHash + resolveRoute', () => {
    const routes = [{ name: 'dispositivo', match: pattern('br/*caminho') }]
    const route = resolveRoute(href('br/federal/lei/art1', { q: 'São Paulo' }), routes)
    expect(route).toMatchObject({ name: 'dispositivo', params: { caminho: 'federal/lei/art1' }, query: { q: 'São Paulo' } })
  })
})

describe('navigate e createRouter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubBrowser(initialHash) {
    const target = new EventTarget()
    const location = { hash: initialHash }
    vi.stubGlobal('location', location)
    vi.stubGlobal('window', {
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
    })
    return { location, fireHashChange: () => target.dispatchEvent(new Event('hashchange')) }
  }

  it('navigate escreve o hash', () => {
    const { location } = stubBrowser('')
    navigate('busca', { q: 'furto' })
    expect(location.hash).toBe('#/busca?q=furto')
  })

  it('notifica a rota inicial e cada mudança, até cancelar', () => {
    const { location, fireHashChange } = stubBrowser('#/conta')
    const onChange = vi.fn()
    const stop = createRouter(onChange, { routes: [{ name: 'busca', match: pattern('busca') }] })

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'conta' }))

    location.hash = '#/busca?q=furto'
    fireHashChange()
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ name: 'busca', query: { q: 'furto' } }))

    stop()
    location.hash = '#/'
    fireHashChange()
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})
