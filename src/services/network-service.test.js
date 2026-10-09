import { describe, expect, it, vi } from 'vitest'
import { createNetworkService } from './network-service.js'

/** window e navigator falsos, com eventos disparáveis à mão. */
function fakeEnv({ onLine = true, type, effectiveType } = {}) {
  const win = new EventTarget()
  const connection = Object.assign(new EventTarget(), { type, effectiveType })
  const nav = { onLine, connection }
  return {
    win,
    nav,
    goOffline() {
      nav.onLine = false
      win.dispatchEvent(new Event('offline'))
    },
    goOnline() {
      nav.onLine = true
      win.dispatchEvent(new Event('online'))
    },
    switchTo(next) {
      Object.assign(connection, next)
      connection.dispatchEvent(new Event('change'))
    },
  }
}

describe('networkService', () => {
  it('lê o estado atual sem precisar de inscritos', () => {
    const env = fakeEnv({ onLine: false, type: 'wifi' })
    const network = createNetworkService(env)
    expect(network.isOnline()).toBe(false)
    expect(network.kind()).toBe('wifi')
  })

  it('prefere o type; sem ele (ou "unknown"), usa o effectiveType; sem API, null', () => {
    expect(createNetworkService(fakeEnv({ type: 'unknown', effectiveType: '4g' })).kind()).toBe('4g')
    expect(createNetworkService({ win: new EventTarget(), nav: { onLine: true } }).kind()).toBe(null)
  })

  it('avisa queda, volta e troca de tipo de rede', () => {
    const env = fakeEnv({ type: 'wifi' })
    const network = createNetworkService(env)
    const fn = vi.fn()
    network.subscribe(fn)
    env.goOffline()
    env.switchTo({ type: 'cellular' }) // offline: silencioso
    env.goOnline()
    env.switchTo({ type: 'wifi' })
    env.switchTo({ type: 'wifi' }) // mesmo tipo: nada
    expect(fn.mock.calls).toEqual([
      [{ online: false, kind: 'wifi', change: 'offline' }],
      [{ online: true, kind: 'cellular', change: 'online' }],
      [{ online: true, kind: 'wifi', change: 'change' }],
    ])
  })

  it('para de escutar o navegador quando sai o último inscrito', () => {
    const env = fakeEnv()
    const spy = vi.spyOn(env.win, 'removeEventListener')
    const network = createNetworkService(env)
    const off1 = network.subscribe(() => {})
    const off2 = network.subscribe(() => {})
    off1()
    expect(spy).not.toHaveBeenCalled()
    off2()
    expect(spy).toHaveBeenCalledWith('offline', expect.any(Function))
  })
})
