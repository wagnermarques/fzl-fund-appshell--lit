/**
 * API pública do appshell: um app consumidor importa só daqui (e de
 * ./styles/theme.css), sem tocar em src/webcomponents/ ou src/router.js
 * diretamente.
 */
// Os @font-face das fontes de acessibilidade que o app habilitou (gerado
// pelo preset do Vite a partir do appshell.config.js).
import 'virtual:appshell-fonts'
import { accessibilityService } from './services/accessibility-service.js'
import './webcomponents/md-imports.js'
import './webcomponents/app-shell.js'

// Antes de qualquer componente renderizar: tema, fonte e tamanho de texto
// salvos já valem no primeiro quadro, sem piscar no tema padrão.
accessibilityService.apply()

export { createAppShell, validateConfig } from './create-app-shell.js'
export { href, navigate, pattern } from './router.js'
export { analyticsService, track } from './services/analytics-service.js'
export { consentService } from './services/consent-service.js'
export { accessibilityService }
export { authService, localProvider } from './services/auth-service.js'
