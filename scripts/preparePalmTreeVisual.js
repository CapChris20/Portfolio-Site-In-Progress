import { NodeIO } from '@gltf-transform/core'
import { center, clearNodeTransform, flatten, normals as generateNormals, prune, weld } from '@gltf-transform/functions'
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const sourcePath = process.argv[2] || join(rootDir, 'static/Tree.glb')
const outputPath = join(rootDir, 'static/palmTrees/palmTreesVisual.glb')

const TARGET_HEIGHT = 9
const TRIANGLE_STEP = 1800
const TEXTURE_SIZE = 512
const LEAVES_HEIGHT_RATIO = 0.72

const io = new NodeIO()
const document = await io.read(sourcePath)
const root = document.getRoot()
const sourceMesh = root.listMeshes()[0]

if(!sourceMesh)
    throw new Error('Could not find mesh in source GLB')

const sourcePrimitive = sourceMesh.listPrimitives()[0]
const sourcePosition = sourcePrimitive.getAttribute('POSITION')
const sourceNormal = sourcePrimitive.getAttribute('NORMAL')
const sourceUv = sourcePrimitive.getAttribute('TEXCOORD_0')
const sourceArray = sourcePosition.getArray()
const sourceNormalArray = sourceNormal?.getArray()
const sourceUvArray = sourceUv?.getArray()
const sourceCount = sourcePosition.getCount()
const sourceIndices = sourcePrimitive.getIndices().getArray()
const sourceMaterial = sourcePrimitive.getMaterial()

let minY = Infinity
let maxY = -Infinity

for(let i = 0; i < sourceCount; i++)
{
    const y = sourceArray[i * 3 + 1]
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
}

const height = maxY - minY
const triangleCount = sourceIndices.length / 3
const sampledIndices = []

for(let triangle = 0; triangle < triangleCount; triangle += TRIANGLE_STEP)
{
    const offset = triangle * 3
    sampledIndices.push(
        sourceIndices[offset],
        sourceIndices[offset + 1],
        sourceIndices[offset + 2],
    )
}

const usedVertices = new Set(sampledIndices)
const vertexMap = new Map()
const positions = []
const normalData = []
const uvData = []

for(const vertexIndex of usedVertices)
{
    vertexMap.set(vertexIndex, positions.length / 3)
    positions.push(
        sourceArray[vertexIndex * 3],
        sourceArray[vertexIndex * 3 + 1],
        sourceArray[vertexIndex * 3 + 2],
    )

    if(sourceNormalArray)
    {
        normalData.push(
            sourceNormalArray[vertexIndex * 3],
            sourceNormalArray[vertexIndex * 3 + 1],
            sourceNormalArray[vertexIndex * 3 + 2],
        )
    }

    if(sourceUvArray)
    {
        uvData.push(
            sourceUvArray[vertexIndex * 2],
            sourceUvArray[vertexIndex * 2 + 1],
        )
    }
}

const remappedIndices = sampledIndices.map((index) => vertexMap.get(index))

let treeMaterial = sourceMaterial

if(sourceMaterial?.getBaseColorTexture())
{
    const sourceTexture = sourceMaterial.getBaseColorTexture()
    const sourceImage = sourceTexture.getImage()

    if(sourceImage)
    {
        const resized = await sharp(Buffer.from(sourceImage))
            .resize(TEXTURE_SIZE, TEXTURE_SIZE, { fit: 'inside' })
            .jpeg({ quality: 82 })
            .toBuffer()

        const texture = document.createTexture('treeBaseColor')
            .setImage(resized)
            .setMimeType('image/jpeg')

        treeMaterial = document.createMaterial('treeBodyMat')
            .setBaseColorTexture(texture)
            .setBaseColorFactor(sourceMaterial.getBaseColorFactor())
            .setMetallicFactor(sourceMaterial.getMetallicFactor() ?? 0.5)
            .setRoughnessFactor(sourceMaterial.getRoughnessFactor() ?? 0.35)
    }
}

if(!treeMaterial)
{
    treeMaterial = document.createMaterial('treeBodyMat')
        .setBaseColorFactor([0.45, 0.28, 0.12, 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(1)
}

const treePrimitive = document.createPrimitive()
treePrimitive.setAttribute(
    'POSITION',
    document.createAccessor()
        .setType('VEC3')
        .setArray(new Float32Array(positions)),
)

if(normalData.length)
{
    treePrimitive.setAttribute(
        'NORMAL',
        document.createAccessor()
            .setType('VEC3')
            .setArray(new Float32Array(normalData)),
    )
}

if(uvData.length)
{
    treePrimitive.setAttribute(
        'TEXCOORD_0',
        document.createAccessor()
            .setType('VEC2')
            .setArray(new Float32Array(uvData)),
    )
}

treePrimitive.setIndices(
    document.createAccessor()
        .setType('SCALAR')
        .setArray(new Uint32Array(remappedIndices)),
)
treePrimitive.setMaterial(treeMaterial)

const treeMesh = document.createMesh('treeBody')
treeMesh.addPrimitive(treePrimitive)

for(const node of [...root.listNodes()])
    node.dispose()

for(const mesh of [...root.listMeshes()])
{
    if(mesh !== treeMesh)
        mesh.dispose()
}

for(const texture of [...root.listTextures()])
{
    if(texture !== treeMaterial.getBaseColorTexture())
        texture.dispose()
}

for(const material of [...root.listMaterials()])
{
    if(material !== treeMaterial)
        material.dispose()
}

const scene = root.listScenes()[0]

if(scene)
    scene.listChildren().forEach((child) => child.dispose())

const treeBody = document.createNode('treeBody')
treeBody.setMesh(treeMesh)
scene.addChild(treeBody)

const targetScale = TARGET_HEIGHT / height
treeBody.setScale([targetScale, targetScale, targetScale])

await document.transform(
    weld(),
    generateNormals({ overwrite: true }),
    flatten(),
    center({ pivot: 'below' }),
    prune(),
)

for(const node of root.listNodes())
{
    if(node.getMesh())
        clearNodeTransform(node)
}

const bodyNode = root.listNodes().find((node) => node.getName() === 'treeBody')
const bodyPrimitive = bodyNode?.getMesh()?.listPrimitives()[0]
const bodyPosition = bodyPrimitive?.getAttribute('POSITION')
const bodyArray = bodyPosition?.getArray()
let bodyMinY = Infinity
let bodyMaxY = -Infinity

if(bodyArray)
{
    for(let i = 0; i < bodyPosition.getCount(); i++)
    {
        const y = bodyArray[i * 3 + 1]
        bodyMinY = Math.min(bodyMinY, y)
        bodyMaxY = Math.max(bodyMaxY, y)
    }
}

const treeLeaves = document.createNode('treeLeaves')
treeLeaves.setTranslation([0, bodyMaxY * LEAVES_HEIGHT_RATIO, 0])
root.listScenes()[0].addChild(treeLeaves)

await mkdir(dirname(outputPath), { recursive: true })
await io.write(outputPath, document)

console.log(`Tree visual written to ${outputPath}`)
console.log(`  vertices: ${bodyPosition?.getCount() ?? 'unknown'}`)
console.log(`  attributes: ${(bodyPrimitive?.listSemantics() ?? []).join(', ')}`)
console.log(`  height: ${bodyMinY.toFixed(2)} → ${bodyMaxY.toFixed(2)}`)
console.log(`  leaves anchor y: ${(bodyMaxY * LEAVES_HEIGHT_RATIO).toFixed(2)}`)
console.log(`  material: ${treeMaterial.getName()}`)
