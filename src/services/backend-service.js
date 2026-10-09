/**
 * Os backends do app, declarados no appshell.config.js:
 *
 *   backends: {
 *     api: { url: 'http://localhost:8080/api', auth: 'bearer', health: '/health', timeoutMs: 15000 },
 *   }
 *
 * e usados pelo app com
 *
 *   const pedidos = await backend('api').get('/pedidos', { query: { status: 'aberto' } })
 *   await backend('api').post('/pedidos', novoPedido)
 *
 * O shell sabe *onde* cada backend está, *como entrar* nele e *se ele
 * responde* — nada além: cache, fila offline e endpoints tipados ficam no
 * app. O que cada chamada ganha:
 *
 * - URL montada a partir da url do backend (o caminho nunca pode ser outra
 *   origem: o token do usuário não sai para um host que o app não declarou);
 * - JSON nos dois sentidos (FormData, Blob e texto passam como vieram);
 * - auth: 'bearer' manda Authorization: Bearer <token>, com o token vindo
 *   do provedor de auth do app (getAccessToken — ver auth-service.js);
 * - tempo limite (timeoutMs; padrão 15 s);
 * - erros como BackendError, com mensagem para o usuário (como o resto do
 *   shell) e status/code/body para o app decidir.
 *
 * Estado de cada backend (respondendo ou não) sai como eventos
 * backend:reachable / backend:unreachable — da checagem de saúde (health)
 * e de toda chamada normal — e um 401 como backend:unauthorized (o app
 * decide se manda para o login). Sem polling: o shell checa ao abrir, ao
 * voltar a rede e ao o app voltar ao primeiro plano.
 */
import { DEFAULT_TIMEOUT_MS } from '../app-config.js'

const HEALTH_TIMEOUT_MS = 5000
/** app:visible acontece a cada troca de aba; não checar mais que isto. */
const MIN_CHECK_INTERVAL_MS = 30000
/** Respostas que vêm do caminho (proxy/gateway), não do backend. */
const GATEWAY_STATUSES = [502, 503, 504]

export class BackendError extends Error {
  /** code: 'not-configured' | 'network' | 'timeout' | 'http' | 'bad-path' */
  constructor(message, { backend, code, status = 0, body = null } = {}) {
    super(message)
    this.name = 'BackendError'
    this.backend = backend
    this.code = code
    this.status = status
    this.body = body
  }
}

const STATUS_MESSAGES = {
  401: 'Sua sessão expirou. Entre de novo.',
  403: 'Você não tem permissão para isso.',
  404: 'Não encontrado.',
  408: 'O servidor demorou demais para responder.',
  429: 'Muitas tentativas seguidas. Espere um pouco e tente de novo.',
}

function messageFor(status, body) {
  // Validação (400/409/422...) costuma trazer uma mensagem útil do próprio
  // backend; 401/403 e 5xx, não — e nunca se mostra um stack trace.
  const fromBody = typeof body === 'object' && body !== null ? (body.message ?? body.error) : null
  if (status >= 400 && status < 500 && !STATUS_MESSAGES[status] && typeof fromBody === 'string' && fromBody) {
    return fromBody
  }
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status]
  if (status >= 500) return 'O servidor teve um problema. Tente de novo em instantes.'
  return 'Não foi possível concluir a operação.'
}

/** base + caminho + query. O caminho é sempre relativo à base. */
export function buildUrl(base, path = '', query = {}) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) return null
  const joined = path ? `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}` : base
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined) continue
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item)
  }
  const search = params.toString()
  return search ? `${joined}${joined.includes('?') ? '&' : '?'}${search}` : joined
}

function isJsonBody(body) {
  if (body === null || typeof body !== 'object') return typeof body === 'number' || typeof body === 'boolean'
  const tag = Object.prototype.toString.call(body)
  return tag === '[object Object]' || Array.isArray(body)
}

