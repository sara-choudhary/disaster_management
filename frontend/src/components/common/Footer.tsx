import React from 'react';
import { ShieldCheck, WifiOff } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900/60 border-t border-slate-800/80 py-4 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Zero-External-Dependency Resilient Ad-Hoc Mesh System</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <WifiOff className="w-3.5 h-3.5 text-amber-400" /> Offline-First Architecture
          </span>
          <span>FastAPI + SQLite + React TS</span>
        </div>
      </div>
    </footer>
  );
};
