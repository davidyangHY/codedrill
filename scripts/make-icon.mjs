// Renders assets/icon.svg into build/icon.ico (multi-size) and build/icon.png.
import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'assets', 'icon.svg'));

function renderPng(size) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  return r.render().asPng();
}

const buildDir = path.join(root, 'build');
fs.mkdirSync(buildDir, { recursive: true });

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = sizes.map(renderPng);

fs.writeFileSync(path.join(buildDir, 'icon.png'), renderPng(512));
const ico = await pngToIco(pngs);
fs.writeFileSync(path.join(buildDir, 'icon.ico'), ico);

console.log('Wrote build/icon.ico (' + ico.length + ' bytes) and build/icon.png');
