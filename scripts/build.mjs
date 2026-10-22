import { build as bundle } from 'esbuild';
import { build as viteBuild } from 'vite';
import { mkdir } from 'node:fs/promises';
export async function buildElectron() {
  await mkdir('dist-electron', { recursive: true });
  await Promise.all(['main', 'preload'].map(name => bundle({ entryPoints: [`electron/${name}.ts`], outfile: `dist-electron/${name}.cjs`, platform: 'node', target: 'node24', format: 'cjs', bundle: true, external: ['electron'], sourcemap: false })));
}
if (process.argv[1]?.endsWith('build.mjs')) {
  await Promise.all([buildElectron(), viteBuild()]);
  console.log('ClipBox production build complete.');
}
