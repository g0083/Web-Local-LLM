import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { getUserLanguage } from './services/history'
import { setLanguage } from './utils/i18n'

const init = async () => {
  const lang = await getUserLanguage();
  setLanguage(lang);

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
};

init();
