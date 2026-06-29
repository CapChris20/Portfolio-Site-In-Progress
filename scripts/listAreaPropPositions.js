/**
 * Lists every physical prop in areas.glb with world position + config keys for StatueReplacements.js
 *
 * Usage: node scripts/listAreaPropPositions.js
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const areasPath = join(root, 'static/areas/areas.glb')
const cleanUpRegexp = /physical|fixed|dynamic|kinematicPositionBased/gi

function parseGlb(path)
{
    const data = readFileSync(path)
    let offset = 12
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let json = null

    while(offset < data.length)
    {
        const len = view.getUint32(offset, true)
        const type = view.getUint32(offset + 4, true)

        if(type === 0x4E4F534A)
            json = JSON.parse(new TextDecoder().decode(data.slice(offset + 8, offset + 8 + len)))

        offset += 8 + len
    }

    return json
}

function referenceKey(nodeName)
{
    const matches = nodeName.match(/^ref(?:erence)?([^0-9]+)([0-9]+)?$/)

    if(!matches)
        return null

    return matches[1].charAt(0).toLowerCase() + matches[1].slice(1)
}

function runtimeConfigKey(glbNodeName)
{
    const renamed = glbNodeName.replace(cleanUpRegexp, '')

    if(glbNodeName.startsWith('ref'))
    {
        const key = referenceKey(renamed)

        return key ? { type: 'reference', key } : null
    }

    return { type: 'objectName', key: renamed }
}

function walk(nodeIndex, nodes, parent = { x: 0, y: 0, z: 0, area: null })
{
    const n = nodes[nodeIndex]
    const t = n.translation || [ 0, 0, 0 ]
    const pos = {
        x: parent.x + t[0],
        y: parent.y + t[1],
        z: parent.z + t[2],
    }

    let area = parent.area

    if(n.name && !n.name.startsWith('ref') && !/Physical/i.test(n.name))
    {
        for(const areaName of [ 'social', 'landing', 'projects', 'lab', 'career', 'bowling', 'cookie', 'altar', 'circuit', 'toilet', 'timeMachine', 'achievements', 'behindTheScene' ])
        {
            if(n.name === areaName || n.name.startsWith(areaName))
                area = areaName
        }
    }

    const results = []

    if(n.mesh !== undefined && /Physical/i.test(n.name || ''))
    {
        const config = runtimeConfigKey(n.name)

        results.push({
            area: area ?? '?',
            nodeName: n.name,
            configType: config?.type ?? '?',
            configKey: config?.key ?? n.name,
            x: pos.x,
            y: pos.y,
            z: pos.z,
        })
    }

    for(const childIndex of n.children ?? [])
        results.push(...walk(childIndex, nodes, { ...pos, area }))

    return results
}

const json = parseGlb(areasPath)
const items = []

for(const rootIndex of json.scenes[0].nodes)
    items.push(...walk(rootIndex, json.nodes))

items.sort((a, b) => a.area.localeCompare(b.area) || a.configKey.localeCompare(b.configKey))

console.log('Prop slots for StatueReplacements.js\n')
console.log('Use configType + configKey in sources/Game/World/StatueReplacements.js')
console.log('')
console.log(
    pad('area', 16)
    + pad('config', 36)
    + pad('world X', 10)
    + pad('Y', 8)
    + pad('Z', 10)
    + 'glb node (Blender name)',
)
console.log('─'.repeat(110))

for(const item of items)
{
    const config = item.configType === 'reference'
        ? `reference: '${item.configKey}'`
        : `objectName: '${item.configKey}'`

    console.log(
        pad(item.area, 16)
        + pad(config, 36)
        + pad(item.x.toFixed(2), 10)
        + pad(item.y.toFixed(2), 8)
        + pad(item.z.toFixed(2), 10)
        + item.nodeName,
    )
}

const outPath = join(root, 'static/areas/prop-positions.json')
writeFileSync(outPath, JSON.stringify(items, null, 2))

console.log(`\nSaved ${items.length} entries → static/areas/prop-positions.json`)
console.log('\nExample (social statue):')
console.log(`{
    area: 'social',
    reference: 'statue',
    resource: 'myStatueGlb',
    targetLength: 4.5,
}`)

function pad(value, width)
{
    return String(value).padEnd(width)
}
