// Notificações do usuário logado.
//
// Como o auth-service, é um provedor local (localStorage, uma lista por
// usuário) com uma interface pensada para ser trocada por chamadas ao
// backend depois — a UI só usa subscribe/add/markRead/markAllRead.

import { authService } from './auth-service.js'
import { storageKey } from '../storage-keys.js'

const keyFor = (userId) => storageKey(`notifications:${userId}`)

const listeners = new Set()
let currentUserId = null
let notifications = []

function read(userId) {
  try {
    return JSON.parse(localStorage.getItem(keyFor(userId))) ?? []
  } catch {
    return []
  }
}

function write(userId, list) {
  localStorage.setItem(keyFor(userId), JSON.stringify(list))
  if (userId === currentUserId) {
    notifications = list
    emit()
  }
}

function emit() {
  listeners.forEach((fn) => fn(notifications))
}

authService.subscribe((user) => {
  currentUserId = user?.id ?? null
  notifications = currentUserId ? read(currentUserId) : []
  emit()
})

authService.onSignUp((user) => {
  notificationService.add(user.id, {
    title: `Bem-vindo(a), ${user.name}!`,
    body: 'Sua conta foi criada. As notificações do app aparecerão aqui.',
  })
})

// Mudanças feitas em outra aba do mesmo app.
window.addEventListener('storage', (e) => {
  if (currentUserId && e.key === keyFor(currentUserId)) {
    notifications = read(currentUserId)
    emit()
  }
})

export const notificationService = {
  /** Chama o callback imediatamente com as notificações do usuário atual
   *  (mais recentes primeiro) e depois a cada mudança. */
  subscribe(callback) {
    listeners.add(callback)
    callback(notifications)
    return () => listeners.delete(callback)
  },

  unreadCount() {
    return notifications.filter((n) => !n.read).length
  },

  add(userId, { title, body = '' }) {
    const item = { id: crypto.randomUUID(), title, body, read: false, createdAt: new Date().toISOString() }
    write(userId, [item, ...read(userId)])
    return item
  },

  markRead(id) {
    if (!currentUserId) return
    write(
      currentUserId,
      read(currentUserId).map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
  },

  markAllRead() {
    if (!currentUserId) return
    write(
      currentUserId,
      read(currentUserId).map((n) => ({ ...n, read: true })),
    )
  },
}
