import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { announce } from './announce.js'

/** O suficiente de um document para announce. */
function fakeDocument() {
  const body = { children: [], append: (el) => body.children.push(el) }
  return {
    body,
    createElement: () => {
      const el = { attrs: {}, style: {}, textContent: '' }
      el.setAttribute = (k, v) => (el.attrs[k] = v)
      return el
    },
  }
}

describe('announce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('cria as regiões uma vez só e anuncia na educada', async () => {
    const doc = fakeDocument()
    const done = announce('Sem conexão', { document: doc })
    announce('De novo', { document: doc })
    expect(doc.body.children.map((el) => el.attrs['aria-live'])).toEqual(['polite', 'assertive'])

    await vi.runAllTimersAsync()
    await done
    expect(doc.body.children[0].textContent).toBe('De novo')
    expect(doc.body.children[1].textContent).toBe('')
  })

  it('assertive usa a outra região', async () => {
    const doc = fakeDocument()
    announce('Sessão expirou', { assertive: true, document: doc })
    await vi.runAllTimersAsync()
    expect(doc.body.children[1].textContent).toBe('Sessão expirou')
  })

  it('a mesma mensagem duas vezes é anunciada de novo (esvazia antes)', async () => {
    const doc = fakeDocument()
    announce('Sem conexão', { document: doc })
    await vi.runAllTimersAsync()
    announce('Sem conexão', { document: doc })
    expect(doc.body.children[0].textContent).toBe('')
    await vi.runAllTimersAsync()
    expect(doc.body.children[0].textContent).toBe('Sem conexão')
  })

  it('sem document (SSR, Node) não quebra', async () => {
    await expect(announce('x', { document: undefined })).resolves.toBeUndefined()
  })
})
