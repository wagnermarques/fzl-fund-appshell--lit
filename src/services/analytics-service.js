/**
 * Analytics (GA4 / gtag.js) para os apps que usam este appshell.
 *
 * Cada app consumidor configura o *seu* Measurement ID via
 * createAppShell({ analytics: { id: 'G-XXXXXXXXXX' } }) — nada aqui é
 * global nem compartilhado entre apps. Sem id (o caso normal em
 * desenvolvimento, quando a variável de ambiente não está definida), o
 * serviço fica desligado e nenhuma requisição sai do navegador.
 *
 * Por que o carregamento é em runtime e não um <script> no index.html: o
 * index.html é do app consumidor, e "vir de fábrica" significa não pedir
 * que cada app cole o snippet do Google. O id chega pela config do
 * createAppShell e o script é injetado aqui.
 *
 * SPA + rotas no hash: o gtag manda um page_view sozinho na carga da
 * página e nunca mais — nossas rotas vivem em location.hash, então uma
 * navegação de #/ para #/livro/1 não é vista como página nova. Por isso a
 * config sobe com send_page_view: false e cada page_view é mandado na mão
 * por trackPageView(), a partir do callback do createRouter() (que dispara
 * uma vez na carga inicial e a cada hashchange — ou seja, exatamente uma
 * vez por view, sem duplicar a primeira).
 *
 * Consentimento (LGPD): por padrão nada é carregado até o usuário aceitar
 * no banner do shell (consent-service.js). Um app que não precisa pedir
 * — uso interno, por exemplo — passa requireConsent: false.
 */
import { href } from '../router.js'

/** Measurement ID do GA4 (Admin > Fluxos de dados), no formato G-XXXXXXXXXX. */
export const GA4_ID_PATTERN = /^G-[A-Z0-9]+$/i

/** Chaves de query que nunca podem sair do navegador: links de confirmação
 *  de e-mail e de reset de senha chegam com o token na URL, e o
 *  page_location vai inteiro para o Google. (O hash de callback dos
 *  provedores — #access_token=... — já é neutralizado antes de chegar
 *  aqui: resolveRoute() devolve segments e query vazios para ele.) */
const SENSITIVE_QUERY_KEYS = new Set([
  'access_token',
  'refresh_token',
  'id_token',
  'token',
  'code',
  'password',
  'senha',
])

/** URL que será reportada como page_location: remonta o hash a partir da
 *  rota já resolvida (nunca copia location.href cru) e descarta as chaves
 *  sensíveis da query. */
export function safePageLocation(baseUrl, route = {}) {
  const query = Object.fromEntries(
    Object.entries(route.query ?? {}).filter(([key]) => !SENSITIVE_QUERY_KEYS.has(key.toLowerCase())),
  )
  return `${baseUrl}${href((route.segments ?? []).join('/'), query)}`
}

/** Parâmetros do evento page_view.
 *
 *  route_name é o nome da rota ('livro' e não 'livro/42'): é ele que dá
 *  relatório agregado por tela, enquanto page_location, com os parâmetros
 *  já substituídos, renderia uma linha por id. */
export function pageViewParams({ route = {}, title = '', baseUrl = '' }) {
  const name = route.name ?? ''
  return {
    page_location: safePageLocation(baseUrl, route),
    page_title: title ? `${title} — ${name}` : name,
    route_name: name,
  }
}

export function gtagSrc(id) {
  return `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
}

/** Os sinais do Consent Mode v2. O appshell não usa anúncios, então os
 *  três ad_* ficam sempre negados; só analytics_storage acompanha a
 *  escolha do usuário. */
function consentSignals(granted) {
  return {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  }
}

function installGtag(id, { doc, win, cookiePrefix, params }) {
  win.dataLayer = win.dataLayer || []
  // Precisa ser uma function de verdade, não uma arrow com ...args: o
  // gtag empurra o próprio objeto `arguments` no dataLayer, e a tag do
  // Google conta com esse formato.
  function gtag() {
    win.dataLayer.push(arguments)
  }
  win.gtag = gtag

  // O default do Consent Mode precisa vir antes do config. Só chegamos
  // aqui com o consentimento dado (ou dispensado pelo app), daí o
  // analytics_storage já 'granted'.
  gtag('consent', 'default', consentSignals(true))
  gtag('js', new Date())
  gtag('config', id, {
    send_page_view: false,
    // Apps diferentes hospedados na mesma origem (ex.:
    // usuario.github.io/<repo>) compartilhariam o cookie _ga e, com ele,
    // sessão e usuário — o mesmo problema que __APP_STORAGE_PREFIX__
    // resolve no localStorage, e a mesma solução.
    ...(cookiePrefix ? { cookie_prefix: cookiePrefix } : {}),
    ...params,
  })

  const script = doc.createElement('script')
  script.async = true
  script.src = gtagSrc(id)
  doc.head.appendChild(script)
}

/** Nomes dos cookies do GA4 deste app: <prefixo>_ga e <prefixo>_ga_<id>. */
export function isGaCookie(name, cookiePrefix = '') {
  const base = `${cookiePrefix}_ga`
  return name === base || name.startsWith(`${base}_`)
}

/** Apaga os cookies do GA4 deste app ao revogar o consentimento. O gtag
 *  grava com cookie_domain 'auto' (o domínio mais alto aceito), que daqui
 *  não dá pra saber — então tenta o host e cada domínio pai. */
function deleteGaCookies(doc, win, cookiePrefix) {
  const names = (doc.cookie ?? '')
    .split(';')
    .map((part) => part.split('=')[0].trim())
    .filter((name) => name && isGaCookie(name, cookiePrefix))
  const labels = (win.location?.hostname ?? '').split('.')
  const domains = [null, ...labels.map((_, i) => `.${labels.slice(i).join('.')}`)]
  for (const name of names) {
    for (const domain of domains) {
      doc.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ''}`
    }
  }
}

