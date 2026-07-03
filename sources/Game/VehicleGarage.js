import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { CustomVisualVehicle } from './World/CustomVisualVehicle.js'
import { WalkingVisualVehicle } from './World/WalkingVisualVehicle.js'
import { VisualVehicle } from './World/VisualVehicle.js'
import {
    applyVehicleStyleMaterials,
    createGroundedPropVisual,
    preparePropMaterials,
} from './World/PropVisual.js'
import { attachStatuePhysics } from './World/StaticProp.js'

const STORAGE_KEY = 'folioVehicleChoice'

export const VEHICLE_ORDER = [ 'mcqueen', 'motorcycle', 'secondMotorcycle', 'speedStar', 'king', 'radiatorMcqueen' ]

export const GARAGE_PALM_COLOR_A = '#602060'
export const GARAGE_PALM_COLOR_B = '#ff50a0'

// Open grass on the east side — off the circuit track and away from landmarks.
export const GARAGE_WORLD_POSITION = Object.freeze({
    x: 70,
    y: 0,
    z: 25,
})

export const GARAGE_SPAWN = Object.freeze({
    x: 63,
    y: 4,
    z: 25,
    rotation: Math.PI,
})

const GARAGE_BUILDING_LENGTH = 10
const GARAGE_INTERACT_RADIUS = 30

