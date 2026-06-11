// 用源 PNG 一次性生成 Windows .ico 和 macOS .icns，内嵌多分辨率位图。
// 每次更新 translite-icon.png 后跑一次 `npm run build:icons` 再 commit。
const fs = require('node:fs');
const path = require('node:path');
const png2icons = require('png2icons');

const sourcePng = path.join(__dirname, '..', 'src', 'renderer', 'assets', 'translite-icon.png');
const outputDir = path.join(__dirname, '..', 'build');
const assetsDir = path.join(__dirname, '..', 'src', 'renderer', 'assets');

if (!fs.existsSync(sourcePng)) {
  console.error(`源图标不存在：${sourcePng}`);
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

const input = fs.readFileSync(sourcePng);
console.log(`读取源图标：${sourcePng}（${input.length} 字节）`);

const ico = png2icons.createICO(input, png2icons.BICUBIC, 0, false, true);
if (!ico) {
  console.error('生成 ICO 失败');
  process.exit(1);
}
const icoPath = path.join(outputDir, 'icon.ico');
fs.writeFileSync(icoPath, ico);
console.log(`写入 ${icoPath}（${ico.length} 字节）`);
const icoAssetPath = path.join(assetsDir, 'translite-icon.ico');
fs.writeFileSync(icoAssetPath, ico);
console.log(`写入 ${icoAssetPath}`);

const icns = png2icons.createICNS(input, png2icons.BICUBIC, 0);
if (!icns) {
  console.error('生成 ICNS 失败');
  process.exit(1);
}
const icnsPath = path.join(outputDir, 'icon.icns');
fs.writeFileSync(icnsPath, icns);
console.log(`写入 ${icnsPath}（${icns.length} 字节）`);
const icnsAssetPath = path.join(assetsDir, 'translite-icon.icns');
fs.writeFileSync(icnsAssetPath, icns);
console.log(`写入 ${icnsAssetPath}`);

const pngOut = path.join(outputDir, 'icon.png');
fs.copyFileSync(sourcePng, pngOut);
console.log(`复制 ${pngOut}`);

console.log('图标生成完成。');
