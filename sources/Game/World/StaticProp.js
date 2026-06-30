import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { createGroundedPropVisual } from './PropVisual.js'

export class StaticProp
{
    constructor(sourceModel, options = {})
    {
        this.game = Game.getInstance()

        this.options = {
            position: new THREE.Vector3(),
            rotationY: 0,
            targetLength: 3,
            ...options,
        }

        if(this.options.position instanceof THREE.Vector3 === false)
            this.options.position = new THREE.Vector3(
                this.options.position.x ?? 0,
                0,
                this.options.position.z ?? 0,
            )

        this.group = new THREE.Group()
        this.group.name = this.options.name || 'statuePhysicalFixed'
        this.group.position.copy(this.options.position)

        if(this.options.facePosition)
        {
            const face = this.options.facePosition instanceof THREE.Vector3
                ? this.options.facePosition
                : new THREE.Vector3(
                    this.options.facePosition.x ?? 0,
                    this.options.facePosition.y ?? 0,
                    this.options.facePosition.z ?? 0,
                )

            this.group.lookAt(face)

            if(this.options.faceFlip)
                this.group.rotateY(Math.PI)
        }
        else
        {
            this.group.rotation.y = this.options.rotationY
        }

        const model = createGroundedPropVisual(sourceModel, this.options.targetLength, {
            castShadow: this.options.castShadow,
            receiveShadow: this.options.receiveShadow,
            materialPrefix: this.options.name || 'staticProp',
        })

        if(this.options.modelRotationY)
            model.rotation.y = this.options.modelRotationY

        this.game.materials.applyObjectMaterials(model, { useCache: false })
        this.group.add(model)

        if(this.options.physical !== false)
            this.setPhysical()
        else
            this.game.scene.add(this.group)
    }

    setPhysical()
    {
        attachStatuePhysics(this.group, this.options.targetLength, {
            position: this.options.position,
            rotation: this.group.quaternion,
            castShadow: this.options.castShadow,
            receiveShadow: this.options.receiveShadow,
        })
    }

    destroy()
    {
        this.group.removeFromParent()
    }
}

/**
 * Fixed cuboid colliders matching areas.glb props (walls, altar, cones).
 * Use for custom statue GLBs that are added as plain scene visuals.
 */
export function attachStatuePhysics(group, targetLength, options = {})
{
    const game = Game.getInstance()

    if(!/physical/i.test(group.name))
        group.name = `${group.name}PhysicalFixed`

    for(const child of [...group.children])
    {
        if(/^cuboid/i.test(child.name))
            group.remove(child)
    }

    const scale = targetLength / 5.5

    const base = new THREE.Object3D()
    base.name = 'cuboid'
    base.scale.set(3.4 * scale, 1.0 * scale, 3.4 * scale)
    base.position.y = 0.5 * scale
    group.add(base)

    const body = new THREE.Object3D()
    body.name = 'cuboid.001'
    body.scale.set(2.6 * scale, 6.0 * scale, 2.2 * scale)
    body.position.y = 3.4 * scale
    group.add(body)

    const position = options.position ?? group.position

    return game.objects.addFromModel(
        group,
        {
            castShadow: options.castShadow ?? false,
            receiveShadow: options.receiveShadow ?? true,
            updateMaterials: false,
            parent: group.parent ? null : game.scene,
        },
        {
            type: 'fixed',
            position: new THREE.Vector3(position.x, 0, position.z),
            rotation: (options.rotation ?? group.quaternion).clone(),
            friction: 0.9,
            restitution: 0.02,
            sleeping: true,
            contactThreshold: 2,
            onCollision: (force, collisionPosition) =>
            {
                game.audio.groups.get('hitDefault').playRandomNext(force, collisionPosition)
            },
        },
    )
}
