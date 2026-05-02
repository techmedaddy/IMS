import React from 'react';
import { Hexagon, Activity, BarChart3, AlertCircle, ChevronRight } from 'lucide-react';
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
        <Link to="/" className="p-5 flex items-center gap-3 hover:opacity-80 transition-opacity group" title="Return to Dashboard">
          <div className="relative w-8 h-8 flex items-center justify-center overflow-hidden rounded-md bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] shadow-inner">
            <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8 relative z-10" xmlns="http://www.w3.org/2000/svg">
              <style>
                {`
                  @keyframes bob {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(1.5px) rotate(-3deg); }
                  }
                  @keyframes row {
                    0%, 100% { transform: rotate(-25deg); }
                    50% { transform: rotate(25deg); }
                  }
                  @keyframes look {
                    0%, 100% { transform: translateX(0px); }
                    20% { transform: translateX(-2px); }
                    40% { transform: translateX(-2px); }
                    60% { transform: translateX(2px); }
                    80% { transform: translateX(2px); }
                  }
                  @keyframes wave {
                    0%, 100% { transform: translateX(0px); }
                    50% { transform: translateX(-8px); }
                  }
                  .boat-group { animation: bob 4s ease-in-out infinite; transform-origin: 16px 24px; }
                  .oar { animation: row 2s ease-in-out infinite; transform-origin: 16px 18px; }
                  .head { animation: look 6s ease-in-out infinite; }
                  .waves { animation: wave 5s linear infinite; }
                `}
              </style>
              
              {/* Background Glow */}
              <circle cx="16" cy="16" r="16" fill="url(#skyGrad)" opacity="0.3" />

              {/* Water Waves (Animated) */}
              <g className="waves">
                <path d="M-8 24 Q -4 22, 0 24 T 8 24 T 16 24 T 24 24 T 32 24 T 40 24 V 32 H -8 Z" fill="#4f46e5" opacity="0.4"/>
                <path d="M-8 26 Q -4 28, 0 26 T 8 26 T 16 26 T 24 26 T 32 26 T 40 26 V 32 H -8 Z" fill="#3730a3" opacity="0.6"/>
              </g>

              {/* Boat and Sailor (Animated) */}
              <g className="boat-group">
                {/* Oar Background */}
                <line x1="16" y1="18" x2="22" y2="26" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" className="oar" style={{ animationDelay: '-1s' }}/>
                
                {/* Boat Hull */}
                <path d="M 4 23 Q 16 29 28 23 L 26 21 Q 16 26 6 21 Z" fill="#818cf8"/>
                
                {/* Sailor Body */}
                <path d="M 13 22 L 14 16 Q 16 14 18 16 L 19 22 Z" fill="#c7d2fe"/>
                
                {/* Sailor Head (looking around) */}
                <circle cx="16" cy="12" r="2.5" fill="#ffffff" className="head"/>
                
                {/* Oar Foreground */}
                <line x1="16" y1="18" x2="10" y2="26" stroke="#e0e7ff" strokeWidth="1.5" strokeLinecap="round" className="oar"/>
              </g>

              <defs>
                <radialGradient id="skyGrad" cx="16" cy="16" r="16" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#818cf8" />
                  <stop offset="1" stopColor="transparent" />
                </radialGradient>
              </defs>
            </svg>
          </div>
          <div className="leading-none">
            <h1 className="font-bold tracking-tight text-[14px] bg-clip-text text-transparent bg-gradient-to-r from-white to-[var(--color-text-secondary)]">Sentinel</h1>
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5 tracking-wide">IMS Platform</p>
          </div>
        </Link>

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
            <Link to="/" className="text-[var(--color-text-ghost)] hover:text-[var(--color-text-secondary)] transition-colors">sentinel</Link>
            <ChevronRight className="w-3 h-3 text-[var(--color-text-ghost)]" />
            <Link 
              to={location.pathname} 
              onClick={(e) => {
                if (location.pathname === '/') {
                  e.preventDefault();
                  window.location.reload();
                }
              }} 
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {breadcrumb}
            </Link>
          </div>
          <Link to="/analytics" className="flex items-center gap-2 hover:bg-[var(--color-surface-hover)] px-2.5 py-1.5 rounded-md transition-colors cursor-pointer group">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-green)] live-dot" />
            <span className="text-[10px] text-[var(--color-text-tertiary)] tracking-wide group-hover:text-[var(--color-text-primary)] transition-colors">System Online</span>
          </Link>
        </header>
        
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}
