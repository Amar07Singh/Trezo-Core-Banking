/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#ECEAE3',        // Warm matte ecru/stone background
        card: '#FFFFFF',          // Pure white card background
        forest: '#2D4739',        // Deep forest pine green
        sage: '#5C7C68',          // Dusty sage/moss green
        sageLight: '#7B9B87',
        sageDark: '#445D4E',
        sageMuted: '#E2EAE4',
        mint: '#E4EFE7',          // Soft green pill badge background
        mintText: '#2E593E',      // Soft green pill badge text
        blush: '#FCE8E6',         // Soft pink/red pill badge background
        blushText: '#D14334',     // Soft pink/red pill badge text
        charcoal: '#191A19',      // Deep charcoal/almost black text
        muted: '#7E807A',         // Warm grey secondary text
        borderStone: '#E5E3DC',   // Subtle stone border
      },
      borderRadius: {
        '2xl': '20px',
        '3xl': '28px',
        '4xl': '32px',
      },
      fontFamily: {
        serif: ['"EB Garamond"', 'Garamond', 'Baskerville', 'Georgia', 'serif'],
        sans: ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['"EB Garamond"', 'Garamond', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
