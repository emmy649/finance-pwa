# Finance PWA — Fixes Applied
- Updated `postcss.config.js` to use `@tailwindcss/postcss` (Tailwind v4).
- Updated `src/index.css` to `@import "tailwindcss";`.
- Standardized `tailwind.config.js` content globs.
- Ensured `@tailwindcss/postcss` is in `devDependencies`.
- Ensured `recharts` is in `dependencies`.

## After extracting:
1) Open terminal in project folder:
   npm install

2) Start dev server:
   npm run dev

If you changed Node recently, delete `node_modules` and `package-lock.json` before `npm install`.
