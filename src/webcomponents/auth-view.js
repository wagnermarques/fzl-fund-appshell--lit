import { LitElement, html, css } from 'lit'
import { authService } from '../services/auth-service.js'
import {
  navigateHome,
  navigateToAccount,
  navigateToChangePassword,
  navigateToForgotPassword,
  navigateToLogin,
  navigateToSignup,
} from '../router.js'

/** Conta do usuário. mode:
 *  - "signin" / "signup": login e cadastro;
 *  - "forgot": pede o link de redefinição de senha;
 *  - "reset": nova senha a partir do link (token vem da query ?token=);
 *  - "change": troca a senha de quem está logado.
 *  Com alguém logado, signin/signup/forgot mostram os dados da conta; sem
 *  ninguém, change mostra o login. reset vale nos dois casos (provedores
 *  como o Supabase já abrem o link com a sessão de recuperação ativa).
 *  O que o provedor do app não implementa não aparece. */
export class AuthView extends LitElement {
  static properties = {
    mode: { reflect: true },
    token: {},
    _user: { state: true },
    _done: { state: true },
    _error: { state: true },
    _busy: { state: true },
  }

  static styles = css`
    :host {
      display: block;
      max-width: 420px;
      margin: 0 auto;
      padding: 16px 24px 64px;
    }
    h1 {
      font-size: 1.5rem;
      margin: 0 0 4px;
    }
    .subtitle {
      color: var(--md-sys-color-on-surface-variant);
      margin: 0 0 24px;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    md-outlined-text-field {
      width: 100%;
    }
    md-filled-button {
      margin-top: 4px;
    }
    .error {
      color: var(--md-sys-color-error);
      font-size: 0.875rem;
      margin: 0;
    }
    .switch {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 24px;
      font-size: 0.875rem;
      color: var(--md-sys-color-on-surface-variant);
    }
    .notice {
      margin-top: 32px;
      font-size: 0.8rem;
      color: var(--md-sys-color-on-surface-variant);
    }
    .profile {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 4px 16px;
      margin: 0 0 24px;
      padding: 16px;
      border: 1px solid var(--md-sys-color-outline);
      border-radius: 12px;
      background: var(--md-sys-color-surface-variant);
    }
    .profile dt {
      color: var(--md-sys-color-on-surface-variant);
      font-size: 0.85rem;
    }
    .profile dd {
      margin: 0;
      word-break: break-all;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .forgot {
      align-self: flex-end;
      margin-top: -4px;
    }
    .done a {
      color: var(--md-sys-color-primary);
      word-break: break-all;
    }
  `

  constructor() {
    super()
    this.mode = 'signin'
    this.token = null
    this._user = null
    this._done = null
    this._error = null
    this._busy = false
  }

  connectedCallback() {
    super.connectedCallback()
    this._unsubscribe = authService.subscribe((user) => (this._user = user))
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubscribe?.()
  }

  willUpdate(changed) {
    // Trocar de tela não deve carregar o erro nem o sucesso da anterior.
    if (changed.has('mode')) {
      this._error = null
      this._done = null
    }
  }

  /** Qual formulário mostrar, dado o mode e se há alguém logado. */
  _screen() {
    if (this.mode === 'reset') return 'reset'
    if (this._user) return this.mode === 'change' ? 'change' : 'account'
    return this.mode === 'change' ? 'signin' : this.mode
  }

  async _submit(e) {
    e.preventDefault()
    const form = e.target
    if (!form.reportValidity()) return
    const data = Object.fromEntries(
      [...form.querySelectorAll('md-outlined-text-field')].map((f) => [f.name, f.value]),
    )

    const screen = this._screen()
    this._error = null
    if ('passwordConfirm' in data && data.password !== data.passwordConfirm) {
      this._error = 'As senhas não conferem.'
      return
    }

    this._busy = true
    try {
      switch (screen) {
        case 'signup':
          await authService.signUp(data)
          navigateHome()
          break
        case 'forgot':
          this._done = await authService.requestPasswordReset({ email: data.email })
          break
        case 'reset':
          this._done = { user: await authService.resetPassword({ token: this.token, password: data.password }) }
          break
        case 'change':
          await authService.changePassword({ currentPassword: data.currentPassword, newPassword: data.password })
          this._done = {}
          break
        default:
          await authService.signIn(data)
          navigateHome()
      }
    } catch (err) {
      this._error = err.message
    } finally {
      this._busy = false
    }
  }

  render() {
    const screen = this._screen()
    if (screen === 'account') return this._renderAccount()
    if (this._done) return this._renderDone(screen)
    if (['forgot', 'reset', 'change'].includes(screen) && !authService.supports(OPERATION_OF[screen])) {
      return html`
        <h1>Senha</h1>
        <p class="subtitle">Este app não oferece essa operação.</p>
        <md-text-button @click=${navigateToLogin}>Voltar para o login</md-text-button>
      `
    }
    if (screen === 'forgot') return this._renderForgot()
    if (screen === 'reset' || screen === 'change') return this._renderNewPassword(screen)
    return this._renderForm(screen)
  }

  _passwordField({ name = 'password', label = 'Senha', autocomplete = 'new-password', hint = true } = {}) {
    const min = authService.passwordMinLength()
    return html`<md-outlined-text-field
      name=${name}
      label=${label}
      type="password"
      autocomplete=${autocomplete}
      minlength=${hint ? min : 0}
      supporting-text=${hint ? `Mínimo de ${min} caracteres.` : ''}
      required
    ></md-outlined-text-field>`
  }

  _renderError() {
    return this._error ? html`<p class="error" role="alert">${this._error}</p>` : ''
  }

