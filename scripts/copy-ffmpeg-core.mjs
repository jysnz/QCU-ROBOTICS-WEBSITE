import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const srcDir = join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
const destDir = join(root, 'public', 'ffmpeg');
const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

if (!existsSync(srcDir)) {
  console.warn('[ffmpeg] @ffmpeg/core not found, skipping copy');
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });

for (const file of files) {
  copyFileSync(join(srcDir, file), join(destDir, file));
}

console.log('[ffmpeg] copied ffmpeg-core (esm) into public/ffmpeg');
