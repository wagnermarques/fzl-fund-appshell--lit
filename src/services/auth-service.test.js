import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authService, localProvider } from './auth-service.js'

function memoryStorage() {
  const data = {}
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => (data[k] = String(v)),
    removeItem: (k) => delete data[k],
    data,
  }
}

const REDIRECT = 'https://app.test/#/conta/redefinir-senha'

function tokenOf(previewUrl) {
  return new URL(previewUrl.replace('#/', '')).searchParams.get('token')
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage())
  authService.use(localProvider)
})

describe('authService com o provedor local', () => {
  it('cria conta, sai e entra de novo', async () => {
    const user = await authService.signUp({ name: 'Ana', email: ' Ana@X.com ', password: 'segredo1' })
    expect(user).toMatchObject({ name: 'Ana', email: 'ana@x.com' })
    expect(authService.getCurrentUser()).toEqual(user)
    await authService.signOut()
    expect(authService.getCurrentUser()).toBe(null)
    await authService.signIn({ email: 'ana@x.com', password: 'segredo1' })
    expect(authService.getCurrentUser()?.id).toBe(user.id)
  })

  it('troca a senha de quem está logado, conferindo a atual', async () => {
    await authService.signUp({ name: 'Ana', email: 'ana@x.com', password: 'segredo1' })
    await expect(authService.changePassword({ currentPassword: 'errada', newPassword: 'nova123' })).rejects.toThrow(
      /Senha atual incorreta/,
    )
    await expect(authService.changePassword({ currentPassword: 'segredo1', newPassword: '123' })).rejects.toThrow(
      /pelo menos 6/,
    )
    await authService.changePassword({ currentPassword: 'segredo1', newPassword: 'nova123' })
    await authService.signOut()
    await expect(authService.signIn({ email: 'ana@x.com', password: 'segredo1' })).rejects.toThrow(/inválidos/)
    await authService.signIn({ email: 'ana@x.com', password: 'nova123' })
  })

  it('troca de senha exige alguém logado', async () => {
    await expect(authService.changePassword({ currentPassword: 'a', newPassword: 'b' })).rejects.toThrow(/Entre na sua conta/)
  })

  it('redefine a senha pelo link, que só vale uma vez', async () => {
    await authService.signUp({ name: 'Ana', email: 'ana@x.com', password: 'segredo1' })
    await authService.signOut()

    const { previewUrl } = await authService.requestPasswordReset({ email: 'ANA@x.com', redirectTo: REDIRECT })
    expect(previewUrl.startsWith(`${REDIRECT}?token=`)).toBe(true)
    const token = tokenOf(previewUrl)

    expect(await authService.resetPassword({ token, password: 'outra123' })).toBe(null)
    await authService.signIn({ email: 'ana@x.com', password: 'outra123' })
    await expect(authService.resetPassword({ token, password: 'denovo123' })).rejects.toThrow(/inválido ou expirou/)
  })

  it('link expirado, token inventado ou ausente não servem', async () => {
    await authService.signUp({ name: 'Ana', email: 'ana@x.com', password: 'segredo1' })
    const { previewUrl } = await authService.requestPasswordReset({ email: 'ana@x.com', redirectTo: REDIRECT })
    await expect(authService.resetPassword({ token: 'inventado', password: 'outra123' })).rejects.toThrow(/inválido/)
    await expect(authService.resetPassword({ password: 'outra123' })).rejects.toThrow(/inválido/)

    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + 31 * 60 * 1000)
    await expect(authService.resetPassword({ token: tokenOf(previewUrl), password: 'outra123' })).rejects.toThrow(
      /expirou/,
    )
    vi.restoreAllMocks()
  })

  it('um pedido novo invalida o anterior', async () => {
    await authService.signUp({ name: 'Ana', email: 'ana@x.com', password: 'segredo1' })
    const first = await authService.requestPasswordReset({ email: 'ana@x.com', redirectTo: REDIRECT })
    await authService.requestPasswordReset({ email: 'ana@x.com', redirectTo: REDIRECT })
    await expect(authService.resetPassword({ token: tokenOf(first.previewUrl), password: 'outra123' })).rejects.toThrow(
      /inválido/,
    )
  })

  it('e-mail sem conta resolve sem erro e sem link', async () => {
    expect(await authService.requestPasswordReset({ email: 'ninguem@x.com', redirectTo: REDIRECT })).toEqual({})
    await expect(authService.requestPasswordReset({ email: ' ' })).rejects.toThrow(/Informe seu e-mail/)
  })

  it('nunca guarda o token em claro', async () => {
    await authService.signUp({ name: 'Ana', email: 'ana@x.com', password: 'segredo1' })
    const { previewUrl } = await authService.requestPasswordReset({ email: 'ana@x.com', redirectTo: REDIRECT })
    expect(JSON.stringify(localStorage.data)).not.toContain(tokenOf(previewUrl))
  })
})

