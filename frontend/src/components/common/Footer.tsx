import React from 'react';
import { ShieldCheck, WifiOff } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-coastal-cream/80 backdrop-blur-sm border-t border-coastal-border py-4 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-coastal-text-muted gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-coastal-cerulean" />
          <span>Zero-External-Dependency Resilient Ad-Hoc Mesh System</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <WifiOff className="w-3.5 h-3.5 text-coastal-sand" /> Offline-First Architecture
          </span>
          <span className="text-[11px] bg-coastal-powder px-2 py-0.5 rounded-full border border-coastal-border text-coastal-text">
            FastAPI + SQLite + React TS
          </span>
        </div>
      </div>
    </footer>
  );
};
