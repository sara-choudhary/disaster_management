import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Radio } from 'lucide-react';
import { useHealth } from '../../hooks/useHealth';
import { useNetworkEvents } from '../../context/NetworkEventContext';

interface HeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isSidebarOpen, onToggleSidebar }) => {
  const { health } = useHealth(15000);
  const isHealthy = health?.status === 'ok';
  const { isLive, connectionState } = useNetworkEvents();

  let wsDot = 'bg-coastal-text-muted';
  let wsLabel = 'Offline';

  if (isLive) {
    wsDot = 'bg-coastal-safe-text';
    wsLabel = 'Live Feed Active';
  } else if (connectionState === 'POLLING_FALLBACK') {
    wsDot = 'bg-coastal-warning-text';
    wsLabel = 'Polling Fallback';
  } else if (connectionState === 'RECONNECTING' || connectionState === 'CONNECTING') {
    wsDot = 'bg-coastal-mauve';
    wsLabel = 'Reconnecting...';
  }

  return (
    <header className="bg-coastal-cream/90 backdrop-blur-md border-b border-coastal-border sticky top-0 z-40 h-14 shadow-coastal-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex items-center justify-between h-full">
          {/* Left: Hamburger button + Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label="Toggle Navigation Menu"
              aria-expanded={isSidebarOpen}
              aria-controls="app-sidebar"
              className="p-2 rounded-xl text-coastal-text hover:bg-coastal-powder/60 border border-transparent hover:border-coastal-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coastal-cerulean"
            >
              {isSidebarOpen ? (
                <X className="w-5 h-5 text-coastal-text" />
              ) : (
                <Menu className="w-5 h-5 text-coastal-text" />
              )}
            </button>

            <Link
              to="/"
              className="flex items-center gap-2.5 text-coastal-text font-bold text-base tracking-tight hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coastal-cerulean rounded-lg"
            >
              <div className="p-1.5 bg-coastal-powder text-coastal-cerulean rounded-lg border border-coastal-border">
                <Radio className="w-4 h-4" />
              </div>
              <span className="hidden sm:inline">Disaster-Resistant Network</span>
              <span className="sm:hidden">DisasterComm</span>
            </Link>
          </div>

          {/* Right: Plain text status with small indicator (no excessive badges) */}
          <div className="flex items-center gap-4 text-xs text-coastal-text-muted">
            {/* Real-time WebSocket / Polling Connection Indicator */}
            <div className="inline-flex items-center gap-1.5 font-medium" data-testid="live-status-indicator">
              <span className={`w-2 h-2 rounded-full ${wsDot}`} aria-hidden="true" />
              <span className="font-medium text-coastal-text">{wsLabel}</span>
            </div>

            <span className="text-coastal-border hidden sm:inline">|</span>

            {/* System Health */}
            <div className="inline-flex items-center gap-1.5 font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  isHealthy ? 'bg-coastal-safe-text' : 'bg-coastal-critical'
                }`}
                aria-hidden="true"
              />
              <span className="font-medium text-coastal-text">
                {isHealthy ? 'System Active' : 'System Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
