import React from 'react'
import ReactDOM from 'react-dom/client'

// Core base styles
import './styles/App.css'

// Layout (sidebar + shell) for Fazenda/CRAS v2 UI
import './styles/cras_ui_v2.css'

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
