import * as THREE from 'three/webgpu'
import { color, float, Fn, instancedArray, mix, normalWorld, positionGeometry, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { Inputs } from '../../Inputs/Inputs.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Area } from './Area.js'
import gsap from 'gsap'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'
import { createGroundedPropVisual, applyVehicleStyleMaterials, preparePropMaterials } from '../PropVisual.js'
import { attachStatuePhysics } from '../StaticProp.js'

const LANDING_SPAWN = new THREE.Vector3(39.52898025512695, 0, 37.82522964477539)
const _gameboyLookTarget = new THREE.Vector3()
const CONTROLS_PROP_SKIP = /^gamepadPhysicalDynamic|^gizmoPhysicalDynamic|^phonePhysicalDynamic/
const CONTROLS_GAMEBOY_LENGTH = 3.4
const CONTROLS_GAMEBOY_BACK_OFFSET = 2.5
const NAME_BLOCKS_LENGTH = 32
const NAME_BLOCKS_HEIGHT = 4.5
const NAME_BLOCKS_MASS = 5
const NAME_BLOCKS_SEGMENTS = 10

export class LandingArea extends Area
{
    constructor(model)
    {
        // Strip map kiosk meshes before the area loads them into the scene
        for(const child of [...model.children])
        {
            if(/^physicalFixed\.00[39]$/.test(child.name))
                model.remove(child)

            if(CONTROLS_PROP_SKIP.test(child.name))
                model.remove(child)
        }

        super(model)

        this.localTime = uniform(0)

        this.setLetters()
        this.setProjectsGuide()
        this.setKiosk()
        this.setControls()
        this.setControlsGameboy()
        this.setBonfire()
        this.setAchievement()
    }

    setLetters()
    {
        const references = this.getLetterReferences()

        if(!references.length)
            return

        for(const reference of references)
        {
            reference.visible = false

            const object = reference.userData.object

            if(object)
                this.game.objects.disable(object)
        }

        this.addNameBlocks(references)
    }

    addNameBlocks(references)
    {
        const source = this.game.resources.nameBlocks?.scene

        if(!source)
        {
            console.warn('LandingArea: nameBlocks resource missing')
            return
        }

        if(this.nameBlocksObject)
            this.game.objects.disable(this.nameBlocksObject)

        this.model.updateMatrixWorld(true)

        const sorted = [...references].sort((a, b) => a.position.x - b.position.x)
        const start = new THREE.Vector3()
        const end = new THREE.Vector3()
        sorted[0].getWorldPosition(start)
        sorted[sorted.length - 1].getWorldPosition(end)

        const center = new THREE.Vector3()
        const slotBox = new THREE.Box3()

        for(const reference of references)
        {
            const point = new THREE.Vector3()
            reference.getWorldPosition(point)
            center.add(point)
            slotBox.expandByObject(reference)
        }

        center.divideScalar(references.length)

        const baselineY = slotBox.min.y
        const rowDx = end.x - start.x
        const rowDz = end.z - start.z

        const model = source.clone(true)

        model.traverse((child) =>
        {
            if(child.isMesh)
            {
                child.castShadow = true
                child.receiveShadow = true
            }
        })

        preparePropMaterials(model, 'nameSign')
        applyVehicleStyleMaterials(model, { materialNamePrefix: 'nameSign' })

        model.rotation.y = Math.PI

        const rawBox = new THREE.Box3().setFromObject(model)
        const rawSize = rawBox.getSize(new THREE.Vector3())
        const lengthScale = NAME_BLOCKS_LENGTH / Math.max(rawSize.x, rawSize.z)
        const heightScale = NAME_BLOCKS_HEIGHT / rawSize.y
        const scale = Math.min(lengthScale, heightScale)

        model.scale.setScalar(scale)
        model.updateMatrixWorld(true)

        const fittedBox = new THREE.Box3().setFromObject(model)
        const fittedCenter = fittedBox.getCenter(new THREE.Vector3())

        model.position.x -= fittedCenter.x
        model.position.z -= fittedCenter.z
        model.position.y -= fittedBox.min.y

        const fittedSize = fittedBox.getSize(new THREE.Vector3())

        const group = new THREE.Group()
        group.name = 'nameBlocksPhysicalDynamic'
        group.rotation.y = Math.atan2(rowDx, rowDz) + Math.PI * 0.5

        const segmentLength = fittedSize.x / NAME_BLOCKS_SEGMENTS

        for(let i = 0; i < NAME_BLOCKS_SEGMENTS; i++)
        {
            const cuboid = new THREE.Object3D()
            cuboid.name = 'cuboid'
            cuboid.scale.set(
                segmentLength * 0.9,
                fittedSize.y * 0.92,
                fittedSize.z * 0.92,
            )
            cuboid.position.set(
                fittedBox.min.x + segmentLength * (i + 0.5),
                fittedSize.y * 0.46,
                0,
            )
            group.add(cuboid)
        }

        group.add(model)

        const worldRotation = group.quaternion.clone()

        this.nameBlocksObject = this.game.objects.addFromModel(
            group,
            {
                updateMaterials: false,
                parent: this.game.scene,
            },
            {
                type: 'dynamic',
                position: new THREE.Vector3(center.x, baselineY, center.z),
                rotation: worldRotation,
                sleeping: true,
                mass: NAME_BLOCKS_MASS,
            },
        )

        const { physical } = this.nameBlocksObject

        if(physical)
        {
            for(const collider of physical.colliders)
            {
                collider.setActiveEvents(this.game.RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
                collider.setContactForceEventThreshold(5)
            }

            physical.onCollision = (force, position) =>
            {
                this.game.audio.groups.get('hitBrick').playRandomNext(force, position)
            }
        }
    }

    setProjectsGuide()
    {
        const position = this.references.items.get('kioskInteractivePoint')[0].position.clone()
        position.x -= 2.2
        position.z += 1.5

        this.game.interactivePoints.create(
            position,
            'Skills',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.player.respawn('projects', () =>
                {
                    this.game.view.focusPoint.isTracking = true
                })
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )
    }

    getLetterReferences()
    {
        const references = this.references.items.get('letters.')
            ?? this.references.items.get('lettersPhysicalDynamic.')
            ?? []

        if(references.length)
            return references

        const fallback = []

        this.references.items.forEach((items, key) =>
        {
            if(key.startsWith('letters'))
                fallback.push(...items)
        })

        return fallback
    }

    setKiosk()
    {
        this.purgeKioskMeshes()
        this.addKioskSonic()

        this.events.on('frustumIn', () =>
        {
            this.purgeKioskMeshes()
        })

        // Interactive point
        const interactivePoint = this.game.interactivePoints.create(
            this.references.items.get('kioskInteractivePoint')[0].position,
            'Map',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.modals.open('map')
                // interactivePoint.hide()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )

        // this.game.map.items.get('map').events.on('close', () =>
        // {
        //     interactivePoint.show()
        // })
    }

    purgeKioskMeshes()
    {
        const kioskRef = this.references.items.get('kioskInteractivePoint')[0]
        const kioskPoint = new THREE.Vector3()
        kioskRef.getWorldPosition(kioskPoint)

        const kioskPattern = /^physicalFixed\.00[39]$|^\.00[39]$/

        for(const object of [...this.objects.items])
        {
            const object3D = object.visual?.object3D

            if(!object3D || !kioskPattern.test(object3D.name))
                continue

            const hideIndex = this.objects.hideable.indexOf(object3D)

            if(hideIndex !== -1)
                this.objects.hideable.splice(hideIndex, 1)

            this.game.objects.disable(object)
        }

        const toRemove = []

        this.game.scene.traverse((node) =>
        {
            if(node.name === 'landingKioskSonic')
                return

            if(kioskPattern.test(node.name))
            {
                toRemove.push(node)
                return
            }

            if(!node.isMesh)
                return

            const world = new THREE.Vector3()
            node.getWorldPosition(world)

            if(world.distanceTo(kioskPoint) > 2.8)
                return

            if(kioskPattern.test(node.name) || kioskPattern.test(node.parent?.name ?? ''))
                toRemove.push(node)
        })

        for(const node of toRemove)
            node.parent?.remove(node)
    }

    addKioskSonic()
    {
        const source = this.game.resources.sonic?.scene

        if(!source)
            return

        if(this.kioskSonic)
            this.kioskSonic.removeFromParent()

        const kioskRef = this.references.items.get('kioskInteractivePoint')[0]
        const kioskPoint = new THREE.Vector3()
        kioskRef.getWorldPosition(kioskPoint)

        const visual = createGroundedPropVisual(source, 4.5, {
            materialPrefix: 'landingKioskSonic',
        })

        const group = new THREE.Group()
        group.name = 'landingKioskSonic'
        group.position.set(kioskPoint.x, 0, kioskPoint.z)

        const dx = LANDING_SPAWN.x - kioskPoint.x
        const dz = LANDING_SPAWN.z - kioskPoint.z
        group.rotation.y = Math.atan2(dx, dz) + Math.PI / 2

        this.game.materials.applyObjectMaterials(visual, { useCache: false })
        group.add(visual)
        this.game.scene.add(group)

        attachStatuePhysics(group, 4.5, {
            position: group.position,
            rotation: group.quaternion,
        })

        this.kioskSonic = group
    }

    setControls()
    {
        // Interactive point
        const interactivePoint = this.game.interactivePoints.create(
            this.references.items.get('controlsInteractivePoint')[0].position,
            'Controls',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.menu.open('controls')
                interactivePoint.hide()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )

        // Menu instance
        const menuInstance = this.game.menu.items.get('controls')

        menuInstance.events.on('close', () =>
        {
            interactivePoint.show()
        })

        menuInstance.events.on('open', () =>
        {
            if(this.game.inputs.mode === Inputs.MODE_GAMEPAD)
                menuInstance.tabs.goTo('gamepad')
            else if(this.game.inputs.mode === Inputs.MODE_MOUSEKEYBOARD)
                menuInstance.tabs.goTo('mouse-keyboard')
            else if(this.game.inputs.mode === Inputs.MODE_TOUCH)
                menuInstance.tabs.goTo('touch')
        })
    }

    setControlsGameboy()
    {
        const source = this.game.resources.gameboy?.scene

        if(!source)
        {
            console.warn('LandingArea: gameboy resource missing')
            return
        }

        if(this.controlsGameboy)
            this.controlsGameboy.removeFromParent()

        const controlsRef = this.references.items.get('controlsInteractivePoint')?.[0]

        if(!controlsRef)
            return

        const point = new THREE.Vector3()
        controlsRef.getWorldPosition(point)
        point.y = 0

        const awayFromSpawn = point.clone().sub(LANDING_SPAWN)
        awayFromSpawn.y = 0

        if(awayFromSpawn.lengthSq() > 0)
        {
            awayFromSpawn.normalize().multiplyScalar(CONTROLS_GAMEBOY_BACK_OFFSET)
            point.add(awayFromSpawn)
        }

        const visual = createGroundedPropVisual(source, CONTROLS_GAMEBOY_LENGTH, {
            materialPrefix: 'landingControlsGameboy',
        })

        const group = new THREE.Group()
        group.name = 'landingControlsGameboy'
        group.position.copy(point)

        this.game.materials.applyObjectMaterials(visual, { useCache: false })
        group.add(visual)
        this.game.scene.add(group)
        this.objects.hideable.push(group)

        this.controlsGameboy = group
    }

    setBonfire()
    {
        const position = this.references.items.get('bonfireHashes')[0].position

        // Particles
        let particles = null
        {
            const emissiveMaterial = this.game.materials.getFromName('emissiveOrangeRadialGradient')
    
            const count = 30
            const elevation = uniform(5)
            const positions = new Float32Array(count * 3)
            const scales = new Float32Array(count)
    
    
            for(let i = 0; i < count; i++)
            {
                const i3 = i * 3
    
                const angle = Math.PI * 2 * Math.random()
                const radius = Math.pow(Math.random(), 1.5) * 1
                positions[i3 + 0] = Math.cos(angle) * radius
                positions[i3 + 1] = Math.random()
                positions[i3 + 2] = Math.sin(angle) * radius
    
                scales[i] = 0.02 + Math.random() * 0.06
            }
            
            const positionAttribute = instancedArray(positions, 'vec3').toAttribute()
            const scaleAttribute = instancedArray(scales, 'float').toAttribute()
    
            const material = new THREE.SpriteNodeMaterial()
            material.outputNode = emissiveMaterial.outputNode
    
            const progress = float(0).toVar()
    
            material.positionNode = Fn(() =>
            {
                const newPosition = positionAttribute.toVar()
                progress.assign(newPosition.y.add(this.localTime.mul(newPosition.y)).fract())
    
                newPosition.y.assign(progress.mul(elevation))
                newPosition.xz.addAssign(this.game.wind.direction.mul(progress))
    
                const progressHide = step(0.8, progress).mul(100)
                newPosition.y.addAssign(progressHide)
                
                return newPosition
            })()
            material.scaleNode = Fn(() =>
            {
                const progressScale = progress.remapClamp(0.5, 1, 1, 0)
                return scaleAttribute.mul(progressScale)
            })()
    
            const geometry = new THREE.CircleGeometry(0.5, 8)
    
            particles = new THREE.Mesh(geometry, material)
            particles.visible = false
            particles.position.copy(position)
            particles.count = count
            this.game.scene.add(particles)
        }

        // Hashes
        {
            const alphaNode = Fn(() =>
            {
                const baseUv = uv(1)
                const distanceToCenter = baseUv.sub(0.5).length()
    
                const voronoi = texture(
                    this.game.noises.voronoi,
                    baseUv
                ).g
    
                voronoi.subAssign(distanceToCenter.remap(0, 0.5, 0.3, 0))
    
                return voronoi
            })()
    
            const material = new MeshDefaultMaterial({
                colorNode: color(0x6F6A87),
                alphaNode: alphaNode,
                hasWater: false,
                hasLightBounce: false
            })
    
            const mesh = this.references.items.get('bonfireHashes')[0]
            mesh.material = material
        }

        // Burn
        const burn = this.references.items.get('bonfireBurn')[0]
        burn.visible = false

        // Interactive point
        this.game.interactivePoints.create(
            this.references.items.get('bonfireInteractivePoint')[0].position,
            'Res(e)t',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.reset()

                gsap.delayedCall(2, () =>
                {
                    // Bonfire
                    particles.visible = true
                    burn.visible = true
                    this.game.ticker.wait(2, () =>
                    {
                        particles.geometry.boundingSphere.center.y = 2
                        particles.geometry.boundingSphere.radius = 2
                    })

                    // Sound
                    this.game.audio.groups.get('campfire').items[0].positions.push(position)
                })
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )
    }

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'landing')
        })
        this.events.on('boundingOut', () =>
        {
            this.game.achievements.setProgress('landingLeave', 1)
        })
    }

    update()
    {
        this.localTime.value += this.game.ticker.deltaScaled * 0.1

        if(this.controlsGameboy)
        {
            _gameboyLookTarget.copy(this.game.view.defaultCamera.position)
            _gameboyLookTarget.y = this.controlsGameboy.position.y
            this.controlsGameboy.lookAt(_gameboyLookTarget)
        }
    }
}