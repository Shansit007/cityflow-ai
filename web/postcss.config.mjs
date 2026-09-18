/**
 * PostCSS configuration.
 *
 * CityFlow AI uses Tailwind CSS v4, which is wired in through a single
 * PostCSS plugin. All design tokens live in `src/app/globals.css`.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
