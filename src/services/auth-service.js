// Autenticação do appshell.
//
// A UI (auth-view, user-status, drawer) só conversa com o authService, cuja
// interface (getCurrentUser/subscribe/signUp/signIn/signOut + as operações
// de senha) é a mesma do auth-service do biblereaderapp. Quem de fato
// autentica é um *provedor*, e o app consumidor passa o seu em
// createAppShell({ auth: meuProvedor }) — sem editar nada do shell.
//
// Contrato do provedor (todas as operações assíncronas; erro = throw new
// Error('mensagem para o usuário')):
//
//   signIn({ email, password })          -> usuário           (obrigatório)
//   signOut()                                                  (obrigatório)
//   signUp({ name, email, password })    -> usuário           (opcional)
//   requestPasswordReset({ email, redirectTo })               (opcional)
//       Manda ao usuário (por e-mail, normalmente) um link para
//       redirectTo — a URL absoluta de #/conta/redefinir-senha — com o que o
//       provedor precisar para validar o pedido (ex.: ?token=...). Deve
//       resolver igual exista ou não a conta, para não revelar quais
//       e-mails estão cadastrados.
//   resetPassword({ token, password })   -> usuário | null    (opcional)
//       Conclui o pedido acima. token vem da query da rota (?token=...);
//       provedores que já trazem a sessão de recuperação no próprio hash
//       (#access_token=...&type=recovery, como o Supabase) recebem null e
//       usam a sessão. Devolver um usuário já o deixa logado.
//   changePassword({ user, currentPassword, newPassword })    (opcional)
//       Troca a senha de quem está logado.
//   init({ setUser })                    -> função de limpeza (opcional)
//       Chamado ao instalar: restaure a sessão salva e avise mudanças
//       vindas de fora (outra aba, callback do provedor) com setUser(user).
//   passwordMinLength                    número; padrão 6       (opcional)
//
// Um usuário é { id, name, email, createdAt? }. Operação opcional ausente
// some da UI (sem signUp, não há "Criar conta"; sem requestPasswordReset,
// não há "Esqueci minha senha").
//
// O provedor padrão, localProvider, é só para desenvolvimento e
// demonstração: as contas ficam no localStorage deste navegador (senha com
// hash SHA-256 e salt, mas ainda assim no cliente) e o "e-mail" de
// redefinição de senha não é enviado — o link aparece na própria tela.

import { href } from '../router.js'
import { storageKey } from '../storage-keys.js'

const USERS_KEY = storageKey('auth:users')
const SESSION_KEY = storageKey('auth:session')
const RESETS_KEY = storageKey('auth:password-resets')

const RESET_TTL_MS = 30 * 60 * 1000
const DEFAULT_MIN_LENGTH = 6

export const PROVIDER_OPERATIONS = ['signIn', 'signOut', 'signUp', 'requestPasswordReset', 'resetPassword', 'changePassword']
export const REQUIRED_OPERATIONS = ['signIn', 'signOut']

// --- provedor local (demonstração) ---------------------------------------

function readJSON(key, fallback) {
  try {
    const raw = globalThis.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  if (value === null) globalThis.localStorage.removeItem(key)
  else globalThis.localStorage.setItem(key, JSON.stringify(value))
}

/** Usuário público (sem hash/salt) a partir do registro armazenado. */
function toPublicUser(record) {
  return record ? { id: record.id, name: record.name, email: record.email, createdAt: record.createdAt } : null
}

function loadSessionUser() {
  const session = readJSON(SESSION_KEY, null)
  if (!session) return null
  return toPublicUser(readJSON(USERS_KEY, []).find((u) => u.id === session.userId))
}

function requireSecureContext() {
  // crypto.subtle/randomUUID só existem em contexto seguro (HTTPS ou
  // localhost) — ao abrir o dev server pelo IP da rede local via http, não.
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.randomUUID) {
    throw new Error('Login local indisponível: abra o app via HTTPS ou localhost.')
  }
}

