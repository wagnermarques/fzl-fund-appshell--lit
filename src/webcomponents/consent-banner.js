import { LitElement, html, css } from 'lit'
import { consentService } from '../services/consent-service.js'

/** Pede o consentimento para o analytics na primeira visita. Fica no fluxo
 *  da página, acima do rodapé (não flutua por cima do conteúdo), e
 *  "Recusar" tem o mesmo peso visual de "Aceitar": sob a LGPD, o
 *  consentimento só vale se recusar for tão fácil quanto aceitar. A escolha
 *  pode ser trocada depois em Config > Privacidade. */
export class ConsentBanner extends LitElement {
  static properties = {
    privacyUrl: {},
  }

  static styles = css`
    :host {
      display: block;
      border-top: 1px solid var(--md-sys-color-outline-variant);
      background: var(--md-sys-color-surface-container);
      color: var(--md-sys-color-on-surface);
    }
    .content {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 16px;
      max-width: 960px;
      margin: 0 auto;
      padding: 12px 16px;
    }
    p {
      flex: 1 1 320px;
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.4;
    }
    a {
      color: var(--md-sys-color-primary);
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }
  `

  render() {
    return html`
      <div class="content" role="region" aria-label="Consentimento de cookies">
        <p>
          Usamos o Google Analytics para entender como o app é usado — quais telas são abertas,
          sem nenhum dado seu de conta. Isso grava cookies no seu navegador. Você pode mudar de
          ideia a qualquer momento em Config › Privacidade.
          ${this.privacyUrl
            ? html`<a href=${this.privacyUrl} target="_blank" rel="noopener">Saiba mais</a>`
            : ''}
        </p>
        <div class="actions">
          <md-outlined-button @click=${() => consentService.set('denied')}>Recusar</md-outlined-button>
          <md-outlined-button @click=${() => consentService.set('granted')}>Aceitar</md-outlined-button>
        </div>
      </div>
    `
  }
}

customElements.define('consent-banner', ConsentBanner)
