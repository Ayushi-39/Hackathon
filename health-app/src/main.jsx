import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js' // Make sure this path is correct relative to main.jsx
import './index.css' // Ensure your Tailwind CSS import is here

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
