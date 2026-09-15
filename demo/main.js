import { html } from 'lit'
import '../src/styles/theme.css'
import './home-view.js'
import { createAppShell } from '../src/index.js'

createAppShell({
  mount: '#app',
  title: 'Fund Appshell',
  home: () => html`<home-view></home-view>`,
})
