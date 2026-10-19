import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Network, Route, Cpu } from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="relative overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[75vh] flex flex-col justify-center items-center text-center px-4 py-20 sm:py-28 max-w-5xl mx-auto">
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
          Delivering resilient decentralized communication, autonomous alternate routing, and deterministic packet delivery for disaster recovery operations.
        </p>

        {/* One Prominent Clean Rectangular Action Button */}
        <div className="mt-12">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-coastal-cerulean hover:bg-coastal-cerulean/90 text-white rounded-xl font-semibold text-base tracking-wide shadow-coastal-md transition-all duration-200 hover:shadow-coastal-lg hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-coastal-cerulean focus:ring-offset-2 focus:ring-offset-coastal-cream"
          >
            <span>Explore Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Natural Transition Section: Key Architecture Pillars */}
      <section className="pt-8 pb-16 border-t border-coastal-border/60 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-coastal-text-muted">
            Architecture Highlights
          </span>
          <h2 className="text-2xl font-bold text-coastal-text mt-1">
            Built for Zero-Infrastructure Resilience
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-6 shadow-coastal-sm">
            <div className="p-2.5 bg-coastal-powder text-coastal-cerulean rounded-xl w-fit mb-4">
              <Network className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-coastal-text mb-2">
              Decentralized Mesh Topology
            </h3>
            <p className="text-xs text-coastal-text-muted leading-relaxed">
              Ad-hoc peer nodes connect dynamically without reliance on centralized cell towers, fiber backbones, or public cloud providers.
            </p>
          </div>

          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-6 shadow-coastal-sm">
            <div className="p-2.5 bg-coastal-lavender text-coastal-mauve rounded-xl w-fit mb-4">
              <Route className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-coastal-text mb-2">
              Deterministic Priority Queues
            </h3>
            <p className="text-xs text-coastal-text-muted leading-relaxed">
              Dijkstra graph weighting preempts non-critical traffic, guaranteeing minimal latency routes for life-critical SOS and triage packets.
            </p>
          </div>

          <div className="bg-coastal-cream border border-coastal-border rounded-2xl p-6 shadow-coastal-sm">
            <div className="p-2.5 bg-coastal-peach text-coastal-brown rounded-xl w-fit mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-coastal-text mb-2">
              Autonomous Alternate Routing
            </h3>
            <p className="text-xs text-coastal-text-muted leading-relaxed">
              Continuous link degradation assessment automatically detours traffic around damaged, offline, or battery-exhausted repeaters.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
