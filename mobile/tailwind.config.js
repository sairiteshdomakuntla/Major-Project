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
        // Teal Focus design system
        primary: {
          DEFAULT: '#0F766E',
          pressed: '#115E59',
          tint: '#F0FDFA',
          'tint-border': '#CCFBF1',
        },
        'input-border-tint': '#99F6E4',
        background: '#F8FAFC',
        surface: '#FFFFFF',
        border: '#E5E7EB',
        'border-strong': '#D1D5DB',
        divider: '#F3F4F6',
        'text-primary': '#111827',
        'text-secondary': '#6B7280',
        success: { DEFAULT: '#166534', dot: '#16A34A' },
        warning: { DEFAULT: '#92400E', dot: '#D97706' },
        error: { DEFAULT: '#991B1B', dot: '#DC2626' },
      },
      borderRadius: {
        card: '14px',
        btn: '12px',
        input: '12px',
        fab: '16px',
        badge: '999px',
      },
      spacing: {
        'screen-px': '20px',
        'grid-gap': '12px',
        'card-px': '16px',
        'section-gap': '20px',
      },
      fontSize: {
        'screen-title': ['24px', { lineHeight: '30px', fontWeight: '600', letterSpacing: '-0.01em' }],
        'section-heading': ['16px', { lineHeight: '22px', fontWeight: '600' }],
        'metric-value': ['22px', { lineHeight: '28px', fontWeight: '600' }],
        body: ['14px', { lineHeight: '20px' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        secondary: ['13px', { lineHeight: '18px' }],
        caption: ['12px', { lineHeight: '16px' }],
        'caption-md': ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'tab-label': ['12px', { lineHeight: '16px' }],
        label: ['13px', { lineHeight: '18px', fontWeight: '500' }],
      },
    },
  },
  plugins: [],
};
