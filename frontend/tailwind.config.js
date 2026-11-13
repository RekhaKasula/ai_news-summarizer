/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ["Georgia", "Cambria", "'Times New Roman'", "serif"],
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "'Segoe UI'", "Roboto", "sans-serif"],
      },
      colors: {
        ink: { 50: "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1", 500: "#64748b", 700: "#334155", 900: "#0f172a" },
        brand: { 50: "#fef2f2", 100: "#fee2e2", 600: "#dc2626", 700: "#b91c1c", 800: "#991b1b" },
      },
    },
  },
  plugins: [],
};
