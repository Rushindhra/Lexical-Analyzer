import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import LexicalAnalyzer from './LexicalAnalyzer.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LexicalAnalyzer />
  </StrictMode>,
)
