/**
 * Eventos do ciclo de vida do shell, para o app consumidor reagir sem
 * conhecer os serviços por dentro:
 *
 *   createAppShell({ ..., on: { 'auth:login': ({ user }) => ... } })
 *   const off = shellEvents.on('network:offline', () => ...)
 *
 * Só eventos que o *shell* conhece (autenticação, rede, rota, visibilidade,
 * PWA, privacidade, acessibilidade) — a lista é fechada e um nome fora dela
 * dá erro, tanto no on() quanto no emit(). Eventos de domínio do app ficam
 * no próprio app; deixar este barramento aceitar qualquer nome o
 * transformaria num depósito global.
 *
 * Eventos avisam *mudanças*. Quem chega depois não recebe o passado: o
 * estado atual vem dos serviços (authService.getCurrentUser(),
 * networkService.isOnline()...). Por isso os listeners do `on` da config
 * são registrados antes de o <app-shell> montar — pegam a sessão
 * restaurada, a primeira rota e o shell:ready.
 *
 * Um listener que lança (ou devolve uma promise rejeitada) não derruba o
 * shell nem impede os demais: o erro vai para o console e a fila segue.
 */

/** Nome do evento -> o que vem no argumento do listener. */
export const SHELL_EVENTS = {
  'shell:ready': '{ shell } — <app-shell> renderizou pela primeira vez',
  'auth:login': '{ user, reason } — signIn | signUp | passwordReset | restored | external | (motivo do provedor)',
  'auth:logout': '{ user, reason } — signOut | providerChange | external | (motivo do provedor, ex.: expired)',
  'auth:signup': '{ user } — conta nova criada (antes do auth:login correspondente)',
  'network:online': '{ online, kind } — a conexão voltou',
  'network:offline': '{ online, kind } — a conexão caiu',
  'network:change': '{ online, kind } — mudou o tipo de rede (wifi, 4g...) sem cair',
  'route:change': '{ name, params, query, initial } — rota resolvida (initial: a da carga da página)',
  'app:visible': '{} — o app voltou ao primeiro plano (aba/PWA retomada)',
  'app:hidden': '{} — o app foi para o segundo plano',
  'pwa:update-available': '{} — há versão nova esperando (o toast "Atualizar" aparece)',
  'pwa:offline-ready': '{} — o service worker terminou o cache; o app já abre sem rede',
  'pwa:installed': '{} — o usuário instalou o app',
  'consent:change': '{ consent } — granted | denied',
  'a11y:change': '{ preferences } — tema, fonte ou tamanho do texto mudou',
  'notification:new': '{ notification, userId } — notificação nova no sino do cabeçalho (notificationService.add)',
  'push:permission-change': '{ permission } — granted | denied | default',
  'push:subscribed': '{ subscription } — inscrição criada e entregue ao backend (push.onSubscribe)',
  'push:unsubscribed': '{} — inscrição desfeita',
  'push:subscription-change': '{ subscription } — o navegador trocou a inscrição; a nova já foi reentregue',
  'push:received': '{ title, body, url, data } — push chegou com o app aberto (a notificação do sistema aparece igual)',
  'push:clicked': '{ url, data, action } — o usuário tocou na notificação; o shell navega até url depois',
  'backend:reachable': '{ backend, url } — o backend respondeu (de novo)',
  'backend:unreachable': '{ backend, url, error } — o backend parou de responder (rede, tempo limite, 502/503/504)',
  'backend:unauthorized': '{ backend, url, status } — o backend respondeu 401 (sessão vencida ou ausente)',
}

function requireKnown(name, where) {
  if (!Object.hasOwn(SHELL_EVENTS, name)) {
    throw new Error(`shellEvents.${where}: evento desconhecido "${name}" (veja SHELL_EVENTS)`)
  }
}

function requireFunction(fn, where) {
  if (typeof fn !== 'function') {
    throw new Error(`shellEvents.${where}: o listener deve ser uma função`)
  }
}

function report(name, error) {
  console.error(`[appshell] listener de "${name}" falhou:`, error)
}

