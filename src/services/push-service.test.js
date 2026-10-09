import { describe, expect, it, vi } from 'vitest'
import {
  PUSH_CLICK_PARAM,
  createPushService,
  readClickFromUrl,
  urlBase64ToUint8Array,
  validatePushConfig,
} from './push-service.js'

const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
const ENDPOINT_KEY = `${__APP_STORAGE_PREFIX__}:push:endpoint`

function fakeSubscription(endpoint = 'https://push.example/abc') {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn(async () => true),
  }
}

/** Navegador falso: service worker, PushManager, Notification e storage. */
function fakeBrowser({ permission = 'default', answer = 'granted', subscription = null, href = 'https://app.test/' } = {}) {
  const data = {}
  const pushManager = {
    current: subscription,
    getSubscription: vi.fn(async () => pushManager.current),
    subscribe: vi.fn(async () => (pushManager.current = fakeSubscription())),
  }
  const registration = { pushManager }
  const serviceWorker = Object.assign(new EventTarget(), {
    ready: Promise.resolve(registration),
    getRegistration: vi.fn(async () => registration),
  })
  const Notification = {
    permission,
    requestPermission: vi.fn(async () => (Notification.permission = answer)),
  }
  const win = {
    PushManager: function PushManager() {},
    location: { href, assign: vi.fn() },
    history: { state: null, replaceState: vi.fn((_s, _t, url) => (win.location.href = url)) },
  }
  const storage = {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => (data[k] = String(v)),
    removeItem: (k) => delete data[k],
  }
  const service = createPushService({ win, nav: { serviceWorker }, Notification, storage: () => storage })
  const events = []
  service.subscribe((e) => events.push(e))
  const message = (data) => serviceWorker.dispatchEvent(Object.assign(new Event('message'), { data }))
  return { service, events, pushManager, Notification, win, data, message, serviceWorker }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('validatePushConfig', () => {
  it('sem config ou com chave vazia, push desligado', () => {
    expect(validatePushConfig(null)).toBe(null)
    expect(validatePushConfig({ vapidPublicKey: undefined, onSubscribe: () => {} })).toBe(null)
    expect(validatePushConfig({ vapidPublicKey: '', onSubscribe: () => {} })).toBe(null)
  })

  it('exige onSubscribe e chave em base64url', () => {
    expect(() => validatePushConfig('x')).toThrow(/objeto/)
    expect(() => validatePushConfig({ vapidPublicKey: KEY })).toThrow(/onSubscribe é obrigatório/)
    expect(() => validatePushConfig({ vapidPublicKey: 'não é chave', onSubscribe: () => {} })).toThrow(/base64url/)
    expect(() => validatePushConfig({ vapidPublicKey: KEY, onSubscribe: () => {}, onUnsubscribe: 1 })).toThrow(
      /onUnsubscribe/,
    )
  })
})

describe('auxiliares', () => {
  it('urlBase64ToUint8Array decodifica a chave pública (65 bytes, começando em 0x04)', () => {
    const bytes = urlBase64ToUint8Array(KEY)
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(4)
  })

  it('readClickFromUrl tira o clique da query e preserva a rota', () => {
    const payload = { url: '#/pedidos/42', data: { id: 42 }, action: null }
    const href = `https://app.test/?${PUSH_CLICK_PARAM}=${encodeURIComponent(JSON.stringify(payload))}#/pedidos/42`
    expect(readClickFromUrl(href)).toEqual({ click: payload, cleanUrl: 'https://app.test/#/pedidos/42' })
    expect(readClickFromUrl('https://app.test/#/x')).toEqual({ click: null, cleanUrl: 'https://app.test/#/x' })
    expect(readClickFromUrl(`https://app.test/?${PUSH_CLICK_PARAM}=%7Bquebrado`).click).toBe(null)
  })
})

describe('pushService', () => {
  const config = (extra = {}) => ({ vapidPublicKey: KEY, onSubscribe: vi.fn(async () => {}), ...extra })

  it('enable(): pede permissão, inscreve, entrega ao backend e avisa', async () => {
    const b = fakeBrowser()
    const cfg = config()
    b.service.use(cfg)
    const json = await b.service.enable()
    expect(b.Notification.requestPermission).toHaveBeenCalledOnce()
    expect(b.pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) })
    expect(cfg.onSubscribe).toHaveBeenCalledWith(json)
    expect(b.data[ENDPOINT_KEY]).toBe(json.endpoint)
    expect(b.events).toEqual([
      { type: 'permission-change', permission: 'granted' },
      { type: 'subscribed', subscription: json },
    ])
    expect(await b.service.isActive()).toBe(true)
  })

  it('permissão negada: erro para o usuário e nada de inscrição', async () => {
    const b = fakeBrowser({ answer: 'denied' })
    b.service.use(config())
    await expect(b.service.enable()).rejects.toThrow(/bloqueadas/)
    expect(b.pushManager.subscribe).not.toHaveBeenCalled()
  })

  it('backend recusou: a inscrição é desfeita', async () => {
    const b = fakeBrowser({ permission: 'granted' })
    b.service.use(config({ onSubscribe: async () => Promise.reject(new Error('Servidor fora do ar.')) }))
    await expect(b.service.enable()).rejects.toThrow(/fora do ar/)
    expect(b.pushManager.current.unsubscribe).toHaveBeenCalled()
    expect(b.events).toEqual([])
  })

  it('sem config, enable() recusa e isConfigured() é falso', async () => {
    const b = fakeBrowser()
    b.service.use(null)
    expect(b.service.isConfigured()).toBe(false)
    await expect(b.service.enable()).rejects.toThrow(/não envia notificações/)
  })

  it('disable(): avisa o backend e desfaz', async () => {
    const sub = fakeSubscription()
    const b = fakeBrowser({ permission: 'granted', subscription: sub })
    const cfg = config({ onUnsubscribe: vi.fn(async () => {}) })
    b.data[ENDPOINT_KEY] = sub.endpoint
    b.service.use(cfg)
    await b.service.disable()
    expect(cfg.onUnsubscribe).toHaveBeenCalledWith(sub.toJSON())
    expect(sub.unsubscribe).toHaveBeenCalled()
    expect(b.data[ENDPOINT_KEY]).toBeUndefined()
    expect(b.events).toEqual([{ type: 'unsubscribed' }])
  })

  it('repassa push recebido e clique vindos do service worker; o clique navega até url', () => {
    const b = fakeBrowser()
    b.service.use(config())
    b.message({ type: 'appshell:push-received', payload: { title: 'Oi', body: 'b', url: null, data: {} } })
    b.message({ type: 'appshell:push-clicked', payload: { url: '#/pedidos/42', data: { id: 42 }, action: 'ver' } })
    b.message({ type: 'outra-coisa' })
    expect(b.events).toEqual([
      { type: 'received', title: 'Oi', body: 'b', url: null, data: {} },
      { type: 'clicked', url: '#/pedidos/42', data: { id: 42 }, action: 'ver' },
    ])
    expect(b.win.location.assign).toHaveBeenCalledWith('https://app.test/#/pedidos/42')
  })

  it('clique que abriu o app do zero sai no use() e some da URL', () => {
    const payload = { url: '#/x', data: {}, action: null }
    const href = `https://app.test/?${PUSH_CLICK_PARAM}=${encodeURIComponent(JSON.stringify(payload))}#/x`
    const b = fakeBrowser({ href })
    b.service.use(config())
    expect(b.events).toEqual([{ type: 'clicked', ...payload }])
    expect(b.win.location.href).toBe('https://app.test/#/x')
  })

  it('inscrição trocada pelo navegador é reentregue ao backend e avisada', async () => {
    const b = fakeBrowser({ permission: 'granted', subscription: fakeSubscription('https://push.example/novo') })
    b.data[ENDPOINT_KEY] = 'https://push.example/velho'
    const cfg = config()
    b.service.use(cfg)
    await flush()
    expect(cfg.onSubscribe).toHaveBeenCalledWith(expect.objectContaining({ endpoint: 'https://push.example/novo' }))
    expect(b.events).toEqual([{ type: 'subscription-change', subscription: expect.objectContaining({ endpoint: 'https://push.example/novo' }) }])
    expect(b.data[ENDPOINT_KEY]).toBe('https://push.example/novo')
  })

  it('sem service worker registrado (npm run dev): não trava, só fica inativo', async () => {
    const b = fakeBrowser()
    b.serviceWorker.getRegistration.mockResolvedValue(undefined)
    b.service.use(config())
    expect(await b.service.isActive()).toBe(false)
    b.Notification.permission = 'granted'
    await expect(b.service.enable()).rejects.toThrow(/terminando de instalar/)
  })

  it('navegador sem Push API: não suportado, e use() não quebra', () => {
    const service = createPushService({ win: { location: { href: 'https://app.test/' } }, nav: {}, Notification: undefined })
    service.use(config())
    expect(service.isSupported()).toBe(false)
    expect(service.isConfigured()).toBe(true)
    expect(service.isAvailable()).toBe(false)
    expect(service.permission()).toBe('unsupported')
  })
})