async function readBody(response) {
  if (response.status === 204 || response.status === 205) return null
  const text = await response.text()
  if (!text) return null
  if ((response.headers.get('content-type') ?? '').includes('json')) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

export function createBackendService({
  fetch = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
  setTimeout: setTimer = (...args) => globalThis.setTimeout(...args),
  clearTimeout: clearTimer = (...args) => globalThis.clearTimeout(...args),
} = {}) {
  let backends = {}
  let getToken = async () => null
  const statuses = new Map()
  const listeners = new Set()
  const clients = new Map()

  function notify(change) {
    listeners.forEach((fn) => fn(change))
  }

  function status(name) {
    return statuses.get(name) ?? { reachable: null, checkedAt: null, error: null }
  }

  /** Grava o estado; avisa só quando muda (ou na primeira vez que se sabe). */
  function setReachable(name, reachable, error = null) {
    const previous = status(name).reachable
    statuses.set(name, { reachable, checkedAt: now(), error })
    if (previous !== reachable) {
      notify({ type: reachable ? 'reachable' : 'unreachable', backend: name, url: backends[name]?.url ?? '', error })
    }
  }

  function requireBackend(name) {
    const config = backends[name]
    if (!config) {
      const known = Object.keys(backends)
      throw new BackendError(
        `Backend "${name}" não declarado no appshell.config.js${known.length ? ` (há: ${known.join(', ')})` : ''}.`,
        { backend: name, code: 'not-configured' },
      )
    }
    if (!config.url) {
      throw new BackendError(`O endereço do backend "${name}" não está configurado.`, {
        backend: name,
        code: 'not-configured',
      })
    }
    return config
  }

  /** fetch com tempo limite, somado ao signal de quem chamou. */
  async function timedFetch(url, init, timeoutMs, signal) {
    // Cancelado antes de começar (ex.: durante o getToken): o 'abort' já
    // passou e o listener abaixo nunca dispararia.
    signal?.throwIfAborted()
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimer(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort)
    try {
      return { response: await fetch(url, { ...init, signal: controller.signal }) }
    } catch (error) {
      if (signal?.aborted) throw error // o app cancelou: não é problema do backend
      return { error, timedOut }
    } finally {
      clearTimer(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }

  async function request(name, method, path, { query, body, headers = {}, timeoutMs, signal } = {}) {
    const config = requireBackend(name)
    const url = buildUrl(config.url, path, query)
    if (url === null) {
      throw new BackendError(`Caminho inválido "${path}": use um caminho relativo ao backend "${name}".`, {
        backend: name,
        code: 'bad-path',
      })
    }

    const init = { method, headers: { Accept: 'application/json', ...headers } }
    if (body !== undefined) {
      if (isJsonBody(body)) {
        init.body = JSON.stringify(body)
        init.headers['Content-Type'] ??= 'application/json'
      } else {
        init.body = body
      }
    }
    if (config.auth === 'bearer' && !init.headers.Authorization) {
      const token = await getToken()
      if (token) init.headers.Authorization = `Bearer ${token}`
    }

    const { response, error, timedOut } = await timedFetch(url, init, timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS, signal)
    if (!response) {
      const message = timedOut
        ? 'O servidor demorou demais para responder.'
        : 'Não foi possível falar com o servidor. Verifique sua conexão.'
      setReachable(name, false, message)
      throw new BackendError(message, { backend: name, code: timedOut ? 'timeout' : 'network', body: error })
    }

    const gateway = GATEWAY_STATUSES.includes(response.status)
    setReachable(name, !gateway, gateway ? messageFor(response.status) : null)
    if (response.status === 401) notify({ type: 'unauthorized', backend: name, url: config.url, status: 401 })

    const data = await readBody(response)
    if (!response.ok) {
      throw new BackendError(messageFor(response.status, data), {
        backend: name,
        code: 'http',
        status: response.status,
        body: data,
      })
    }
    return data
  }

  function client(name) {
    const call = (method) => (path, options) => request(name, method, path, options)
    return {
      name,
      get url() {
        return backends[name]?.url ?? ''
      },
      request: (method, path, options) => request(name, method, path, options),
      get: call('GET'),
      delete: call('DELETE'),
      post: (path, body, options) => request(name, 'POST', path, { ...options, body }),
      put: (path, body, options) => request(name, 'PUT', path, { ...options, body }),
      patch: (path, body, options) => request(name, 'PATCH', path, { ...options, body }),
      check: (options) => service.check(name, options),
    }
  }

  const service = {
    /** createAppShell chama com os backends já resolvidos (arquivo +
     *  ambiente) e o getAccessToken do provedor de auth. */
    use(newBackends = {}, { getAccessToken } = {}) {
      backends = newBackends ?? {}
      if (getAccessToken) getToken = getAccessToken
      statuses.clear()
      clients.clear()
    },

    /** Cliente do backend: backend('api').get('/pedidos'). Nome
     *  desconhecido só dá erro na chamada, para o app poder montar os
     *  clientes no import, antes do createAppShell. */
    backend(name) {
      if (!clients.has(name)) clients.set(name, client(name))
      return clients.get(name)
    },

    /** [{ name, url, auth, health, timeoutMs }] na ordem do arquivo. */
    list() {
      return Object.entries(backends).map(([name, config]) => ({
        name,
        url: config.url,
        auth: config.auth ?? 'none',
        health: config.health ?? null,
        timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      }))
    },

    /** { reachable: true | false | null, checkedAt, error } — null = ainda não se sabe. */
    status,

    /** Checa a saúde (GET em health, sem login). Sem health ou sem url,
     *  não faz nada. Devolve o status. */
    async check(name, { force = true } = {}) {
      const config = backends[name]
      if (!config?.url || !config.health) return status(name)
      const last = status(name).checkedAt
      if (!force && last !== null && now() - last < MIN_CHECK_INTERVAL_MS) return status(name)

      const { response, timedOut } = await timedFetch(
        buildUrl(config.url, config.health),
        { method: 'GET', headers: { Accept: 'application/json' } },
        Math.min(config.timeoutMs ?? DEFAULT_TIMEOUT_MS, HEALTH_TIMEOUT_MS),
      )
      if (!response) {
        setReachable(name, false, timedOut ? 'Não respondeu a tempo.' : 'Sem resposta.')
      } else if (response.status >= 500) {
        setReachable(name, false, `Respondeu com erro ${response.status}.`)
      } else {
        // 2xx, ou mesmo um 4xx: o servidor está lá e respondeu.
        setReachable(name, true)
      }
      return status(name)
    },

    /** Checa todos os que têm health. force: false respeita o intervalo mínimo. */
    async checkAll({ force = false } = {}) {
      await Promise.all(Object.keys(backends).map((name) => service.check(name, { force })))
    },

    /** Chama o callback a cada mudança com { type, backend, url, ... },
     *  type = 'reachable' | 'unreachable' | 'unauthorized'. */
    subscribe(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
  }

  return service
}

export const backendService = createBackendService()

/** Atalho: backend('api').get('/pedidos'). */
export function backend(name) {
  return backendService.backend(name)
}
