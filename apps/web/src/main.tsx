import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './index.css'
import App from './App'
import { AuthProvider } from '@/lib/auth'
import { TooltipProvider } from '@/components/primitives/tooltip'

/**
 * QueryClient — architecture §12.2 defaults:
 *   staleTime   5 min  — master data (clusters, vendors, etc.) rarely changes mid-session
 *   retry       1      — single retry on transient query errors; don't hammer
 *   retry (mut) 0      — never retry mutations; double-write is worse than one failure
 *
 * refetchOnWindowFocus is left at the TanStack default (true) here; slow-changing
 * master-data queries should set { refetchOnWindowFocus: false } at the per-query
 * level in Tasks C3–C9.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
})

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found in index.html')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <App />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
