import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcSvg = path.join(__dirname, 'icon-source.svg');
const outDir = path.join(__dirname, '..', 'public', 'icons');

mkdirSync(outDir, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
];

for (const { file, size } of targets) {
  await sharp(srcSvg)
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, file));
  console.log(`wrote public/icons/${file} (${size}x${size})`);
}
