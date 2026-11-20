import '@fontsource-variable/manrope';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
try { document.documentElement.dataset.theme = localStorage.getItem('decision-radar-theme') === 'light' ? 'light' : 'dark'; } catch { document.documentElement.dataset.theme = 'dark'; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
