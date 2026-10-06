/**
 * Plugin do Vite (roda no Node, em build) que gera um módulo virtual com o
 * @font-face só das fontes de acessibilidade habilitadas. Fonte desligada
 * não entra no bundle nem no precache do PWA.
 *
 *   // vite.config.js
 *   import { a11yFontsPlugin, resolveAccessibility } from 'fzl-fund-appshell--lit/a11y/vite'
 *   plugins: [a11yFontsPlugin(resolveAccessibility({ fonts: ['atkinson'] }))]
 *
 *   // main.js do app
 *   import 'virtual:a11y-fonts'
 *
 * Separado de ./index.js porque é código de build: não pode ir para o
 * bundle do navegador.
 */
import { fontImports } from './config.js'

export { resolveAccessibility } from './config.js'

export const A11Y_FONTS_MODULE = 'virtual:a11y-fonts'

/** Resolve cada import antes, para que um pacote @fontsource faltando dê
 *  um erro que diz o que instalar — em vez do "Failed to resolve import"
 *  genérico do Vite. */
export function a11yFontsPlugin(resolved, { id = A11Y_FONTS_MODULE } = {}) {
  const resolvedId = '\0' + id
  return {
    name: 'a11y-fonts',
    resolveId(source) {
      if (source === id) return resolvedId
    },
    async load(source) {
      if (source !== resolvedId) return
      const imports = fontImports(resolved)
      for (const spec of imports) {
        if (!(await this.resolve(spec))) {
          const pkg = spec.split('/').slice(0, 2).join('/')
          this.error(
            `a11y: a fonte habilitada em accessibility.fonts precisa do pacote ${pkg} — rode \`npm install ${pkg}\` ou tire a fonte de accessibility.fonts`,
          )
        }
      }
      return imports.map((spec) => `import '${spec}'`).join('\n') + '\n'
    },
  }
}
