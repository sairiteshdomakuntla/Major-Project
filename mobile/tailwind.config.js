/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './App.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // AgentBridge theme foundation
        background: '#0F172A',
        surface: '#1E293B',
        primary: '#38BDF8',
        onPrimary: '#0F172A',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
      },
      spacing: {
        // Use default Tailwind spacing scale; documented conventions:
        // xs=4, sm=8, md=16, lg=24, xl=32
      },
      borderRadius: {
        sm: 8,
        md: 12,
        lg: 16,
        xl: 24,
      },
    },
  },
  plugins: [],
};