// config: a config validada (ou null); installed: o gtag.js já foi
// injetado; enabled: pode mandar evento agora; lastView: a última rota
// vista, para contar a tela onde o usuário estava quando aceitou.
let state = { config: null, installed: false, enabled: false, lastView: null, env: null }

function envOf({ doc, win } = {}) {
  return { doc: doc ?? state.env?.doc ?? globalThis.document, win: win ?? state.env?.win ?? globalThis.window }
}

function sendPageView(win) {
  const { route, title, loc } = state.lastView
  const location_ = loc ?? win.location
  const baseUrl = `${location_.origin}${location_.pathname}`
  win.gtag?.('event', 'page_view', pageViewParams({ route, title, baseUrl }))
}

function enable(env) {
  const { config } = state
  if (!state.installed) {
    installGtag(config.id, { ...env, cookiePrefix: config.cookiePrefix, params: config.params })
    state.installed = true
  } else {
    env.win.gtag?.('consent', 'update', consentSignals(true))
  }
  state.enabled = true
}

export const analyticsService = {
  /** Recebe a config já validada por createAppShell e o consentimento
   *  salvo. Liga o GA4 na hora só se o app dispensou o consentimento
   *  (requireConsent: false) ou se o usuário já aceitou antes; senão fica
   *  à espera de setConsent('granted') — sem baixar o gtag.js, sem
   *  cookie, sem requisição nenhuma (o modo "básico" do Consent Mode: o
   *  "avançado" mandaria pings sem cookie mesmo com consentimento negado,
   *  o que sob a LGPD ainda é tratamento de dado sem base legal).
   *
   *  Devolve true quando ficou ativo. Chamar de novo com o mesmo id não
   *  recarrega o script. */
  init(analytics, { doc, win, consent = null } = {}) {
    const env = envOf({ doc, win })
    if (!analytics || analytics.provider !== 'ga4' || !env.doc || !env.win) return false
    if (state.config?.id === analytics.id) return state.enabled

    state = { config: analytics, installed: false, enabled: false, lastView: null, env: { doc, win } }
    if (analytics.requireConsent === false || consent === 'granted') enable(env)
    return state.enabled
  },

  /** true quando o app tem GA4 configurado e o usuário precisa responder. */
  needsConsent() {
    return !!state.config && state.config.requireConsent !== false
  },

  /** Aplica a resposta do usuário. 'granted' liga (e conta a tela atual,
   *  que ficou sem page_view na carga); 'denied' desliga, avisa o gtag e
   *  apaga os cookies _ga deste app. */
  setConsent(value, env_) {
    if (!state.config) return false
    const env = envOf(env_)
    if (value === 'granted') {
      if (state.enabled) return true
      enable(env)
      if (state.lastView) sendPageView(env.win)
      return true
    }
    if (state.enabled) {
      env.win.gtag?.('consent', 'update', consentSignals(false))
      deleteGaCookies(env.doc, env.win, state.config.cookiePrefix)
    }
    state.enabled = false
    return false
  },

  /** Um page_view por view — chamado pelo app-shell a cada mudança de rota. */
  trackPageView(route, title = '', { win, loc } = {}) {
    state.lastView = { route, title, loc }
    const window_ = envOf({ win }).win
    if (!state.enabled || !window_) return false
    sendPageView(window_)
    return true
  },

  /** Evento de domínio do app consumidor: track('livro_aberto', { id }). */
  track(name, params = {}, { win } = {}) {
    const window_ = envOf({ win }).win
    if (!state.enabled || !window_ || !name) return false
    window_.gtag?.('event', name, params)
    return true
  },

  /** Desliga (usado pelos testes; um app não precisa chamar). */
  reset() {
    state = { config: null, installed: false, enabled: false, lastView: null, env: null }
  },
}

export function track(name, params) {
  return analyticsService.track(name, params)
}
