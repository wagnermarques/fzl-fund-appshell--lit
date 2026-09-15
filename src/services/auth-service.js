// Autenticação do appshell.
//
// A interface (getCurrentUser/subscribe/signUp/signIn/signOut) é a mesma do
// auth-service do biblereaderapp, para que a UI (auth-view, user-status,
// drawer) não precise mudar quando o backend real chegar (roadmap M4).
//
// ATENÇÃO: esta implementação é um *provedor local*, só para desenvolvimento
// e demonstração — as contas ficam no localStorage deste navegador (senha
// guardada como hash SHA-256 com salt, mas ainda assim no cliente). Não é
// autenticação de verdade: troque o miolo destas funções por chamadas ao
// backend (REST em VITE_REST_API_BASE_URL, Supabase…) mantendo as assinaturas.

import { storageKey } from '../storage-keys.js'

const USERS_KEY = storageKey('auth:users')
const SESSION_KEY = storageKey('auth:session')

const listeners = new Set()

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key, value) {
  if (value === null) localStorage.removeItem(key)
  else localStorage.setItem(key, JSON.stringify(value))
}

/** Usuário público (sem hash/salt) a partir do registro armazenado. */
function toPublicUser(record) {
  return record ? { id: record.id, name: record.name, email: record.email, createdAt: record.createdAt } : null
}

function loadCurrentUser() {
  const session = readJSON(SESSION_KEY, null)
  if (!session) return null
  const record = readJSON(USERS_KEY, []).find((u) => u.id === session.userId)
  return toPublicUser(record)
}

let currentUser = loadCurrentUser()

function setCurrentUser(user) {
  currentUser = user
  writeJSON(SESSION_KEY, user ? { userId: user.id } : null)
  listeners.forEach((fn) => fn(currentUser))
}

// Login/logout feito em outra aba do mesmo app reflete aqui também.
window.addEventListener('storage', (e) => {
  if (e.key === SESSION_KEY || e.key === USERS_KEY) {
    currentUser = loadCurrentUser()
    listeners.forEach((fn) => fn(currentUser))
  }
})

function requireSecureContext() {
  // crypto.subtle/randomUUID só existem em contexto seguro (HTTPS ou
  // localhost) — ao abrir o dev server pelo IP da rede local via http, não.
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.randomUUID) {
    throw new Error('Login local indisponível: abra o app via HTTPS ou localhost.')
  }
}

async function hashPassword(password, salt) {
  requireSecureContext()
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

const signUpListeners = new Set()

export const authService = {
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
    email = normalizeEmail(email)
    name = String(name ?? '').trim()
    if (!name) throw new Error('Informe seu nome.')
    if (!email) throw new Error('Informe seu e-mail.')
    if (!password || password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')

    requireSecureContext()
    const users = readJSON(USERS_KEY, [])
    if (users.some((u) => u.email === email)) {
      throw new Error('Já existe uma conta com este e-mail.')
    }
    const salt = crypto.randomUUID()
    const record = {
      id: crypto.randomUUID(),
      name,
      email,
      salt,
      passwordHash: await hashPassword(password, salt),
      createdAt: new Date().toISOString(),
    }
    writeJSON(USERS_KEY, [...users, record])
    const user = toPublicUser(record)
    signUpListeners.forEach((fn) => fn(user))
    setCurrentUser(user)
    return user
  },

  async signIn({ email, password }) {
    email = normalizeEmail(email)
    const record = readJSON(USERS_KEY, []).find((u) => u.email === email)
    // Mesma mensagem para e-mail inexistente e senha errada, de propósito.
    if (!record || (await hashPassword(password ?? '', record.salt)) !== record.passwordHash) {
      throw new Error('E-mail ou senha inválidos.')
    }
    const user = toPublicUser(record)
    setCurrentUser(user)
    return user
  },

  async signOut() {
    setCurrentUser(null)
  },
}
