import { NodeIO } from '@gltf-transform/core'
import { center, clearNodeTransform, flatten, normals as generateNormals, prune, weld } from '@gltf-transform/functions'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const sourcePath = process.argv[2] || join(rootDir, 'static/props/tropical_palm_tree.glb')
const outputPath = process.argv[3] || join(rootDir, 'static/palmTrees/palmTreesVisual.glb')

const TARGET_HEIGHT = 9

function measureHeight(root)
{
    let minY = Infinity
    let maxY = -Infinity

    for(const mesh of root.listMeshes())
    {
        for(const primitive of mesh.listPrimitives())
        {
            const position = primitive.getAttribute('POSITION')

            if(!position)
                continue

            const array = position.getArray()

            for(let i = 0; i < position.getCount(); i++)
            {
                const y = array[i * 3 + 1]
                minY = Math.min(minY, y)
                maxY = Math.max(maxY, y)
            }
        }
    }

    return { minY, maxY, height: maxY - minY }
}

function scaleVertices(root, scale)
{
    for(const mesh of root.listMeshes())
    {
        for(const primitive of mesh.listPrimitives())
        {
            const position = primitive.getAttribute('POSITION')

            if(!position)
                continue

            const array = new Float32Array(position.getArray())

            for(let i = 0; i < array.length; i++)
                array[i] *= scale

            position.setArray(array)
        }
    }
}

function bakeMeshTransforms(root)
{
    for(const node of root.listNodes())
    {
        if(node.getMesh())
            clearNodeTransform(node)
    }
}

const io = new NodeIO()
const document = await io.read(sourcePath)
const root = document.getRoot()

await document.transform(
    weld(),
    generateNormals({ overwrite: true }),
    flatten(),
    prune(),
)

bakeMeshTransforms(root)

const { height } = measureHeight(root)

if(!height || !Number.isFinite(height))
    throw new Error('Could not measure palm tree height')

scaleVertices(root, TARGET_HEIGHT / height)

await document.transform(
    center({ pivot: 'below' }),
    prune(),
)

bakeMeshTransforms(root)

const { height: finalHeight, minY, maxY } = measureHeight(root)

await mkdir(dirname(outputPath), { recursive: true })
await io.write(outputPath, document)

const finalMeshes = root.listMeshes().map((mesh) =>
{
    const prim = mesh.listPrimitives()[0]
    const indices = prim?.getIndices()
    const tris = indices ? indices.getCount() / 3 : 0
    const verts = prim?.getAttribute('POSITION')?.getCount() ?? 0
    return `${mesh.getName()} (${tris || verts} verts)`
})

console.log(`Palm tree visual → ${outputPath}`)
console.log(`  source: ${sourcePath}`)
console.log(`  height: ${height.toFixed(1)} → ${finalHeight.toFixed(2)} (y ${minY.toFixed(2)}..${maxY.toFixed(2)})`)
console.log(`  meshes: ${finalMeshes.join(', ')}`)
