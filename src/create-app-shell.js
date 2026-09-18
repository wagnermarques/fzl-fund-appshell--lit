/**
 * Lógica de createAppShell(), separada de index.js para ficar livre de
 * imports com efeito colateral (registro de web components, que precisam de
 * DOM) e assim ser testável em Node puro.
 */

import { GA4_ID_PATTERN } from './services/analytics-service.js'
import { authService, validateAuthProvider } from './services/auth-service.js'

const SHELL_SECTION_NAMES = ['conta', 'config']
const ANALYTICS_PROVIDERS = ['none', 'ga4']

function validateRoutes(routes) {
  const seen = new Set()
  for (const route of routes) {
    if (!route.name) {
      throw new Error('createAppShell: toda rota precisa de "name"')
    }
    if (seen.has(route.name)) {
      throw new Error(`createAppShell: nome de rota duplicado "${route.name}"`)
    }
    seen.add(route.name)
    if (typeof route.match !== 'function') {
      throw new Error(`createAppShell: rota "${route.name}" precisa de "match"`)
    }
    if (typeof route.render !== 'function') {
      throw new Error(`createAppShell: rota "${route.name}" precisa de "render"`)
    }
  }
}

function validateDrawer(drawer) {
  const sections = drawer.sections || []
  const seen = new Set()
  for (const section of sections) {
    if (!section.id) {
      throw new Error('createAppShell: toda seção do drawer precisa de "id"')
    }
    if (seen.has(section.id)) {
      throw new Error(`createAppShell: id de seção duplicado "${section.id}"`)
    }
    seen.add(section.id)
    if (!section.label) {
      throw new Error(`createAppShell: seção "${section.id}" precisa de "label"`)
    }
    const hasItems = section.items !== undefined
    const hasRender = section.render !== undefined
    if (hasItems === hasRender) {
      throw new Error(`createAppShell: seção "${section.id}" precisa de "items" ou "render" (não os dois, nem nenhum)`)
    }
    if (hasRender && typeof section.render !== 'function') {
      throw new Error(`createAppShell: "render" da seção "${section.id}" deve ser uma função`)
    }
    if (hasItems && !Array.isArray(section.items)) {
      throw new Error(`createAppShell: "items" da seção "${section.id}" deve ser um array`)
    }
  }

  const shellSections = { conta: true, config: true, ...drawer.shellSections }
  for (const key of Object.keys(shellSections)) {
    if (!SHELL_SECTION_NAMES.includes(key)) {
      throw new Error(`createAppShell: shellSections não reconhece "${key}" (use "conta" ou "config")`)
    }
  }

  return { sections, shellSections }
}

/** Valida analytics e devolve { provider: 'none' } ou a config do GA4.
 *
 *  requireConsent vale true por padrão: sob a LGPD o cookie do GA4 precisa
 *  de consentimento, e esquecer de pedir é o erro caro. privacyUrl, se
 *  houver, vira o link "Saiba mais" do banner.
 *
 *  id vazio/ausente desliga o analytics em vez de dar erro: um app passa
 *  `id: import.meta.env.VITE_GA4_MEASUREMENT_ID`, e essa variável
 *  normalmente não existe em desenvolvimento — quebrar o `npm run dev` por
 *  isso seria pior que rodar sem medição. Já um id *preenchido* e fora do
 *  formato é erro: aí é engano de digitação, e um id errado só se
 *  descobre semanas depois, quando o relatório aparece vazio. */