describe('authService com provedor do app', () => {
  it('delega ao provedor, normaliza o e-mail e esconde o que ele não implementa', async () => {
    const provider = {
      signIn: vi.fn(async ({ email }) => ({ id: '1', name: 'Bia', email })),
      signOut: vi.fn(async () => {}),
      requestPasswordReset: vi.fn(async () => {}),
    }
    authService.use(provider)
    expect(authService.isLocal()).toBe(false)
    expect(authService.supports('requestPasswordReset')).toBe(true)
    expect(authService.supports('resetPassword')).toBe(false)
    expect(authService.supports('signUp')).toBe(false)

    await authService.signIn({ email: ' BIA@x.com', password: 'p' })
    expect(provider.signIn).toHaveBeenCalledWith({ email: 'bia@x.com', password: 'p' })
    expect(await authService.requestPasswordReset({ email: 'bia@x.com', redirectTo: REDIRECT })).toEqual({})
    expect(provider.requestPasswordReset).toHaveBeenCalledWith({ email: 'bia@x.com', redirectTo: REDIRECT })
    await expect(authService.resetPassword({ token: 't', password: 'x' })).rejects.toThrow(/não disponível/)
  })

  it('changePassword recebe o usuário logado; resetPassword que devolve usuário já loga', async () => {
    const bia = { id: '1', name: 'Bia', email: 'bia@x.com' }
    const provider = {
      signIn: async () => bia,
      signOut: async () => {},
      resetPassword: vi.fn(async () => bia),
      changePassword: vi.fn(async () => {}),
    }
    authService.use(provider)
    expect(await authService.resetPassword({ password: 'nova' })).toEqual(bia)
    expect(provider.resetPassword).toHaveBeenCalledWith({ token: null, password: 'nova' })
    expect(authService.getCurrentUser()).toEqual(bia)

    await authService.changePassword({ currentPassword: 'a', newPassword: 'b' })
    expect(provider.changePassword).toHaveBeenCalledWith({ user: bia, currentPassword: 'a', newPassword: 'b' })
  })

  it('init restaura a sessão e pode avisar mudanças; trocar de provedor desfaz o anterior', () => {
    const cleanup = vi.fn()
    let push
    authService.use({
      signIn: async () => null,
      signOut: async () => {},
      passwordMinLength: 10,
      init: ({ setUser }) => {
        push = setUser
        setUser({ id: '9', name: 'Caio', email: 'c@x.com' })
        return cleanup
      },
    })
    expect(authService.getCurrentUser()?.id).toBe('9')
    expect(authService.passwordMinLength()).toBe(10)
    push(null)
    expect(authService.getCurrentUser()).toBe(null)

    authService.use(localProvider)
    expect(cleanup).toHaveBeenCalledOnce()
    push({ id: 'velho' })
    expect(authService.getCurrentUser()).toBe(null)
  })
})
