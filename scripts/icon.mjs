import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
const png = await sharp('assets/icon.svg').resize(256, 256).png().toBuffer();
await writeFile('assets/icon.png', png);
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
await writeFile('assets/icon.ico', Buffer.concat([header, png]));
const chunks = [];
for (const [tag, size] of [['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024]]) {
  const data = await sharp('assets/icon.svg').resize(size, size).png().toBuffer();
  const chunk = Buffer.alloc(8); chunk.write(tag); chunk.writeUInt32BE(data.length + 8, 4);
  chunks.push(chunk, data);
}
const icns = Buffer.concat(chunks); const icnsHeader = Buffer.alloc(8);
icnsHeader.write('icns'); icnsHeader.writeUInt32BE(icns.length + 8, 4);
await writeFile('assets/icon.icns', Buffer.concat([icnsHeader, icns]));
await mkdir('assets/linux', { recursive: true });
for (const size of [16, 32, 48, 64, 128, 256, 512]) await sharp('assets/icon.svg').resize(size, size).png().toFile(`assets/linux/${size}x${size}.png`);
const tray = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16 3H6a2 2 0 0 0-2 2v13M9 7h11v14H9zM12 11h5M12 14h5M12 17h3" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
await sharp(tray).resize(22, 22).png().toFile('assets/trayTemplate.png');
await sharp(tray).resize(44, 44).png().toFile('assets/trayTemplate@2x.png');
