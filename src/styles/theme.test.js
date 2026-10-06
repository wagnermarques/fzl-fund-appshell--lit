import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../a11y/contrast.js'

/** Os quatro temas de theme.css, como { tema: { papel: '#hex' } }. O
 *  bloco ":root {" sem data-theme é o claro. */
function themes() {
  const css = readFileSync(new URL('./theme.css', import.meta.url), 'utf8')
  const result = {}
  for (const [, , name, body] of css.matchAll(/^:root(\[data-theme='([\w-]+)'\])? \{([^}]*)\}/gm)) {
    const colors = Object.fromEntries(
      [...body.matchAll(/--md-sys-color-([\w-]+):\s*(#[0-9a-f]{3,6})/gi)].map(([, role, hex]) => [role, hex]),
    )
    if (Object.keys(colors).length) result[name ?? 'light'] = colors
  }
  return result
}

/** Cada "on-X" sobre "X", mais os pares que não seguem esse padrão. */
function textPairs(colors) {
  const pairs = Object.keys(colors)
    .filter((role) => role.startsWith('on-') && colors[role.slice(3)])
    .map((role) => [role, role.slice(3)])
  return [...pairs, ['inverse-on-surface', 'inverse-surface'], ['on-surface-variant', 'surface'], ['primary', 'surface']]
}

const MINIMUM = { light: 4.5, dark: 4.5, 'high-contrast-light': 7, 'high-contrast-dark': 7 }

describe('contraste dos temas (theme.css)', () => {
  const all = themes()

  it('os quatro temas existem', () => {
    expect(Object.keys(all).sort()).toEqual(Object.keys(MINIMUM).sort())
  })

  for (const [name, colors] of Object.entries(all)) {
    it(`${name}: texto >= ${MINIMUM[name]}:1 (1.4.3 / 1.4.6) e contorno >= 3:1 (1.4.11)`, () => {
      const failures = textPairs(colors)
        .map(([fg, bg]) => [fg, bg, contrastRatio(colors[fg], colors[bg])])
        .filter(([, , ratio]) => ratio < MINIMUM[name])
        .map(([fg, bg, ratio]) => `${fg} sobre ${bg}: ${ratio.toFixed(2)}`)
      expect(failures).toEqual([])
      expect(contrastRatio(colors.outline, colors.surface)).toBeGreaterThanOrEqual(3)
    })
  }
})
