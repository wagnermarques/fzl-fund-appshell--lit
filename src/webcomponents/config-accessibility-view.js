import { LitElement, html, css } from 'lit'
import { FONTS, THEMES } from '../accessibility-config.js'
import { accessibilityService } from '../services/accessibility-service.js'

/** Config > Acessibilidade — tema (inclusive alto contraste), fonte e
 *  tamanho do texto. Só oferece o que o app habilitou no appshell.config.js;
 *  cada escolha vale na hora, em todo o app, e fica salva.
 *
 *  Grupos de rádio nativos da plataforma (fieldset/legend + md-radio dentro
 *  de <label>): leitores de tela anunciam "Tema, grupo, Claro, botão de
 *  opção, 2 de 5", as setas trocam a opção, e cada linha inteira é clicável
 *  com altura >= 48px (WCAG 2.5.8, e o 2.5.5 AAA de 44px). */
export class ConfigAccessibilityView extends LitElement {
  static properties = {
    _prefs: { state: true },
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
    fieldset {
      border: 0;
      margin: 0 0 24px;
      padding: 0;
    }
    legend {
      font-size: 1rem;
      font-weight: 700;
      padding: 0;
      margin-bottom: 4px;
    }
    .hint {
      margin: 0 0 8px;
      font-size: 0.85rem;
      color: var(--md-sys-color-on-surface-variant);
    }
    label {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 48px;
      cursor: pointer;
      font-size: 1rem;
    }
    .sizes {
      display: flex;
      flex-wrap: wrap;
      column-gap: 24px;
    }
    .sample {
      margin: 0 0 24px;
      padding: 16px;
      border: 1px solid var(--md-sys-color-outline);
      border-radius: 8px;
      background: var(--md-sys-color-surface-container);
      color: var(--md-sys-color-on-surface);
      line-height: 1.5;
    }
  `

  constructor() {
    super()
    this._prefs = accessibilityService.get()
  }

  connectedCallback() {
    super.connectedCallback()
    this._unsubscribe = accessibilityService.subscribe((prefs) => (this._prefs = prefs))
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._unsubscribe?.()
  }

  _group(field, legend, hint, options, { fontPreview = false } = {}) {
    return html`
      <fieldset>
        <legend>${legend}</legend>
        ${hint ? html`<p class="hint">${hint}</p>` : ''}
        ${options.map(
          ({ value, label }) => html`
            <label style=${fontPreview && value !== 'system' ? `font-family: ${FONTS[value].family}, system-ui` : ''}>
              <md-radio
                name=${field}
                .value=${String(value)}
                .checked=${this._prefs[field] === value}
                @change=${() => accessibilityService.set({ [field]: value })}
              ></md-radio>
              ${label}
            </label>
          `,
        )}
      </fieldset>
    `
  }

  render() {
    const { config } = accessibilityService
    const themes = [{ value: 'system', label: 'Sistema' }, ...config.themes.map((id) => ({ value: id, label: THEMES[id].label }))]
    const fonts = [{ value: 'system', label: 'Fonte do sistema' }, ...config.fonts.map((id) => ({ value: id, label: FONTS[id].label }))]
    const sizes = config.textScales.map((s) => ({ value: s, label: `${Math.round(s * 100)}%` }))

    return html`
      <p class="breadcrumb">Config &rsaquo; Acessibilidade</p>
      <h1>Acessibilidade</h1>
      <p class="hint">As escolhas valem na hora, em todo o app, e ficam salvas neste aparelho.</p>

      ${this._group(
        'theme',
        'Tema',
        'Os temas de alto contraste têm contraste de pelo menos 7:1 entre texto e fundo. "Sistema" segue o modo claro/escuro e o contraste configurados no seu aparelho.',
        themes,
      )}
      ${fonts.length > 1
        ? this._group(
            'font',
            'Fonte',
            'Atkinson Hyperlegible foi desenhada para leitores com baixa visão. OpenDyslexic é preferida por parte das pessoas com dislexia.',
            fonts,
            { fontPreview: true },
          )
        : ''}
      ${sizes.length > 1
        ? html`
            <fieldset>
              <legend>Tamanho do texto</legend>
              <div class="sizes">
                ${sizes.map(
                  ({ value, label }) => html`
                    <label>
                      <md-radio
                        name="textScale"
                        .value=${String(value)}
                        .checked=${this._prefs.textScale === value}
                        @change=${() => accessibilityService.set({ textScale: value })}
                      ></md-radio>
                      ${label}
                    </label>
                  `,
                )}
              </div>
            </fieldset>
          `
        : ''}

      <p class="sample">
        Luís argüia à Júlia que «brações, fé, chá, óxido, pôr, zângão» eram palavras do português.
        Il1 O0 rn m — 0123456789.
      </p>

      <md-outlined-button @click=${() => accessibilityService.reset()}>Restaurar padrões</md-outlined-button>
    `
  }
}

customElements.define('config-accessibility-view', ConfigAccessibilityView)
