import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Share2,
  Sliders,
  Send,
  Cpu,
  ShieldAlert,
  FileText,
  X,
  Radio,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  to: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Overview', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Network Topology', to: '/topology', icon: Share2 },
  { name: 'Scenarios', to: '/scenarios', icon: Sliders },
  { name: 'Traffic & QoS', to: '/traffic', icon: Send },
  { name: 'Telemetry', to: '/telemetry', icon: Cpu },
  { name: 'Alerts & Events', to: '/alerts', icon: ShieldAlert },
  { name: 'Security Hub', to: '/security', icon: Radio },
  { name: 'Reports', to: '/reports', icon: FileText },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Close when pressing Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus / prevent scrolling when open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay (clicking closes the drawer) */}
      <div
        className="fixed inset-0 bg-coastal-text/25 backdrop-blur-xs z-50 transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer */}
      <aside
        id="app-sidebar"
        ref={sidebarRef}
        role="dialog"
        aria-label="Navigation Menu"
        aria-modal="true"
        className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-coastal-cream border-r border-coastal-border shadow-coastal-lg flex flex-col justify-between py-6 px-4 animate-in slide-in-from-left duration-200"
      >
        <div className="space-y-6">
          {/* Header inside drawer */}
          <div className="flex items-center justify-between pb-4 border-b border-coastal-border">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-coastal-powder text-coastal-cerulean rounded-lg border border-coastal-border">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-coastal-text block tracking-tight">
                  Emergency Mesh
                </span>
                <span className="text-[10px] text-coastal-text-muted block">
                  Priority Routing System
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="p-1.5 rounded-lg text-coastal-text-muted hover:text-coastal-text hover:bg-coastal-powder/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coastal-cerulean"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav aria-label="Main Navigation" className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group relative ${
                      isActive
                        ? 'bg-coastal-powder/60 text-coastal-cerulean font-semibold border-l-2 border-coastal-cerulean pl-3'
                        : 'text-coastal-text-muted hover:bg-coastal-powder/30 hover:text-coastal-text border-l-2 border-transparent pl-3'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0 transition-colors group-hover:text-coastal-cerulean" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Bottom System Info */}
        <div className="pt-4 border-t border-coastal-border text-[11px] text-coastal-text-muted">
          <p className="font-medium text-coastal-text">Offline-First Resilient Architecture</p>
          <p className="mt-0.5 text-[10px]">Zero Cloud Credentials • Local Mesh</p>
        </div>
      </aside>
    </>
  );
};
