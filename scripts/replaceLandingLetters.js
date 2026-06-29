/**
 * Replaces the baked "BRUNO SIMON" letter meshes in areas.glb with "CHRIS SHINA".
 * Run: node scripts/replaceLandingLetters.js
 */
globalThis.self = globalThis

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { writeFileSync, copyFileSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const glbPath = join(root, 'static/areas/areas.glb')
const fontPath = join(root, 'node_modules/three/examples/fonts/helvetiker_bold.typeface.json')
const letters = ['C', 'H', 'R', 'I', 'S', 'S', 'H', 'I', 'N', 'A']

const loader = new GLTFLoader()
const fontLoader = new FontLoader()

const glbBuffer = readFileSync(glbPath)
const glbArrayBuffer = glbBuffer.buffer.slice(glbBuffer.byteOffset, glbBuffer.byteOffset + glbBuffer.byteLength)

const [ gltf, font ] = await Promise.all([
    loader.parseAsync(glbArrayBuffer, glbPath),
    Promise.resolve(fontLoader.parse(JSON.parse(readFileSync(fontPath, 'utf8'))))
])

const exportGltf = (scene) => new Promise((resolve, reject) =>
{
    const exporter = new GLTFExporter()
    exporter.parse(
        scene,
        resolve,
        reject,
        { binary: true }
    )
})

const references = []

gltf.scene.traverse((object) =>
{
    if(object.name.startsWith('refLettersPhysicalDynamic.'))
        references.push(object)
})

references.sort((a, b) => a.name.localeCompare(b.name))

if(references.length !== letters.length)
    throw new Error(`Expected ${letters.length} letter references, found ${references.length}`)

for(let i = 0; i < references.length; i++)
{
    const mesh = references[i]
    const oldBox = new THREE.Box3().setFromObject(mesh)
    const oldSize = oldBox.getSize(new THREE.Vector3())
    const oldCenter = oldBox.getCenter(new THREE.Vector3())

    const geometry = new TextGeometry(letters[i], {
        font,
        size: 1,
        depth: 0.35,
        curveSegments: 4,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.02,
        bevelSegments: 2
    })

    geometry.computeBoundingBox()
    const newSize = geometry.boundingBox.getSize(new THREE.Vector3())
    const scale = Math.min(oldSize.x / newSize.x, oldSize.y / newSize.y, oldSize.z / newSize.z)
    geometry.scale(scale, scale, scale)
    geometry.center()
    geometry.computeBoundingBox()

    if(mesh.geometry)
        mesh.geometry.dispose()

    mesh.geometry = geometry

    const offset = oldCenter.clone().sub(mesh.position)
    geometry.translate(offset.x, offset.y, offset.z)
}

copyFileSync(glbPath, `${glbPath}.bak`)
const binary = await exportGltf(gltf.scene)
writeFileSync(glbPath, Buffer.from(binary))
console.log(`Updated ${glbPath} (${references.length} letters → CHRIS SHINA). Backup: areas.glb.bak`)
