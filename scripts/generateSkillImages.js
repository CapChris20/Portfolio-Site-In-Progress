import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../static/projects/images')
const iconsDir = path.join(outDir, 'skill-icons')
fs.mkdirSync(iconsDir, { recursive: true })

/** Every skill you listed — icons pulled from https://cdn.simpleicons.org */
const categories = [
    {
        slug: 'skills-languages',
        title: 'Languages',
        accent: '#5390ff',
        skills: [
            { file: 'html', slug: 'html5', label: 'HTML', color: 'E34F26' },
            { file: 'css', slug: 'css', label: 'CSS', color: '1572B6' },
            { file: 'javascript', slug: 'javascript', label: 'JavaScript', color: 'F7DF1E' },
            { file: 'typescript', slug: 'typescript', label: 'TypeScript', color: '3178C6' },
        ],
    },
    {
        slug: 'skills-frontend',
        title: 'Frontend',
        accent: '#61dafb',
        skills: [
            { file: 'react', slug: 'react', label: 'React', color: '61DAFB' },
            { file: 'nextjs', slug: 'nextdotjs', label: 'Next.js', color: 'FFFFFF' },
            { file: 'tailwind', slug: 'tailwindcss', label: 'Tailwind', color: '06B6D4' },
            { file: 'vite', slug: 'vite', label: 'Vite', color: '646CFF' },
            { file: 'webpack', slug: 'webpack', label: 'Webpack', color: '8DD6F9' },
        ],
    },
    {
        slug: 'skills-mobile',
        title: 'Mobile',
        accent: '#b65fff',
        skills: [
            { file: 'react-native', slug: 'react', label: 'React Native', color: '61DAFB', url: 'https://reactnative.dev/img/tiny_logo.png' },
            { file: 'firebase', slug: 'firebase', label: 'Firebase', color: 'FFCA28' },
            { file: 'supabase', slug: 'supabase', label: 'Supabase', color: '3FCF8E' },
            { file: 'nodejs', slug: 'nodedotjs', label: 'Node.js', color: '339933' },
        ],
    },
    {
        slug: 'skills-tools',
        title: 'Tools',
        accent: '#ff8039',
        skills: [
            { file: 'figma', slug: 'figma', label: 'Figma', color: 'F24E1E' },
            { file: 'cursor', slug: 'cursor', label: 'Cursor', color: 'FFFFFF' },
        ],
    },
    {
        slug: 'skills-apis',
        title: 'APIs & AI',
        accent: '#ff69b4',
        skills: [
            { file: 'stripe', slug: 'stripe', label: 'Stripe API', color: '635BFF' },
            { file: 'imdb', slug: 'imdb', label: 'IMDb API', color: 'F5C518' },
            { file: 'claude', label: 'Claude API', localPath: 'static/props/Claude.png' },
        ],
    },
]

async function saveNormalizedPng(source, iconPath)
{
    const tempPath = `${iconPath}.tmp`

    try
    {
        await sharp(source)
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toFile(iconPath)
        return
    }
    catch
    {
        if(Buffer.isBuffer(source))
            fs.writeFileSync(tempPath, source)

        await execFileAsync('magick', [
            Buffer.isBuffer(source) ? tempPath : source,
            '-resize', '512x512',
            iconPath,
        ])

        if(fs.existsSync(tempPath))
            fs.unlinkSync(tempPath)
    }
}

async function loadIcon(skill)
{
    const iconPath = path.join(iconsDir, `${skill.file}.png`)

    if(skill.localPath)
    {
        const sourcePath = path.join(__dirname, '..', skill.localPath)

        if(!fs.existsSync(sourcePath))
            throw new Error(`Missing local icon for ${skill.label}: ${sourcePath}`)

        await saveNormalizedPng(sourcePath, iconPath)
        console.log(`  synced ${skill.label} from ${skill.localPath}`)
        return iconPath
    }

    if(fs.existsSync(iconPath) && fs.statSync(iconPath).size > 0)
    {
        try
        {
            await sharp(iconPath).metadata()
            console.log(`  using local ${skill.label} → ${iconPath}`)
            return iconPath
        }
        catch
        {
            console.log(`  local ${skill.label} invalid, fetching fallback...`)
        }
    }

    const url = skill.url ?? `https://cdn.simpleicons.org/${skill.slug}/${skill.color}`
    const response = await fetch(url)

    if(!response.ok)
        throw new Error(`${skill.label} (${url}) → HTTP ${response.status}`)

    const raw = Buffer.from(await response.arrayBuffer())

    await saveNormalizedPng(raw, iconPath)

    console.log(`  fetched ${skill.label} → ${iconPath}`)
    return iconPath
}

function escapeXml(text)
{
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function cardSvg(title, accent)
{
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
        <defs>
            <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#14002a"/>
                <stop offset="100%" stop-color="#251f2b"/>
            </linearGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#bg)"/>
        <circle cx="1700" cy="180" r="320" fill="${accent}" opacity="0.12"/>
        <circle cx="200" cy="920" r="280" fill="${accent}" opacity="0.08"/>
        <text x="960" y="130" text-anchor="middle" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="80" font-weight="700">${escapeXml(title)}</text>
    </svg>`)
}

function resolveFontPath()
{
    const candidates = [
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
        '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
    ]

    return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]
}

async function buildCategory(category)
{
    const iconSize = 300
    const cellW = 380
    const cellH = 320
    const cols = Math.min(category.skills.length, 5)
    const rows = Math.ceil(category.skills.length / cols)
    const gridW = cols * cellW
    const startX = Math.floor((1920 - gridW) / 2 + cellW / 2)
    const startY = Math.floor((1080 - rows * cellH) / 2 + cellH / 2) + 50

    const composites = []
    const labels = []

    for(let i = 0; i < category.skills.length; i++)
    {
        const skill = category.skills[i]
        const col = i % cols
        const row = Math.floor(i / cols)
        const cx = startX + col * cellW
        const cy = startY + row * cellH

        const iconPath = await loadIcon(skill)

        const icon = await sharp(iconPath)
            .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer()

        composites.push({
            input: icon,
            left: Math.round(cx - iconSize / 2),
            top: Math.round(cy - iconSize / 2 - 24),
        })

        labels.push({ x: cx, y: cy + iconSize / 2 + 36, text: skill.label })
    }

    const output = path.join(outDir, `${category.slug}.png`)
    const tempOutput = `${output}.tmp.png`

    await sharp(cardSvg(category.title, category.accent))
        .composite(composites)
        .png()
        .toFile(tempOutput)

    const annotateArgs = [
        tempOutput,
        '-font', resolveFontPath(),
        '-pointsize', '42',
        '-fill', '#f8fafc',
        '-stroke', '#14002a',
        '-strokewidth', '2',
    ]

    for(const label of labels)
    {
        annotateArgs.push(
            '-gravity', 'Center',
            '-annotate', `+${label.x - 960}+${label.y - 540}`,
            label.text,
        )
    }

    annotateArgs.push(output)

    await execFileAsync('magick', annotateArgs)
    fs.unlinkSync(tempOutput)

    console.log(`created ${output}`)
}

console.log(`Building skill cards from icons in ${iconsDir}\n`)

for(const category of categories)
{
    console.log(`[${category.title}]`)
    await buildCategory(category)
    console.log('')
}

console.log('Done. Icons saved in static/projects/images/skill-icons/')
