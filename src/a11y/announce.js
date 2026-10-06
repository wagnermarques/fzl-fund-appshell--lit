/**
 * Mensagens de status para leitores de tela (WCAG 4.1.3): anuncia sem
 * mover o foco, por uma região "live" visualmente escondida no fim do
 * <body>, compartilhada pelo app inteiro.
 *
 *   announce('Sem conexão')                       // educado: espera a fala atual
 *   announce('Sessão expirou', { assertive: true }) // interrompe — só para urgências
 *
 * Uma região só (por cortesia) e não uma por componente: leitores de tela
 * anunciam mudanças em regiões que já existiam no DOM, e regiões criadas
 * junto com a mensagem costumam ser ignoradas. Por isso a região é criada
 * vazia e o texto entra num tick seguinte.
 */

const VISUALLY_HIDDEN =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap'

const regions = new WeakMap()

function region(doc, assertive) {
  let pair = regions.get(doc)
  if (!pair) {
    pair = {}
    for (const politeness of ['polite', 'assertive']) {
      const el = doc.createElement('div')
      el.setAttribute('aria-live', politeness)
      el.setAttribute('aria-atomic', 'true')
      el.setAttribute('data-a11y-announcer', politeness)
      el.style.cssText = VISUALLY_HIDDEN
      doc.body.append(el)
      pair[politeness] = el
    }
    regions.set(doc, pair)
  }
  return assertive ? pair.assertive : pair.polite
}

/** Devolve uma Promise que resolve quando o texto já está na região. */
export function announce(message, { assertive = false, document: doc = globalThis.document } = {}) {
  if (!doc?.body || !message) return Promise.resolve()
  const el = region(doc, assertive)
  // Esvazia e preenche no tick seguinte: a mesma mensagem duas vezes
  // seguidas ("Sem conexão" ... "Sem conexão") também é anunciada.
  el.textContent = ''
  return new Promise((resolve) =>
    setTimeout(() => {
      el.textContent = message
      resolve()
    }, 50),
  )
}
