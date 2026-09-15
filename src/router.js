/**
 * Minimal hash router. Routes:
 *   #/                                  -> home
 *   #/conta/entrar                      -> login
 *   #/conta/cadastro                    -> signup
 *   #/conta                             -> account (logged-in user)
 *   #/config/backend/servicos-rest      -> REST services base path config
 */

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '')
  const segments = hash.split('/').filter(Boolean)

  if (segments[0] === 'conta') {
    if (segments[1] === 'entrar') return { name: 'conta-entrar' }
    if (segments[1] === 'cadastro') return { name: 'conta-cadastro' }
    return { name: 'conta' }
  }
  if (segments[0] === 'config' && segments[1] === 'backend' && segments[2] === 'servicos-rest') {
    return { name: 'config-backend-servicos-rest' }
  }
  if (segments.length === 0) {
    return { name: 'home' }
  }
  return { name: 'home' }
}

export function createRouter(onChange) {
  const handler = () => onChange(parseHash())
  window.addEventListener('hashchange', handler)
  handler() // fire once for the initial URL
  return () => window.removeEventListener('hashchange', handler)
}

export function navigateHome() {
  location.hash = '#/'
}

export function navigateToLogin() {
  location.hash = '#/conta/entrar'
}

export function navigateToSignup() {
  location.hash = '#/conta/cadastro'
}

export function navigateToAccount() {
  location.hash = '#/conta'
}

export function navigateToConfigRestServices() {
  location.hash = '#/config/backend/servicos-rest'
}
