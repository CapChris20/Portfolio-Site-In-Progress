import { Game } from '../Game.js'
import { InstancedGroup } from '../InstancedGroup.js'
import { DRIFT_MASK } from './WorldProps.js'

const HIDDEN_BENCH_NAMES = new Set([
    'benchPhysicalDynamic.003',
])

const BENCH_HIDE_RADIUS = 5

function shouldHideBench(instance)
{
    if(HIDDEN_BENCH_NAMES.has(instance.name))
        return true

    const dx = instance.position.x - DRIFT_MASK.x
    const dz = instance.position.z - DRIFT_MASK.z

    return Math.hypot(dx, dz) < BENCH_HIDE_RADIUS
}

export class Benches
{
    constructor()
    {
        this.game = Game.getInstance()

        const instances = this.game.resources.benchesModel.scene.children

        // Base and references
        const [ base, allReferences ] = InstancedGroup.getBaseAndReferencesFromInstances(instances)
        const references = []

        for(let i = 0; i < instances.length; i++)
        {
            if(shouldHideBench(instances[i]))
                continue

            references.push(allReferences[i])
        }

        base.castShadow = true
        base.receiveShadow = true
        base.frustumCulled = true

        // Descriptions > To extract colliders
        const descriptions = this.game.objects.getFromModel(base, {}, {})
        
        // Update materials 
        this.game.materials.updateObject(base)

        // Objects
        this.objects = []
        for(const reference of references)
        {
            this.objects.push(this.game.objects.add(
                {
                    model: reference,
                    updateMaterials: false,
                    parent: null,
                },
                {
                    type: 'dynamic',
                    position: reference.position,
                    rotation: reference.quaternion,
                    friction: 0.7,
                    mass: 0.1,
                    sleeping: true,
                    colliders: descriptions[1].colliders,
                    waterGravityMultiplier: - 1,
                    contactThreshold: 10,
                    onCollision: (force, position) =>
                    {
                        // this.game.audio.groups.get('hitMetal').playRandomNext(force, position)
                    }
                },
            ))
        }


        // Instanced group
        this.instancedGroup = new InstancedGroup(references, base)

        // Tick update
        this.game.ticker.events.on('tick', () =>
        {
            for(const object of this.objects)
            {
                if(!object.physical.body.isSleeping() && object.physical.body.isEnabled())
                    object.visual.object3D.needsUpdate = true
            }
        }, 10)
    }
}