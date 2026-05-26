import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider } from 'convex/react'

import App from './App.tsx'
import './index.css'
import { convex } from './lib/convex'

const app = (
  <StrictMode>
    {convex ? (
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    ) : (
      <App />
    )}
  </StrictMode>
)

createRoot(document.getElementById('root')!).render(app)
