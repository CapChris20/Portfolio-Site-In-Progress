import { NodeIO } from '@gltf-transform/core'
import { center, clearNodeTransform, flatten, prune } from '@gltf-transform/functions'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const sourcePath = process.argv[2] || join(process.env.HOME, 'Desktop/NEW GLB FILES/palm_trees.glb')
const outputPath = join(rootDir, 'static/palmTrees/palmTreesVisual.glb')

// -90° around X — source trunk is authored on Z, game expects Y-up like birch trees
const ROTATE_X_UP = [-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)]
// ~9 unit birch height (source palm is ~3.9 units at the old 100× root scale)
const TARGET_SCALE = 2.3

const io = new NodeIO()
const document = await io.read(sourcePath)
const root = document.getRoot()

const palmRoot = root.listNodes().find((node) => node.getName() === 'Bark_1')

if(!palmRoot)
    throw new Error('Could not find Bark_1 palm in source GLB')

for(const node of root.listNodes())
{
    if(node === palmRoot || node.listChildren().includes(palmRoot))
        continue

    if(node.getName().match(/^Bark_[2-4]/) || node.getName().match(/^Leaf_[2-4]/) || node.getName().match(/^(Bark|Leaf)_[2-4]_/))
        node.dispose()
}

palmRoot.setName('palmRoot')

const scene = root.listScenes()[0]
if(scene)
{
    scene.listChildren().forEach((child) => child.dispose())
    scene.addChild(palmRoot)
}

palmRoot.setTranslation([0, 0, 0])
palmRoot.setRotation(ROTATE_X_UP)
palmRoot.setScale([TARGET_SCALE, TARGET_SCALE, TARGET_SCALE])

await document.transform(
    flatten(),
    center({ pivot: 'below' }),
    prune(),
)

for(const node of root.listNodes())
{
    if(node.getMesh())
        clearNodeTransform(node)
}

// Move baked leaf positions into node transforms (foliage system expects offsets on nodes)
for(const node of root.listNodes())
{
    const name = node.getName()

    if(!name.match(/^Leaf_1_Leaf_/))
        continue

    const mesh = node.getMesh()
    const primitive = mesh.listPrimitives()[0]
    const position = primitive.getAttribute('POSITION')
    const array = position.getArray()

    let cx = 0
    let cy = 0
    let cz = 0
    const count = position.getCount()

    for(let i = 0; i < count; i++)
    {
        cx += array[i * 3]
        cy += array[i * 3 + 1]
        cz += array[i * 3 + 2]
    }

    cx /= count
    cy /= count
    cz /= count

    for(let i = 0; i < count; i++)
    {
        array[i * 3] -= cx
        array[i * 3 + 1] -= cy
        array[i * 3 + 2] -= cz
    }

    position.setArray(array)
    node.setTranslation([cx, cy, cz])
}

palmRoot.setTranslation([0, 0, 0])
palmRoot.setRotation([0, 0, 0, 1])
palmRoot.setScale([1, 1, 1])

await document.transform(center({ pivot: 'below' }))

for(const node of root.listNodes())
{
    const name = node.getName()

    if(name.match(/^Bark_1_Bark_1_0$/))
        node.setName('treeBody')
    else if(name.match(/^Leaf_1_Leaf_1_0$/))
        node.setName('treeLeaves')
    else if(name.match(/^Leaf_1_Leaf_2_0$/))
        node.setName('treeLeaves.001')
    else if(name.match(/^Leaf_1_Leaf_3_0$/))
        node.setName('treeLeaves.002')
}

// One foliage anchor per tree — the game renders leaves via impostors, not these meshes
const leafNodes = root.listNodes().filter((node) => node.getName().match(/^treeLeaves/))
let canopyAnchor = null

if(leafNodes.length)
{
    let anchorX = 0
    let anchorY = 0
    let anchorZ = 0

    for(const node of leafNodes)
    {
        const translation = node.getTranslation()
        anchorX += translation[0]
        anchorY += translation[1]
        anchorZ += translation[2]
    }

    canopyAnchor = [
        anchorX / leafNodes.length,
        anchorY / leafNodes.length,
        anchorZ / leafNodes.length,
    ]

    for(const node of leafNodes)
        node.dispose()
}

// Drop 2048px textures — trunk uses a flat color, leaves are foliage impostors
for(const material of root.listMaterials())
{
    material.setBaseColorTexture(null)
    material.setMetallicRoughnessTexture(null)
    material.setNormalTexture(null)
    material.setOcclusionTexture(null)
    material.setEmissiveTexture(null)
    material.setBaseColorFactor([0.45, 0.28, 0.12, 1])
    material.setMetallicFactor(0)
    material.setRoughnessFactor(1)
}

await document.transform(prune())

if(canopyAnchor)
{
    const anchor = document.createNode('treeLeaves')
    anchor.setTranslation(canopyAnchor)
    scene.addChild(anchor)
}

await mkdir(dirname(outputPath), { recursive: true })
await io.write(outputPath, document)

console.log(`Palm tree visual written to ${outputPath}`)
