/**
 * Opções de acessibilidade do app: quais fontes, temas e tamanhos de texto
 * o usuário pode escolher em Config > Acessibilidade, e o que vale antes de
 * ele escolher. Normas e referências por trás de cada opção:
 * documentation/acessibilidade.org.
 *
 * Módulo puro (sem DOM, sem lit) porque roda nos dois lados:
 * - no Vite (vite/preset.js), em *build* — só as fontes habilitadas entram
 *   no bundle e no precache do PWA;
 * - no navegador (accessibility-service.js), que recebe a config já
 *   resolvida pelo preset via __APPSHELL_ACCESSIBILITY__.
 */

/** Fontes opcionais. 'system' (a fonte do sistema) está sempre disponível
 *  e não aparece aqui. Só o subconjunto latin (cobre o português) e os
 *  pesos que o Material usa — 500 cai no 400 mais próximo na OpenDyslexic,
 *  que não tem 500. */
export const FONTS = {
  atkinson: {
    label: 'Atkinson Hyperlegible',
    family: "'Atkinson Hyperlegible Next'",
    package: '@fontsource/atkinson-hyperlegible-next',
    css: ['latin-400.css', 'latin-500.css', 'latin-700.css'],
  },
  opendyslexic: {
    label: 'OpenDyslexic',
    family: "'OpenDyslexic'",
    package: '@fontsource/opendyslexic',
    css: ['latin-400.css', 'latin-700.css'],
  },
}

/** Temas opcionais — o valor vira data-theme no <html> (ver theme.css).
 *  'system' (segue prefers-color-scheme e prefers-contrast) está sempre
 *  disponível e não aparece aqui. */
export const THEMES = {
  light: { label: 'Claro' },
  dark: { label: 'Escuro' },
  'high-contrast-light': { label: 'Alto contraste claro' },
  'high-contrast-dark': { label: 'Alto contraste escuro' },
}

/** Degraus de tamanho de texto (1 = 100%). Vão até 200%, o que a WCAG
 *  1.4.4 exige que funcione sem perda de conteúdo. */
export const TEXT_SCALES = [1, 1.25, 1.5, 1.75, 2]

const KNOWN_KEYS = ['fonts', 'themes', 'textScale', 'defaults']

/** Config desligada: sem fontes extras, sem tela de acessibilidade. */
export const ACCESSIBILITY_DISABLED = Object.freeze({
  enabled: false,
  fonts: [],
  themes: [],
  textScales: [1],
  defaults: { font: 'system', theme: 'system', textScale: 1 },
})

function fail(message) {
  throw new Error(`accessibility: ${message}`)
}

function checkList(value, known, field) {
  if (!Array.isArray(value)) fail(`"${field}" deve ser um array`)
  for (const item of value) {
    if (!(item in known)) {
      fail(`"${field}" não reconhece "${item}" (use ${Object.keys(known).map((k) => `"${k}"`).join(', ')})`)
    }
  }
  return [...new Set(value)]
}

/**
 * Valida a opção `accessibility` de appshell.config.js e devolve a forma
 * normalizada { enabled, fonts, themes, textScales, defaults }.
 *
 * Ausente = tudo ligado: acessibilidade opt-in acaba esquecida (mesmo
 * raciocínio do requireConsent: true do analytics). false desliga. Chave
 * desconhecida é erro — um "font" no lugar de "fonts" tem de quebrar o
 * build, não sumir em silêncio.
 */
export function resolveAccessibility(accessibility) {
  if (accessibility === false) return ACCESSIBILITY_DISABLED
  if (accessibility === undefined || accessibility === null || accessibility === true) accessibility = {}
  if (typeof accessibility !== 'object' || Array.isArray(accessibility)) {
    fail('deve ser um objeto, true ou false')
  }

  for (const key of Object.keys(accessibility)) {
    if (!KNOWN_KEYS.includes(key)) {
      fail(`opção desconhecida "${key}" (use ${KNOWN_KEYS.map((k) => `"${k}"`).join(', ')})`)
    }
  }

  const {
    fonts = Object.keys(FONTS),
    themes = Object.keys(THEMES),
    textScale = { min: 1, max: 2 },
    defaults = {},
  } = accessibility

  const resolvedFonts = checkList(fonts, FONTS, 'fonts')
  const resolvedThemes = checkList(themes, THEMES, 'themes')

  if (typeof textScale !== 'object' || textScale === null) fail('"textScale" deve ser { min, max }')
  const { min = 1, max = 2 } = textScale
  if (!TEXT_SCALES.includes(min) || !TEXT_SCALES.includes(max) || min > max) {
    fail(`"textScale" precisa de min <= max, cada um entre ${TEXT_SCALES.join(', ')}`)
  }
  const textScales = TEXT_SCALES.filter((s) => s >= min && s <= max)

  const { font = 'system', theme = 'system', textScale: defaultScale = textScales[0] } = defaults
  if (font !== 'system' && !resolvedFonts.includes(font)) {
    fail(`"defaults.font" deve ser "system" ou uma das "fonts" habilitadas, não "${font}"`)
  }
  if (theme !== 'system' && !resolvedThemes.includes(theme)) {
    fail(`"defaults.theme" deve ser "system" ou um dos "themes" habilitados, não "${theme}"`)
  }
  if (!textScales.includes(defaultScale)) {
    fail(`"defaults.textScale" deve ser um de ${textScales.join(', ')}`)
  }

  return {
    enabled: true,
    fonts: resolvedFonts,
    themes: resolvedThemes,
    textScales,
    defaults: { font, theme, textScale: defaultScale },
  }
}

/** Os imports de CSS das fontes habilitadas — conteúdo do módulo virtual
 *  'virtual:appshell-fonts' que o preset gera. */
export function fontImports(resolved) {
  return resolved.fonts.flatMap((id) => FONTS[id].css.map((file) => `${FONTS[id].package}/${file}`))
}
