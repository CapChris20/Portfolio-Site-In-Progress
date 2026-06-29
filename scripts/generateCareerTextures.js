import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../static/career')

const FONT_FAMILY = 'Arial, Helvetica, sans-serif'
const FONT_SIZE = 22
const LINE_HEIGHT = 30
const PADDING_X = 6
const PADDING_Y = 4
const GREEN = '#00ff00'
const RED = '#ff0000'
const BLACK = '#000000'

const textures = [
    {
        file: 'careerHetic',
        lines: [
            'DIVINE CHILD HS',
            'INTRO TO JAVASCRIPT',
        ],
    },
    {
        file: 'careerFreelancer',
        lines: [
            'AP CSP — CODE.ORG',
            'STADIUM + NBA APPS',
        ],
    },
    {
        file: 'careerUzik',
        lines: [
            'OAKLAND UNIVERSITY',
            'HTML & CSS',
        ],
    },
    {
        file: 'careerIRLTeacher',
        lines: [
            '2024 — ON PAUSE',
            'BACK JAN 2025',
            'LIVBAKES — LIVE SITE',
        ],
    },
    {
        file: 'careerImmersiveGarden',
        lines: [
            'MIDNIGHT VINYL + CINEMOOD',
            'RETRONIX + VINYL PARADOX',
        ],
    },
    {
        file: 'careerOnlineTeacher',
        lines: [
            'COACH CONNECT',
            'RELEASE AUG 2026',
            'DEVORA + PLATEDX',
        ],
    },
]

function estimateTextWidth(text)
{
    let width = 0

    for(const char of text)
    {
        if(char === ' ')
            width += 9
        else if(char === '—')
            width += 20
        else if(char === '+' || char === '&')
            width += 16
        else
            width += 14
    }

    return width
}

function escapeXml(text)
{
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function buildSvg(lines)
{
    const lineWidths = lines.map((line) => estimateTextWidth(line) + PADDING_X * 2 + 12)
    const width = Math.max(...lineWidths)
    const height = lines.length * LINE_HEIGHT

    const lineElements = lines.map((line, index) =>
    {
        const y = index * LINE_HEIGHT
        const lineWidth = lineWidths[index]

        return `
            <rect x="0" y="${y}" width="${lineWidth}" height="${LINE_HEIGHT}" fill="${GREEN}" />
            <text
                x="${PADDING_X}"
                y="${y + LINE_HEIGHT - PADDING_Y}"
                fill="${RED}"
                font-family="${FONT_FAMILY}"
                font-size="${FONT_SIZE}"
                font-weight="700"
            >${escapeXml(line)}</text>
        `
    }).join('')

    return `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="${BLACK}" />
            ${lineElements}
        </svg>
    `
}

async function generateTexture({ file, lines })
{
    const svg = buildSvg(lines)
    const outPath = path.join(outDir, `${file}.png`)

    await sharp(Buffer.from(svg))
        .png()
        .toFile(outPath)

    console.log(`Wrote ${outPath}`)
}

for(const texture of textures)
    await generateTexture(texture)
