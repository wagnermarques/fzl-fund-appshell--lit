import { LitElement, html, css } from 'lit'
import { notificationService } from '../services/notification-service.js'

const DATE_FORMAT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Sino de notificações do usuário logado: badge com a quantidade não lida
 *  e um menu com a lista (clicar numa notificação marca como lida). */
export class UserNotifications extends LitElement {
  static properties = {
    _items: { state: true },
  }

  static styles = css`
    :host {
      display: inline-flex;
      position: relative;
    }
    .badge {
      position: absolute;
      top: 4px;
      right: 4px;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 8px;
      background: var(--md-sys-color-error);
      color: var(--md-sys-color-on-error);
      font-size: 0.65rem;
      font-weight: 600;
      line-height: 16px;
      text-align: center;
      pointer-events: none;
    }
    md-menu {
      --md-menu-container-color: var(--md-sys-color-surface);
      min-width: 280px;
    }
    .menu-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 8px 4px 16px;
      font-weight: 600;
      font-size: 0.9rem;
    }
    .empty {
      padding: 16px;
      color: var(--md-sys-color-on-surface-variant);
      font-size: 0.875rem;
    }
    md-menu-item.unread [slot='headline'] {
      font-weight: 600;
    }
    md-menu-item md-icon[slot='start'] {
      color: var(--md-sys-color-primary);
    }
  `

  constructor() {
    super()
    this._items = []
  }

  connectedCallback() {
    super.connectedCallback()
    this._unsubscribe = notificationService.subscribe((items) => (this._items = items))
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubscribe?.()
  }

  _toggleMenu() {
    const menu = this.renderRoot.querySelector('md-menu')
    menu.open = !menu.open
  }

  render() {
    const unread = this._items.filter((n) => !n.read).length
    const label = unread ? `Notificações (${unread} não lidas)` : 'Notificações'
    return html`
      <md-icon-button id="anchor" aria-label=${label} title=${label} @click=${this._toggleMenu}>
        <md-icon>${unread ? 'notifications_active' : 'notifications'}</md-icon>
      </md-icon-button>
      ${unread ? html`<span class="badge" aria-hidden="true">${unread > 99 ? '99+' : unread}</span>` : ''}

      <!-- popover: o menu vai para a top layer e não é cortado pelo header
           nem fica atrás do drawer/main (ver comentário em app-shell.js). -->
      <md-menu anchor="anchor" positioning="popover" menu-corner="start-end" anchor-corner="end-end">
        <div class="menu-header">
          <span>Notificações</span>
          ${unread
            ? html`<md-text-button @click=${() => notificationService.markAllRead()}>Marcar todas como lidas</md-text-button>`
            : ''}
        </div>
        <md-divider></md-divider>
        ${this._items.length
          ? this._items.map(
              (n) => html`
                <md-menu-item class=${n.read ? '' : 'unread'} @click=${() => notificationService.markRead(n.id)}>
                  <md-icon slot="start">${n.read ? 'drafts' : 'mail'}</md-icon>
                  <div slot="headline">${n.title}</div>
                  ${n.body ? html`<div slot="supporting-text">${n.body}</div>` : ''}
                  <div slot="trailing-supporting-text">${DATE_FORMAT.format(new Date(n.createdAt))}</div>
                </md-menu-item>
              `,
            )
          : html`<div class="empty">Nenhuma notificação.</div>`}
      </md-menu>
    `
  }
}

customElements.define('user-notifications', UserNotifications)
