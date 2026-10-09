import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bridgeAuth,
  bridgeNetwork,
  bridgeNotifications,
  bridgePreferences,
  bridgePush,
  createShellEvents,
} from './shell-events.js'

afterEach(() => vi.restoreAllMocks())

/** Serviço com subscribe() no formato dos do shell, controlável no teste. */
function fakeService({ immediate } = {}) {
  const listeners = new Set()
  return {
    subscribe(fn) {
      listeners.add(fn)
      if (immediate) fn(...immediate)
      return () => listeners.delete(fn)
    },
    push: (...args) => listeners.forEach((fn) => fn(...args)),
    get size() {
      return listeners.size
    },
  }
}

function fakeAuth(currentUser = null) {
  const state = fakeService({ immediate: [currentUser] })
  const signUp = fakeService()
  return { subscribe: state.subscribe, onSignUp: signUp.subscribe, change: state.push, signUp: signUp.push }
}

const ana = { id: '1', email: 'ana@x.com' }
const bia = { id: '2', email: 'bia@x.com' }

describe('createShellEvents', () => {
  it('entrega o detalhe aos listeners do evento e off() remove', () => {
    const events = createShellEvents()
    const fn = vi.fn()
    const off = events.on('network:offline', fn)
    events.emit('network:offline', { online: false })
    events.emit('network:online', { online: true })
    off()
    events.emit('network:offline', { online: false })
    expect(fn.mock.calls).toEqual([[{ online: false }]])
  })

  it('detalhe padrão é um objeto vazio', () => {
    const events = createShellEvents()
    const fn = vi.fn()
    events.on('app:visible', fn)
    events.emit('app:visible')
    expect(fn).toHaveBeenCalledWith({})
  })

  it('o mesmo listener registrado duas vezes roda duas vezes, e cada off() remove o seu', () => {
    const events = createShellEvents()
    const fn = vi.fn()
    const off1 = events.on('app:hidden', fn)
    events.on('app:hidden', fn)
    off1()
    events.emit('app:hidden')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('once() dispara só na próxima ocorrência', () => {
    const events = createShellEvents()
    const fn = vi.fn()
    events.once('shell:ready', fn)
    events.emit('shell:ready', { n: 1 })
    events.emit('shell:ready', { n: 2 })
    expect(fn.mock.calls).toEqual([[{ n: 1 }]])
  })

  it('onAny() recebe todos os eventos com o nome', () => {
    const events = createShellEvents()
    const fn = vi.fn()
    events.onAny(fn)
    events.emit('app:visible')
    events.emit('consent:change', { consent: 'denied' })
    expect(fn.mock.calls).toEqual([
      ['app:visible', {}],
      ['consent:change', { consent: 'denied' }],
    ])
  })

  it('recusa evento desconhecido no on() e no emit() — o barramento não é para eventos do app', () => {
    const events = createShellEvents()
    expect(() => events.on('auth:logon', () => {})).toThrow(/desconhecido "auth:logon"/)
    expect(() => events.emit('pedido:criado')).toThrow(/desconhecido/)
    expect(() => events.on('auth:login', 'x')).toThrow(/função/)
  })

  it('um listener que lança não impede os outros nem derruba quem emitiu', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const events = createShellEvents()
    const after = vi.fn()
    events.on('app:visible', () => {
      throw new Error('bug do app')
    })
    events.on('app:visible', after)
    expect(() => events.emit('app:visible')).not.toThrow()
    expect(after).toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith('[appshell] listener de "app:visible" falhou:', expect.any(Error))
  })

  it('promise rejeitada de listener assíncrono também vai para o console', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const events = createShellEvents()
    events.on('app:visible', async () => {
      throw new Error('falhou depois')
    })
    events.emit('app:visible')
    await Promise.resolve()
    expect(error).toHaveBeenCalledWith('[appshell] listener de "app:visible" falhou:', expect.any(Error))
  })
})

