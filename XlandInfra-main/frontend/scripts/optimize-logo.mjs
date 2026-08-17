import sharp from 'sharp';
import { existsSync, mkdirSync, statSync } from 'fs';
import { dirname } from 'path';

const input = 'src/assets/LOGO 2.png';
const outputWebp = 'public/logo.webp';
const outputPng = 'public/logo.png';

const dir = dirname(outputWebp);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const meta = await sharp(input).metadata();
console.log('Original:', meta.width, 'x', meta.height, '-', meta.format);

// Resize to 128px height (covers logo sizes up to 64px @ 2x DPI) - smaller for faster loading
await sharp(input)
  .resize({ height: 128, fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 80, effort: 6 })
  .toFile(outputWebp);

// Also create optimized PNG fallback
await sharp(input)
  .resize({ height: 128, fit: 'inside', withoutEnlargement: true })
  .png({ compressionLevel: 9, quality: 80 })
  .toFile(outputPng);

const webpSize = statSync(outputWebp).size;
const pngSize = statSync(outputPng).size;
console.log('WebP:', (webpSize / 1024).toFixed(2) + 'KB');
console.log('PNG:', (pngSize / 1024).toFixed(2) + 'KB');
