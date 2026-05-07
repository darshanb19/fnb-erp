import { Routes, Route } from 'react-router-dom'
import ComponentsIndex from '@/dev/ComponentsIndex'

/**
 * App — top-level router for the F&B ERP production web app.
 *
 * Task C1 (DL-005 one-time copy-port): minimal routing — only the parity-check
 * `/_dev/components` route is registered. Production pages (MDM screens,
 * auth-gated routes) land in Task C3+ once real services from Arc (a) are wired.
 *
 * BrowserRouter wraps this tree from main.tsx (no QueryClientProvider or
 * AuthProvider yet — that's Task C2).
 */
export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="p-8 text-on-surface">
            <h1 className="text-xl font-semibold">F&amp;B ERP</h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              Production app — pages landing in Tasks C3+.
            </p>
          </div>
        }
      />
      <Route path="/_dev/components" element={<ComponentsIndex />} />
    </Routes>
  )
}
