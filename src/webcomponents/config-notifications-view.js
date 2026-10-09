import { LitElement, html, css } from 'lit'
import { announce } from '../a11y/index.js'
import { pushService } from '../services/push-service.js'

/** Config > Notificações — onde o usuário liga ou desliga o Web Push neste
 *  navegador. É o único lugar em que o shell pede a permissão do sistema:
 *  o pedido precisa nascer de um clique (Safari/iOS recusam fora dele), e
 *  pedir sem o usuário ter procurado é má prática. */
export class ConfigNotificationsView extends LitElement {
  static properties = {
    _active: { state: true },
    _permission: { state: true },
    _busy: { state: true },
    _error: { state: true },
  }

  static styles = css`
    :host {
      display: block;
      max-width: 640px;
      margin: 0 auto;
      padding: 16px 24px 64px;
    }
    h1 {
      font-size: 1.5rem;
      margin: 0 0 4px;
    }
    .breadcrumb {
      color: var(--md-sys-color-on-surface-variant);
      font-size: 0.85rem;
      margin: 0 0 24px;
    }
    label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      font-size: 1rem;
    }
    .hint {
      margin-top: 8px;
      font-size: 0.85rem;
      color: var(--md-sys-color-on-surface-variant);
    }
    .error {
      margin-top: 8px;
      color: var(--md-sys-color-error);
    }
  `

  constructor() {
    super()
    this._active = null // null = ainda consultando o navegador
    this._permission = pushService.permission()
    this._busy = false
    this._error = ''
  }

  connectedCallback() {
    super.connectedCallback()
    this._refresh()
    // Permissão trocada nas configurações do navegador com a tela aberta.
    this._unsubscribe = pushService.subscribe(({ type }) => {
      if (type === 'permission-change' || type === 'subscription-change') this._refresh()
    })
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubscribe?.()
  }

  async _refresh() {
    this._permission = pushService.permission()
    this._active = pushService.isSupported() ? await pushService.isActive() : false
  }

  async _toggle(e) {
    const turnOn = e.target.selected
    this._busy = true
    this._error = ''
    try {
      if (turnOn) await pushService.enable()
      else await pushService.disable()
      announce(turnOn ? 'Notificações ativadas' : 'Notificações desativadas')
    } catch (error) {
      this._error = error.message || 'Não foi possível mudar as notificações. Tente de novo.'
    } finally {
      this._busy = false
      await this._refresh()
      // O switch fica no estado real, não no que o clique pediu.
      e.target.selected = this._active
    }
  }

  _statusText() {
    if (!pushService.isSupported()) {
      return 'Este navegador não recebe notificações deste app. No iPhone e no iPad, instale o app na tela inicial (Compartilhar › Adicionar à Tela de Início) e abra-o por lá.'
    }
    if (this._permission === 'denied') {
      return 'As notificações deste site estão bloqueadas no navegador. Para ativá-las, libere-as nas permissões do site (o ícone ao lado do endereço) e volte aqui.'
    }
    if (this._active === null) return 'Verificando…'
    return this._active
      ? 'Você recebe avisos do app mesmo com ele fechado. Desligue quando quiser.'
      : 'Ligue para receber avisos do app mesmo com ele fechado. O navegador vai pedir sua permissão.'
  }

  render() {
    const disabled = this._busy || this._active === null || !pushService.isSupported() || this._permission === 'denied'
    return html`
      <p class="breadcrumb">Config &rsaquo; Notificações</p>
      <h1>Notificações</h1>
      <label>
        Receber notificações neste aparelho
        <md-switch ?selected=${Boolean(this._active)} ?disabled=${disabled} @change=${this._toggle}></md-switch>
      </label>
      <p class="hint">${this._statusText()}</p>
      ${this._error ? html`<p class="error" role="alert">${this._error}</p>` : ''}
    `
  }
}

customElements.define('config-notifications-view', ConfigNotificationsView)