const GARAGE_SLOTS = [
    {
        id: 'mcqueen',
        local: { x: -2.3, z: -0.75 },
        rotationY: 0,
        vehicleRotationY: Math.PI * 0.5,
        parkedLength: 2.0,
    },
    {
        id: 'motorcycle',
        local: { x: 0, z: -0.75 },
        rotationY: 0,
        vehicleRotationY: Math.PI * 0.5,
        parkedLength: 2.2,
    },
    {
        id: 'secondMotorcycle',
        local: { x: 2.3, z: -0.75 },
        rotationY: 0,
        vehicleRotationY: Math.PI * 0.5,
        parkedLength: 2.2,
    },
    {
        id: 'speedStar',
        local: { x: -2.3, z: -2.4 },
        rotationY: 0,
        vehicleRotationY: Math.PI * 0.5,
        parkedLength: 2.0,
    },
    {
        id: 'king',
        local: { x: 0, z: -2.4 },
        rotationY: 0,
        vehicleRotationY: Math.PI * 0.5,
        parkedLength: 2.0,
    },
    {
        id: 'radiatorMcqueen',
        local: { x: 2.3, z: -2.4 },
        rotationY: 0,
        vehicleRotationY: Math.PI * 0.5,
        parkedLength: 2.0,
    },
]

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
        parkingLength: 5.5,
        options: {
            targetLength: 5.5,
            groundY: -0.85,
            rotationY: Math.PI * 0.5,
        },
    },
    secondMotorcycle: {
        id: 'secondMotorcycle',
        label: '2nd Motorcycle',
        resourceKey: 'secondMotorcycleVehicle',
        visual: 'drive',
        parkingLength: 5.5,
        options: {
            targetLength: 5.5,
            groundY: -0.85,
            rotationY: Math.PI * 0.5,
        },
    },
    speedStar: {
        id: 'speedStar',
        label: 'Speed Star',
        resourceKey: 'speedStarVehicle',
        visual: 'drive',
        parkingLength: 6,
        options: {
            targetLength: 6,
            groundY: -0.85,
            rotationY: Math.PI * 0.5,
        },
    },
    king: {
        id: 'king',
        label: 'The King',
        resourceKey: 'kingVehicle',
        visual: 'drive',
        parkingLength: 6,
        options: {
            targetLength: 6,
            groundY: -0.85,
            rotationY: Math.PI * 0.5,
        },
    },
    radiatorMcqueen: {
        id: 'radiatorMcqueen',
        label: 'Retro McQueen',
        resourceKey: 'radiatorMcqueenVehicle',
        visual: 'drive',
        parkingLength: 6,
        options: {
            targetLength: 6,
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

        this.tickCallback = () =>
        {
            this.update()
        }
        this.game.ticker.events.on('tick', this.tickCallback, 9)
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

    getMapPinPosition()
    {
        if(this.parking?.group)
        {
            const position = new THREE.Vector3()
            this.parking.group.getWorldPosition(position)
            return position
        }

        return new THREE.Vector3(
            GARAGE_WORLD_POSITION.x,
            GARAGE_WORLD_POSITION.y,
            GARAGE_WORLD_POSITION.z,
        )
    }

    getInteractPosition()
    {
        const position = this.getMapPinPosition()
        position.y += 3.2
        return position
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

    setGarageBuilding(position, rotationY = Math.PI)
    {
        this.clearParkingSlots()

        if(this.parking?.group)
            this.parking.group.removeFromParent()

        const source = this.game.resources.oldGarage?.scene

        if(!source)
        {
            console.warn('VehicleGarage: oldGarage resource missing')
            this.setParkingSpot(position, rotationY)
            return
        }

        const building = source.clone(true)
        preparePropMaterials(building, 'garageBuilding')

        building.traverse((child) =>
        {
            if(child.isMesh)
            {
                child.castShadow = true
                child.receiveShadow = true
            }
        })

        const box = new THREE.Box3().setFromObject(building)
        const size = box.getSize(new THREE.Vector3())
        const footprint = Math.max(size.x, size.z)
        const scale = GARAGE_BUILDING_LENGTH / footprint

        building.scale.setScalar(scale)
        building.updateMatrixWorld(true)

        const fittedBox = new THREE.Box3().setFromObject(building)
        const center = fittedBox.getCenter(new THREE.Vector3())

        building.position.x -= center.x
        building.position.z -= center.z
        building.position.y -= fittedBox.min.y

        this.game.materials.applyObjectMaterials(building, { useCache: false })

        const group = new THREE.Group()
        group.name = 'vehicleGarageBuilding'
        group.position.copy(position)
        group.rotation.y = rotationY

        const vehiclesGroup = new THREE.Group()
        vehiclesGroup.name = 'vehicleGarageSlots'
        group.add(building)
        group.add(vehiclesGroup)

        this.game.scene.add(group)

        group.updateMatrixWorld(true)

        attachStatuePhysics(group, GARAGE_BUILDING_LENGTH, {
            position: group.position,
            rotation: group.quaternion,
        })

        this.parking = {
            position: position.clone(),
            rotationY,
            group,
            building,
            vehiclesGroup,
            slots: [],
        }
        this.parkingRotation = rotationY

        this.refreshParkingDisplay()
    }

    setParkingSpot(position, rotationY = 0)
    {
        this.parking = {
            position: position.clone(),
            rotationY,
            group: new THREE.Group(),
            vehiclesGroup: null,
            slots: [],
        }

        this.parking.group.name = 'vehicleGarageParking'
        this.parking.group.position.copy(position)
        this.parking.group.position.y += 0.02
        this.parking.group.rotation.y = rotationY
        this.parking.vehiclesGroup = this.parking.group
        this.game.scene.add(this.parking.group)
        this.parkingRotation = rotationY

        this.refreshParkingDisplay()
    }

    clearParkingSlots()
    {
        if(!this.parking?.slots?.length)
            return

        for(const slot of this.parking.slots)
        {
            if(slot.intersect)
                this.game.rayCursor.removeIntersect(slot.intersect)
        }

        this.parking.slots = []
    }

    refreshParkingDisplay()
    {
        if(!this.parking?.vehiclesGroup)
            return

        this.clearParkingSlots()
        this.parking.vehiclesGroup.clear()

        for(const slotConfig of GARAGE_SLOTS)
        {
            if(!VEHICLE_ORDER.includes(slotConfig.id))
                continue

            if(slotConfig.id === this.activeId)
                continue

            const definition = VEHICLE_DEFINITIONS[slotConfig.id]
            const resource = this.game.resources[definition.resourceKey]

            if(!resource?.scene)
            {
                console.warn(`VehicleGarage: missing parked display for "${slotConfig.id}"`)
                continue
            }

            const slotGroup = new THREE.Group()
            slotGroup.name = `garageSlot_${slotConfig.id}`
            slotGroup.position.set(slotConfig.local.x, 0, slotConfig.local.z)
            slotGroup.rotation.y = slotConfig.rotationY ?? 0

            const parkedLength = slotConfig.parkedLength ?? definition.parkingLength * 0.45

            const visual = createGroundedPropVisual(resource.scene, parkedLength, {
                materialPrefix: `garageParked${slotConfig.id}`,
            })

            applyVehicleStyleMaterials(visual, { polished: true })
            visual.rotation.y = slotConfig.vehicleRotationY ?? definition.options.rotationY

            const hitbox = new THREE.Object3D()
            hitbox.position.y = parkedLength * 0.35
            slotGroup.add(visual)
            slotGroup.add(hitbox)
            this.parking.vehiclesGroup.add(slotGroup)

            const baseScale = visual.scale.clone()
            const intersect = this.game.rayCursor.addIntersect({
                active: false,
                shape: new THREE.Sphere(new THREE.Vector3(), parkedLength * 0.55),
                onClick: () =>
                {
                    this.select(slotConfig.id)
                },
                onEnter: () =>
                {
                    visual.scale.copy(baseScale).multiplyScalar(1.06)
                },
                onLeave: () =>
                {
                    visual.scale.copy(baseScale)
                },
            })

            hitbox.getWorldPosition(intersect.shape.center)

            this.parking.slots.push({
                id: slotConfig.id,
                group: slotGroup,
                visual,
                hitbox,
                intersect,
                baseScale,
            })
        }
    }

    update()
    {
        if(!this.parking?.slots?.length || !this.parking.position)
            return

        const playerDistance = Math.hypot(
            this.game.player.position.x - this.parking.position.x,
            this.game.player.position.z - this.parking.position.z,
        )

        const nearGarage = playerDistance < GARAGE_INTERACT_RADIUS

        for(const slot of this.parking.slots)
        {
            if(!slot.intersect)
                continue

            slot.hitbox.getWorldPosition(slot.intersect.shape.center)
            slot.intersect.active = nearGarage
        }
    }
}
