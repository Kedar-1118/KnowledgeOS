// apps/frontend/src/components/Layout.tsx
/**
 * Main layout wrapper — sidebar + main content area.
 * Used by all authenticated routes.
 */

import { Outlet } from 'react-router-dom';

import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <Sidebar />

      {/* Main content area — offset by sidebar width */}
      <main
        className="flex-1 ml-[240px] min-h-screen"
        style={{ backgroundColor: 'var(--color-background)' }}
      >
        <div className="p-6 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