  _renderForgot() {
    return html`
      <h1>Esqueci minha senha</h1>
      <p class="subtitle">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
      <form @submit=${this._submit} novalidate>
        <md-outlined-text-field
          name="email"
          label="E-mail"
          type="email"
          autocomplete="email"
          required
        ></md-outlined-text-field>
        ${this._renderError()}
        <md-filled-button type="submit" ?disabled=${this._busy}>Enviar link</md-filled-button>
      </form>
      <p class="switch">Lembrou a senha? <md-text-button @click=${navigateToLogin}>Entrar</md-text-button></p>
    `
  }

  _renderNewPassword(screen) {
    const change = screen === 'change'
    return html`
      <h1>${change ? 'Alterar senha' : 'Criar nova senha'}</h1>
      <p class="subtitle">
        ${change ? 'Confirme a senha atual e escolha a nova.' : 'Escolha a nova senha da sua conta.'}
      </p>
      <form @submit=${this._submit} novalidate>
        ${change
          ? this._passwordField({ name: 'currentPassword', label: 'Senha atual', autocomplete: 'current-password', hint: false })
          : ''}
        ${this._passwordField({ label: 'Nova senha' })}
        ${this._passwordField({ name: 'passwordConfirm', label: 'Confirmar nova senha', hint: false })}
        ${this._renderError()}
        <div class="actions">
          <md-filled-button type="submit" ?disabled=${this._busy}>Salvar senha</md-filled-button>
          ${change ? html`<md-text-button type="button" @click=${navigateToAccount}>Cancelar</md-text-button>` : ''}
        </div>
      </form>
    `
  }

  _renderDone(screen) {
    if (screen === 'forgot') {
      const { previewUrl } = this._done
      return html`
        <h1>Verifique seu e-mail</h1>
        <p class="subtitle">
          Se houver uma conta com esse e-mail, você vai receber um link para criar uma nova senha.
        </p>
        ${previewUrl
          ? html`<p class="notice done">
              Modo local de demonstração: nenhum e-mail é enviado. O link seria este:
              <a href=${previewUrl}>${previewUrl}</a>
            </p>`
          : ''}
        <md-text-button @click=${navigateToLogin}>Voltar para o login</md-text-button>
      `
    }
    const signedIn = screen === 'change' || this._done.user
    return html`
      <h1>Senha alterada</h1>
      <p class="subtitle">
        ${signedIn ? 'Sua nova senha já está valendo.' : 'Sua nova senha já está valendo. Entre com ela.'}
      </p>
      ${signedIn
        ? html`<md-filled-button @click=${navigateToAccount}>Minha conta</md-filled-button>`
        : html`<md-filled-button @click=${navigateToLogin}>Entrar</md-filled-button>`}
    `
  }

  _renderAccount() {
    const since = new Date(this._user.createdAt).toLocaleDateString('pt-BR')
    return html`
      <h1>Minha conta</h1>
      <p class="subtitle">Você está conectado.</p>
      <dl class="profile">
        <dt>Nome</dt>
        <dd>${this._user.name}</dd>
        <dt>E-mail</dt>
        <dd>${this._user.email}</dd>
        <dt>Desde</dt>
        <dd>${since}</dd>
      </dl>
      <div class="actions">
        ${authService.supports('changePassword')
          ? html`<md-outlined-button @click=${navigateToChangePassword}>
              <md-icon slot="icon">password</md-icon>
              Alterar senha
            </md-outlined-button>`
          : ''}
        <md-outlined-button @click=${() => authService.signOut()}>
          <md-icon slot="icon">logout</md-icon>
          Sair
        </md-outlined-button>
      </div>
    `
  }

  _renderForm(screen) {
    const signup = screen === 'signup' && authService.supports('signUp')
    return html`
      <h1>${signup ? 'Criar conta' : 'Entrar'}</h1>
      <p class="subtitle">
        ${signup ? 'Preencha os dados abaixo para criar sua conta.' : 'Acesse com seu e-mail e senha.'}
      </p>

      <form @submit=${this._submit} novalidate>
        ${signup
          ? html`<md-outlined-text-field
              name="name"
              label="Nome"
              autocomplete="name"
              required
            ></md-outlined-text-field>`
          : ''}
        <md-outlined-text-field
          name="email"
          label="E-mail"
          type="email"
          autocomplete="email"
          required
        ></md-outlined-text-field>
        ${signup ? this._passwordField() : this._passwordField({ autocomplete: 'current-password', hint: false })}
        ${!signup && authService.supports('requestPasswordReset')
          ? html`<md-text-button class="forgot" type="button" @click=${navigateToForgotPassword}>
              Esqueci minha senha
            </md-text-button>`
          : ''}
        ${signup
          ? html`<md-outlined-text-field
              name="passwordConfirm"
              label="Confirmar senha"
              type="password"
              autocomplete="new-password"
              required
            ></md-outlined-text-field>`
          : ''}
        ${this._renderError()}
        <md-filled-button type="submit" ?disabled=${this._busy}>
          ${signup ? 'Criar conta' : 'Entrar'}
        </md-filled-button>
      </form>

      ${signup
        ? html`<p class="switch">Já tem conta? <md-text-button @click=${navigateToLogin}>Entrar</md-text-button></p>`
        : authService.supports('signUp')
          ? html`<p class="switch">
              Não tem conta? <md-text-button @click=${navigateToSignup}>Criar conta</md-text-button>
            </p>`
          : ''}
      ${authService.isLocal()
        ? html`<p class="notice">
            Modo local de demonstração: as contas ficam salvas apenas neste navegador até o backend
            de autenticação ser ligado.
          </p>`
        : ''}
    `
  }
}

const OPERATION_OF = { forgot: 'requestPasswordReset', reset: 'resetPassword', change: 'changePassword' }

customElements.define('auth-view', AuthView)
