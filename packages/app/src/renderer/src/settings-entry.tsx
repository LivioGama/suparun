import React from 'react'
import ReactDOM from 'react-dom/client'
import { SettingsView } from './components/SettingsView'
import './styles/globals.css'

const SettingsApp: React.FC = () => (
  <SettingsView onBack={() => window.close()} />
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>
)
