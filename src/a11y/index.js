/**
 * fzl-fund-appshell--lit/a11y — recursos de acessibilidade portáteis.
 *
 * Sem lit, sem Material e sem constante de build: só DOM e CSS, para usar
 * em qualquer projeto web (Lit, React, Vue, HTML puro). O appshell é um
 * consumidor como outro qualquer (ver src/services/accessibility-service.js).
 *
 * - ./config.js       opções do app (fontes, temas, tamanhos) validadas
 * - ./preferences.js  escolhas do usuário: salvar e aplicar no <html>
 * - ./a11y.css        fontes, tamanho do texto, movimento reduzido,
 *                     .a11y-visually-hidden, .a11y-skip-link
 *                     (import 'fzl-fund-appshell--lit/a11y/styles.css')
 * - ./announce.js     mensagens de status para leitores de tela (4.1.3)
 * - ./focus.js        foco por script e título da página (2.4.1–2.4.3)
 * - ./contrast.js     razão de contraste da WCAG 2.x, para testes
 * - ./vite.js         plugin de build das fontes (entry ./a11y/vite)
 *
 * As cores dos temas ficam no CSS de quem usa: o valor de data-theme é
 * marcado aqui, mas os tokens dependem do design system de cada projeto.
 * Normas e o estado de cada critério: documentation/acessibilidade.org e
 * wcag.org.
 */
export { ACCESSIBILITY_DISABLED, FONTS, TEXT_SCALES, THEMES, resolveAccessibility } from './config.js'
export {
  TEXT_SCALE_PROPERTY,
  applyPreferences,
  createPreferences,
  readPreferences,
  sanitizePreferences,
} from './preferences.js'
export { announce } from './announce.js'
export { focusElement, setDocumentTitle } from './focus.js'
export { CONTRAST_MINIMUMS, contrastRatio, meetsContrast, relativeLuminance } from './contrast.js'
