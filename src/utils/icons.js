'use strict';
const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

const ICON_SIZES = [
  { name: 'favicon-16x16.png',  size: 16  },
  { name: 'favicon-32x32.png',  size: 32  },
  { name: 'favicon-48x48.png',  size: 48  },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-72x72.png',     size: 72  },
  { name: 'icon-96x96.png',     size: 96  },
  { name: 'icon-128x128.png',   size: 128 },
  { name: 'icon-144x144.png',   size: 144 },
  { name: 'icon-152x152.png',   size: 152 },
  { name: 'icon-192x192.png',   size: 192 },
  { name: 'icon-256x256.png',   size: 256 },
  { name: 'icon-384x384.png',   size: 384 },
  { name: 'icon-512x512.png',   size: 512 },
];

// ── CRC32 ─────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── ZIP builder (stored, no compression) ─────────────────────────────────
function buildZip(files) {
  const locals  = [], datas = [], central = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nb  = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const now = new Date();
    const dt  = ((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate();
    const tm  = (now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1);

    const lh = Buffer.alloc(30 + nb.length);
    lh.writeUInt32LE(0x04034B50,0); lh.writeUInt16LE(20,4);   lh.writeUInt16LE(0,6);
    lh.writeUInt16LE(0,8);          lh.writeUInt16LE(tm,10);   lh.writeUInt16LE(dt,12);
    lh.writeUInt32LE(crc,14);       lh.writeUInt32LE(data.length,18); lh.writeUInt32LE(data.length,22);
    lh.writeUInt16LE(nb.length,26); lh.writeUInt16LE(0,28);
    nb.copy(lh, 30);
    locals.push(lh); datas.push(data);

    const cd = Buffer.alloc(46 + nb.length);
    cd.writeUInt32LE(0x02014B50,0); cd.writeUInt16LE(20,4);  cd.writeUInt16LE(20,6);
    cd.writeUInt16LE(0,8);          cd.writeUInt16LE(0,10);  cd.writeUInt16LE(tm,12);
    cd.writeUInt16LE(dt,14);        cd.writeUInt32LE(crc,16); cd.writeUInt32LE(data.length,20);
    cd.writeUInt32LE(data.length,24); cd.writeUInt16LE(nb.length,28); cd.writeUInt16LE(0,30);
    cd.writeUInt16LE(0,32);         cd.writeUInt16LE(0,34);  cd.writeUInt16LE(0,36);
    cd.writeUInt32LE(0,38);         cd.writeUInt32LE(offset,42);
    nb.copy(cd, 46);
    central.push(cd);
    offset += lh.length + data.length;
  }

  const cdBuf = Buffer.concat(central);
  const eocd  = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054B50,0); eocd.writeUInt16LE(0,4);          eocd.writeUInt16LE(0,6);
  eocd.writeUInt16LE(files.length,8); eocd.writeUInt16LE(files.length,10);
  eocd.writeUInt32LE(cdBuf.length,12); eocd.writeUInt32LE(offset,16); eocd.writeUInt16LE(0,20);

  const parts = [];
  for (let i = 0; i < locals.length; i++) parts.push(locals[i], datas[i]);
  parts.push(cdBuf, eocd);
  return Buffer.concat(parts);
}

// ── ICO builder (embeds 16 and 32 px PNG data) ────────────────────────────
function buildIco(png16, png32) {
  const imgs = [{ s:16, d:png16 }, { s:32, d:png32 }];
  const hdr  = Buffer.alloc(6);
  hdr.writeUInt16LE(0,0); hdr.writeUInt16LE(1,2); hdr.writeUInt16LE(imgs.length,4);

  let imgOffset = 6 + 16 * imgs.length;
  const entries = imgs.map(({ s, d }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(s,0); e.writeUInt8(s,1); e.writeUInt8(0,2); e.writeUInt8(0,3);
    e.writeUInt16LE(1,4); e.writeUInt16LE(32,6);
    e.writeUInt32LE(d.length,8); e.writeUInt32LE(imgOffset,12);
    imgOffset += d.length;
    return e;
  });

  return Buffer.concat([hdr, ...entries, ...imgs.map(i=>i.d)]);
}

// ── Main export ───────────────────────────────────────────────────────────
async function generateIcons(srcPath, slug) {
  const dir = path.join(UPLOAD_DIR, 'icons', slug);
  fs.mkdirSync(dir, { recursive: true });

  const zipFiles = [];
  const dbIcons  = [];

  for (const { name, size } of ICON_SIZES) {
    const out = path.join(dir, name);
    await sharp(srcPath)
      .resize(size, size, { fit: 'contain', background: { r:0, g:0, b:0, alpha:0 } })
      .png()
      .toFile(out);
    zipFiles.push({ name, data: fs.readFileSync(out) });
    dbIcons.push({ name, url: `/uploads/icons/${slug}/${name}`, size });
  }

  // favicon.ico
  const ico = buildIco(
    fs.readFileSync(path.join(dir,'favicon-16x16.png')),
    fs.readFileSync(path.join(dir,'favicon-32x32.png'))
  );
  fs.writeFileSync(path.join(dir,'favicon.ico'), ico);
  zipFiles.push({ name: 'favicon.ico', data: ico });

  // manifest.json
  const manifest = {
    name: slug, short_name: slug, start_url: '/', display: 'standalone',
    icons: ICON_SIZES.filter(i=>i.size>=72).map(i=>({ src:`/icons/${i.name}`, sizes:`${i.size}x${i.size}`, type:'image/png' })),
  };
  const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir,'manifest.json'), manifestBuf);
  zipFiles.push({ name: 'manifest.json', data: manifestBuf });

  // README
  const readme = `# Icons for ${slug}\nGenerated by WAppStore\n\n## HTML\n\`\`\`html\n<link rel="icon" href="/favicon.ico">\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">\n<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">\n<link rel="manifest" href="/manifest.json">\n\`\`\`\n`;
  zipFiles.push({ name: 'README.md', data: Buffer.from(readme, 'utf8') });

  const zipPath = path.join(dir, 'icons.zip');
  fs.writeFileSync(zipPath, buildZip(zipFiles));

  return {
    icons:       dbIcons,
    zip_url:     `/uploads/icons/${slug}/icons.zip`,
    favicon_url: `/uploads/icons/${slug}/favicon.ico`,
  };
}

async function processScreenshot(srcPath, slug, filename) {
  const dir = path.join(UPLOAD_DIR, 'screenshots', slug);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, filename);
  await sharp(srcPath).resize(1280, null, { fit:'inside', withoutEnlargement:true }).jpeg({ quality:85 }).toFile(out);
  return `/uploads/screenshots/${slug}/${filename}`;
}

module.exports = { generateIcons, processScreenshot };
