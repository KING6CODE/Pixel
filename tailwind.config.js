/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 500: "#ff7a45", 600: "#ff6a33" },
      },
      boxShadow: {
        soft: "0 8px 24px rgba(0,0,0,0.22)"
      }
    },
  },
  plugins: [],
};
