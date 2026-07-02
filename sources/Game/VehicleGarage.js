import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { CustomVisualVehicle } from './World/CustomVisualVehicle.js'
import { WalkingVisualVehicle } from './World/WalkingVisualVehicle.js'
import { VisualVehicle } from './World/VisualVehicle.js'
import { createGroundedPropVisual, applyVehicleStyleMaterials } from './World/PropVisual.js'

const STORAGE_KEY = 'folioVehicleChoice'

export const VEHICLE_ORDER = [ 'mcqueen', 'motorcycle' ]

// Open grass on the east side — off the circuit track and away from landmarks.
export const GARAGE_WORLD_POSITION = Object.freeze({
    x: 70,
    y: 0,
    z: 25,
})

export const GARAGE_SPAWN = Object.freeze({
    x: 66.5,
    y: 4,
    z: 25,
    rotation: Math.PI,
})

const GARAGE_PARKING_SPACING = 7

const DEFAULT_PHYSICS = {
    locomotion: 'drive',
    steeringAmplitude: 0.5,
    engineForceAmplitude: 300,
    topSpeed: 5,
    topSpeedBoost: 40,
    boostMultiplier: 2,
    walkTurnSpeed: 3.5,
    walkAcceleration: 14,
    wheels: {
        offset: { x: 0.90, y: 0, z: 0.75 },
        radius: 0.4,
    },
}

export const VEHICLE_DEFINITIONS = {
    mcqueen: {
        id: 'mcqueen',
        label: 'McQueen',
        resourceKey: 'customVehicle',
        visual: 'drive',
        parkingLength: 6.35,
        options: {
            targetLength: 6.35,
            groundY: -0.85,
            rotationY: Math.PI * 0.5,
        },
    },
    motorcycle: {
        id: 'motorcycle',
        label: 'Motorcycle',
        resourceKey: 'motorcycleVehicle',
        visual: 'drive',
        parkingLength: 4.5,
        options: {
            targetLength: 4.5,
            groundY: -0.85,
            rotationY: Math.PI * 0.5,
        },
    },
    mecha: {
        id: 'mecha',
        label: 'Mecha',
        resourceKey: 'mechaVehicle',
        visual: 'walk',
        parkingLength: 5.5,
        options: {
            targetLength: 5.5,
            groundY: -0.5,
            rotationY: Math.PI * 0.5,
        },
        physics: {
            locomotion: 'walk',
            steeringAmplitude: 0.6,
            engineForceAmplitude: 0,
            topSpeed: 1.75,
            topSpeedBoost: 1.75,
            boostMultiplier: 1,
            walkTurnSpeed: 5,
            walkAcceleration: 18,
            wheels: {
                offset: { x: 0.25, y: 0, z: 0.25 },
                radius: 0.12,
            },
        },
    },
}

export class VehicleGarage
{
    constructor()
    {
        this.game = Game.getInstance()
        this.activeId = this.loadSavedChoice()
        this.parking = null
        this.parkingRotation = 0
    }

    loadSavedChoice()
    {
        try
        {
            const saved = localStorage.getItem(STORAGE_KEY)

            if(saved && VEHICLE_DEFINITIONS[saved] && VEHICLE_ORDER.includes(saved))
                return saved
        }
        catch(_error) {}

        return 'mcqueen'
    }

    getDefinition(id = this.activeId)
    {
        return VEHICLE_DEFINITIONS[id]
    }

    getNextId()
    {
        const start = VEHICLE_ORDER.indexOf(this.activeId)

        for(let i = 1; i <= VEHICLE_ORDER.length; i++)
        {
            const id = VEHICLE_ORDER[(start + i) % VEHICLE_ORDER.length]
            const resource = this.game.resources[VEHICLE_DEFINITIONS[id].resourceKey]

            if(resource?.scene)
                return id
        }

        return this.activeId
    }

    getInactiveIds()
    {
        return VEHICLE_ORDER.filter((id) =>
        {
            if(id === this.activeId)
                return false

            return !!this.game.resources[VEHICLE_DEFINITIONS[id].resourceKey]?.scene
        })
    }

    mount()
    {
        if(this.game.vehicleMode === 'custom')
            this.apply(this.activeId, { save: false, refreshParking: false })
        else
            this.game.world.visualVehicle = new VisualVehicle(this.game.resources.vehicle.scene)
    }

    createVisual(definition, scene)
    {
        if(definition.visual === 'walk')
            return new WalkingVisualVehicle(scene, definition.options)

        return new CustomVisualVehicle(scene, definition.options)
    }

