import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/shell/AppShell'
import ScreenIndex from '@/pages/ScreenIndex'
import ScreenStub from '@/pages/ScreenStub'
import ComponentsIndex from '@/dev/ComponentsIndex'
import SiRpt002 from '@/screens/rpt/SI-RPT-002'
import SiRpt005 from '@/screens/rpt/SI-RPT-005'
import SiRpt006 from '@/screens/rpt/SI-RPT-006'
import SiInf005 from '@/screens/inf/SI-INF-005'
import SiInf001 from '@/screens/inf/SI-INF-001'
import SiInf002 from '@/screens/inf/SI-INF-002'
import SiInf003 from '@/screens/inf/SI-INF-003'
import SiInf004 from '@/screens/inf/SI-INF-004'
import SiInf007 from '@/screens/inf/SI-INF-007'
import SiInf008 from '@/screens/inf/SI-INF-008'
import SiInf009 from '@/screens/inf/SI-INF-009'
import SiInv001 from '@/screens/inv/SI-INV-001'
import SiInv002 from '@/screens/inv/SI-INV-002'
import SiInv003 from '@/screens/inv/SI-INV-003'
import SiInv004 from '@/screens/inv/SI-INV-004'
import SiInv005 from '@/screens/inv/SI-INV-005'
import SiInv006 from '@/screens/inv/SI-INV-006'
import SiInv007 from '@/screens/inv/SI-INV-007'
import SiInv008 from '@/screens/inv/SI-INV-008'
import SiInv009 from '@/screens/inv/SI-INV-009'
import SiInv010 from '@/screens/inv/SI-INV-010'
import SiInv011 from '@/screens/inv/SI-INV-011'
import SiInv012 from '@/screens/inv/SI-INV-012'
import SiInv016 from '@/screens/inv/SI-INV-016'
import SiAcc003 from '@/screens/acc/SI-ACC-003'
import SiAcc010 from '@/screens/acc/SI-ACC-010'
import SiAcc013 from '@/screens/acc/SI-ACC-013'
import SiPur003 from '@/screens/pur/SI-PUR-003'
import SiMdm001 from '@/screens/mdm/SI-MDM-001'
import SiMdm002 from '@/screens/mdm/SI-MDM-002'
import SiMdm003 from '@/screens/mdm/SI-MDM-003'
import SiMdm004 from '@/screens/mdm/SI-MDM-004'
import SiMdm005 from '@/screens/mdm/SI-MDM-005'
import SiMdm006 from '@/screens/mdm/SI-MDM-006'
import SiMdm007 from '@/screens/mdm/SI-MDM-007'
import SiUsr001 from '@/screens/usr/SI-USR-001'
import SiUsr002 from '@/screens/usr/SI-USR-002'
import SiUsr003 from '@/screens/usr/SI-USR-003'
import SiUsr004 from '@/screens/usr/SI-USR-004'
import SiUsr005 from '@/screens/usr/SI-USR-005'
import SiUsr006 from '@/screens/usr/SI-USR-006'
import SiUsr007 from '@/screens/usr/SI-USR-007'
import SiUsr008 from '@/screens/usr/SI-USR-008'
import SiDsp010 from '@/screens/dsp/SI-DSP-010'
import SiPro011 from '@/screens/pro/SI-PRO-011'

/**
 * App — top-level router for the Phase 2c-S2 mockup harness.
 *
 * Every route mounts inside `<AppShell />` so the cockpit sidebar +
 * surface-shift top bar stay constant across screens. `/_dev/components` is
 * the developer permutation viewer; `/:screenId` falls through to a
 * placeholder until the screen author lands a real implementation.
 *
 * Per DL-030, `/SI-USR-008` (Brand Owner approval queue) is registered as a
 * route here but should NOT be added to the cockpit sidebar nav menu in
 * Arc (c) — single-tenant MVP has no Superadmin role-bearer in production,
 * so the actionable queue is always empty for the brand. The route exists
 * for platform-team Superadmin use and as the deep-link target from
 * SI-USR-002 when a Brand Owner self-creation is submitted.
 */
