import * as THREE from 'three/webgpu'
import { color, float, Fn, instancedArray, mix, normalWorld, positionGeometry, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import helvetikerFont from '../../../../static/fonts/helvetiker_bold.typeface.json'
import { Inputs } from '../../Inputs/Inputs.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Area } from './Area.js'
import gsap from 'gsap'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'
import { createGroundedPropVisual } from '../PropVisual.js'

const LANDING_SPAWN = new THREE.Vector3(39.52898025512695, 0, 37.82522964477539)
const CONTROLS_PROP_SKIP = /^gamepadPhysicalDynamic|^gizmoPhysicalDynamic|^phonePhysicalDynamic/
const CONTROLS_GAMEBOY_LENGTH = 2.2
const CONTROLS_GAMEBOY_BACK_OFFSET = 2.5

const NAME_WORDS = [
    ['C', 'H', 'R', 'I', 'S'],
    ['S', 'H', 'I', 'N', 'A'],
]

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

        this.letterMaterial = new MeshDefaultMaterial({
            colorNode: color('#f0b4c8'),
            hasWater: false,
        })

        for(const reference of references)
        {
            const object = reference.userData.object

            if(object?.physical)
            {
                object.physical.colliders[0].setActiveEvents(this.game.RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
                object.physical.colliders[0].setContactForceEventThreshold(5)
                object.physical.onCollision = (force, position) =>
                {
                    this.game.audio.groups.get('hitBrick').playRandomNext(force, position)
                }
            }
        }

        const font = new FontLoader().parse(helvetikerFont)
        this.setNameLetters(references, font)
    }

    setNameLetters(references, font)
    {
        const letters = NAME_WORDS.flat()
        const sorted = [...references].sort((a, b) =>
        {
            if(a.position.x !== b.position.x)
                return a.position.x - b.position.x

            return a.position.z - b.position.z
        })

        let targetHeight = 0
        for(const reference of references)
        {
            const size = new THREE.Box3().setFromObject(reference).getSize(new THREE.Vector3())
            targetHeight = Math.max(targetHeight, size.y)
        }

        const start = sorted[0].position.clone()
        const end = sorted[sorted.length - 1].position.clone()
        const direction = end.clone().sub(start)
        const rowLength = direction.length()
        direction.normalize()

        const letterSpacing = sorted.length > 1 ? rowLength / (sorted.length - 1) : 0

        for(let i = 0; i < sorted.length; i++)
        {
            const targetPosition = start.clone().add(direction.clone().multiplyScalar(letterSpacing * i))
            this.replaceLetterGeometry(sorted[i], font, letters[i], targetHeight, targetPosition)
        }
    }

    replaceLetterGeometry(reference, font, letter, targetHeight, targetPosition = null)
    {
        const oldBox = new THREE.Box3().setFromObject(reference)
        const oldCenter = oldBox.getCenter(new THREE.Vector3())

        const geometry = new TextGeometry(letter, {
            font,
            size: 1,
            depth: 0.46,
            curveSegments: 6,
            bevelEnabled: true,
            bevelThickness: 0.05,
            bevelSize: 0.025,
            bevelSegments: 2
        })

        geometry.computeBoundingBox()
        const newSize = geometry.boundingBox.getSize(new THREE.Vector3())
        const scale = targetHeight / newSize.y
        geometry.scale(scale, scale, scale)
        geometry.center()

        const oldGeometry = reference.geometry

        if(targetPosition)
        {
            reference.position.set(
                targetPosition.x,
                oldCenter.y,
                targetPosition.z,
            )
            reference.geometry = geometry
        }
        else
        {
            const offset = oldCenter.clone().sub(reference.position)
            geometry.translate(offset.x, offset.y, offset.z)
            reference.geometry = geometry
        }

        if(oldGeometry && oldGeometry !== geometry)
            oldGeometry.dispose()
        reference.material = this.letterMaterial
        reference.visible = true
        reference.castShadow = true
        reference.receiveShadow = true
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
        group.lookAt(LANDING_SPAWN.x, point.y, LANDING_SPAWN.z)

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
    }
}