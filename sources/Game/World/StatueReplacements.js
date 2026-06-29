import { Game } from '../Game.js'
import { createGroundedPropVisual } from './PropVisual.js'

/**
 * Swap area props with your own GLBs — same position, rotation, and physics as the original.
 *
 * HOW TO ADD A REPLACEMENT
 * 1. Put your .glb in static/props/ (e.g. static/props/myStatue.glb)
 * 2. Register it in sources/Game/Game.js resources (copy the retrowaveCar line)
 * 3. Add an entry below
 * 4. Run: node scripts/listAreaPropPositions.js  →  find `reference` keys + world XYZ
 *
 * REFERENCE NAMES (at runtime, after areas.glb loads):
 *   refStatuePhysicalDynamic  →  reference key: statue
 *   refJukeboxPhysicalDynamic  →  jukebox
 *
 * Non-ref props (e.g. discordPhysicalDynamic) use objectName instead:
 *   objectName: 'discord'
 *
 * AREA NAMES: social, landing, projects, lab, career, bowling, cookie, altar, etc.
 */
export const STATUE_REPLACEMENTS = [
    // Social center pyramid is handled in SocialArea.js (refCenter)

    // Examples — uncomment and point resource at your GLB:
    // {
    //     area: 'bowling',
    //     reference: 'jukebox',
    //     resource: 'myJukebox',
    //     targetLength: 3,
    // },
    // {
    //     area: 'social',
    //     objectName: 'discord',
    //     resource: 'myDiscordStatue',
    //     targetLength: 1.5,
    // },
]

export function applyStatueReplacements(area, areaName)
{
    const game = Game.getInstance()

    for(const config of STATUE_REPLACEMENTS)
    {
        if(config.area && config.area !== areaName)
            continue

        const reference = findReference(area, config)
        const object = findPhysicalObject(area, config, reference)

        if(!object?.visual)
            continue

        const source = game.resources[config.resource]?.scene

        if(!source)
        {
            console.warn(`StatueReplacements: missing resource "${config.resource}" for ${areaName}/${config.reference ?? config.objectName}`)
            continue
        }

        if(config.hideOriginalMesh !== false)
        {
            object.visual.object3D.traverse((child) =>
            {
                if(child.isMesh)
                    child.visible = false
            })
        }

        const visual = createGroundedPropVisual(source, config.targetLength ?? 4, {
            materialPrefix: `statue_${config.resource ?? config.reference ?? config.objectName ?? 'prop'}`,
        })

        if(config.rotationY)
            visual.rotation.y = config.rotationY

        game.materials.applyObjectMaterials(visual, { useCache: false })
        object.visual.object3D.add(visual)
    }
}

function findPhysicalObject(area, config, referenceNode)
{
    if(referenceNode?.userData?.object?.visual)
        return referenceNode.userData.object

    if(config.reference)
    {
        const needle = config.reference.toLowerCase()

        for(const object of area.objects.items)
        {
            const name = (object.visual?.object3D?.name ?? '').toLowerCase()

            if(name.includes(needle))
                return object
        }
    }

    return findObjectByName(area, config.objectName)
}

function findReference(area, config)
{
    if(!config.reference)
        return null

    const keys = [
        config.reference,
        config.reference.replace(/PhysicalDynamic.*$/i, ''),
        config.reference.replace(/^ref/i, '').replace(/PhysicalDynamic.*$/i, ''),
    ]

    for(const key of keys)
    {
        const match = area.references.items.get(key)?.[0]

        if(match)
            return match
    }

    return null
}

function findObjectByName(area, objectName)
{
    if(!objectName)
        return null

    const names = [
        objectName,
        objectName.replace(/PhysicalDynamic.*$/i, ''),
    ]

    for(const object of area.objects.items)
    {
        const nodeName = object.visual?.object3D?.name

        if(names.includes(nodeName))
            return object
    }

    return null
}

export function getAreaNameFromModel(model)
{
    return model.name
}