    applyPhysicsProfile(profile)
    {
        const physicalVehicle = this.game.physicalVehicle
        const settings = profile ?? DEFAULT_PHYSICS

        physicalVehicle.locomotion = settings.locomotion ?? 'drive'
        physicalVehicle.steeringAmplitude = settings.steeringAmplitude
        physicalVehicle.engineForceAmplitude = settings.engineForceAmplitude
        physicalVehicle.topSpeed = settings.topSpeed
        physicalVehicle.topSpeedBoost = settings.topSpeedBoost
        physicalVehicle.boostMultiplier = settings.boostMultiplier ?? 2
        physicalVehicle.walkTurnSpeed = settings.walkTurnSpeed ?? 3.5
        physicalVehicle.walkAcceleration = settings.walkAcceleration ?? 14

        if(settings.wheels)
        {
            physicalVehicle.wheels.settings.offset.x = settings.wheels.offset.x
            physicalVehicle.wheels.settings.offset.y = settings.wheels.offset.y
            physicalVehicle.wheels.settings.offset.z = settings.wheels.offset.z
            physicalVehicle.wheels.settings.radius = settings.wheels.radius
            physicalVehicle.wheels.updateSettings()
        }
    }

    apply(id, { save = true, refreshParking = true } = {})
    {
        const definition = VEHICLE_DEFINITIONS[id]
        const resource = this.game.resources[definition.resourceKey]

        if(!resource?.scene)
        {
            console.warn(`VehicleGarage: missing resource for "${id}"`)
            return false
        }

        if(this.game.world.visualVehicle?.destroy)
            this.game.world.visualVehicle.destroy()

        if(this.game.vehicleMode === 'custom')
            this.game.world.visualVehicle = this.createVisual(definition, resource.scene)
        else
            this.game.world.visualVehicle = new VisualVehicle(resource.scene)

        this.applyPhysicsProfile(definition.physics ?? DEFAULT_PHYSICS)

        if(definition.physics?.locomotion === 'walk')
        {
            const body = this.game.physicalVehicle.chassis.physical.body
            const rotation = body.rotation()
            const euler = new THREE.Euler().setFromQuaternion(
                new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
                'YXZ',
            )
            const upright = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, euler.y, 0))
            body.setRotation({ x: upright.x, y: upright.y, z: upright.z, w: upright.w })
            body.setLinvel({ x: 0, y: body.linvel().y, z: 0 })
            body.setAngvel({ x: 0, y: 0, z: 0 })
        }

        this.activeId = id

        if(save)
        {
            try
            {
                localStorage.setItem(STORAGE_KEY, id)
            }
            catch(_error) {}
        }

        if(refreshParking)
            this.refreshParkingDisplay()

        return true
    }

    select(id)
    {
        if(id === this.activeId)
            return true

        const applied = this.apply(id)

        if(!applied)
            return false

        if(this.game.world.confetti)
            this.game.world.confetti.pop(this.game.physicalVehicle.position.clone())

        this.game.audio.groups.get('uiDing')?.play()

        return true
    }

    swap()
    {
        return this.select(this.getNextId())
    }

    setParkingSpot(position, rotationY = 0)
    {
        this.parking = {
            position: position.clone(),
            rotationY,
            group: new THREE.Group(),
        }

        this.parking.group.name = 'vehicleGarageParking'
        this.parking.group.position.copy(position)
        this.parking.group.position.y += 0.02
        this.parking.group.rotation.y = rotationY
        this.game.scene.add(this.parking.group)
        this.parkingRotation = rotationY

        this.refreshParkingDisplay()
    }

    refreshParkingDisplay()
    {
        if(!this.parking?.group)
            return

        this.parking.group.clear()

        const inactiveIds = this.getInactiveIds()

        if(!inactiveIds.length)
            return

        const rowWidth = (inactiveIds.length - 1) * GARAGE_PARKING_SPACING
        const startX = -rowWidth * 0.5

        inactiveIds.forEach((id, index) =>
        {
            const definition = VEHICLE_DEFINITIONS[id]
            const resource = this.game.resources[definition.resourceKey]

            if(!resource?.scene)
            {
                console.warn(`VehicleGarage: missing parked display for "${id}"`)
                return
            }

            const visual = createGroundedPropVisual(resource.scene, definition.parkingLength, {
                materialPrefix: `garageParked${id}`,
            })

            applyVehicleStyleMaterials(visual, { polished: true })

            visual.rotation.y = definition.options.rotationY
            visual.position.x += startX + index * GARAGE_PARKING_SPACING
            this.parking.group.add(visual)
        })
    }
}
