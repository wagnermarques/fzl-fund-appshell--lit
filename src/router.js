/**
 * Hash router genérico.
 *
 * Uma rota é { name, match }, onde match(segments, query) devolve os
 * parâmetros da rota (um objeto) quando casa, ou null quando não casa. O
 * helper pattern() cobre o caso comum:
 *
 *   pattern('')                -> só a raiz (#/)
 *   pattern('conta/entrar')    -> segmentos literais
 *   pattern('livro/:id')       -> :nome casa exatamente um segmento
 *   pattern('br/*caminho')     -> *nome (só no fim) casa um ou mais segmentos,
 *                                 devolvidos juntos, separados por '/'
 *
 * Rotas do app são testadas antes das rotas estruturais do shell (abaixo),
 * na ordem em que foram passadas; a primeira que casar vence. Se nenhuma
 * casar, a rota resolvida é 'not-found' — nunca cai silenciosamente em home.
 *
 * Rotas estruturais do shell:
 *   #/                                  -> home
 *   #/conta/entrar                      -> login
 *   #/conta/cadastro                    -> signup
 *   #/conta                             -> account (logged-in user)
 *   #/conta/esqueci-senha               -> pedir o link de redefinição
 *   #/conta/redefinir-senha?token=...   -> nova senha a partir do link
 *   #/conta/alterar-senha               -> trocar a senha (logado)
 *   #/config/backend/servicos-rest      -> REST services base path config
 *   #/config/privacidade                -> consentimento do analytics
 *   #/config/acessibilidade             -> tema, fonte e tamanho do texto
 */

export const NOT_FOUND = 'not-found'

export function pattern(spec) {
  const parts = spec.split('/').filter(Boolean)
  const last = parts.at(-1)
  const restName = last?.startsWith('*') ? last.slice(1) : null
  const fixed = restName === null ? parts : parts.slice(0, -1)

  if (fixed.some((p) => p.startsWith('*'))) {
    throw new Error(`pattern('${spec}'): *${fixed.find((p) => p.startsWith('*')).slice(1)} só pode aparecer no fim.`)
  }

  return (segments) => {
    if (restName === null ? segments.length !== fixed.length : segments.length <= fixed.length) {
      return null
    }
    const params = {}
    for (let i = 0; i < fixed.length; i++) {
      if (fixed[i].startsWith(':')) params[fixed[i].slice(1)] = segments[i]
      else if (fixed[i] !== segments[i]) return null
    }
    if (restName !== null) params[restName] = segments.slice(fixed.length).join('/')
    return params
  }
}

export const shellRoutes = [
  { name: 'home', match: pattern('') },
  { name: 'conta-entrar', match: pattern('conta/entrar') },
  { name: 'conta-cadastro', match: pattern('conta/cadastro') },
  { name: 'conta-esqueci-senha', match: pattern('conta/esqueci-senha') },
  { name: 'conta-redefinir-senha', match: pattern('conta/redefinir-senha') },
  { name: 'conta-alterar-senha', match: pattern('conta/alterar-senha') },
  { name: 'conta', match: pattern('conta') },
  { name: 'config-backend-servicos-rest', match: pattern('config/backend/servicos-rest') },
  { name: 'config-privacidade', match: pattern('config/privacidade') },
  { name: 'config-acessibilidade', match: pattern('config/acessibilidade') },
]

// Redirecionamentos de confirmação de e-mail/magic link/reset de senha de
// provedores como o Supabase entregam a sessão no hash
// (#access_token=...&type=signup). Como nossas rotas também vivem no hash,
// esse fragmento seria lido como uma rota inexistente — trata como a página
// da conta (ou, no link de recuperação de senha, type=recovery, como a tela
// de nova senha: a sessão de recuperação já veio no hash).
export function isAuthCallbackHash(hash) {
  return /(^|[&#/])access_token=|(^|[&#/])error_description=/.test(hash)
}

function isPasswordRecoveryHash(hash) {
  return /(^|[&#/?])type=recovery(&|$)/.test(hash)
}

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment // sequência % malformada — usa o texto cru
  }
}

/** '#/a/b?x=1' -> { segments: ['a', 'b'], query: { x: '1' } } */
export function parseHash(hash) {
  const raw = hash.replace(/^#\/?/, '')
  const queryStart = raw.indexOf('?')
  const pathPart = queryStart === -1 ? raw : raw.slice(0, queryStart)
  const queryPart = queryStart === -1 ? '' : raw.slice(queryStart + 1)
  return {
    segments: pathPart.split('/').filter(Boolean).map(decodeSegment),
    query: Object.fromEntries(new URLSearchParams(queryPart)),
  }
}

/** Resolve um hash contra as rotas do app + as do shell.
 *  Devolve { name, params, query, segments }. */
export function resolveRoute(hash, appRoutes = []) {
  const { segments, query } = parseHash(hash)

  if (isAuthCallbackHash(hash)) {
    const name = isPasswordRecoveryHash(hash) ? 'conta-redefinir-senha' : 'conta'
    return { name, params: {}, query: {}, segments: [] }
  }

  for (const route of [...appRoutes, ...shellRoutes]) {
    const params = route.match(segments, query)
    if (params) return { name: route.name, params, query, segments }
  }
  return { name: NOT_FOUND, params: {}, query, segments }
}

/** Monta o hash de uma rota: href('br/lei/art1', { q: 'x' }) -> '#/br/lei/art1?q=x'.
 *  Cada segmento é codificado; valores de query null/undefined são omitidos. */
export function href(path = '', query = {}) {
  const encodedPath = String(path)
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) params.append(key, value)
  }
  const search = params.toString()
  return `#/${encodedPath}${search ? `?${search}` : ''}`
}

export function navigate(path, query) {
  location.hash = href(path, query)
}

export function createRouter(onChange, { routes = [] } = {}) {
  const handler = () => onChange(resolveRoute(location.hash, routes))
  window.addEventListener('hashchange', handler)
  handler() // fire once for the initial URL
  return () => window.removeEventListener('hashchange', handler)
}

export function navigateHome() {
  navigate('')
}

export function navigateToLogin() {
  navigate('conta/entrar')
}

export function navigateToSignup() {
  navigate('conta/cadastro')
}

export function navigateToForgotPassword() {
  navigate('conta/esqueci-senha')
}

export function navigateToChangePassword() {
  navigate('conta/alterar-senha')
}

export function navigateToAccount() {
  navigate('conta')
}

export function navigateToConfigRestServices() {
  navigate('config/backend/servicos-rest')
}

export function navigateToConfigPrivacy() {
  navigate('config/privacidade')
}

export function navigateToConfigAccessibility() {
  navigate('config/acessibilidade')
}