export default function App() {
  return (
    <Routes>
      {/*
       * Pre-auth surfaces — rendered OUTSIDE the AppShell. Login + password
       * reset are pre-authentication; the cockpit sidebar + persona switcher
       * only make sense for authenticated users (Phase 4 Epic 2 Arc (b)
       * Task B1 judgment call — Arc (c) wires real session-based gating).
       */}
      <Route path="/SI-USR-003" element={<SiUsr003 />} />
      <Route path="/SI-USR-004" element={<SiUsr004 />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<ScreenIndex />} />
        <Route path="/_dev/components" element={<ComponentsIndex />} />
        <Route path="/SI-RPT-002" element={<SiRpt002 />} />
        <Route path="/SI-RPT-005" element={<SiRpt005 />} />
        <Route path="/SI-RPT-006" element={<SiRpt006 />} />
        <Route path="/SI-INF-005" element={<SiInf005 />} />
        <Route path="/SI-INF-001" element={<SiInf001 />} />
        <Route path="/SI-INF-002" element={<SiInf002 />} />
        <Route path="/SI-INF-003" element={<SiInf003 />} />
        <Route path="/SI-INF-004" element={<SiInf004 />} />
        <Route path="/SI-INF-007" element={<SiInf007 />} />
        <Route path="/SI-INF-008" element={<SiInf008 />} />
        <Route path="/SI-INF-009" element={<SiInf009 />} />
        <Route path="/SI-INV-001" element={<SiInv001 />} />
        <Route path="/SI-INV-002" element={<SiInv002 />} />
        <Route path="/SI-INV-003" element={<SiInv003 />} />
        <Route path="/SI-INV-004" element={<SiInv004 />} />
        <Route path="/SI-INV-005" element={<SiInv005 />} />
        <Route path="/SI-INV-006" element={<SiInv006 />} />
        <Route path="/SI-INV-007" element={<SiInv007 />} />
        <Route path="/SI-INV-008" element={<SiInv008 />} />
        <Route path="/SI-INV-009" element={<SiInv009 />} />
        <Route path="/SI-INV-010" element={<SiInv010 />} />
        <Route path="/SI-INV-011" element={<SiInv011 />} />
        <Route path="/SI-INV-012" element={<SiInv012 />} />
        <Route path="/SI-INV-016" element={<SiInv016 />} />
        <Route path="/SI-ACC-003" element={<SiAcc003 />} />
        <Route path="/SI-ACC-010" element={<SiAcc010 />} />
        <Route path="/SI-ACC-013" element={<SiAcc013 />} />
        <Route path="/SI-PUR-003" element={<SiPur003 />} />
        <Route path="/SI-MDM-001" element={<SiMdm001 />} />
        <Route path="/SI-MDM-002" element={<SiMdm002 />} />
        <Route path="/SI-MDM-003" element={<SiMdm003 />} />
        <Route path="/SI-MDM-004" element={<SiMdm004 />} />
        <Route path="/SI-MDM-005" element={<SiMdm005 />} />
        <Route path="/SI-MDM-006" element={<SiMdm006 />} />
        <Route path="/SI-MDM-007" element={<SiMdm007 />} />
        <Route path="/SI-USR-001" element={<SiUsr001 />} />
        <Route path="/SI-USR-002" element={<SiUsr002 />} />
        <Route path="/SI-USR-005" element={<SiUsr005 />} />
        <Route path="/SI-USR-006" element={<SiUsr006 />} />
        <Route path="/SI-USR-007" element={<SiUsr007 />} />
        <Route path="/SI-USR-008" element={<SiUsr008 />} />
        <Route path="/SI-DSP-010" element={<SiDsp010 />} />
        <Route path="/SI-PRO-011" element={<SiPro011 />} />
        <Route path="/:screenId" element={<ScreenStub />} />
      </Route>
    </Routes>
  )
}
