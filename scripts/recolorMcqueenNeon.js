import { NodeIO } from '@gltf-transform/core'
import sharp from 'sharp'
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const inputPath = process.argv[2] || join(rootDir, 'static/vehicle/lightningMcqueen.glb')
const outputPath = process.argv[3] || inputPath

const BODY_MATERIAL_PATTERN = /body/i

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

function recolorPixel(r, g, b, a)
{
    if(a < 12)
        return [ r, g, b, a ]

    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    const sat = Math.max(r, g, b) - Math.min(r, g, b)

    if(lum < 28)
        return [ r, g, b, a ]

    if(lum > 235 && sat < 35)
        return [ r, g, b, a ]

    // McQueen red paint → neon pink / magenta
    if(r > g + 18 && r > b + 8)
    {
        const t = Math.min(1, lum / 255)
        let color

        if(t < 0.22)
            color = SHADOW
        else if(t < 0.48)
            color = lerpRgb(SHADOW, MID, (t - 0.22) / 0.26)
        else if(t < 0.72)
            color = lerpRgb(MID, HI, (t - 0.48) / 0.24)
        else
            color = lerpRgb(HI, BRIGHT, (t - 0.72) / 0.28)

        return [ ...color, a ]
    }

    return [ r, g, b, a ]
}

async function recolorTexture(texture)
{
    const source = Buffer.from(texture.getImage())
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

    for(let i = 0; i < data.length; i += 4)
    {
        const [ r, g, b, a ] = recolorPixel(data[i], data[i + 1], data[i + 2], data[i + 3])
        data[i] = r
        data[i + 1] = g
        data[i + 2] = b
        data[i + 3] = a
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
    if(!BODY_MATERIAL_PATTERN.test(material.getName()))
        continue

    const texture = material.getBaseColorTexture()

    if(!texture || recoloredTextures.has(texture))
        continue

    recoloredTextures.add(texture)
    await recolorTexture(texture)
}

await io.write(outputPath, document)

console.log(`Neon McQueen body recolor → ${outputPath}`)
console.log(`  body materials: ${[ ...document.getRoot().listMaterials() ].filter((m) => BODY_MATERIAL_PATTERN.test(m.getName())).map((m) => m.getName()).join(', ')}`)
console.log(`  textures updated: ${recoloredTextures.size}`)
