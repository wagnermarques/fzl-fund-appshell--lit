/**
 * Foco e título da página — o que um app de página única (SPA) tem de
 * fazer à mão, porque o navegador só faz sozinho numa carga de página.
 */

/**
 * Move o foco para um elemento qualquer, mesmo que não seja focável por
 * natureza (um <main>, um <h1>): ganha tabindex="-1", que permite foco por
 * script sem entrar na ordem do Tab.
 *
 * Usos:
 * - link "Ir para o conteúdo" (WCAG 2.4.1), quando o destino está num
 *   shadow DOM e um href="#id" não o alcança;
 * - depois de trocar de rota (2.4.3), para o leitor de tela começar pela
 *   tela nova em vez de continuar onde o foco estava (ex.: num drawer que
 *   acabou de fechar).
 */
export function focusElement(el, { preventScroll = false } = {}) {
  if (!el) return false
  if (!el.hasAttribute('tabindex') && el.tabIndex < 0) el.setAttribute('tabindex', '-1')
  el.focus({ preventScroll })
  return el.getRootNode().activeElement === el
}

/**
 * Título da aba/janela (WCAG 2.4.2), do mais específico para o mais geral:
 * setDocumentTitle('Acessibilidade', 'Config', 'Ler-gislação')
 *   -> "Acessibilidade — Config — Ler-gislação". Partes vazias são omitidas.
 */
export function setDocumentTitle(...parts) {
  const title = parts.filter(Boolean).join(' — ')
  if (globalThis.document && title) globalThis.document.title = title
  return title
}
