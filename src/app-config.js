/**
 * O appshell.config.js de cada app: esquema, validação, sobrescrita por
 * variável de ambiente e a leitura no navegador.
 *
 * Regra da casa: *valores* no appshell.config.js (título, prefixo de
 * storage, acessibilidade, analytics, push, backends...), *código* no
 * createAppShell() do main.js (rotas, home, drawer, provedor de auth,
 * listeners). O arquivo é lido pelo vite.config.js, no Node, e chega ao
 * navegador pelo preset como a constante de build __APPSHELL_CONFIG__ —
 * createAppShell() o mescla sozinho, sem o main.js repetir nada.
 *
 * Nada de segredo aqui: o arquivo vai para o git e o conteúdo dele para o
 * JavaScript que todo navegador baixa. Chave com cara de segredo (secret,
 * password, private...) é erro.
 *
 * O que muda por implantação (URL do backend, id do GA4...) o arquivo traz
 * como padrão — normalmente o de desenvolvimento — e cada ambiente
 * sobrescreve por variável de ambiente, sem editar o arquivo:
 *
 *   title                -> VITE_APPSHELL_TITLE
 *   analytics.id         -> VITE_APPSHELL_ANALYTICS_ID
 *   push.vapidPublicKey  -> VITE_APPSHELL_PUSH_VAPID_PUBLIC_KEY
 *   backends.api.url     -> VITE_APPSHELL_BACKENDS_API_URL
 *
 * (o nome é o caminho em MAIÚSCULAS_COM_SUBLINHADO, após VITE_APPSHELL_).
 * Os nomes antigos (VITE_GA4_MEASUREMENT_ID...) continuam valendo, abaixo
 * dos novos — ver LEGACY_ENV.
 *
 * Módulo puro: nada de DOM nem de constante de build no import (o
 * vite.config.js o carrega no Node).
 */

export const CONFIG_FILE = 'appshell.config.js'
export const ENV_PREFIX = 'VITE_APPSHELL_'
export const GA4_ID_PATTERN = /^G-[A-Z0-9]+$/i
export const VAPID_KEY_PATTERN = /^[A-Za-z0-9_-]+=*$/

/** Chaves de nível superior do arquivo. As de build (base, manifest,
 *  includeAssets, workbox) só o preset do Vite usa. */
const KNOWN_KEYS = [
  'title',
  'storagePrefix',
  'accessibility',
  'analytics',
  'push',
  'backends',
  'debug',
  'base',
  'manifest',
  'includeAssets',
  'workbox',
]
const BUILD_ONLY_KEYS = ['base', 'manifest', 'includeAssets', 'workbox', 'accessibility']
const ANALYTICS_KEYS = ['provider', 'id', 'cookiePrefix', 'params', 'requireConsent', 'privacyUrl']
const PUSH_KEYS = ['vapidPublicKey', 'backend', 'path']
const BACKEND_KEYS = ['url', 'auth', 'health', 'timeoutMs']
const BACKEND_AUTH = ['none', 'bearer']
const BACKEND_NAME = /^[a-z][a-z0-9-]*$/
export const DEFAULT_TIMEOUT_MS = 15000
const ANALYTICS_PROVIDERS = ['none', 'ga4']
const SECRET_KEY = /secret|passw|private|credential/i

/** Caminhos que o ambiente pode sobrescrever, além de backends.<nome>.url
 *  de cada backend declarado (ver overridablePaths). */
export const OVERRIDABLE_PATHS = ['title', 'analytics.id', 'analytics.privacyUrl', 'push.vapidPublicKey']

/** Nomes antigos, aceitos abaixo dos VITE_APPSHELL_*. */
export const LEGACY_ENV = {
  title: 'VITE_APP_TITLE',
  'analytics.id': 'VITE_GA4_MEASUREMENT_ID',
  'push.vapidPublicKey': 'VITE_PUSH_VAPID_PUBLIC_KEY',
  // Também cria o backend "api" quando o arquivo não o declara: era o
  // único backend que o appshell conhecia antes de `backends` existir.
  'backends.api.url': 'VITE_REST_API_BASE_URL',
}

