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
  dustyRose: '#9E4A59',
  dustyRoseDark: '#843B48',
  dustyRoseLight: '#C98F9B',
  mutedMauve: '#AA96B5',
  mutedCerulean: '#6D9EBA',
  cerulean: '#2E6F9E',
  ceruleanLight: '#6D9EBA',
  ceruleanDark: '#24597F',
  sand: '#C9B69B',
  mountainBrown: '#8C7565',
  warmOrange: '#C96D3B',

  // Typography & Borders
  mainText: '#393640',
  secondaryText: '#746E79',
  border: '#E2D9D5',
  borderDark: '#CDC2BC',

  // Semantic Status Tones (Pastel)
  safe: '#B8D6BE',           // Active / Healthy (Muted Sage Green)
  safeBorder: '#8BBF96',
  safeText: '#2D5936',
  warning: '#E6CD8C',        // Degraded / Alert (Muted Amber/Sand)
  warningBorder: '#D8B868',
  warningText: '#684F17',
  suspicious: '#DCA77C',     // High / Medical / Warning (Muted Terracotta)
  suspiciousText: '#613615',
  critical: '#CC858D',       // Critical SOS / Offline (Muted Dusty Crimson)
  criticalBorder: '#B86872',
  criticalText: '#5E2229',
  neutral: '#A9BAC7',        // Routine / Passive (Muted Slate Cerulean)
  neutralText: '#264253',
} as const;

export type CoastalColorKey = keyof typeof coastalColors;
