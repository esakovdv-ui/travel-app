// Генерация og-travel.jpg (1200×630) из фирменного логотипа и палитры сайта.
import sharp from 'sharp';
import { readFileSync } from 'fs';

const ROOT = process.cwd();
const W = 1200, H = 630;

const BEIGE = '#f5f1e8';
const TEXT = '#14142b';
const RED = '#e8272a';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${BEIGE}"/>
  <circle cx="${W - 90}" cy="${H - 70}" r="230" fill="${RED}" opacity="0.06"/>
  <circle cx="70" cy="80" r="150" fill="${TEXT}" opacity="0.04"/>
  <text x="90" y="330" font-family="Helvetica, Arial, sans-serif" font-size="76"
        font-weight="700" fill="${TEXT}">Мои путешествия</text>
  <text x="90" y="405" font-family="Helvetica, Arial, sans-serif" font-size="34"
        fill="${TEXT}" opacity="0.62">Тёплые страны, северные направления</text>
  <text x="90" y="452" font-family="Helvetica, Arial, sans-serif" font-size="34"
        fill="${TEXT}" opacity="0.62">и активные маршруты — в одном поиске</text>
  <rect x="90" y="510" width="120" height="8" rx="4" fill="${RED}"/>
</svg>`;

const logo = await sharp(readFileSync(`${ROOT}/public/logo-moi-puteshestviya@4x.png`))
  .resize({ width: 180 })
  .toBuffer();

await sharp(Buffer.from(svg))
  .composite([{ input: logo, top: 120, left: 90 }])
  .jpeg({ quality: 88 })
  .toFile(`${ROOT}/public/og-travel.jpg`);

const meta = await sharp(`${ROOT}/public/og-travel.jpg`).metadata();
console.log(`готово: ${meta.width}×${meta.height}, ${meta.format}`);
