import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Radio, Activity, Share2, Send, ShieldAlert } from 'lucide-react';
import { useHealth } from '../../hooks/useHealth';

export const Navbar: React.FC = () => {
  const { health } = useHealth(15000);

  const isHealthy = health?.status === 'ok';

  return (
    <header className="bg-coastal-cream/90 backdrop-blur-md border-b border-coastal-border sticky top-0 z-50 shadow-coastal-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <div className="p-2 bg-coastal-powder text-coastal-cerulean rounded-xl border border-coastal-border shadow-coastal-sm">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-coastal-text tracking-tight flex items-center gap-2">
                DisasterComm
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-coastal-lavender text-coastal-mauve border border-coastal-border">
                  Mesh Router
                </span>
              </span>
              <p className="text-xs text-coastal-text-muted hidden sm:block">
                Priority Routing & Emergency Network
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1.5 bg-coastal-cream-dark/60 p-1 rounded-xl border border-coastal-border">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-coastal-cerulean text-white shadow-coastal-sm'
                    : 'text-coastal-text-muted hover:bg-coastal-powder/60 hover:text-coastal-text'
                }`
              }
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/topology"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-coastal-cerulean text-white shadow-coastal-sm'
                    : 'text-coastal-text-muted hover:bg-coastal-powder/60 hover:text-coastal-text'
                }`
              }
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Mesh Topology</span>
            </NavLink>

            <NavLink
              to="/simulation"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-coastal-cerulean text-white shadow-coastal-sm'
                    : 'text-coastal-text-muted hover:bg-coastal-powder/60 hover:text-coastal-text'
                }`
              }
            >
              <Send className="w-3.5 h-3.5" />
              <span>Priority Router</span>
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                isHealthy
                  ? 'bg-coastal-safe/30 text-coastal-safe-text border-coastal-safe'
                  : 'bg-coastal-critical/20 text-coastal-critical-text border-coastal-critical'
              }`}
              title={`Database: ${health?.database ?? 'unknown'}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isHealthy ? 'bg-coastal-safe-text' : 'bg-coastal-critical'
                }`}
              />
              <span className="hidden md:inline">
                {isHealthy ? 'System Active' : 'Offline Mode'}
              </span>
            </div>
            {!isHealthy && (
              <span title="Backend connection issue">
                <ShieldAlert className="w-4 h-4 text-coastal-critical" />
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