async function sha256(text) {
  requireSecureContext()
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function hashPassword(password, salt) {
  return sha256(`${salt}:${password}`)
}

async function withNewPassword(record, password) {
  const salt = crypto.randomUUID()
  return { ...record, salt, passwordHash: await hashPassword(password, salt) }
}

function requireMinLength(password) {
  if (!password || password.length < DEFAULT_MIN_LENGTH) {
    throw new Error(`A senha precisa ter pelo menos ${DEFAULT_MIN_LENGTH} caracteres.`)
  }
}

function saveUser(record) {
  writeJSON(
    USERS_KEY,
    readJSON(USERS_KEY, []).map((u) => (u.id === record.id ? record : u)),
  )
}

export const localProvider = {
  passwordMinLength: DEFAULT_MIN_LENGTH,

  init({ setUser }) {
    setUser(loadSessionUser())
    // Login/logout feito em outra aba do mesmo app reflete aqui também.
    const onStorage = (e) => {
      if (e.key === SESSION_KEY || e.key === USERS_KEY) setUser(loadSessionUser())
    }
    globalThis.addEventListener?.('storage', onStorage)
    return () => globalThis.removeEventListener?.('storage', onStorage)
  },

  async signUp({ name, email, password }) {
    requireMinLength(password)
    requireSecureContext()
    const users = readJSON(USERS_KEY, [])
    if (users.some((u) => u.email === email)) {
      throw new Error('Já existe uma conta com este e-mail.')
    }
    const record = await withNewPassword({ id: crypto.randomUUID(), name, email, createdAt: new Date().toISOString() }, password)
    writeJSON(USERS_KEY, [...users, record])
    writeJSON(SESSION_KEY, { userId: record.id })
    return toPublicUser(record)
  },

  async signIn({ email, password }) {
    const record = readJSON(USERS_KEY, []).find((u) => u.email === email)
    // Mesma mensagem para e-mail inexistente e senha errada, de propósito.
    if (!record || (await hashPassword(password ?? '', record.salt)) !== record.passwordHash) {
      throw new Error('E-mail ou senha inválidos.')
    }
    writeJSON(SESSION_KEY, { userId: record.id })
    return toPublicUser(record)
  },

  async signOut() {
    writeJSON(SESSION_KEY, null)
  },

  /** Guarda só o hash do token, com validade de 30 min e um pedido ativo
   *  por conta. Sem servidor de e-mail, devolve { previewUrl } com o link
   *  que seria enviado — o que revela se a conta existe, aceitável só
   *  porque isto é uma demonstração. */
  async requestPasswordReset({ email, redirectTo }) {
    requireSecureContext()
    const record = readJSON(USERS_KEY, []).find((u) => u.email === email)
    if (!record) return {}
    const token = crypto.randomUUID()
    const others = readJSON(RESETS_KEY, []).filter((r) => r.userId !== record.id && r.expiresAt > Date.now())
    writeJSON(RESETS_KEY, [...others, { tokenHash: await sha256(token), userId: record.id, expiresAt: Date.now() + RESET_TTL_MS }])
    const separator = redirectTo.includes('?') ? '&' : '?'
    return { previewUrl: `${redirectTo}${separator}token=${encodeURIComponent(token)}` }
  },

  async resetPassword({ token, password }) {
    requireMinLength(password)
    const invalid = new Error('Este link de redefinição é inválido ou expirou. Peça um novo.')
    if (!token) throw invalid
    const tokenHash = await sha256(token)
    const resets = readJSON(RESETS_KEY, [])
    const reset = resets.find((r) => r.tokenHash === tokenHash && r.expiresAt > Date.now())
    const record = reset && readJSON(USERS_KEY, []).find((u) => u.id === reset.userId)
    if (!record) throw invalid
    saveUser(await withNewPassword(record, password))
    // Uso único.
    writeJSON(RESETS_KEY, resets.filter((r) => r.userId !== record.id))
    return null
  },

  async changePassword({ user, currentPassword, newPassword }) {
    requireMinLength(newPassword)
    const record = readJSON(USERS_KEY, []).find((u) => u.id === user.id)
    if (!record || (await hashPassword(currentPassword ?? '', record.salt)) !== record.passwordHash) {
      throw new Error('Senha atual incorreta.')
    }
    saveUser(await withNewPassword(record, newPassword))
  },
}

// --- serviço (independente do provedor) -----------------------------------

const listeners = new Set()
const signUpListeners = new Set()

let provider = null
let teardown = null
let currentUser = null

function setCurrentUser(user) {
  currentUser = user ?? null
  listeners.forEach((fn) => fn(currentUser))
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

function requireEmail(email) {
  if (!email) throw new Error('Informe seu e-mail.')
}

function requireOperation(name) {
  if (typeof provider[name] !== 'function') {
    throw new Error('Operação não disponível neste app.')
  }
}

/** Lança se o objeto não cumpre o contrato de provedor (ver topo). Usada
 *  também por validateConfig(), para o app falhar cedo. */
export function validateAuthProvider(candidate) {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('createAppShell: "auth" deve ser um objeto (o provedor de autenticação)')
  }
  for (const name of REQUIRED_OPERATIONS) {
    if (typeof candidate[name] !== 'function') {
      throw new Error(`createAppShell: auth.${name} é obrigatório e deve ser uma função`)
    }
  }
  for (const name of [...PROVIDER_OPERATIONS, 'init']) {
    if (candidate[name] !== undefined && typeof candidate[name] !== 'function') {
      throw new Error(`createAppShell: auth.${name} deve ser uma função`)
    }
  }
  const min = candidate.passwordMinLength
  if (min !== undefined && !(Number.isInteger(min) && min >= 1)) {
    throw new Error('createAppShell: auth.passwordMinLength deve ser um inteiro positivo')
  }
}

export const authService = {
  /** Troca o provedor (createAppShell faz isso com config.auth). Desfaz o
   *  anterior e começa deslogado até o novo restaurar a sessão. */
  use(newProvider) {
    validateAuthProvider(newProvider)
    teardown?.()
    teardown = null
    provider = newProvider
    setCurrentUser(null)
    const cleanup = provider.init?.({ setUser: (user) => provider === newProvider && setCurrentUser(user) })
    if (typeof cleanup === 'function') teardown = cleanup
  },

  /** true quando o provedor atual implementa a operação (a UI esconde o
   *  que não existe). */
  supports(operation) {
    return typeof provider?.[operation] === 'function'
  },

  /** true com o provedor local de demonstração (a UI avisa o usuário). */
  isLocal() {
    return provider === localProvider
  },

  passwordMinLength() {
    return provider.passwordMinLength ?? DEFAULT_MIN_LENGTH
  },

  /** Síncrono — null quando ninguém está logado. */
  getCurrentUser() {
    return currentUser
  },

  /** Chama o callback imediatamente com o usuário atual e depois a cada mudança. */
  subscribe(callback) {
    listeners.add(callback)
    callback(currentUser)
    return () => listeners.delete(callback)
  },

  /** Notificado quando uma conta nova é criada (usado pelo notification-service
   *  para gerar a mensagem de boas-vindas). */
  onSignUp(callback) {
    signUpListeners.add(callback)
    return () => signUpListeners.delete(callback)
  },

  async signUp({ name, email, password }) {
    requireOperation('signUp')
    name = String(name ?? '').trim()
    email = normalizeEmail(email)
    if (!name) throw new Error('Informe seu nome.')
    requireEmail(email)
    const user = await provider.signUp({ name, email, password })
    signUpListeners.forEach((fn) => fn(user))
    setCurrentUser(user)
    return user
  },

  async signIn({ email, password }) {
    const user = await provider.signIn({ email: normalizeEmail(email), password })
    setCurrentUser(user)
    return user
  },

  async signOut() {
    await provider.signOut()
    setCurrentUser(null)
  },

  /** Pede o link de redefinição. redirectTo padrão: #/conta/redefinir-senha
   *  neste mesmo endereço. Devolve o que o provedor devolver (o local
   *  devolve { previewUrl }). */
  async requestPasswordReset({ email, redirectTo = defaultResetUrl() }) {
    requireOperation('requestPasswordReset')
    email = normalizeEmail(email)
    requireEmail(email)
    return (await provider.requestPasswordReset({ email, redirectTo })) ?? {}
  },

  async resetPassword({ token = null, password }) {
    requireOperation('resetPassword')
    const user = await provider.resetPassword({ token, password })
    if (user) setCurrentUser(user)
    return user ?? null
  },

  async changePassword({ currentPassword, newPassword }) {
    requireOperation('changePassword')
    if (!currentUser) throw new Error('Entre na sua conta para trocar a senha.')
    await provider.changePassword({ user: currentUser, currentPassword, newPassword })
  },
}

function defaultResetUrl() {
  const { origin, pathname } = globalThis.location ?? {}
  return `${origin ?? ''}${pathname ?? ''}${href('conta/redefinir-senha')}`
}

authService.use(localProvider)
