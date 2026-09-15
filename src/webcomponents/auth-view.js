import { LitElement, html, css } from 'lit'
import { authService } from '../services/auth-service.js'
import { navigateHome, navigateToLogin, navigateToSignup } from '../router.js'

/** Conta do usuário: formulário de login (mode="signin") ou de cadastro
 *  (mode="signup"); com alguém logado, mostra os dados da conta e o botão
 *  Sair, independentemente do mode. */
export class AuthView extends LitElement {
  static properties = {
    mode: { reflect: true },
    _user: { state: true },
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
  `

  constructor() {
    super()
    this.mode = 'signin'
    this._user = null
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
    // Trocar entre login e cadastro não deve carregar o erro da outra tela.
    if (changed.has('mode')) this._error = null
  }

  async _submit(e) {
    e.preventDefault()
    const form = e.target
    if (!form.reportValidity()) return
    const data = Object.fromEntries(
      [...form.querySelectorAll('md-outlined-text-field')].map((f) => [f.name, f.value]),
    )

    this._error = null
    if (this.mode === 'signup' && data.password !== data.passwordConfirm) {
      this._error = 'As senhas não conferem.'
      return
    }

    this._busy = true
    try {
      if (this.mode === 'signup') await authService.signUp(data)
      else await authService.signIn(data)
      navigateHome()
    } catch (err) {
      this._error = err.message
    } finally {
      this._busy = false
    }
  }

  render() {
    return this._user ? this._renderAccount() : this._renderForm()
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
      <md-outlined-button @click=${() => authService.signOut()}>
        <md-icon slot="icon">logout</md-icon>
        Sair
      </md-outlined-button>
    `
  }

  _renderForm() {
    const signup = this.mode === 'signup'
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
        <md-outlined-text-field
          name="password"
          label="Senha"
          type="password"
          autocomplete=${signup ? 'new-password' : 'current-password'}
          minlength=${signup ? 6 : 0}
          supporting-text=${signup ? 'Mínimo de 6 caracteres.' : ''}
          required
        ></md-outlined-text-field>
        ${signup
          ? html`<md-outlined-text-field
              name="passwordConfirm"
              label="Confirmar senha"
              type="password"
              autocomplete="new-password"
              required
            ></md-outlined-text-field>`
          : ''}
        ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : ''}
        <md-filled-button type="submit" ?disabled=${this._busy}>
          ${signup ? 'Criar conta' : 'Entrar'}
        </md-filled-button>
      </form>

      <p class="switch">
        ${signup
          ? html`Já tem conta? <md-text-button @click=${navigateToLogin}>Entrar</md-text-button>`
          : html`Não tem conta? <md-text-button @click=${navigateToSignup}>Criar conta</md-text-button>`}
      </p>

      <p class="notice">
        Modo local de demonstração: as contas ficam salvas apenas neste navegador até o backend
        de autenticação ser ligado.
      </p>
    `
  }
}

customElements.define('auth-view', AuthView)
