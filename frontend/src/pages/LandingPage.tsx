import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="relative min-h-[82vh] flex flex-col justify-center items-center text-center px-4 py-20 sm:py-28 max-w-5xl mx-auto overflow-hidden">
      {/* Subtle Watermark Shield Outline */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none -z-10 overflow-hidden"
        aria-hidden="true"
      >
        <ShieldCheck
          strokeWidth={0.8}
          className="w-[420px] h-[420px] sm:w-[620px] sm:h-[620px] text-coastal-sand opacity-[0.14] transform -translate-y-4"
        />
      </div>

      {/* Hero Title */}
      <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-coastal-text tracking-tight leading-[1.12] max-w-4xl">
        Disaster-Resistant Emergency Communication Network with Priority Routing
      </h1>

      {/* Minimal Supporting Text */}
      <p className="mt-8 text-base sm:text-lg md:text-xl text-coastal-text-muted max-w-2xl leading-relaxed">
        Engineered for crisis environments where conventional internet infrastructure has collapsed.
        Decentralized communication, deterministic priority routing, and verified packet delivery for disaster recovery operations.
      </p>

      {/* One Prominent Clean Rectangular Action Button */}
      <div className="mt-12">
        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 bg-coastal-dusty-rose hover:bg-coastal-dusty-rose-dark active:scale-[0.99] text-white rounded-md font-semibold text-base tracking-wide shadow-coastal-md transition-all focus:outline-none focus:ring-2 focus:ring-coastal-dusty-rose focus:ring-offset-2 focus:ring-offset-coastal-cream cursor-pointer"
        >
          <span>Explore Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};
