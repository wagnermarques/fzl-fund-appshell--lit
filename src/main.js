import { html } from 'lit'
import './styles/theme.css'
import '../demo/home-view.js'
import { createAppShell } from './index.js'

createAppShell({
  mount: '#app',
  title: 'Fund Appshell',
  home: () => html`<home-view></home-view>`,
})
