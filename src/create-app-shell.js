/**
 * Lógica de createAppShell(), separada de index.js para ficar livre de
 * imports com efeito colateral (registro de web components, que precisam de
 * DOM) e assim ser testável em Node puro.
 */

/** Valida a config de createAppShell() e devolve os campos normalizados. */
export function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('createAppShell: config é obrigatório')
  }

  const { mount, routes = [], home } = config

  if (!mount) {
    throw new Error('createAppShell: "mount" é obrigatório')
  }
  if (typeof home !== 'function') {
    throw new Error('createAppShell: "home" deve ser uma função')
  }

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

  return { mount, routes, home }
}

/** Cria e monta o <app-shell>, configurado com as rotas e a home do app.
 *  mount pode ser um seletor CSS ou o próprio elemento container.
 *  Pressupõe que o custom element 'app-shell' já foi registrado (index.js
 *  cuida disso antes de expor esta função). */
export function createAppShell(config) {
  const { mount, routes, home } = validateConfig(config)

  const container = typeof mount === 'string' ? document.querySelector(mount) : mount
  if (!container) {
    throw new Error(`createAppShell: elemento não encontrado para mount "${mount}"`)
  }

  container.innerHTML = '<app-shell></app-shell>'
  const shell = container.querySelector('app-shell')
  shell.routes = routes
  shell.home = home
  return shell
}
