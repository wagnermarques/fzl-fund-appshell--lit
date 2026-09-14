import { LitElement, html, css } from 'lit'

/** Versão do app (de package.json, injetada em build por vite.config.js) —
 *  útil para saber, ao dar suporte a alguém, exatamente qual versão do PWA
 *  está instalada no dispositivo (PWAs cacheiam agressivamente, então nem
 *  sempre "o de sempre" é a última build). */
export class AppVersion extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      opacity: 0.8;
    }
  `

  render() {
    return html`<span title="Versão do app">v${__APP_VERSION__}</span>`
  }
}

customElements.define('app-version', AppVersion)
