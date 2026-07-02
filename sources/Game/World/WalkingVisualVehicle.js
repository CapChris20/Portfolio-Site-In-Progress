import * as THREE from 'three/webgpu'
import { CustomVisualVehicle } from './CustomVisualVehicle.js'

export class WalkingVisualVehicle extends CustomVisualVehicle
{
    constructor(model, options = {})
    {
        super(model, options)

        this.walkPhase = 0
        this.walkDistance = 0
        this.modelBaseY = this.model.position.y
        this.visualYaw = 0
        this.smoothedPosition = new THREE.Vector3()
        this.smoothedQuaternion = new THREE.Quaternion()
        this._hasSmoothing = false
    }

    setBoostTrails()
    {
        this.boostTrails = { left: null, right: null }
    }

    update()
    {
        const physicalVehicle = this.game.physicalVehicle
        const speed = physicalVehicle.xzSpeed
        const moving = speed > 0.15
        const steering = this.game.player.steering
        const delta = this.game.ticker.deltaScaled

        if(!this._hasSmoothing)
        {
            this.smoothedPosition.copy(physicalVehicle.position)
            this.smoothedQuaternion.copy(physicalVehicle.quaternion)
            this.visualYaw = physicalVehicle.yRotation
            this._hasSmoothing = true
        }

        this.smoothedPosition.lerp(physicalVehicle.position, Math.min(1, delta * 18))
        this.smoothedQuaternion.slerp(physicalVehicle.quaternion, Math.min(1, delta * 14))

        this.parts.chassis.position.copy(this.smoothedPosition)
        this.parts.chassis.quaternion.copy(this.smoothedQuaternion)

        if(moving)
        {
            this.walkDistance += speed * delta * 0.55
            this.walkPhase = this.walkDistance * Math.PI * 2

            const stride = Math.min(speed / 1.6, 1)
            const stepWave = Math.sin(this.walkPhase)
            const stepLift = Math.max(0, stepWave)
            const stomp = stepWave < -0.8 ? 0.1 * stride : 0
            const sway = Math.sin(this.walkPhase * 0.5)

            this.model.position.y = this.modelBaseY + stepLift * 0.35 * stride - stomp
            this.model.position.x = sway * 0.22 * stride
            this.model.position.z = Math.cos(this.walkPhase) * 0.12 * stride

            this.model.rotation.x = 0.18 * stride + stepLift * 0.12
            this.model.rotation.z = steering * 0.2 * stride + sway * 0.1 * stride
        }
        else
        {
            this.model.position.y += (this.modelBaseY - this.model.position.y) * 0.2
            this.model.position.x *= 0.85
            this.model.position.z *= 0.85
            this.model.rotation.x *= 0.85
            this.model.rotation.z *= 0.85
        }

        const vector = new THREE.Vector3()
        vector.setFromMatrixPosition(this.parts.chassis.matrixWorld)
        vector.project(this.game.view.camera)

        this.screenPosition.x = (vector.x * 0.5 + 0.5)
        this.screenPosition.y = (vector.y * -0.5 + 0.5)
    }
}
