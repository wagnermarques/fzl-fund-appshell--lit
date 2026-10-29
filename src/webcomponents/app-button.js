import { LitElement, html, css } from 'lit'

export class FzlLitButton extends LitElement {
  static properties = {
    variant: { type: String, reflect: true },
    size: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
    type: { type: String, reflect: true },
  }

  static styles = css`
    :host {
      --_fzl-font-family: var(--fzl-font-family, var(--md-ref-typeface-plain, system-ui, sans-serif));
      --_fzl-color-primary: var(--fzl-color-primary, var(--md-sys-color-primary, #1d4ed8));
      --_fzl-color-primary-hover: var(--fzl-color-primary-hover, var(--md-sys-color-primary, #1e40af));
      --_fzl-color-primary-active: var(--fzl-color-primary-active, var(--md-sys-color-primary, #1e3a8a));
      --_fzl-color-primary-contrast: var(--fzl-color-primary-contrast, var(--md-sys-color-on-primary, #ffffff));
      --_fzl-color-secondary: var(--fzl-color-secondary, var(--md-sys-color-secondary, #475569));
      --_fzl-color-secondary-hover: var(--fzl-color-secondary-hover, var(--md-sys-color-secondary, #334155));
      --_fzl-color-secondary-active: var(--fzl-color-secondary-active, var(--md-sys-color-secondary, #1e293b));
      --_fzl-color-secondary-contrast: var(--fzl-color-secondary-contrast, var(--md-sys-color-on-secondary, #ffffff));
      --_fzl-color-danger: var(--fzl-color-danger, var(--md-sys-color-error, #b91c1c));
      --_fzl-color-danger-hover: var(--fzl-color-danger-hover, var(--md-sys-color-error, #991b1b));
      --_fzl-color-danger-contrast: var(--fzl-color-danger-contrast, var(--md-sys-color-on-error, #ffffff));
      --_fzl-color-disabled-bg: var(--fzl-color-disabled-bg, var(--md-sys-color-surface-variant, #e2e8f0));
      --_fzl-color-disabled-text: var(--fzl-color-disabled-text, var(--md-sys-color-outline, #94a3b8));
      --_fzl-focus-ring: var(--fzl-focus-ring, 0 0 0 3px rgba(103, 80, 164, 0.3));
      --_fzl-transition-fast: var(--fzl-transition-fast, 150ms cubic-bezier(0.4, 0, 0.2, 1));
      display: inline-block;
      vertical-align: middle;
    }

    button {
      font-family: var(--_fzl-font-family);
      font-weight: 500;
      line-height: 1.5;
      border: 1px solid transparent;
      border-radius: 0.375rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition:
        background-color var(--_fzl-transition-fast),
        border-color var(--_fzl-transition-fast),
        opacity var(--_fzl-transition-fast);
      user-select: none;
    }

    button:focus-visible {
      outline: none;
      box-shadow: var(--_fzl-focus-ring);
    }

    button.size-sm {
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
    }

    button.size-md {
      font-size: 0.875rem;
      padding: 0.5rem 1rem;
    }

    button.size-lg {
      font-size: 1rem;
      padding: 0.75rem 1.5rem;
    }

    button.variant-primary {
      background-color: var(--_fzl-color-primary);
      color: var(--_fzl-color-primary-contrast);
    }
    button.variant-primary:hover:not(:disabled) {
      background-color: var(--_fzl-color-primary-hover);
      opacity: 0.92;
    }

    button.variant-secondary {
      background-color: var(--_fzl-color-secondary);
      color: var(--_fzl-color-secondary-contrast);
    }
    button.variant-secondary:hover:not(:disabled) {
      background-color: var(--_fzl-color-secondary-hover);
      opacity: 0.92;
    }

    button.variant-danger {
      background-color: var(--_fzl-color-danger);
      color: var(--_fzl-color-danger-contrast);
    }
    button.variant-danger:hover:not(:disabled) {
      background-color: var(--_fzl-color-danger-hover);
      opacity: 0.92;
    }

    button:disabled {
      background-color: var(--_fzl-color-disabled-bg);
      color: var(--_fzl-color-disabled-text);
      cursor: not-allowed;
      border-color: transparent;
    }
  `

  constructor() {
    super()
    this.variant = 'primary'
    this.size = 'md'
    this.disabled = false
    this.type = 'button'
  }

  _handleClick(event) {
    if (this.disabled) {
      event.preventDefault()
      event.stopImmediatePropagation()
      return
    }
    this.dispatchEvent(
      new CustomEvent('fzl-click', {
        detail: { originalEvent: event },
        bubbles: true,
        composed: true,
      }),
    )
  }

  render() {
    return html`
      <button
        part="button"
        class="variant-${this.variant} size-${this.size}"
        .type=${this.type}
        ?disabled=${this.disabled}
        @click=${this._handleClick}
      >
        <slot></slot>
      </button>
    `
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('fzl-lit-button')) {
  customElements.define('fzl-lit-button', FzlLitButton)
}
