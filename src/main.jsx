import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { applyTheme, getSavedTema } from './theme';
import './styles/index.css';

applyTheme(getSavedTema());

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    const pref = document.documentElement.getAttribute('data-tema-pref') || getSavedTema();
    if (pref === 'sistema') applyTheme('sistema');
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
