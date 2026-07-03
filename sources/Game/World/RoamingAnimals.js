import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { alea } from 'seedrandom'
import { applyVehicleStyleMaterials, createGroundedPropVisual } from './PropVisual.js'
import { TerrainHeightSampler } from './TerrainHeightSampler.js'

const LION_SPAWNS = [
    { x: -69, z: 55 },
    { x: 1, z: 49 },
    { x: 16, z: -80 },
    { x: -68, z: -80 },
]

function lerpAngle(current, target, alpha)
{
    let delta = target - current

    while(delta > Math.PI)
        delta -= Math.PI * 2

    while(delta < -Math.PI)
        delta += Math.PI * 2

    return current + delta * alpha
}

class RoamingLion
{
    static STATE_IDLE = 0
    static STATE_WALK = 1
    static STATE_FLEE = 2

    constructor(source, spawn, config, random, terrain)
    {
        this.game = Game.getInstance()
        this.config = config
        this.random = random
        this.terrain = terrain

        this.group = new THREE.Group()
        this.group.name = 'roamingLion'

        this.visual = createGroundedPropVisual(source, config.length, {
            materialPrefix: 'roamingLion',
        })

        if(config.modelRotationY)
            this.visual.rotation.y = config.modelRotationY

        applyVehicleStyleMaterials(this.visual, {
            polished: false,
            materialNamePrefix: 'roamingLion',
        })

        this.visual.traverse((child) =>
        {
            if(child.isMesh)
            {
                child.castShadow = true
                child.receiveShadow = true
            }
        })

        this.group.add(this.visual)
        this.game.scene.add(this.group)

        this.home = new THREE.Vector3(spawn.x, 0, spawn.z)
        this.baseY = this.visual.position.y
        this.walkPhase = random() * Math.PI * 2
        this.state = RoamingLion.STATE_IDLE
        this.idleTimer = 1 + random() * 2
        this.target = new THREE.Vector3()
        this.moveDirection = new THREE.Vector3(0, 0, 1)
        this.facing = random() * Math.PI * 2
        this.fleeTimer = 0
        this.stuckTimer = 0
        this.lastProgressDistance = Infinity

        this.setPosition(spawn.x, spawn.z)
        this.pickWanderTarget(true)
    }

    setPosition(x, z)
    {
        const y = this.terrain.getHeightAt(x, z)
        this.group.position.set(x, y, z)
    }

    pickWanderTarget(force = false)
    {
        const origin = force ? this.home : this.group.position
        let bestTarget = null
        let bestScore = -Infinity

        for(let attempt = 0; attempt < 40; attempt++)
        {
            const angle = this.random() * Math.PI * 2
            const radius = 4 + this.random() * this.config.wanderRadius
            const x = origin.x + Math.cos(angle) * radius
            const z = origin.z + Math.sin(angle) * radius

            if(!this.terrain.isWalkable(x, z))
                continue

            const distFromHome = Math.hypot(x - this.home.x, z - this.home.z)

            if(distFromHome > this.config.homeRadius)
                continue

            const distFromCurrent = Math.hypot(
                x - this.group.position.x,
                z - this.group.position.z,
            )

            if(distFromCurrent < 2.5)
                continue

            const terrain = this.terrain.sampleTerrain(x, z)
            const grassScore = terrain?.grass ?? 0.5
            const score = grassScore * 2 + distFromCurrent * 0.08

            if(score > bestScore)
            {
                bestScore = score
                bestTarget = new THREE.Vector3(x, this.terrain.getHeightAt(x, z), z)
            }
        }

        if(bestTarget)
        {
            this.target.copy(bestTarget)
            return true
        }

        this.target.copy(this.home)
        this.target.y = this.terrain.getHeightAt(this.home.x, this.home.z)
        return false
    }

    pickFleeTarget()
    {
        const player = this.game.player.position
        const awayX = this.group.position.x - player.x
        const awayZ = this.group.position.z - player.z
        const awayLength = Math.hypot(awayX, awayZ) || 1

        for(let attempt = 0; attempt < 24; attempt++)
        {
            const spread = (this.random() - 0.5) * 0.8
            const dirX = awayX / awayLength + spread
            const dirZ = awayZ / awayLength - spread
            const dirLength = Math.hypot(dirX, dirZ) || 1
            const fleeDistance = 10 + this.random() * 10
            const fleeX = this.group.position.x + (dirX / dirLength) * fleeDistance
            const fleeZ = this.group.position.z + (dirZ / dirLength) * fleeDistance

            if(this.terrain.isWalkable(fleeX, fleeZ))
            {
                this.target.set(
                    fleeX,
                    this.terrain.getHeightAt(fleeX, fleeZ),
                    fleeZ,
                )
                return
            }
        }

        this.pickWanderTarget()
    }

