import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Trails } from '../Trails.js'

export class CustomVisualVehicle
{
    constructor(model, options = {})
    {
        this.game = Game.getInstance()

        this.options = {
            targetLength: 5.75,
            groundY: -0.85,
            rotationY: Math.PI / 2,
            ...options,
        }

        this.parts = {}
        this.wheels = { items: [] }

        this.setChassis(model)
        this.setBoostTrails()
        this.setScreenPosition()

        this.tickCallback = () =>
        {
            this.update()
        }
        this.game.ticker.events.on('tick', this.tickCallback, 8)
    }

    destroy()
    {
        this.game.ticker.events.off('tick', this.tickCallback)
        this.parts.chassis.removeFromParent()
    }

    setChassis(sourceModel)
    {
        this.parts.chassis = new THREE.Group()
        this.parts.chassis.name = 'chassis'
        this.parts.chassis.rotation.reorder('YXZ')

        const model = sourceModel.clone(true)
        model.rotation.y = this.options.rotationY

        model.traverse((child) =>
        {
            if(child.isMesh)
            {
                child.castShadow = true
                child.receiveShadow = true

                if(child.material)
                    child.material.shadowSide = THREE.BackSide
            }
        })

        this.game.materials.updateObject(model)

        const box = new THREE.Box3().setFromObject(model)
        const size = box.getSize(new THREE.Vector3())
        const length = Math.max(size.x, size.z)
        const scale = this.options.targetLength / length
        model.scale.setScalar(scale)

        model.updateMatrixWorld(true)

        const fittedBox = new THREE.Box3().setFromObject(model)
        const center = fittedBox.getCenter(new THREE.Vector3())
        model.position.x -= center.x
        model.position.z -= center.z
        model.position.y = this.options.groundY - fittedBox.min.y

        this.parts.bodyPainted = model
        this.parts.chassis.add(model)
        this.game.scene.add(this.parts.chassis)

        this.model = model
        this.localBounds = new THREE.Box3().setFromObject(model)
    }

    setBoostTrails()
    {
        this.boostTrails = {}
        this.boostTrails.instance = new Trails()

        const rearZ = this.localBounds.max.z + 0.15
        const width = (this.localBounds.max.x - this.localBounds.min.x) * 0.25

        this.boostTrails.leftReference = new THREE.Object3D()
        this.boostTrails.leftReference.position.set(width, 0.15, rearZ)
        this.parts.chassis.add(this.boostTrails.leftReference)

        this.boostTrails.left = this.boostTrails.instance.create()
        this.boostTrails.leftReference.getWorldPosition(this.boostTrails.left.position)

        this.boostTrails.rightReference = new THREE.Object3D()
        this.boostTrails.rightReference.position.set(-width, 0.15, rearZ)
        this.parts.chassis.add(this.boostTrails.rightReference)

        this.boostTrails.right = this.boostTrails.instance.create()
        this.boostTrails.rightReference.getWorldPosition(this.boostTrails.right.position)
    }

    setScreenPosition()
    {
        this.screenPosition = new THREE.Vector2(0, 0)
    }

    update()
    {
        const physicalVehicle = this.game.physicalVehicle

        this.parts.chassis.position.copy(physicalVehicle.position)
        this.parts.chassis.quaternion.copy(physicalVehicle.quaternion)
        this.model.rotation.z = 0

        const trailAlpha = physicalVehicle.goingForward && this.game.player.boosting && this.game.player.accelerating > 0 ? 1 : 0
        this.boostTrails.leftReference.getWorldPosition(this.boostTrails.left.position)
        this.boostTrails.left.alpha = trailAlpha
        this.boostTrails.rightReference.getWorldPosition(this.boostTrails.right.position)
        this.boostTrails.right.alpha = trailAlpha

        const vector = new THREE.Vector3()
        vector.setFromMatrixPosition(this.parts.chassis.matrixWorld)
        vector.project(this.game.view.camera)

        this.screenPosition.x = (vector.x * 0.5 + 0.5)
        this.screenPosition.y = (vector.y * -0.5 + 0.5)
    }
}
