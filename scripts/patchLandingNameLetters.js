/**
 * Bakes "CHRIS SHINA" into areas.glb letter meshes (geometry + UVs).
 * Run: node scripts/patchLandingNameLetters.js
 */
globalThis.self = globalThis
globalThis.window = globalThis
globalThis.document = { createElement: () => ({ getContext: () => null, style: {} }) }

globalThis.FileReader = class FileReader
{
    readAsArrayBuffer(blob)
    {
        blob.arrayBuffer().then((buffer) =>
        {
            this.result = buffer
            this.onloadend?.()
        })
    }
}

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
const fontPath = join(root, 'node_modules/three/examples/fonts/helvetiker_bold.typeface.json')

const NAME_WORDS = [
    ['C', 'H', 'R', 'I', 'S'],
    ['S', 'H', 'I', 'N', 'A'],
]

const loader = new GLTFLoader()
const font = new FontLoader().parse(JSON.parse(readFileSync(fontPath, 'utf8')))

const exportGltf = (scene) => new Promise((resolve, reject) =>
{
    new GLTFExporter().parse(scene, resolve, reject, { binary: true })
})

const patchFile = async (glbPath) =>
{
    const buffer = readFileSync(glbPath)
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    const gltf = await loader.parseAsync(arrayBuffer, glbPath)

    const references = []
    gltf.scene.traverse((object) =>
    {
        if(/refLettersPhysicalDynamic/i.test(object.name) && object.isMesh)
            references.push(object)
    })

    if(references.length !== 10)
        throw new Error(`${glbPath}: expected 10 letter meshes, found ${references.length}`)

    const groups = [[], []]

    for(const reference of references)
    {
        const index = parseInt(reference.name.match(/(\d+)$/)?.[1] ?? '0', 10)

        if(index <= 14)
            groups[0].push(reference)
        else
            groups[1].push(reference)
    }

    for(const group of groups)
        group.sort((a, b) => a.position.x - b.position.x)

    for(let g = 0; g < groups.length; g++)
    {
        for(let i = 0; i < groups[g].length; i++)
            replaceLetterGeometry(groups[g][i], NAME_WORDS[g][i])
    }

    copyFileSync(glbPath, `${glbPath}.bak`)
    const binary = await exportGltf(gltf.scene)
    writeFileSync(glbPath, Buffer.from(binary))
    console.log(`Patched ${glbPath}`)
}

const replaceLetterGeometry = (mesh, letter) =>
{
    const oldBox = new THREE.Box3().setFromObject(mesh)
    const oldSize = oldBox.getSize(new THREE.Vector3())
    const oldCenter = oldBox.getCenter(new THREE.Vector3())

    const geometry = new TextGeometry(letter, {
        font,
        size: 1,
        depth: 0.46,
        curveSegments: 6,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.025,
        bevelSegments: 2
    })

    geometry.rotateY(Math.PI)

    geometry.computeBoundingBox()
    const newSize = geometry.boundingBox.getSize(new THREE.Vector3())
    const scale = Math.min(oldSize.x / newSize.x, oldSize.y / newSize.y, oldSize.z / newSize.z)
    geometry.scale(scale, scale, scale)
    geometry.center()

    const offset = oldCenter.clone().sub(mesh.position)
    geometry.translate(offset.x, offset.y, offset.z)

    const uvs = geometry.attributes.uv

    for(let i = 0; i < uvs.count; i++)
        uvs.setXY(i, 0.12, 0.22)

    if(mesh.geometry)
        mesh.geometry.dispose()

    mesh.geometry = geometry
}

await patchFile(join(root, 'static/areas/areas.glb'))

const compressedPath = join(root, 'static/areas/areas-compressed.glb')

try
{
    await patchFile(compressedPath)
}
catch(error)
{
    console.warn(`Skipped ${compressedPath}: ${error.message}`)
}
