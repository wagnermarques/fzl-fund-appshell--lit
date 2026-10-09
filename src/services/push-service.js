/**
 * Web Push do lado da página: permissão, inscrição e o que o service
 * worker (src/pwa/push-sw.js) repassa. O app liga com
 *
 *   createAppShell({ push: { vapidPublicKey, onSubscribe, onUnsubscribe } })
 *
 * onSubscribe(subscription) e onUnsubscribe(subscription) recebem a
 * inscrição em JSON ({ endpoint, keys: { p256dh, auth } }) e a guardam ou
 * apagam no backend do app — é ele quem envia os pushes, com a chave
 * privada VAPID. Se onSubscribe falhar, a inscrição é desfeita: inscrição
 * que o backend não conhece só gasta a permissão do usuário.
 *
 * A permissão só é pedida dentro de enable(), que deve rodar num gesto
 * do usuário (o switch de Config > Notificações): Safari/iOS recusam o
 * pedido fora de um clique, e pedir ao abrir o app é má prática. No iOS,
 * push só existe com o app instalado na tela inicial (16.4+).
 *
 * Mudanças viram { type, ...detalhe } para os inscritos, e daí os eventos
 * push:<type> (ver bridgePush em shell-events.js).
 */
import { storageKey } from '../storage-keys.js'

export const PUSH_CLICK_PARAM = 'appshell-push-click'
const VAPID_KEY_PATTERN = /^[A-Za-z0-9_-]+=*$/

