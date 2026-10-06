/**
 * Razão de contraste pela fórmula da WCAG 2.x (luminância relativa) — a
 * que vale para declarar conformidade com a WCAG 2.2 e a NBR 17225. (O
 * APCA, proposto para a WCAG 3, ainda é rascunho.)
 *
 * Pensado para testes: conferir cada par de tokens de cada tema.
 *
 *   contrastRatio('#1d1b20', '#fffbfe')  // ~16.4
 *   meetsContrast('#79747e', '#fffbfe', 'non-text') // 1.4.11: >= 3
 */

/** Mínimos por critério: texto normal/grande (1.4.3 AA, 1.4.6 AAA) e
 *  componentes e gráficos (1.4.11 AA). Texto grande = >= 24px, ou >= 18,66px
 *  em negrito. */
export const CONTRAST_MINIMUMS = {
  AA: 4.5,
  'AA-large': 3,
  AAA: 7,
  'AAA-large': 4.5,
  'non-text': 3,
}

function parseHex(hex) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim())
  if (!match) throw new Error(`contraste: cor "${hex}" não está em #rgb ou #rrggbb`)
  let digits = match[1]
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join('')
  return [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16) / 255)
}

export function relativeLuminance(hex) {
  const [r, g, b] = parseHex(hex).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(foreground, background) {
  const [light, dark] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

export function meetsContrast(foreground, background, level = 'AA') {
  const minimum = CONTRAST_MINIMUMS[level]
  if (minimum === undefined) {
    throw new Error(`contraste: nível "${level}" desconhecido (use ${Object.keys(CONTRAST_MINIMUMS).join(', ')})`)
  }
  return contrastRatio(foreground, background) >= minimum
}
