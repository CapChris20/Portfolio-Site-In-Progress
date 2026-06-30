import { dedup, flatten, prune, textureCompress, weld } from '@gltf-transform/functions'
import { NodeIO } from '@gltf-transform/core'
import { mkdir, copyFile } from 'node:fs/promises'
import { dirname, join as joinPath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = joinPath(__dirname, '..')

const sourcePath = process.argv[2] || joinPath(rootDir, 'static/vehicle/lightningMcqueen.source.glb')
const outputPath = process.argv[3] || joinPath(rootDir, 'static/vehicle/lightningMcqueen.glb')
const backupPath = outputPath.replace(/\.glb$/, '.source.glb')

const MAX_TEXTURE_SIZE = 2048
const SIMPLIFY_RATIO = 0.5

await mkdir(dirname(outputPath), { recursive: true })

try
{
    await copyFile(outputPath, backupPath)
}
catch
{
    // no existing output yet
}

const tmpPath = outputPath.replace(/\.glb$/, '.tmp.glb')

await execFileAsync('npx', [
    'gltf-transform', 'resize',
    sourcePath, tmpPath,
    '--width', String(MAX_TEXTURE_SIZE),
    '--height', String(MAX_TEXTURE_SIZE),
], { cwd: rootDir })

await execFileAsync('npx', [
    'gltf-transform', 'simplify',
    tmpPath, outputPath,
    '--ratio', String(SIMPLIFY_RATIO),
], { cwd: rootDir })

const io = new NodeIO().registerDependencies()
const document = await io.read(outputPath)
await document.transform(dedup(), weld(), prune(), flatten())
await io.write(outputPath, document)

console.log(`Optimized custom vehicle → ${outputPath}`)
console.log(`Source backup → ${backupPath || sourcePath}`)
console.log(`Textures ${MAX_TEXTURE_SIZE}px max, mesh ~${Math.round(SIMPLIFY_RATIO * 100)}% of original`)
