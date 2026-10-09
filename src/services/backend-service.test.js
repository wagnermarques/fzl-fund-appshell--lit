import { describe, expect, it, vi } from 'vitest'
import { BackendError, buildUrl, createBackendService } from './backend-service.js'

function jsonResponse(status, body, headers = { 'content-type': 'application/json' }) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers })
}

/** Serviço com fetch falso; cada chamada responde com o próximo item de `replies`
 *  (uma Response, um erro a lançar, ou 'hang' para nunca responder). */
function setup(backends, replies = [], { token = null } = {}) {
  const calls = []
  let clock = 1000
  const fetch = vi.fn(async (url, init) => {
    calls.push({ url, init })
    const reply = replies.shift()
    if (reply === 'hang') {
      return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('abort', 'AbortError'))))
    }
    if (reply instanceof Error) throw reply
    return reply ?? jsonResponse(200, {})
  })
  const service = createBackendService({ fetch, now: () => clock })
  service.use(backends, { getAccessToken: async () => token })
  const events = []
  service.subscribe((e) => events.push(e))
  return { service, calls, events, advance: (ms) => (clock += ms) }
}

const API = { api: { url: 'https://api.test/v1', auth: 'bearer', health: '/health' } }

describe('buildUrl', () => {
  it('junta base e caminho com uma barra só e monta a query (pulando null/undefined)', () => {
    expect(buildUrl('https://a.test/v1/', '/pedidos', { status: 'aberto', vazio: null, tag: ['a', 'b'] })).toBe(
      'https://a.test/v1/pedidos?status=aberto&tag=a&tag=b',
    )
    expect(buildUrl('/api', 'x')).toBe('/api/x')
    expect(buildUrl('https://a.test', '')).toBe('https://a.test')
  })

  it('recusa caminho que é outra origem — o token não sai do backend declarado', () => {
    expect(buildUrl('https://a.test', 'https://mal.test/x')).toBe(null)
    expect(buildUrl('https://a.test', '//mal.test/x')).toBe(null)
  })
})