describe('bridgeAuth', () => {
  function setup(currentUser) {
    const events = createShellEvents()
    const auth = fakeAuth(currentUser)
    const log = vi.fn()
    events.onAny(log)
    const off = bridgeAuth(events, auth)
    return { auth, log, off }
  }

  it('sessão já restaurada na ligação vira auth:login "restored"', () => {
    const { log } = setup(ana)
    expect(log.mock.calls).toEqual([['auth:login', { user: ana, reason: 'restored' }]])
  })

  it('ninguém logado na ligação: nenhum evento', () => {
    expect(setup(null).log).not.toHaveBeenCalled()
  })

  it('transforma mudanças de estado em login/logout com o motivo', () => {
    const { auth, log } = setup(null)
    auth.change(ana, 'signIn')
    auth.change(null, 'signOut')
    auth.change(ana, 'external')
    expect(log.mock.calls).toEqual([
      ['auth:login', { user: ana, reason: 'signIn' }],
      ['auth:logout', { user: ana, reason: 'signOut' }],
      ['auth:login', { user: ana, reason: 'external' }],
    ])
  })

  it('o mesmo usuário de novo (dados atualizados) não é evento', () => {
    const { auth, log } = setup(ana)
    log.mockClear()
    auth.change({ ...ana, name: 'Ana Maria' }, 'external')
    expect(log).not.toHaveBeenCalled()
  })

  it('troca direta de usuário vira logout do anterior e login do novo', () => {
    const { auth, log } = setup(ana)
    log.mockClear()
    auth.change(bia, 'external')
    expect(log.mock.calls).toEqual([
      ['auth:logout', { user: ana, reason: 'external' }],
      ['auth:login', { user: bia, reason: 'external' }],
    ])
  })

  it('emite auth:signup e para tudo ao desligar', () => {
    const { auth, log, off } = setup(null)
    auth.signUp(ana)
    off()
    auth.signUp(bia)
    auth.change(bia, 'signIn')
    expect(log.mock.calls).toEqual([['auth:signup', { user: ana }]])
  })
})

describe('bridgeNetwork e bridgePreferences', () => {
  it('cada mudança de rede vira network:<change>', () => {
    const events = createShellEvents()
    const network = fakeService()
    const log = vi.fn()
    events.onAny(log)
    bridgeNetwork(events, network)
    network.push({ online: false, kind: null, change: 'offline' })
    network.push({ online: true, kind: 'wifi', change: 'online' })
    network.push({ online: true, kind: '4g', change: 'change' })
    expect(log.mock.calls).toEqual([
      ['network:offline', { online: false, kind: null }],
      ['network:online', { online: true, kind: 'wifi' }],
      ['network:change', { online: true, kind: '4g' }],
    ])
  })

  it('notificação adicionada vira notification:new', () => {
    const events = createShellEvents()
    const added = fakeService()
    const log = vi.fn()
    events.onAny(log)
    bridgeNotifications(events, { onAdd: added.subscribe })
    added.push({ id: 'n1', title: 'Oi' }, 'u1')
    expect(log.mock.calls).toEqual([['notification:new', { notification: { id: 'n1', title: 'Oi' }, userId: 'u1' }]])
  })

  it('cada mudança do pushService vira push:<type>', () => {
    const events = createShellEvents()
    const push = fakeService()
    const log = vi.fn()
    events.onAny(log)
    bridgePush(events, push)
    push.push({ type: 'permission-change', permission: 'granted' })
    push.push({ type: 'clicked', url: '#/x', data: {}, action: null })
    expect(log.mock.calls).toEqual([
      ['push:permission-change', { permission: 'granted' }],
      ['push:clicked', { url: '#/x', data: {}, action: null }],
    ])
  })

  it('consentimento e acessibilidade viram consent:change e a11y:change', () => {
    const events = createShellEvents()
    const consent = fakeService()
    const accessibility = fakeService()
    const log = vi.fn()
    events.onAny(log)
    const off = bridgePreferences(events, { consent, accessibility })
    consent.push('granted')
    accessibility.push({ theme: 'dark' })
    off()
    expect(consent.size + accessibility.size).toBe(0)
    expect(log.mock.calls).toEqual([
      ['consent:change', { consent: 'granted' }],
      ['a11y:change', { preferences: { theme: 'dark' } }],
    ])
  })
})
