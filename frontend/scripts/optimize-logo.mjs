import sharp from 'sharp';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const input = 'src/assets/LOGO 2.png';
const output = 'public/logo-optimized.webp';

const dir = dirname(output);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const meta = await sharp(input).metadata();
console.log('Original:', meta.width, 'x', meta.height, '-', meta.format, (meta.size / 1024 / 1024).toFixed(2) + 'MB');

// Resize to 256px height (covers all logo sizes up to 72px @ 3.5x DPI)
await sharp(input)
  .resize({ height: 256, fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 85, effort: 6, lossless: false })
  .toFile(output);

const outMeta = await sharp(output).metadata();
console.log('Optimized:', outMeta.width, 'x', outMeta.height, '-', outMeta.format, (outMeta.size / 1024).toFixed(2) + 'KB');