describe('backend()', () => {
  it('GET com JSON, token Bearer e Accept', async () => {
    const { service, calls } = setup(API, [jsonResponse(200, [{ id: 1 }])], { token: 'tok' })
    expect(await service.backend('api').get('/pedidos', { query: { p: 2 } })).toEqual([{ id: 1 }])
    expect(calls[0].url).toBe('https://api.test/v1/pedidos?p=2')
    expect(calls[0].init.method).toBe('GET')
    expect(calls[0].init.headers).toMatchObject({ Accept: 'application/json', Authorization: 'Bearer tok' })
  })

  it('POST serializa objeto como JSON; FormData passa como veio; sem token, sem Authorization', async () => {
    const { service, calls } = setup(API, [jsonResponse(201, { id: 9 }), jsonResponse(204)])
    expect(await service.backend('api').post('/pedidos', { item: 'x' })).toEqual({ id: 9 })
    expect(calls[0].init.body).toBe('{"item":"x"}')
    expect(calls[0].init.headers['Content-Type']).toBe('application/json')
    expect(calls[0].init.headers.Authorization).toBeUndefined()
    const form = new FormData()
    expect(await service.backend('api').put('/arquivo', form)).toBe(null)
    expect(calls[1].init.body).toBe(form)
  })

  it('auth: none nunca pede token', async () => {
    const getAccessToken = vi.fn(async () => 'tok')
    const service = createBackendService({ fetch: async () => jsonResponse(200, {}) })
    service.use({ cdn: { url: 'https://cdn.test' } }, { getAccessToken })
    await service.backend('cdn').get('/x')
    expect(getAccessToken).not.toHaveBeenCalled()
  })

  it('erros HTTP viram BackendError com mensagem para o usuário', async () => {
    const { service } = setup(API, [
      jsonResponse(422, { message: 'Quantidade deve ser positiva.' }),
      jsonResponse(500, { message: 'NullPointerException at ...' }),
      jsonResponse(403, { message: 'forbidden' }),
    ])
    const api = service.backend('api')
    await expect(api.post('/p', {})).rejects.toMatchObject({ status: 422, code: 'http', message: 'Quantidade deve ser positiva.' })
    await expect(api.get('/p')).rejects.toMatchObject({ status: 500, message: /servidor teve um problema/ })
    await expect(api.get('/p')).rejects.toMatchObject({ status: 403, message: /não tem permissão/ })
  })

  it('401 vira o evento unauthorized', async () => {
    const { service, events } = setup(API, [jsonResponse(401, {})])
    await expect(service.backend('api').get('/eu')).rejects.toMatchObject({ status: 401, message: /sessão expirou/ })
    expect(events).toContainEqual({ type: 'unauthorized', backend: 'api', url: 'https://api.test/v1', status: 401 })
  })

  it('falha de rede e tempo limite: erro claro e backend marcado como fora', async () => {
    const { service, events } = setup({ api: { ...API.api, timeoutMs: 20 } }, [new TypeError('Failed to fetch'), 'hang'])
    await expect(service.backend('api').get('/x')).rejects.toMatchObject({ code: 'network', message: /Verifique sua conexão/ })
    await expect(service.backend('api').get('/x')).rejects.toMatchObject({ code: 'timeout', message: /demorou demais/ })
    expect(events.map((e) => e.type)).toEqual(['unreachable']) // só a transição
    expect(service.status('api').reachable).toBe(false)
  })

  it('cancelamento do app (signal), antes ou durante o fetch, não marca o backend como fora', async () => {
    const { service, events, calls } = setup(API, ['hang'])
    const before = new AbortController()
    const early = service.backend('api').get('/x', { signal: before.signal })
    before.abort() // ainda no getToken
    await expect(early).rejects.toThrow()
    expect(calls).toHaveLength(0)

    const during = new AbortController()
    const late = service.backend('api').get('/x', { signal: during.signal })
    await new Promise((r) => setTimeout(r, 0))
    expect(calls).toHaveLength(1)
    during.abort()
    await expect(late).rejects.toThrow()
    expect(events).toEqual([])
  })

  it('backend não declarado, sem url ou caminho de outra origem: erro antes de qualquer fetch', async () => {
    const { service, calls } = setup({ ...API, vazio: { url: '' } })
    await expect(service.backend('nao-existe').get('/x')).rejects.toThrow(/não declarado.*há: api, vazio/)
    await expect(service.backend('vazio').get('/x')).rejects.toMatchObject({ code: 'not-configured' })
    await expect(service.backend('api').get('https://mal.test/roubar')).rejects.toMatchObject({ code: 'bad-path' })
    expect(calls).toEqual([])
    expect(new BackendError('x')).toBeInstanceOf(Error)
  })
})

describe('checagem de saúde', () => {
  it('GET em health sem login; muda o estado e avisa só nas transições', async () => {
    const { service, calls, events } = setup(API, [jsonResponse(200, { ok: true }), new TypeError('x'), jsonResponse(200, {})], {
      token: 'tok',
    })
    await service.check('api')
    await service.check('api')
    await service.check('api')
    expect(calls[0].url).toBe('https://api.test/v1/health')
    expect(calls[0].init.headers.Authorization).toBeUndefined()
    expect(events.map((e) => e.type)).toEqual(['reachable', 'unreachable', 'reachable'])
  })

  it('5xx na saúde = fora; 404 = o servidor está lá', async () => {
    const { service } = setup(API, [jsonResponse(503, {}), jsonResponse(404, {})])
    expect((await service.check('api')).reachable).toBe(false)
    expect((await service.check('api')).reachable).toBe(true)
  })

  it('checkAll sem force respeita o intervalo mínimo; backends sem health/url ficam de fora', async () => {
    const { service, calls, advance } = setup({ ...API, semHealth: { url: 'https://x.test' }, vazio: { url: '', health: '/h' } })
    await service.checkAll({ force: true })
    await service.checkAll()
    expect(calls).toHaveLength(1)
    advance(31000)
    await service.checkAll()
    expect(calls).toHaveLength(2)
  })

  it('list() devolve os backends com os padrões preenchidos', () => {
    const { service } = setup({ api: { url: 'https://a.test' } })
    expect(service.list()).toEqual([{ name: 'api', url: 'https://a.test', auth: 'none', health: null, timeoutMs: 15000 }])
  })
})
