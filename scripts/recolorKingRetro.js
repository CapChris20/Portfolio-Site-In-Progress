import { NodeIO } from '@gltf-transform/core'
import sharp from 'sharp'
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const inputPath = process.argv[2] || join(rootDir, 'static/props/KingCar.source.glb')
const outputPath = process.argv[3] || join(rootDir, 'static/props/KingCar.glb')

// Same neon pink / magenta palette as recolorMcqueenNeon.js
const SHADOW = [ 96, 32, 96 ]
const MID = [ 192, 48, 160 ]
const HI = [ 255, 80, 160 ]
const BRIGHT = [ 255, 112, 224 ]

function lerp(a, b, t)
{
    return a + (b - a) * t
}

function lerpRgb(a, b, t)
{
    return [
        Math.round(lerp(a[0], b[0], t)),
        Math.round(lerp(a[1], b[1], t)),
        Math.round(lerp(a[2], b[2], t)),
    ]
}

function mcqueenNeonColor(lum)
{
    const t = Math.min(1, lum / 255)

    if(t < 0.22)
        return SHADOW

    if(t < 0.48)
        return lerpRgb(SHADOW, MID, (t - 0.22) / 0.26)

    if(t < 0.72)
        return lerpRgb(MID, HI, (t - 0.48) / 0.24)

    return lerpRgb(HI, BRIGHT, (t - 0.72) / 0.28)
}

function isBodyPaintPixel(r, g, b, a)
{
    if(a < 12)
        return false

    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    const sat = Math.max(r, g, b) - Math.min(r, g, b)

    if(lum < 28)
        return false

    if(lum > 235 && sat < 35)
        return false

    // King's stock blue body paint
    return b > r + 14 && b > g + 6
}

function recolorPixel(r, g, b, a)
{
    if(!isBodyPaintPixel(r, g, b, a))
        return [ r, g, b, a ]

    const lum = 0.299 * r + 0.587 * g + 0.114 * b

    return [ ...mcqueenNeonColor(lum), a ]
}

async function recolorTexture(texture)
{
    const source = Buffer.from(texture.getImage())
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

    for(let i = 0; i < data.length; i += 4)
    {
        const [ nr, ng, nb, na ] = recolorPixel(data[i], data[i + 1], data[i + 2], data[i + 3])
        data[i] = nr
        data[i + 1] = ng
        data[i + 2] = nb
        data[i + 3] = na
    }

    const encoded = await sharp(data, {
        raw: {
            width: info.width,
            height: info.height,
            channels: 4,
        },
    }).png().toBuffer()

    texture.setImage(encoded).setMimeType('image/png')
}

await mkdir(dirname(outputPath), { recursive: true })

if(outputPath === inputPath)
{
    try
    {
        await copyFile(inputPath, inputPath.replace(/\.glb$/, '.beforeNeon.glb'))
    }
    catch
    {
        // no existing file
    }
}

const io = new NodeIO()
const document = await io.read(inputPath)
const recoloredTextures = new Set()

for(const material of document.getRoot().listMaterials())
{
    const texture = material.getBaseColorTexture()

    if(!texture || recoloredTextures.has(texture))
        continue

    recoloredTextures.add(texture)
    await recolorTexture(texture)
}

await io.write(outputPath, document)

console.log(`McQueen-style King recolor → ${outputPath}`)
console.log(`  textures updated: ${recoloredTextures.size}`)
