#!/usr/bin/env node
// Regenerates <out>/*.png from <svg> (the app's brand mark). Exposed as the
// `appshell-generate-icons` bin: an app that uses this appshell as a
// dependency runs `npx appshell-generate-icons` from its own root — icons
// are always the app's, never the shell's (same reasoning as public/).
//
// Usage: appshell-generate-icons [--svg <path>] [--out <dir>]
// Paths are resolved relative to the current working directory; the
// defaults assume the common public/favicon.svg -> public/icons/ layout.
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

function parseArgs(argv) {
  const args = { svg: 'public/favicon.svg', out: 'public/icons' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--svg') args.svg = argv[++i]
    else if (argv[i] === '--out') args.out = argv[++i]
  }
  return args
}

const { svg, out } = parseArgs(process.argv.slice(2))
const SVG = resolve(process.cwd(), svg)
const OUT_DIR = `${resolve(process.cwd(), out)}/`
const BG = '#fffbfe' // matches manifest.background_color no vite.config.js do app

// "any"-purpose icons: sizes covering Android/Chrome, Apple touch icon (180)
// and Windows tiles, flattened onto the app's surface color so launchers
// never show a transparent hole behind the mark.
const SIZES = [48, 72, 96, 128, 144, 152, 180, 192, 384, 512]

async function renderOnBg(size, markRatio, fileName) {
  const mark = await sharp(SVG, { density: 384 })
    .resize(Math.round(size * markRatio), Math.round(size * markRatio), {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer()

  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(`${OUT_DIR}${fileName}`)
}

await mkdir(OUT_DIR, { recursive: true })

await Promise.all(SIZES.map((size) => renderOnBg(size, 0.72, `icon-${size}.png`)))

// Maskable icon: OS masks (circle/squircle) can crop up to ~10% per edge, so
// the mark must stay inside the inner ~60% safe zone.
await renderOnBg(512, 0.6, 'icon-512-maskable.png')

console.log(`Icons written to ${OUT_DIR}`)
