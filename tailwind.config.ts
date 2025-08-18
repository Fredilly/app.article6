import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ChatGPT-inspired dark palette
        bg: '#343541',
        panel: '#40414F',
        panelElev: '#202123',
        border: '#565869',
        text: '#ECECF1',
        subtext: '#ACB1C9',
        accent: '#10A37F',
        'accent-2': '#2A8C63',
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
