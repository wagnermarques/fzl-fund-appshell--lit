/**
 * Lógica de createAppShell(), separada de index.js para ficar livre de
 * imports com efeito colateral (registro de web components, que precisam de
 * DOM) e assim ser testável em Node puro.
 */

const SHELL_SECTION_NAMES = ['conta', 'config']

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

/** Valida a config de createAppShell() e devolve os campos normalizados. */
export function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('createAppShell: config é obrigatório')
  }

  const { mount, routes = [], home, title, drawer = {}, headerActions = null, footerItems = null } = config

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

  return { mount, routes, home, title, drawer: validateDrawer(drawer), headerActions, footerItems }
}

/** Cria e monta o <app-shell>, configurado com as rotas, a home, o drawer
 *  e o título do app. mount pode ser um seletor CSS ou o próprio elemento
 *  container. Pressupõe que o custom element 'app-shell' já foi registrado
 *  (index.js cuida disso antes de expor esta função).
 *
 *  As propriedades são setadas *antes* do elemento entrar no DOM — nunca
 *  via innerHTML + set depois — porque connectedCallback() já cria o
 *  router lendo this.routes naquele instante; setar depois de conectado
 *  deixaria o router preso à lista vazia do construtor, e nenhuma rota do
 *  app jamais casaria. */
export function createAppShell(config) {
  const { mount, routes, home, title, drawer, headerActions, footerItems } = validateConfig(config)

  const container = typeof mount === 'string' ? document.querySelector(mount) : mount
  if (!container) {
    throw new Error(`createAppShell: elemento não encontrado para mount "${mount}"`)
  }

  const shell = document.createElement('app-shell')
  shell.routes = routes
  shell.home = home
  shell.title = title
  shell.drawer = drawer
  shell.headerActions = headerActions
  shell.footerItems = footerItems

  container.replaceChildren(shell)
  return shell
}
