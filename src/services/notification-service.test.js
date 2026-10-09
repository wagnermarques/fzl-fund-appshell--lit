import { beforeEach, describe, expect, it, vi } from 'vitest'
import { notificationService } from './notification-service.js'

beforeEach(() => {
  const data = {}
  vi.stubGlobal('localStorage', {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => (data[k] = String(v)),
    removeItem: (k) => delete data[k],
  })
})

describe('notificationService.onAdd', () => {
  it('avisa cada notificação adicionada, com o usuário, até o off()', () => {
    const fn = vi.fn()
    const off = notificationService.onAdd(fn)
    const item = notificationService.add('u1', { title: 'Oi', body: 'tudo bem?' })
    off()
    notificationService.add('u1', { title: 'Depois do off' })
    expect(item).toMatchObject({ title: 'Oi', body: 'tudo bem?', read: false })
    expect(fn.mock.calls).toEqual([[item, 'u1']])
  })
})
