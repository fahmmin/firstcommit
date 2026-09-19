import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { a11y } from './lib/a11y.js'
import './index.css'

a11y.apply()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
