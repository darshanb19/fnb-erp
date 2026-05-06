import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/shell/AppShell'
import ScreenIndex from '@/pages/ScreenIndex'
import ScreenStub from '@/pages/ScreenStub'
import ComponentsIndex from '@/dev/ComponentsIndex'

/**
 * App — top-level router for the Phase 2c-S2 mockup harness.
 *
 * Every route mounts inside `<AppShell />` so the cockpit sidebar +
 * surface-shift top bar stay constant across screens. `/_dev/components` is
 * the developer permutation viewer; `/:screenId` falls through to a
 * placeholder until the screen author lands a real implementation.
 */
export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<ScreenIndex />} />
        <Route path="/_dev/components" element={<ComponentsIndex />} />
        <Route path="/:screenId" element={<ScreenStub />} />
      </Route>
    </Routes>
  )
}
