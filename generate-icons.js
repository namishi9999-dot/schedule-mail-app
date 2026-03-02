/**
 * アイコンPNG生成スクリプト
 * 実行: node generate-icons.js
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// カレンダーアイコン SVG（青系 #4A90D9 + 白）
function generateSVG(size) {
  const pad = Math.round(size * 0.08);
  const r = Math.round(size * 0.18); // 角丸半径
  const headerH = Math.round(size * 0.28);
  const dotR = Math.round(size * 0.055);
  const cols = 3;
  const rows = 3;
  const gridX0 = Math.round(size * 0.18);
  const gridY0 = Math.round(size * 0.44);
  const cellW = Math.round((size - gridX0 * 2) / cols);
  const cellH = Math.round((size - gridY0 - Math.round(size * 0.08)) / rows);

  let dots = '';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = gridX0 + col * cellW + Math.round(cellW / 2);
      const cy = gridY0 + row * cellH + Math.round(cellH / 2);
      dots += `<circle cx="${cx}" cy="${cy}" r="${dotR}" fill="white" opacity="0.9"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="#4A90D9"/>
  <rect x="${pad}" y="${Math.round(size * 0.22)}" width="${size - pad * 2}" height="${size - Math.round(size * 0.22) - pad}" rx="${Math.round(r * 0.5)}" fill="white" opacity="0.15"/>
  <rect x="${pad}" y="${pad}" width="${size - pad * 2}" height="${headerH}" rx="${Math.round(r * 0.5)}" fill="white" opacity="0.25"/>
  <text x="${Math.round(size / 2)}" y="${Math.round(pad + headerH * 0.72)}" font-family="Arial,sans-serif" font-weight="bold" font-size="${Math.round(headerH * 0.58)}" fill="white" text-anchor="middle">CAL</text>
  ${dots}
</svg>`;
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function main() {
  console.log('アイコン生成中...');

  for (const size of sizes) {
    const svg = Buffer.from(generateSVG(size));
    const outPath = path.join(iconsDir, `icon-${size}.png`);
    await sharp(svg).png().toFile(outPath);
    console.log(`  生成: icon-${size}.png`);
  }

  // Apple Touch Icon (180x180)
  const svg180 = Buffer.from(generateSVG(180));
  const applePath = path.join(iconsDir, 'apple-touch-icon.png');
  await sharp(svg180).png().toFile(applePath);
  console.log('  生成: apple-touch-icon.png');

  console.log('アイコン生成完了！');
}

main().catch(console.error);
