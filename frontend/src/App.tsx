import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard, ListTree, Tags, Leaf, FolderKanban, Menu
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from './components/ui/sheet';
import { Separator } from './components/ui/separator';
import { cn } from './lib-frontend/utils';

import { TaxonomyManager } from './components/taxonomy/TaxonomyManager';
import { PlantManager } from './components/plants/PlantManager';
import { PlantDetails } from './components/plants/PlantDetails';
import { CsvImportPage } from './components/plants/CsvImportPage';
import { CategoryManager } from './components/categories/CategoryManager';
import { ProjectManager } from './components/projects/ProjectManager';
import { ProjectDetails } from './components/projects/ProjectDetails';
import { ProjectPublicView } from './components/projects/ProjectPublicView';
import { Dashboard } from './components/common/Dashboard';
import { AlertProvider } from './contexts/AlertContext';
import { ConfirmProvider } from './contexts/ConfirmContext';

import './App.css';

const queryClient = new QueryClient();

const NAV_ITEMS = [
  { to: '/', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/taxonomy', label: 'Taxonomy', icon: ListTree },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/plants', label: 'Plants', icon: Leaf },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'hsl(var(--sidebar))' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <img
          src="/logo.svg"
          alt="Landschaft"
          className="w-9 h-9 shrink-0"
          style={{ filter: 'brightness(0) invert(1) opacity(0.90)' }}
        />
        <span className="text-white font-semibold text-base tracking-wide uppercase">
          Landschaft
        </span>
      </div>

      <Separator className="bg-white/10 mx-4" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white text-[hsl(var(--sidebar))]'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              )
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4">
        <p className="text-white/30 text-xs">Plants Database v1.0</p>
      </div>
    </div>
  );
}

function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 min-w-[240px] flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile: top bar + sheet drawer */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden relative flex items-center px-4 py-3 border-b border-border bg-white">

          {/* Left Menu Button */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="p-1 -m-1 rounded text-foreground hover:bg-muted">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0 border-none">
              <SidebarContent onClose={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          {/* Center Brand */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">

            <Link to="/">
              <img
                src="/logo.svg"
                alt="Landschaft"
                className="w-7 h-7"
                style={{
                  filter:
                    "brightness(0) saturate(100%) invert(18%) sepia(28%) saturate(1194%) hue-rotate(92deg) brightness(95%) contrast(90%)"
                }}
              />

            </Link>

            <Link to="/" className="font-medium text-base text-[#1F4D2E]">
              LANDSCHAFT
            </Link>
          </div>

        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/taxonomy" element={<TaxonomyManager />} />
              <Route path="/categories" element={<CategoryManager />} />
              <Route path="/plants" element={<PlantManager />} />
              <Route path="/plants/import" element={<CsvImportPage />} />
              <Route path="/plants/:id" element={<PlantDetails />} />
              <Route path="/projects" element={<ProjectManager />} />
              <Route path="/projects/:id" element={<ProjectDetails />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AlertProvider>
          <ConfirmProvider>
            <Routes>
              {/* Public share page — no sidebar or app chrome */}
              <Route path="/share/:token" element={<ProjectPublicView />} />
              {/* All other routes get the full app layout */}
              <Route path="/*" element={<Layout />} />
            </Routes>
          </ConfirmProvider>
        </AlertProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
