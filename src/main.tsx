import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider } from 'convex/react'
import { createRouter, RouterProvider } from '@tanstack/react-router'

import './index.css'
import { convex } from './lib/convex'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const app = (
  <StrictMode>
    {convex ? (
      <ConvexProvider client={convex}>
        <RouterProvider router={router} />
      </ConvexProvider>
    ) : (
      <RouterProvider router={router} />
    )}
  </StrictMode>
)

createRoot(document.getElementById('root')!).render(app)