function validateAnalytics(analytics) {
  if (analytics === null || analytics === undefined) return { provider: 'none' }
  if (typeof analytics !== 'object') {
    throw new Error('createAppShell: "analytics" deve ser um objeto')
  }

  const { provider = 'ga4', id = '', cookiePrefix, params = {}, requireConsent = true, privacyUrl } = analytics

  if (!ANALYTICS_PROVIDERS.includes(provider)) {
    throw new Error(`createAppShell: analytics.provider não reconhece "${provider}" (use "ga4" ou "none")`)
  }
  if (provider === 'none' || !id) return { provider: 'none' }
  if (!GA4_ID_PATTERN.test(id)) {
    throw new Error(`createAppShell: analytics.id "${id}" não é um Measurement ID do GA4 (G-XXXXXXXXXX)`)
  }
  if (cookiePrefix !== undefined && typeof cookiePrefix !== 'string') {
    throw new Error('createAppShell: analytics.cookiePrefix deve ser uma string')
  }
  if (typeof params !== 'object' || params === null) {
    throw new Error('createAppShell: analytics.params deve ser um objeto')
  }
  if (typeof requireConsent !== 'boolean') {
    throw new Error('createAppShell: analytics.requireConsent deve ser true ou false')
  }
  if (privacyUrl !== undefined && typeof privacyUrl !== 'string') {
    throw new Error('createAppShell: analytics.privacyUrl deve ser uma string')
  }

  return { provider: 'ga4', id, cookiePrefix, params, requireConsent, privacyUrl }
}

/** Valida a config de createAppShell() e devolve os campos normalizados. */
export function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('createAppShell: config é obrigatório')
  }

  const {
    mount,
    routes = [],
    home,
    title,
    drawer = {},
    headerActions = null,
    footerItems = null,
    analytics = null,
    auth = null,
  } = config

  if (!mount) {
    throw new Error('createAppShell: "mount" é obrigatório')
  }
  if (typeof home !== 'function') {
    throw new Error('createAppShell: "home" deve ser uma função')
  }
  if (!title) {
    throw new Error('createAppShell: "title" é obrigatório')
  }
  if (headerActions !== null && typeof headerActions !== 'function') {
    throw new Error('createAppShell: "headerActions" deve ser uma função')
  }
  if (footerItems !== null && typeof footerItems !== 'function') {
    throw new Error('createAppShell: "footerItems" deve ser uma função')
  }

  validateRoutes(routes)
  // Sem auth, fica o provedor local de demonstração (auth-service.js).
  if (auth !== null) validateAuthProvider(auth)

  return {
    mount,
    routes,
    home,
    title,
    drawer: validateDrawer(drawer),
    headerActions,
    footerItems,
    analytics: validateAnalytics(analytics),
    auth,
  }
}

/** Cria e monta o <app-shell>, configurado com as rotas, a home, o drawer
 *  e o título do app, e instala o provedor de autenticação do app (auth —
 *  contrato no topo de services/auth-service.js). mount pode ser um
 *  seletor CSS ou o próprio elemento container. Pressupõe que o custom element 'app-shell' já foi registrado
 *  (index.js cuida disso antes de expor esta função).
 *
 *  As propriedades são setadas *antes* do elemento entrar no DOM — nunca
 *  via innerHTML + set depois — porque connectedCallback() já cria o
 *  router lendo this.routes naquele instante; setar depois de conectado
 *  deixaria o router preso à lista vazia do construtor, e nenhuma rota do
 *  app jamais casaria. */
export function createAppShell(config) {
  const { mount, routes, home, title, drawer, headerActions, footerItems, analytics, auth } = validateConfig(config)

  const container = typeof mount === 'string' ? document.querySelector(mount) : mount
  if (!container) {
    throw new Error(`createAppShell: elemento não encontrado para mount "${mount}"`)
  }

  // Antes de criar o <app-shell>: ele e o header já leem o usuário atual
  // ao conectar, e esse usuário tem de vir do provedor do app.
  if (auth) authService.use(auth)

  const shell = document.createElement('app-shell')
  shell.routes = routes
  shell.home = home
  shell.title = title
  shell.drawer = drawer
  shell.headerActions = headerActions
  shell.footerItems = footerItems
  shell.analytics = analytics

  container.replaceChildren(shell)
  return shell
}
