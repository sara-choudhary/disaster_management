/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        coastal: {
          powder: '#DCEAF3',
          lavender: '#E8E2EF',
          peach: '#F5E2D6',
          cream: '#FBF8F2',
          'cream-dark': '#F3EDE2',
          rose: '#C98F9B',
          mauve: '#AA96B5',
          cerulean: '#6D9EBA',
          sand: '#C9B69B',
          brown: '#8C7565',
          text: '#393640',
          'text-muted': '#746E79',
          border: '#E2D9D5',
          'border-dark': '#CDC2BC',
          safe: '#B8D6BE',
          'safe-text': '#2D5936',
          warning: '#E6CD8C',
          'warning-text': '#684F17',
          suspicious: '#DCA77C',
          'suspicious-text': '#613615',
          critical: '#CC858D',
          'critical-text': '#5E2229',
          neutral: '#A9BAC7',
          'neutral-text': '#264253',
        },
      },
      backgroundImage: {
        'coastal-gradient': 'linear-gradient(135deg, #DCEAF3 0%, #E8E2EF 50%, #F5E2D6 100%)',
        'coastal-card': 'linear-gradient(180deg, #FBF8F2 0%, #F6F1E8 100%)',
      },
      boxShadow: {
        'coastal-sm': '0 1px 3px rgba(57, 54, 64, 0.05)',
        'coastal-md': '0 4px 12px rgba(57, 54, 64, 0.06)',
        'coastal-lg': '0 8px 24px rgba(57, 54, 64, 0.08)',
      },
    },
  },
  plugins: [],
}
