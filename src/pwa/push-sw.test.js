import { beforeEach, describe, expect, it, vi } from 'vitest'

const SCOPE = 'https://app.test/'

/** `self` falso de service worker: guarda os handlers e deixa dispará-los. */
function fakeServiceWorkerScope(openClients = []) {
  const handlers = {}
  return {
    handlers,
    addEventListener: (type, fn) => (handlers[type] = fn),
    registration: {
      scope: SCOPE,
      showNotification: vi.fn(async () => {}),
      pushManager: { subscribe: vi.fn(async () => ({})) },
    },
    clients: {
      matchAll: vi.fn(async () => openClients),
      openWindow: vi.fn(async () => {}),
    },
  }
}

/** Dispara um evento e espera o waitUntil. */
async function fire(scope, type, init) {
  let pending
  scope.handlers[type]({ ...init, waitUntil: (p) => (pending = p) })
  await pending
}

const pushData = (value) => ({
  json: () => (typeof value === 'string' ? JSON.parse(value) : value),
  text: () => String(value),
})

function client(url) {
  return { url, postMessage: vi.fn(), focus: vi.fn(async () => {}) }
}

async function load(scope) {
  vi.stubGlobal('self', scope)
  vi.resetModules()
  await import('./push-sw.js')
}

describe('push-sw.js', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('push: avisa as abas abertas e sempre mostra a notificação', async () => {
    const tab = client(`${SCOPE}#/`)
    const scope = fakeServiceWorkerScope([tab])
    await load(scope)
    await fire(scope, 'push', { data: pushData({ title: 'Pedido 42', body: 'Saiu para entrega', url: '#/pedidos/42', data: { id: 42 } }) })
    expect(tab.postMessage).toHaveBeenCalledWith({
      type: 'appshell:push-received',
      payload: { title: 'Pedido 42', body: 'Saiu para entrega', url: '#/pedidos/42', data: { id: 42 } },
    })
    expect(scope.registration.showNotification).toHaveBeenCalledWith(
      'Pedido 42',
      expect.objectContaining({ body: 'Saiu para entrega', data: { url: '#/pedidos/42', data: { id: 42 } } }),
    )
  })

  it('push com texto puro vira o body', async () => {
    const scope = fakeServiceWorkerScope()
    await load(scope)
    await fire(scope, 'push', { data: pushData('não é json') })
    expect(scope.registration.showNotification).toHaveBeenCalledWith(SCOPE, expect.objectContaining({ body: 'não é json' }))
  })

  it('clique com o app aberto: foca a aba e manda o clique', async () => {
    const tab = client(`${SCOPE}#/`)
    const scope = fakeServiceWorkerScope([client('https://outro.site/'), tab])
    await load(scope)
    const notification = { close: vi.fn(), data: { url: '#/pedidos/42', data: { id: 42 } } }
    await fire(scope, 'notificationclick', { notification, action: 'ver' })
    expect(notification.close).toHaveBeenCalled()
    expect(tab.focus).toHaveBeenCalled()
    expect(tab.postMessage).toHaveBeenCalledWith({
      type: 'appshell:push-clicked',
      payload: { url: '#/pedidos/42', data: { id: 42 }, action: 'ver' },
    })
    expect(scope.clients.openWindow).not.toHaveBeenCalled()
  })

  it('clique com o app fechado: abre já na rota, com o clique na query', async () => {
    const scope = fakeServiceWorkerScope()
    await load(scope)
    await fire(scope, 'notificationclick', { notification: { close: () => {}, data: { url: '#/pedidos/42', data: {} } }, action: '' })
    const opened = new URL(scope.clients.openWindow.mock.calls[0][0])
    expect(opened.hash).toBe('#/pedidos/42')
    expect(JSON.parse(opened.searchParams.get('appshell-push-click'))).toEqual({ url: '#/pedidos/42', data: {}, action: null })
  })

  it('pushsubscriptionchange: reinscreve com as opções antigas e avisa as abas', async () => {
    const tab = client(SCOPE)
    const scope = fakeServiceWorkerScope([tab])
    await load(scope)
    const options = { userVisibleOnly: true, applicationServerKey: new Uint8Array([4]) }
    await fire(scope, 'pushsubscriptionchange', { oldSubscription: { options } })
    expect(scope.registration.pushManager.subscribe).toHaveBeenCalledWith(options)
    expect(tab.postMessage).toHaveBeenCalledWith({ type: 'appshell:push-subscription-change' })
  })
})
