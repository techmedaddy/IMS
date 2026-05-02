import React from 'react';
import { Shield, Activity, BarChart3, AlertCircle, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/src/lib/utils';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', icon: Activity, path: '/' },
    { name: 'Incidents', icon: AlertCircle, path: '/incidents' },
    { name: 'Analytics', icon: BarChart3, path: '/analytics' },
  ];

  const breadcrumb = location.pathname === '/' 
    ? 'Overview' 
    : location.pathname.split('/').filter(Boolean).map(s => 
        s.length > 8 ? s.slice(0, 8) + '…' : s
      ).join(' / ');

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[220px] border-r border-[var(--color-border-default)] flex flex-col shrink-0 bg-[var(--color-surface-base)]">
        <div className="p-5 flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[var(--color-brand)] rounded-md flex items-center justify-center shadow-md shadow-[var(--color-brand)]/20">
            <Shield className="text-white w-4 h-4" />
          </div>
          <div className="leading-none">
            <h1 className="font-semibold tracking-tight text-[13px] text-[var(--color-text-primary)]">Sentinel</h1>
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 tracking-wide">IMS Platform</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.path === '/' 
              ? location.pathname === '/' 
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-[7px] rounded-md transition-all text-[13px] font-medium",
                  isActive
                    ? "bg-[var(--color-brand-muted)] text-[var(--color-brand-hover)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                )}
              >
                <item.icon className="w-[15px] h-[15px]" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-brand)] to-purple-500 flex items-center justify-center text-[9px] font-bold text-white">
              UE
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[11px] font-medium text-[var(--color-text-primary)] truncate">umarejazimam69</p>
              <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[var(--color-surface-base)]">
        <header className="h-11 border-b border-[var(--color-border-default)] flex items-center px-6 bg-[var(--color-surface-raised)]/50 shrink-0">
          <div className="flex-1 flex items-center gap-1.5 text-[var(--color-text-tertiary)] text-[11px]">
            <span className="text-[var(--color-text-ghost)]">sentinel</span>
            <ChevronRight className="w-3 h-3 text-[var(--color-text-ghost)]" />
            <span className="text-[var(--color-text-secondary)]">{breadcrumb}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-green)] live-dot" />
            <span className="text-[10px] text-[var(--color-text-tertiary)] tracking-wide">System Online</span>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}
