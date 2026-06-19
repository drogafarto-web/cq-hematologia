import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{tsx,ts,jsx,js}',
    './index.html',
  ],
  blocklist: [
    '[file:line]',
    '[path:linha]',
    '[test:free]',
    '[web:30]',
  ],
};

export default config;
