import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="text-center py-24 space-y-4">
      <div className="inline-flex p-4 rounded-full bg-rose-950/40 text-rose-400 border border-rose-800">
        <AlertTriangle className="w-10 h-10" />
      </div>
      <h1 className="text-3xl font-extrabold text-white">404 - Node Not Found</h1>
      <p className="text-sm text-slate-400 max-w-md mx-auto">
        The communication sector you are attempting to reach does not exist in the routing table.
      </p>
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          <Home className="w-4 h-4" /> Return to Dashboard
        </Link>
      </div>
    </div>
  );
};
