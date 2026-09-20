/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mox: {
          bg: '#0B1220',
          card: '#111A2B',
          raised: '#16223A',
          border: '#22304A',
          text: '#E6EBF5',
          muted: '#93A0B8',
          teal: '#2BB6A3',
          'teal-hover': '#35C9B5',
          // Light theme
          'light-bg': '#F4F6F9',
          'light-card': '#FFFFFF',
          'light-raised': '#EAEFF6',
          'light-border': '#D0D9E5',
          'light-text': '#0F172A',
          'light-muted': '#5A6A85',
        },
        severity: {
          p1: '#F0504A',
          p2: '#F59E0B',
          p3: '#E0C14B',
          p4: '#4CB782',
        }
      }
    },
  },
  plugins: [],
}
