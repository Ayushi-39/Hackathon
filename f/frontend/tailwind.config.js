/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Use 'Inter' as the primary font as specified in the React code
        inter: ['Inter', 'sans-serif'],
        // 'Poppins' can be added if you use it elsewhere, but 'Inter' is now default
        poppins: ['Poppins', 'sans-serif'],
      }
    },
  },
  plugins: [],
}