import { afterEach, describe, expect, it, vi } from 'vitest'
import { focusElement, setDocumentTitle } from './focus.js'

/** O suficiente de um elemento para focusElement. */
function fakeElement({ tabIndex = -1, attrs = {} } = {}) {
  const root = { activeElement: null }
  const el = {
    tabIndex,
    attrs: { ...attrs },
    hasAttribute: (k) => k in el.attrs,
    setAttribute: (k, v) => (el.attrs[k] = v),
    focus: vi.fn(() => (root.activeElement = el)),
    getRootNode: () => root,
  }
  return el
}

describe('focusElement', () => {
  it('torna focável por script (tabindex -1) quem não é focável', () => {
    const main = fakeElement()
    expect(focusElement(main)).toBe(true)
    expect(main.attrs.tabindex).toBe('-1')
    expect(main.focus).toHaveBeenCalledWith({ preventScroll: false })
  })

  it('não mexe no tabindex de quem já é focável', () => {
    const button = fakeElement({ tabIndex: 0 })
    focusElement(button)
    expect(button.attrs).toEqual({})
  })

  it('sem elemento, não faz nada', () => {
    expect(focusElement(null)).toBe(false)
  })
})

describe('setDocumentTitle', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('junta do mais específico ao mais geral, omitindo partes vazias', () => {
    const doc = { title: '' }
    vi.stubGlobal('document', doc)
    expect(setDocumentTitle('Acessibilidade', '', 'Config', 'Ler-gislação')).toBe('Acessibilidade — Config — Ler-gislação')
    expect(doc.title).toBe('Acessibilidade — Config — Ler-gislação')
  })
})