/** Chave VAPID pública (base64url, como os geradores entregam) -> bytes. */
export function urlBase64ToUint8Array(base64url) {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

/** Lança se a config de push não cumpre o contrato; devolve null quando
 *  vapidPublicKey está vazia (variável de ambiente ausente em
 *  desenvolvimento desliga o push, como o id do GA4). */
export function validatePushConfig(config) {
  if (config === null || config === undefined) return null
  if (typeof config !== 'object') {
    throw new Error('createAppShell: "push" deve ser um objeto')
  }
  const { vapidPublicKey = '', onSubscribe, onUnsubscribe } = config
  if (typeof vapidPublicKey !== 'string') {
    throw new Error('createAppShell: push.vapidPublicKey deve ser uma string')
  }
  if (!vapidPublicKey) return null
  if (!VAPID_KEY_PATTERN.test(vapidPublicKey)) {
    throw new Error('createAppShell: push.vapidPublicKey deve ser a chave pública VAPID em base64url')
  }
  if (typeof onSubscribe !== 'function') {
    throw new Error('createAppShell: push.onSubscribe é obrigatório (é ele que entrega a inscrição ao backend)')
  }
  if (onUnsubscribe !== undefined && typeof onUnsubscribe !== 'function') {
    throw new Error('createAppShell: push.onUnsubscribe deve ser uma função')
  }
  return { vapidPublicKey, onSubscribe, onUnsubscribe }
}

/** Separa o clique em notificação que o service worker deixou na query
 *  (app aberto do zero) do resto da URL. */
export function readClickFromUrl(href) {
  const url = new URL(href)
  const raw = url.searchParams.get(PUSH_CLICK_PARAM)
  if (raw === null) return { click: null, cleanUrl: href }
  url.searchParams.delete(PUSH_CLICK_PARAM)
  let click = null
  try {
    click = JSON.parse(raw)
  } catch {
    // Query adulterada: ignora o clique, mas limpa a URL do mesmo jeito.
  }
  return { click, cleanUrl: url.href }
}

export function createPushService({
  win = globalThis,
  nav = globalThis.navigator,
  Notification = globalThis.Notification,
  storage = () => globalThis.localStorage,
} = {}) {
  const listeners = new Set()
  let config = null
  let started = false

  const endpointKey = () => storageKey('push:endpoint')

  function notify(type, detail = {}) {
    listeners.forEach((fn) => fn({ type, ...detail }))
  }

  function readEndpoint() {
    try {
      return storage()?.getItem(endpointKey()) ?? null
    } catch {
      return null
    }
  }

  function writeEndpoint(endpoint) {
    try {
      if (endpoint) storage()?.setItem(endpointKey(), endpoint)
      else storage()?.removeItem(endpointKey())
    } catch {
      // Sem storage, a troca de inscrição só é notada com o app aberto.
    }
  }

  /** getRegistration(), não .ready: sem service worker (no `npm run dev`,
   *  por exemplo) o ready nunca resolve, e a tela ficaria esperando. */
  async function currentSubscription() {
    if (!service.isSupported()) return null
    const registration = await nav.serviceWorker.getRegistration()
    return (await registration?.pushManager.getSubscription()) ?? null
  }

  /** A inscrição mudou desde a última que o backend recebeu? (o navegador
   *  troca por conta própria — pushsubscriptionchange — às vezes com o app
   *  fechado). Se sim, reentrega e avisa. */
  async function syncSubscription() {
    if (!config) return
    const subscription = await currentSubscription()
    const known = readEndpoint()
    if (!subscription || subscription.endpoint === known) return
    const json = subscription.toJSON()
    await config.onSubscribe(json)
    writeEndpoint(subscription.endpoint)
    // Sem endpoint conhecido é uma inscrição feita antes deste controle
    // existir (ou storage limpo): reentregar basta, não é "mudança".
    if (known) notify('subscription-change', { subscription: json })
  }

  function emitClick(payload) {
    if (!payload) return
    notify('clicked', { url: payload.url ?? null, data: payload.data ?? {}, action: payload.action ?? null })
  }

  function onMessage(event) {
    const { type, payload } = event.data ?? {}
    if (type === 'appshell:push-received') {
      notify('received', { title: payload.title, body: payload.body, url: payload.url, data: payload.data })
    } else if (type === 'appshell:push-clicked') {
      emitClick(payload)
      // Depois do evento: um listener pode querer saber de onde o usuário veio.
      if (payload?.url) win.location.assign(new URL(payload.url, win.location.href).href)
    } else if (type === 'appshell:push-subscription-change') {
      syncSubscription().catch((error) => console.error('[appshell] push: falha ao reentregar a inscrição', error))
    }
  }

  async function watchPermission() {
    try {
      const status = await nav.permissions?.query({ name: 'notifications' })
      if (status) status.onchange = () => notify('permission-change', { permission: service.permission() })
    } catch {
      // Navegador sem Permissions API para notificações: só vemos a
      // mudança que nós mesmos pedimos (em enable()).
    }
  }

  const service = {
    /** O navegador tem service worker, Push API e notificações. */
    isSupported() {
      return Boolean(nav?.serviceWorker && win.PushManager && Notification)
    },

    /** O app configurou push (createAppShell({ push })), suportado ou não. */
    isConfigured() {
      return config !== null
    },

    /** Configurado e suportado por este navegador. */
    isAvailable() {
      return config !== null && service.isSupported()
    },

    /** 'granted' | 'denied' | 'default' | 'unsupported' */
    permission() {
      return Notification?.permission ?? 'unsupported'
    },

    /** Este navegador está inscrito para receber os pushes do app. */
    async isActive() {
      return config !== null && (await currentSubscription()) !== null
    },

    /** Pede a permissão (se preciso), inscreve e entrega ao backend.
     *  Chame de dentro de um clique. Erro = throw new Error('mensagem para
     *  o usuário'). */
    async enable() {
      if (!config) throw new Error('Este app não envia notificações.')
      if (!service.isSupported()) throw new Error('Este navegador não suporta notificações.')
      const before = service.permission()
      const permission = before === 'granted' ? before : await Notification.requestPermission()
      if (permission !== before) notify('permission-change', { permission })
      if (permission !== 'granted') {
        throw new Error(
          permission === 'denied'
            ? 'As notificações estão bloqueadas. Libere-as nas configurações do navegador para este site.'
            : 'Permissão não concedida.',
        )
      }
      if (!(await nav.serviceWorker.getRegistration())) {
        throw new Error('O app ainda está terminando de instalar. Tente de novo em instantes.')
      }
      const registration = await nav.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
      })
      const json = subscription.toJSON()
      try {
        await config.onSubscribe(json)
      } catch (error) {
        await subscription.unsubscribe().catch(() => {})
        throw error
      }
      writeEndpoint(subscription.endpoint)
      notify('subscribed', { subscription: json })
      return json
    },

    /** Avisa o backend (onUnsubscribe) e desfaz a inscrição. Sem inscrição, não faz nada. */
    async disable() {
      const subscription = await currentSubscription()
      if (!subscription) return
      await config?.onUnsubscribe?.(subscription.toJSON())
      await subscription.unsubscribe()
      writeEndpoint(null)
      notify('unsubscribed')
    },

    /** Chama o callback a cada mudança (não na inscrição) com { type, ... }. */
    subscribe(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },

    /** createAppShell chama com a config validada, *depois* de ligar os
     *  eventos: o clique que abriu o app do zero sai aqui como
     *  push:clicked, antes da primeira rota. */
    use(newConfig) {
      config = newConfig
      if (!service.isSupported()) return
      if (!started) {
        started = true
        nav.serviceWorker.addEventListener('message', onMessage)
        watchPermission()
      }
      const { click, cleanUrl } = readClickFromUrl(win.location.href)
      if (cleanUrl !== win.location.href) win.history?.replaceState(win.history.state, '', cleanUrl)
      emitClick(click)
      syncSubscription().catch((error) => console.error('[appshell] push: falha ao reentregar a inscrição', error))
    },
  }

  return service
}

export const pushService = createPushService()
