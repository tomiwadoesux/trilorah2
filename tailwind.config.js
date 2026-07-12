/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Custom dark theme colors
        background: "#0a0a0a",
        surface: "#1a1a1a",
        primary: "#3b82f6", // Bright blue
        accent: "#f48244", // That specific orange you like
      },
    },
  },
  plugins: [],
};
