import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0F14',
        panel: '#11161D',
        panelElev: '#141B23',
        border: '#1E2630',
        text: '#E6EDF6',
        subtext: '#9CB0C3',
        accent: '#35A0FF',
        'accent-2': '#6BE675',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
      },
      boxShadow: {
        soft: '0 6px 24px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