/** Chama um listener isolando erros síncronos e assíncronos. */
function safeCall(name, fn, args) {
  try {
    const result = fn(...args)
    if (typeof result?.catch === 'function') result.catch((error) => report(name, error))
  } catch (error) {
    report(name, error)
  }
}

export function createShellEvents() {
  const listeners = new Map()
  const anyListeners = new Set()

  return {
    /** Registra o listener e devolve a função que o remove. */
    on(name, fn) {
      requireKnown(name, 'on')
      requireFunction(fn, 'on')
      // Envolve para o mesmo fn poder ser registrado duas vezes (e cada
      // off() remover só o seu).
      const entry = (detail) => fn(detail)
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name).add(entry)
      return () => listeners.get(name).delete(entry)
    },

    /** Como on(), mas só para a próxima ocorrência. */
    once(name, fn) {
      requireFunction(fn, 'once')
      const off = this.on(name, (detail) => {
        off()
        return fn(detail)
      })
      return off
    },

    /** Todos os eventos: fn(name, detail). É o que o `debug` usa para logar. */
    onAny(fn) {
      requireFunction(fn, 'onAny')
      const entry = (name, detail) => fn(name, detail)
      anyListeners.add(entry)
      return () => anyListeners.delete(entry)
    },

    /** Uso interno do shell. Copia as listas antes de iterar: um listener
     *  que se remove (once) ou registra outro não bagunça esta emissão. */
    emit(name, detail = {}) {
      requireKnown(name, 'emit')
      for (const fn of [...(listeners.get(name) ?? [])]) safeCall(name, fn, [detail])
      for (const fn of [...anyListeners]) safeCall(name, fn, [name, detail])
    },
  }
}

export const shellEvents = createShellEvents()

// --- pontes: serviço -> eventos ---------------------------------------------
// Cada uma devolve a função que desfaz a ponte. Recebem os serviços por
// parâmetro para serem testáveis sem DOM.

/** auth:login / auth:logout / auth:signup a partir do authService.
 *
 *  authService.subscribe() informa *estado* (e já chama na inscrição); aqui
 *  vira *transição*. Se já há alguém logado no momento da ponte (sessão
 *  restaurada de forma síncrona, como no provedor local), sai um
 *  auth:login com reason 'restored'. Trocar de usuário sem passar por
 *  ninguém logado vira logout do anterior + login do novo; atualizar os
 *  dados do mesmo usuário (mesmo id) não é evento. */
export function bridgeAuth(events, auth) {
  let previous = null
  let first = true
  const offState = auth.subscribe((user, reason) => {
    user = user ?? null
    if (first) {
      first = false
      previous = user
      if (user) events.emit('auth:login', { user, reason: 'restored' })
      return
    }
    const changed = previous?.id !== user?.id
    if (previous && changed) events.emit('auth:logout', { user: previous, reason })
    if (user && changed) events.emit('auth:login', { user, reason })
    previous = user
  })
  const offSignUp = auth.onSignUp((user) => events.emit('auth:signup', { user }))
  return () => {
    offState()
    offSignUp()
  }
}

/** network:online / network:offline / network:change a partir do networkService. */
export function bridgeNetwork(events, network) {
  return network.subscribe(({ online, kind, change }) => {
    events.emit(`network:${change}`, { online, kind })
  })
}

/** notification:new a partir do notificationService. */
export function bridgeNotifications(events, notifications) {
  return notifications.onAdd((notification, userId) => events.emit('notification:new', { notification, userId }))
}

/** push:* a partir do pushService. */
export function bridgePush(events, push) {
  return push.subscribe(({ type, ...detail }) => events.emit(`push:${type}`, detail))
}

/** backend:* a partir do backendService. */
export function bridgeBackends(events, backends) {
  return backends.subscribe(({ type, ...detail }) => events.emit(`backend:${type}`, detail))
}

/** consent:change e a11y:change (os dois serviços só avisam mudanças). */
export function bridgePreferences(events, { consent, accessibility }) {
  const offConsent = consent.subscribe((value) => events.emit('consent:change', { consent: value }))
  const offA11y = accessibility.subscribe((preferences) => events.emit('a11y:change', { preferences }))
  return () => {
    offConsent()
    offA11y()
  }
}
