// Polyfill Buffer for @react-pdf/renderer (uses Node.js Buffer internally)
import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
