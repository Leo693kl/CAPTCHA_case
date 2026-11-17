import '@fontsource/golos-text/cyrillic-400.css';
import '@fontsource/golos-text/cyrillic-500.css';
import '@fontsource/golos-text/cyrillic-600.css';
import '@fontsource/ibm-plex-mono/cyrillic-400.css';
import '@fontsource/ibm-plex-mono/cyrillic-500.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
try { document.documentElement.dataset.theme = localStorage.getItem('decision-radar-theme') === 'light' ? 'light' : 'dark'; } catch { document.documentElement.dataset.theme = 'dark'; }
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
