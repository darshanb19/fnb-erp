import { useState } from 'react'
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { BroadcastBanner } from '@/components/layout/BroadcastBanner'
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarInset,
  SidebarTrigger,
} from '@/components/primitives/sidebar'
import { TooltipProvider } from '@/components/primitives/tooltip'
import { Badge } from '@/components/primitives/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './Popover'
import { Button } from './Button'
import { ChevronDown, Wrench, UserCog, LogOut } from 'lucide-react'
import { personas, defaultPersona, type Persona } from '@/lib/personas'
import { screensByEpic, EPIC_ORDER, EPIC_LABELS } from '@/lib/screen-catalog'
import { SCREEN_ROUTES } from '@/lib/screen-routes'
import { useSession } from '@/lib/auth'

/**
 * AppShell — DESIGN.md §5.1.5 dark teal cockpit sidebar + §5.4 surface-shift
 * top bar + §5.4 main content surface. Plan §10 step 10.
 *
 * The shadcn sidebar primitive consumes the `sidebar-foreground`,
 * `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, and
 * `sidebar-ring` Tailwind utilities. Those are registered in index.css /
 * globals.css `@theme inline` (aliased onto the §5.1.5 cockpit palette) so the
 * utilities exist at build time — without that registration the sidebar text is
 * invisible (background renders via `bg-sidebar`, but the text utilities don't
 * exist and fall back to the dark default foreground). A runtime CSS-var bridge
 * cannot create Tailwind utilities, so the registration must live in the
 * stylesheet, not here.
 */

function PersonaSwitcher({
  current,
  onSelect,
}: {
  current: Persona
  onSelect: (p: Persona) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 h-10 px-3 hover:bg-surface-container-high"
        >
          <UserCog className="h-4 w-4" aria-hidden />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-sm font-medium text-on-surface">
              {current.name}
            </span>
            <span className="text-xs text-on-surface-variant">
              {current.role}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-on-surface-variant" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1">
        <ul className="flex flex-col">
          {personas.map((p) => {
            const active = p.id === current.id
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(p)
                    setOpen(false)
                  }}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex flex-col gap-0.5',
                    'hover:bg-surface-container-high transition-colors',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <span className="text-sm font-medium text-on-surface">
                    {p.name}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    {p.role} · {p.scopeLabel}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

export function AppShell() {
  const [persona, setPersona] = useState<Persona>(defaultPersona)
  const navigate = useNavigate()
  const location = useLocation()
  const { signOut } = useSession()

  const handlePersonaSelect = (p: Persona) => {
    setPersona(p)
    navigate(p.defaultRoute)
  }

  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider>
        <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 py-3">
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src="/logos/logo-nibble.png"
              alt="Wild Sugar"
              className="h-8 w-8 rounded-sm shrink-0 object-contain"
            />
            <span className="text-sm font-semibold text-on-sidebar group-data-[collapsible=icon]:hidden">
              Wild Sugar
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          {EPIC_ORDER.map((epic) => {
            // Only screens with a real, built route are navigable. Epics whose
            // screens are not yet built (PUR…RPT) render no group.
            const screens = screensByEpic[epic].filter((s) => SCREEN_ROUTES[s.id])
            if (screens.length === 0) return null
            return (
              <SidebarGroup key={epic}>
                <SidebarGroupLabel>{EPIC_LABELS[epic]}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {screens.map((s) => {
                      const route = SCREEN_ROUTES[s.id]
                      const isActive = location.pathname === route
                      return (
                        <SidebarMenuItem key={s.id}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={s.name}
                          >
                            <Link to={route}>
                              <span className="truncate">{s.name}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )
          })}
        </SidebarContent>

        <SidebarFooter className="px-2 py-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Developer view">
                <Link to="/_dev/components">
                  <Wrench aria-hidden />
                  <span>Developer view</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Sign out"
                onClick={() => {
                  void signOut()
                }}
              >
                <LogOut aria-hidden />
                <span>Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {/* Top bar: surface_container_low per §5.4 */}
        <header className="bg-surface-container-low h-14 flex items-center gap-3 px-4">
          <SidebarTrigger className="-ml-1" />
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img
              src="/logos/logo-full.png"
              alt="Wild Sugar"
              className="h-8 object-contain"
            />
          </Link>
          <div className="flex-1" />
          <Badge
            variant="secondary"
            className="bg-primary-container text-on-primary-container font-medium"
          >
            {persona.scopeLabel}
          </Badge>
          <PersonaSwitcher current={persona} onSelect={handlePersonaSelect} />
        </header>

        {/* Content surface — neutral page background per §5.1.3 */}
        <main className="flex-1 bg-surface text-on-surface min-h-[calc(100svh-3.5rem)]">
          {/* BroadcastBanner: layout-level mount — shows unacknowledged targeted broadcasts */}
          <BroadcastBanner />
          <Outlet />
        </main>
      </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
