import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/shell/AppShell'
import ScreenIndex from '@/pages/ScreenIndex'
import ScreenStub from '@/pages/ScreenStub'
import ComponentsIndex from '@/dev/ComponentsIndex'
import SiRpt002 from '@/screens/rpt/SI-RPT-002'
import SiRpt005 from '@/screens/rpt/SI-RPT-005'
import SiInf005 from '@/screens/inf/SI-INF-005'
import SiInf001 from '@/screens/inf/SI-INF-001'
import SiAcc003 from '@/screens/acc/SI-ACC-003'

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
        <Route path="/SI-RPT-002" element={<SiRpt002 />} />
        <Route path="/SI-RPT-005" element={<SiRpt005 />} />
        <Route path="/SI-INF-005" element={<SiInf005 />} />
        <Route path="/SI-INF-001" element={<SiInf001 />} />
        <Route path="/SI-ACC-003" element={<SiAcc003 />} />
        <Route path="/:screenId" element={<ScreenStub />} />
      </Route>
    </Routes>
  )
}
