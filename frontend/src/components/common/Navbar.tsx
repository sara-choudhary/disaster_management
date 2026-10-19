import React from 'react';
import { NavLink } from 'react-router-dom';
import { Radio, Activity, Share2, Send, ShieldAlert } from 'lucide-react';
import { useHealth } from '../../hooks/useHealth';

export const Navbar: React.FC = () => {
  const { health } = useHealth(15000);

  const isHealthy = health?.status === 'ok';

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-600/20 text-red-500 rounded-lg border border-red-500/30">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight flex items-center gap-2">
                DisasterComm <span className="text-xs px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/50">Mesh Router</span>
              </span>
              <p className="text-xs text-slate-400 hidden sm:block">
                Priority Routing & Emergency Network
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Activity className="w-4 h-4" />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/topology"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Share2 className="w-4 h-4" />
              <span>Mesh Topology</span>
            </NavLink>

            <NavLink
              to="/simulation"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Send className="w-4 h-4" />
              <span>Priority Router</span>
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                isHealthy
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/50'
                  : 'bg-rose-950/60 text-rose-400 border-rose-700/50'
              }`}
              title={`Database: ${health?.database ?? 'unknown'}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isHealthy ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'
                }`}
              />
              <span className="hidden md:inline">
                {isHealthy ? 'Backend Connected' : 'Offline Mode'}
              </span>
            </div>
            {!isHealthy && (
              <span title="Backend connection issue">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
