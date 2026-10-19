/**
 * Coastal Pastel Design System Color Tokens
 * Shared constants across Tailwind, React Flow node/edge renderers, and Recharts.
 */
export const coastalColors = {
  // Base coastal pastels
  powderBlue: '#DCEAF3',
  paleLavender: '#E8E2EF',
  palePeach: '#F5E2D6',
  cream: '#FBF8F2',
  creamDark: '#F3EDE2',

  // Accent & theme tones
  dustyRose: '#C98F9B',
  mutedMauve: '#AA96B5',
  mutedCerulean: '#6D9EBA',
  sand: '#C9B69B',
  mountainBrown: '#8C7565',

  // Typography & Borders
  mainText: '#393640',
  secondaryText: '#746E79',
  border: '#E2D9D5',
  borderDark: '#CDC2BC',

  // Semantic Status Tones (Pastel)
  safe: '#B8D6BE',           // Active / Healthy (Muted Sage Green)
  safeText: '#2D5936',
  warning: '#E6CD8C',        // Degraded / Alert (Muted Amber/Sand)
  warningText: '#684F17',
  suspicious: '#DCA77C',     // High / Medical / Warning (Muted Terracotta)
  suspiciousText: '#613615',
  critical: '#CC858D',       // Critical SOS / Offline (Muted Dusty Crimson)
  criticalText: '#5E2229',
  neutral: '#A9BAC7',        // Routine / Passive (Muted Slate Cerulean)
  neutralText: '#264253',
} as const;

export type CoastalColorKey = keyof typeof coastalColors;