/** Os caminhos sobrescrevíveis desta config: os fixos, a URL de cada
 *  backend declarado e backends.api.url (do nome antigo). */
export function overridablePaths(config) {
  const backendUrls = Object.keys(config?.backends ?? {}).map((name) => `backends.${name}.url`)
  return [...new Set([...OVERRIDABLE_PATHS, ...backendUrls, 'backends.api.url'])]
}

function fail(message) {
  throw new Error(`${CONFIG_FILE}: ${message}`)
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireKnownKeys(object, known, where) {
  for (const key of Object.keys(object)) {
    if (!known.includes(key)) {
      fail(`${where}"${key}" não é uma opção conhecida (use ${known.map((k) => `"${k}"`).join(', ')})`)
    }
  }
}

function optionalString(value, where) {
  if (value !== undefined && typeof value !== 'string') fail(`"${where}" deve ser texto`)
}

/** Recusa qualquer chave, em qualquer nível, com nome de segredo. */
function rejectSecrets(value, path = []) {
  if (Array.isArray(value)) return value.forEach((item, i) => rejectSecrets(item, [...path, i]))
  if (!isPlainObject(value)) return
  for (const [key, child] of Object.entries(value)) {
    const here = [...path, key]
    if (SECRET_KEY.test(key)) {
      fail(
        `"${here.join('.')}" parece um segredo. Este arquivo vai para o git e para o navegador de todo usuário — segredos ficam só no backend.`,
      )
    }
    rejectSecrets(child, here)
  }
}

/** Valida analytics e devolve { provider: 'none' } ou a config do GA4.
 *  Usada para o arquivo e, de novo, pelo createAppShell() sobre o
 *  resultado mesclado; `where` só muda a mensagem.
 *
 *  requireConsent vale true por padrão: sob a LGPD o cookie do GA4 precisa
 *  de consentimento, e esquecer de pedir é o erro caro. privacyUrl, se
 *  houver, vira o link "Saiba mais" do banner.
 *
 *  id vazio/ausente desliga o analytics em vez de dar erro: o id costuma
 *  vir do ambiente, que normalmente não o tem em desenvolvimento — quebrar
 *  o `npm run dev` por isso seria pior que rodar sem medição. Já um id
 *  *preenchido* e fora do formato é erro: aí é engano de digitação, e um
 *  id errado só se descobre semanas depois, quando o relatório aparece
 *  vazio. */
export function validateAnalytics(analytics, where = 'createAppShell') {
  const err = (message) => {
    throw new Error(`${where}: ${message}`)
  }
  if (analytics === null || analytics === undefined) return { provider: 'none' }
  if (!isPlainObject(analytics)) err('"analytics" deve ser um objeto')

  const { provider = 'ga4', id = '', cookiePrefix, params = {}, requireConsent = true, privacyUrl } = analytics

  if (!ANALYTICS_PROVIDERS.includes(provider)) {
    err(`analytics.provider não reconhece "${provider}" (use "ga4" ou "none")`)
  }
  if (provider === 'none' || !id) return { provider: 'none' }
  if (!GA4_ID_PATTERN.test(id)) {
    err(`analytics.id "${id}" não é um Measurement ID do GA4 (G-XXXXXXXXXX)`)
  }
  if (cookiePrefix !== undefined && typeof cookiePrefix !== 'string') {
    err('analytics.cookiePrefix deve ser uma string')
  }
  if (typeof params !== 'object' || params === null) {
    err('analytics.params deve ser um objeto')
  }
  if (typeof requireConsent !== 'boolean') {
    err('analytics.requireConsent deve ser true ou false')
  }
  if (privacyUrl !== undefined && typeof privacyUrl !== 'string') {
    err('analytics.privacyUrl deve ser uma string')
  }

  return { provider: 'ga4', id, cookiePrefix, params, requireConsent, privacyUrl }
}

/** URL de backend: vazia (não configurado), absoluta http(s) ou caminho
 *  da mesma origem ('/api', atrás do mesmo servidor ou do proxy do Vite). */
function isBackendUrl(url) {
  return url === '' || url.startsWith('/') || /^https?:\/\/[^/]/.test(url)
}

function validateBackends(backends) {
  if (!isPlainObject(backends)) fail('"backends" deve ser um objeto { nome: { url, ... } }')
  for (const [name, backend] of Object.entries(backends)) {
    const where = `backends.${name}`
    if (!BACKEND_NAME.test(name)) fail(`"${where}": nome deve ser minúsculo, começando por letra (ex.: "api", "arquivos")`)
    if (!isPlainObject(backend)) fail(`"${where}" deve ser um objeto { url, auth?, health?, timeoutMs? }`)
    requireKnownKeys(backend, BACKEND_KEYS, `${where}: `)
    const { url, auth = 'none', health, timeoutMs } = backend
    if (typeof url !== 'string') fail(`"${where}.url" é obrigatória (texto; vazia = ainda não configurado)`)
    if (!isBackendUrl(url)) fail(`"${where}.url" deve começar com http://, https:// ou / — veio "${url}"`)
    if (!BACKEND_AUTH.includes(auth)) fail(`"${where}.auth" deve ser "none" ou "bearer"`)
    if (health !== undefined && (typeof health !== 'string' || !health.startsWith('/'))) {
      fail(`"${where}.health" deve ser um caminho começando com / (ex.: "/health")`)
    }
    if (timeoutMs !== undefined && !(Number.isInteger(timeoutMs) && timeoutMs > 0)) {
      fail(`"${where}.timeoutMs" deve ser um inteiro positivo (milissegundos)`)
    }
  }
}

/** Valida o appshell.config.js (as opções de acessibilidade ficam com
 *  resolveAccessibility, no defineAppShellConfig). Devolve a própria config. */
export function validateAppConfig(config) {
  if (!isPlainObject(config)) fail('a config deve ser um objeto')
  requireKnownKeys(config, KNOWN_KEYS, '')
  rejectSecrets(config)

  const { title, storagePrefix, analytics, push, backends, debug } = config
  optionalString(title, 'title')
  optionalString(storagePrefix, 'storagePrefix')
  if (storagePrefix === '') fail('"storagePrefix" não pode ser vazio (omita para usar o name do package.json)')
  if (debug !== undefined && typeof debug !== 'boolean') fail('"debug" deve ser true ou false')

  if (analytics !== undefined) {
    if (!isPlainObject(analytics)) fail('"analytics" deve ser um objeto')
    requireKnownKeys(analytics, ANALYTICS_KEYS, 'analytics: ')
    validateAnalytics(analytics, CONFIG_FILE)
  }

  if (push !== undefined) {
    if (!isPlainObject(push)) fail('"push" deve ser um objeto')
    requireKnownKeys(push, PUSH_KEYS, 'push: ')
    optionalString(push.vapidPublicKey, 'push.vapidPublicKey')
    if (push.vapidPublicKey && !VAPID_KEY_PATTERN.test(push.vapidPublicKey)) {
      fail('"push.vapidPublicKey" deve ser a chave *pública* VAPID em base64url')
    }
    optionalString(push.backend, 'push.backend')
    optionalString(push.path, 'push.path')
    if (Boolean(push.backend) !== Boolean(push.path)) {
      fail('"push.backend" e "push.path" andam juntos (o shell faz POST da inscrição em path, nesse backend)')
    }
    if (push.backend && !backends?.[push.backend]) {
      fail(`"push.backend" aponta para "${push.backend}", que não está em "backends"`)
    }
  }

  if (backends !== undefined) validateBackends(backends)

  return config
}

/** 'push.vapidPublicKey' -> 'VITE_APPSHELL_PUSH_VAPID_PUBLIC_KEY' */
export function envName(path) {
  return (
    ENV_PREFIX +
    path
      .split('.')
      .map((part) => part.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_').toUpperCase())
      .join('_')
  )
}

function getPath(object, path) {
  return path.split('.').reduce((node, key) => node?.[key], object)
}

/** Grava em uma cópia, criando os objetos intermediários. */
function setPath(object, path, value) {
  const keys = path.split('.')
  const last = keys.pop()
  let node = object
  for (const key of keys) {
    node[key] = isPlainObject(node[key]) ? { ...node[key] } : {}
    node = node[key]
  }
  node[last] = value
}

/**
 * Aplica as variáveis de ambiente sobre a config do arquivo. Devolve
 * { config, sources }: sources diz, para cada caminho sobrescrevível com
 * valor, de onde ele veio (o nome da variável ou o arquivo) — a tela de
 * Config mostra isso. Variável vazia não conta (VITE_X= no .env.example
 * não apaga o padrão do arquivo).
 */
export function applyEnvOverrides(config, env = {}, paths = overridablePaths(config), legacy = LEGACY_ENV) {
  const result = structuredClone(config)
  const sources = {}
  for (const path of paths) {
    const candidates = [envName(path), legacy[path]].filter(Boolean)
    const name = candidates.find((n) => typeof env[n] === 'string' && env[n] !== '')
    if (name) {
      setPath(result, path, env[name])
      sources[path] = name
    } else if (getPath(config, path) !== undefined && getPath(config, path) !== '') {
      sources[path] = CONFIG_FILE
    }
  }
  return { config: result, sources }
}

/**
 * O que o preset entrega ao navegador: a config do arquivo já com o
 * ambiente aplicado, validada de novo (um id do GA4 errado vindo do
 * ambiente também quebra o build), sem as chaves só de build e com o
 * storagePrefix resolvido. Roda no Node.
 */
export function resolveAppConfig(config, { env = {}, packageName } = {}) {
  validateAppConfig(config)
  const { config: overridden, sources } = applyEnvOverrides(config, env)
  validateAppConfig(overridden)
  const runtime = Object.fromEntries(Object.entries(overridden).filter(([key]) => !BUILD_ONLY_KEYS.includes(key)))
  runtime.storagePrefix = overridden.storagePrefix ?? packageName
  return { config: runtime, sources }
}

/** No navegador: o que o preset resolveu no build. Fora do Vite (um teste
 *  sem o preset), vazio. */
export const appConfig =
  typeof __APPSHELL_CONFIG__ !== 'undefined' ? __APPSHELL_CONFIG__ : { config: {}, sources: {} }

/** De onde veio o valor de um caminho: nome da variável de ambiente,
 *  'appshell.config.js' ou null (não configurado). */
export function configSource(path, resolved = appConfig) {
  return resolved.sources[path] ?? null
}

/**
 * Mescla a config do arquivo com a do createAppShell(). O main.js vence
 * campo a campo — mas o normal é ele nem repetir o que está no arquivo.
 * analytics.cookiePrefix, se ninguém disser, é o prefixo de storage: dois
 * apps na mesma origem não dividem os cookies do GA4.
 */
export function mergeAppConfig(config, file = appConfig.config) {
  if (!config || typeof config !== 'object') return config
  const merged = { ...config }
  if (merged.title === undefined && file.title !== undefined) merged.title = file.title
  if (merged.debug === undefined && file.debug !== undefined) merged.debug = file.debug

  if (config.analytics !== null && (file.analytics || config.analytics)) {
    merged.analytics = { ...file.analytics, ...config.analytics }
    if (merged.analytics.cookiePrefix === undefined && file.storagePrefix) {
      merged.analytics.cookiePrefix = file.storagePrefix
    }
  }
  if (config.push !== null && (file.push || config.push)) {
    merged.push = { ...file.push, ...config.push }
  }
  return merged
}
