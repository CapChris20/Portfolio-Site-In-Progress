import { Game } from '../Game.js'
import { StaticProp } from './StaticProp.js'

// Drift mask display anchor — keep in sync with WorldProps DRIFT_MASK
export const DRIFT_MASK = { x: 18.5, z: 9.5 }

const LANDING_SPAWN = { x: 39.52898025512695, y: 0, z: 37.82522964477539 }
const PROJECTS_SPAWN = { x: 35.783748626708984, y: 0, z: 17.56519889831543 }
const LAB_SPAWN = { x: 17.8837890625, y: 0, z: 18.80126953125 }

// Off the road — west of the CHRIS SHINA letters, on the grass (spawn/road ~39.5, 37.8)
export const ENTRANCE_STATUE = { x: 29.5, z: 33.0 }
const ENTRANCE_STATUE_CLEAR_RADIUS = 12

// Directly behind the Lab NEXT/PREV/SCROLL sign (sign ~9.35, 17.54 — west of it, facing spawn)
const PISTON_HORSE = { x: 7.0, z: 17.3 }

export function isNearEntranceStatue(position)
{
    const dx = position.x - ENTRANCE_STATUE.x
    const dz = position.z - ENTRANCE_STATUE.z

    return Math.hypot(dx, dz) <= ENTRANCE_STATUE_CLEAR_RADIUS
}

export function filterReferencesNearEntranceStatue(references)
{
    return references.filter((reference) => !isNearEntranceStatue(reference.position))
}

export const WORLD_PROP_CONFIGS = [
    {
        name: 'landingEntranceStatue',
        resource: 'lionStatue',
        position: ENTRANCE_STATUE,
        facePosition: LANDING_SPAWN,
        targetLength: 8.5,
        castShadow: false,
        receiveShadow: true,
    },
    {
        name: 'projectsDriftMask',
        resource: 'driftMask',
        position: DRIFT_MASK,
        facePosition: PROJECTS_SPAWN,
        targetLength: 6.5,
        castShadow: false,
        receiveShadow: true,
    },
    {
        name: 'labPistonHorse',
        resource: 'pistonHorse',
        position: PISTON_HORSE,
        facePosition: LAB_SPAWN,
        targetLength: 6.5,
        castShadow: false,
        receiveShadow: true,
    },
]

export class WorldProps
{
    constructor()
    {
        this.game = Game.getInstance()
        this.items = []
        this.addedResources = new Set()

        this.addFromResources()
    }

    addFromResources()
    {
        for(const config of WORLD_PROP_CONFIGS)
        {
            if(this.addedResources.has(config.resource))
                continue

            const model = this.game.resources[config.resource]?.scene

            if(!model)
                continue

            this.addedResources.add(config.resource)
            this.items.push(new StaticProp(model, config))
        }
    }
}
