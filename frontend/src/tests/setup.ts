import '@testing-library/jest-dom';

// Polyfill ResizeObserver for Vitest / JSDOM (needed for ReactFlow & Recharts)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
