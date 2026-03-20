import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/App.css'
import './styles/cras_ui_v2.css'
import './styles/fazenda_tokens.css'
import './styles/ui_nonnegotiable_lock.css'
import './styles/ux_polish_final.css'
import * as AppMod from './App'
import { RootErrorBoundary } from './components/RootErrorBoundary'

const AppComp = AppMod.default || AppMod.App

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <AppComp />
    </RootErrorBoundary>
  </React.StrictMode>
)
