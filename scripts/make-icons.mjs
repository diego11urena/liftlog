// Draws the Home Screen icons (ink background, orange barbell: DESIGN.md tokens --ink / --glow) with no dependencies.
// Run: node scripts/make-icons.mjs  → public/icon-512.png, icon-192.png, apple-touch-icon.png, icon.svg, favicon.svg
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const INK = [0x14, 0x16, 0x18], GLOW = [0xff, 0x6f, 0x31]
// barbell on a 512 grid: [x, y, w, h, radius]
const BAR = [[96, 176, 48, 160, 16], [368, 176, 48, 160, 16], [152, 208, 32, 96, 10], [328, 208, 32, 96, 10], [184, 240, 144, 32, 8]]

const inRound = (px, py, [x, y, w, h, r]) => {
  if (px < x || px > x + w || py < y || py > y + h) return false
  const cx = Math.min(Math.max(px, x + r), x + w - r), cy = Math.min(Math.max(py, y + r), y + h - r)
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r
}

function png(size) {
  const SS = 4, raw = Buffer.alloc(size * (size * 4 + 1))
  for (let j = 0; j < size; j++) {
    raw[j * (size * 4 + 1)] = 0
    for (let i = 0; i < size; i++) {
      let hit = 0
      for (let a = 0; a < SS; a++) for (let b = 0; b < SS; b++) {
        const px = ((i + (a + .5) / SS) / size) * 512, py = ((j + (b + .5) / SS) / size) * 512
        if (BAR.some((r) => inRound(px, py, r))) hit++
      }
      const t = hit / (SS * SS), o = j * (size * 4 + 1) + 1 + i * 4
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(INK[c] + (GLOW[c] - INK[c]) * t)
      raw[o + 3] = 255
    }
  }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// PNGs are full-bleed squares: iOS and maskable icons apply their own rounded mask
writeFileSync('public/icon-512.png', png(512))
writeFileSync('public/icon-192.png', png(192))
writeFileSync('public/apple-touch-icon.png', png(180))
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#141618"/><g fill="#FF6F31">${BAR.map(([x, y, w, h, r]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`).join('')}</g></svg>\n`
writeFileSync('public/icon.svg', svg)
writeFileSync('public/favicon.svg', svg)
