import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="text-center py-24 space-y-4">
      <div className="inline-flex p-4 rounded-2xl bg-coastal-rose/20 text-coastal-rose border border-coastal-rose/30 shadow-coastal-sm">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-extrabold text-coastal-text">404 - Node Not Found</h1>
      <p className="text-sm text-coastal-text-muted max-w-md mx-auto">
        The communication sector you are attempting to reach does not exist in the routing table.
      </p>
      <div className="pt-2">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 bg-coastal-cerulean hover:bg-coastal-cerulean/90 text-white rounded-xl text-xs font-semibold shadow-coastal-sm transition-all"
        >
          <Home className="w-4 h-4" /> Return to Dashboard
        </Link>
      </div>
    </div>
  );
};
