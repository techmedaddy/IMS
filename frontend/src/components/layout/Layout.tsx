import React from 'react';
import { Shield, Activity, BarChart3, AlertCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/src/lib/utils';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', icon: Activity, path: '/' },
    { name: 'Incidents', icon: AlertCircle, path: '/incidents' },
    { name: 'Analytics', icon: BarChart3, path: '/analytics' },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 bg-brand-blue rounded flex items-center justify-center">
            <Shield className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-lg leading-none">SENTINEL</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Incident Management</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                location.pathname === item.path
                  ? "bg-brand-blue/10 text-brand-blue"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-slate-800" />
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-medium truncate">umarejazimam69</p>
              <p className="text-[10px] text-slate-500 truncate">System Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-slate-800 flex items-center px-8 bg-slate-900/10 shrink-0">
          <div className="flex-1 text-slate-400 text-xs font-mono">
            PATH: sentinel{location.pathname.split('/').join(' > ')}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">System Live</span>
            </div>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
}
