import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');
const dev = watch || process.env.BROCALY_DEV === '1';

/**
 * Electron's main process and preload script are bundled to CommonJS.
 * `express`, `zod` and the OpenAI SDK stay external so they are resolved
 * from node_modules at runtime — electron-builder ships them as prod deps.
 */
const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: dev ? 'inline' : false,
  minify: !dev,
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': JSON.stringify(dev ? 'development' : 'production'),
  },
  external: ['electron', 'express', 'zod', 'openai'],
};

const targets = [
  {
    ...shared,
    entryPoints: [path.join(rootDir, 'electron/main.ts')],
    outfile: path.join(rootDir, 'dist/main/main.cjs'),
  },
  {
    ...shared,
    entryPoints: [path.join(rootDir, 'electron/preload.ts')],
    outfile: path.join(rootDir, 'dist/main/preload.cjs'),
    external: ['electron'],
  },
];

if (watch) {
  const contexts = await Promise.all(targets.map((options) => esbuild.context(options)));
  await Promise.all(contexts.map((context) => context.watch()));
  console.log('[build-main] watching…');
} else {
  await Promise.all(targets.map((options) => esbuild.build(options)));
  console.log('[build-main] done');
}
