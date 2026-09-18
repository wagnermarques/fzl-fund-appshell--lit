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

function installGtag(id, { doc, win, cookiePrefix, params }) {
  win.dataLayer = win.dataLayer || []
  // Precisa ser uma function de verdade, não uma arrow com ...args: o
  // gtag empurra o próprio objeto `arguments` no dataLayer, e a tag do
  // Google conta com esse formato.
  function gtag() {
    win.dataLayer.push(arguments)
  }
  win.gtag = gtag

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

let active = null

export const analyticsService = {
  /** Liga o GA4 com a config já validada por createAppShell. Devolve true
   *  quando ficou ativo. Chamar de novo com o mesmo id não recarrega o
   *  script. */
  init(analytics, { doc, win } = {}) {
    const document_ = doc ?? globalThis.document
    const window_ = win ?? globalThis.window
    if (!analytics || analytics.provider !== 'ga4' || !document_ || !window_) return false
    if (active?.id === analytics.id) return true

    active = { id: analytics.id }
    installGtag(analytics.id, {
      doc: document_,
      win: window_,
      cookiePrefix: analytics.cookiePrefix,
      params: analytics.params,
    })
    return true
  },

  /** Um page_view por view — chamado pelo app-shell a cada mudança de rota. */
  trackPageView(route, title = '', { win, loc } = {}) {
    const window_ = win ?? globalThis.window
    if (!active || !window_) return false
    const location_ = loc ?? window_.location
    const baseUrl = `${location_.origin}${location_.pathname}`
    window_.gtag?.('event', 'page_view', pageViewParams({ route, title, baseUrl }))
    return true
  },

  /** Evento de domínio do app consumidor: track('livro_aberto', { id }). */
  track(name, params = {}, { win } = {}) {
    const window_ = win ?? globalThis.window
    if (!active || !window_ || !name) return false
    window_.gtag?.('event', name, params)
    return true
  },

  /** Desliga (usado pelos testes; um app não precisa chamar). */
  reset() {
    active = null
  },
}

export function track(name, params) {
  return analyticsService.track(name, params)
}
