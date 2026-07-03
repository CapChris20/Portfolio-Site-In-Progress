import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { metalRough } from '@gltf-transform/functions'
import sharp from 'sharp'
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const inputPath = process.argv[2] || join(rootDir, 'static/props/RadiatorMcqueen.source.glb')
const outputPath = process.argv[3] || join(rootDir, 'static/props/RadiatorMcqueen.glb')

// Retro synthwave gradient: orange→pink, orange→purple, cyan, magneto highlights.
const SHADOW = [ 45, 0, 80 ]       // deep purple base
const MAGENTO = [ 176, 0, 255 ]    // magneto
const ORANGE = [ 255, 133, 0 ]     // orange
const HOT_PINK = [ 255, 52, 126 ]  // hot pink
const PINK = [ 255, 80, 160 ]      // neon pink
const PURPLE = [ 147, 51, 234 ]    // purple
const CYAN = [ 0, 229, 255 ]       // cyan highlight
const BRIGHT = [ 255, 176, 255 ]   // go-to-the-light highlight

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

function sampleRetroGradient(lumT, vT)
{
    const g = Math.min(1, vT * 0.5 + lumT * 0.5)

    if(g < 0.18)
        return lerpRgb(SHADOW, MAGENTO, g / 0.18)

    if(g < 0.38)
        return lerpRgb(MAGENTO, ORANGE, (g - 0.18) / 0.2)

    if(g < 0.55)
        return lerpRgb(ORANGE, HOT_PINK, (g - 0.38) / 0.17)

    if(g < 0.72)
        return lerpRgb(HOT_PINK, PINK, (g - 0.55) / 0.17)

    if(g < 0.86)
        return lerpRgb(PINK, PURPLE, (g - 0.72) / 0.14)

    if(g < 0.95)
        return lerpRgb(PURPLE, CYAN, (g - 0.86) / 0.09)

    return lerpRgb(CYAN, BRIGHT, (g - 0.95) / 0.05)
}

// Only recolor the RED paint. Leave black paint (and everything else) untouched.
function isRedPaintPixel(r, g, b, a)
{
    if(a < 12)
        return false

    const lum = 0.299 * r + 0.587 * g + 0.114 * b

    // Keep the black paint job.
    if(lum < 50)
        return false

    // McQueen red body paint
    return r > g + 18 && r > b + 8
}

function recolorPixel(r, g, b, a, vNorm)
{
    if(!isRedPaintPixel(r, g, b, a))
        return [ r, g, b, a ]

    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    const lumT = Math.min(1, lum / 255)

    return [ ...sampleRetroGradient(lumT, vNorm), a ]
}

async function recolorTexture(texture)
{
    const source = Buffer.from(texture.getImage())
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })

    for(let y = 0; y < info.height; y++)
    {
        const vNorm = y / Math.max(1, info.height - 1)

        for(let x = 0; x < info.width; x++)
        {
            const i = (y * info.width + x) * 4
            const [ nr, ng, nb, na ] = recolorPixel(data[i], data[i + 1], data[i + 2], data[i + 3], vNorm)
            data[i] = nr
            data[i + 1] = ng
            data[i + 2] = nb
            data[i + 3] = na
        }
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
        await copyFile(inputPath, inputPath.replace(/\.glb$/, '.beforeRetro.glb'))
    }
    catch
    {
        // no existing file
    }
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const document = await io.read(inputPath)
const recoloredTextures = new Set()

for(const material of document.getRoot().listMaterials())
{
    const textures = []

    const baseTex = material.getBaseColorTexture()
    if(baseTex)
        textures.push(baseTex)

    const sg = material.getExtension('KHR_materials_pbrSpecularGlossiness')
    if(sg && typeof sg.getDiffuseTexture === 'function')
    {
        const diffuse = sg.getDiffuseTexture()
        if(diffuse)
            textures.push(diffuse)
    }

    for(const texture of textures)
    {
        if(!texture || recoloredTextures.has(texture))
            continue

        recoloredTextures.add(texture)
        await recolorTexture(texture)
    }
}

// Convert legacy specular-glossiness → metallic-roughness so modern three.js
// (which dropped KHR_materials_pbrSpecularGlossiness) loads the paint correctly.
await document.transform(metalRough())

await io.write(outputPath, document)

console.log(`Retro Radiator McQueen recolor → ${outputPath}`)
console.log(`  textures updated: ${recoloredTextures.size}`)
console.log('  converted specGloss → metallic-rough')
