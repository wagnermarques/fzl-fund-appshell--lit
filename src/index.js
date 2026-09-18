/**
 * API pública do appshell: um app consumidor importa só daqui (e de
 * ./styles/theme.css), sem tocar em src/webcomponents/ ou src/router.js
 * diretamente.
 */
import './webcomponents/md-imports.js'
import './webcomponents/app-shell.js'

export { createAppShell, validateConfig } from './create-app-shell.js'
export { href, navigate, pattern } from './router.js'
export { analyticsService, track } from './services/analytics-service.js'
export { consentService } from './services/consent-service.js'
export { authService, localProvider } from './services/auth-service.js'
