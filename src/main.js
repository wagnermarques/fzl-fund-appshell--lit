import { html } from 'lit'
import './styles/theme.css'
import './webcomponents/home-view.js'
import { createAppShell } from './index.js'

createAppShell({
  mount: '#app',
  home: () => html`<home-view></home-view>`,
})