    update(delta)
    {
        const player = this.game.player.position
        const distToPlayer = this.group.position.distanceTo(player)
        const playerSpeed = this.game.physicalVehicle.xzSpeed

        if(this.fleeTimer > 0)
        {
            this.fleeTimer -= delta
            this.state = RoamingLion.STATE_FLEE
        }
        else if(distToPlayer < this.config.fleeDistance && playerSpeed > 1.25)
        {
            this.state = RoamingLion.STATE_FLEE
            this.fleeTimer = 3.5
            this.pickFleeTarget()
        }
        else if(this.state === RoamingLion.STATE_FLEE)
        {
            this.state = RoamingLion.STATE_IDLE
            this.idleTimer = 1 + this.random() * 2
        }

        let speed = 0

        if(this.state === RoamingLion.STATE_IDLE)
        {
            this.idleTimer -= delta

            if(this.idleTimer <= 0)
            {
                if(this.pickWanderTarget())
                    this.state = RoamingLion.STATE_WALK
                else
                    this.idleTimer = 0.75 + this.random() * 1.5
            }

            const breathe = Math.sin(this.game.ticker.elapsedScaled * 1.2 + this.walkPhase) * 0.015
            this.visual.position.y = THREE.MathUtils.lerp(this.visual.position.y, this.baseY + breathe, 1 - Math.pow(0.001, delta))
            this.visual.rotation.x = THREE.MathUtils.lerp(this.visual.rotation.x, 0, 1 - Math.pow(0.001, delta))
        }
        else
        {
            const dx = this.target.x - this.group.position.x
            const dz = this.target.z - this.group.position.z
            const distance = Math.hypot(dx, dz)

            if(distance < 0.8)
            {
                this.state = RoamingLion.STATE_IDLE
                this.idleTimer = 2 + this.random() * 4
                this.stuckTimer = 0
                speed = 0
            }
            else
            {
                const inv = 1 / distance
                const moveX = dx * inv
                const moveZ = dz * inv
                speed = this.state === RoamingLion.STATE_FLEE
                    ? this.config.fleeSpeed
                    : this.config.walkSpeed

                const nextX = this.group.position.x + moveX * speed * delta
                const nextZ = this.group.position.z + moveZ * speed * delta

                if(this.terrain.isWalkable(nextX, nextZ))
                {
                    this.group.position.x = nextX
                    this.group.position.z = nextZ
                    this.group.position.y = this.terrain.getHeightAt(nextX, nextZ)
                    this.moveDirection.set(moveX, 0, moveZ)
                    this.stuckTimer = 0
                }
                else
                {
                    this.stuckTimer += delta

                    if(this.stuckTimer > 0.6)
                    {
                        this.pickWanderTarget()
                        this.stuckTimer = 0
                    }
                }

                if(distance >= this.lastProgressDistance - 0.01)
                    this.stuckTimer += delta
                else
                    this.stuckTimer = Math.max(0, this.stuckTimer - delta * 2)

                this.lastProgressDistance = distance

                if(this.stuckTimer > 1.25)
                {
                    this.state = RoamingLion.STATE_IDLE
                    this.idleTimer = 0.5 + this.random()
                    this.stuckTimer = 0
                    speed = 0
                }

                this.facing = Math.atan2(this.moveDirection.x, this.moveDirection.z) + (this.config.facingOffset ?? 0)
            }
        }

        const turnSpeed = speed > 0.05 ? 8 : 3
        this.group.rotation.y = lerpAngle(this.group.rotation.y, this.facing, 1 - Math.exp(-turnSpeed * delta))

        if(speed > 0.05)
        {
            this.walkPhase += delta * speed * 6
            const stride = Math.min(speed / this.config.walkSpeed, 1.35)
            const step = Math.sin(this.walkPhase)
            const lift = Math.max(0, step)

            this.visual.position.y = this.baseY + lift * 0.08 * stride
            this.visual.rotation.x = -0.05 * stride
            this.visual.position.x = THREE.MathUtils.lerp(this.visual.position.x, 0, 1 - Math.pow(0.001, delta))
            this.visual.rotation.z = THREE.MathUtils.lerp(this.visual.rotation.z, 0, 1 - Math.pow(0.001, delta))
        }
        else
        {
            this.visual.position.y = THREE.MathUtils.lerp(this.visual.position.y, this.baseY, 1 - Math.pow(0.001, delta))
            this.visual.rotation.x = THREE.MathUtils.lerp(this.visual.rotation.x, 0, 1 - Math.pow(0.001, delta))
            this.visual.rotation.z = THREE.MathUtils.lerp(this.visual.rotation.z, 0, 1 - Math.pow(0.001, delta))
            this.visual.position.x = THREE.MathUtils.lerp(this.visual.position.x, 0, 1 - Math.pow(0.001, delta))
        }
    }

    setVisible(visible)
    {
        this.group.visible = visible
    }

    destroy()
    {
        this.group.removeFromParent()
    }
}

export class RoamingAnimals
{
    constructor()
    {
        this.game = Game.getInstance()
        this.items = []
        this.terrain = new TerrainHeightSampler()
        this.activeRadius = 130

        this.spawnLions()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 9)
    }

    spawnLions()
    {
        const source = this.game.resources.lionAnimal?.scene

        if(!source)
        {
            console.warn('RoamingAnimals: lionAnimal resource missing')
            return
        }

        const config = {
            length: 3.6,
            walkSpeed: 1.35,
            fleeSpeed: 3.1,
            wanderRadius: 16,
            homeRadius: 28,
            fleeDistance: 14,
            facingOffset: Math.PI,
        }

        for(const spawn of LION_SPAWNS)
        {
            if(!this.terrain.isWalkable(spawn.x, spawn.z))
            {
                console.warn(`RoamingAnimals: spawn not walkable (${spawn.x}, ${spawn.z})`)
                continue
            }

            const random = alea(`lion-${spawn.x}-${spawn.z}`)
            this.items.push(new RoamingLion(source, spawn, config, random, this.terrain))
        }

        if(this.items.length === 0)
            console.warn('RoamingAnimals: no lions spawned — check terrain walkability')
    }

    update()
    {
        const delta = this.game.ticker.deltaScaled
        const focus = this.game.view.focusPoint.position

        for(const item of this.items)
        {
            const distance = item.group.position.distanceTo(focus)
            const visible = distance < this.activeRadius

            item.setVisible(visible)

            if(visible)
                item.update(delta)
        }
    }
}
