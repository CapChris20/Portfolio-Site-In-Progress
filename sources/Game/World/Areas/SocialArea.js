import * as THREE from 'three/webgpu'
import { Game } from '../../Game.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import socialData from '../../../data/social.js'
import { GARAGE_WORLD_POSITION } from '../../VehicleGarage.js'
import { Area } from './Area.js'
import { View } from '../../View.js'
import { createGroundedPropVisual } from '../PropVisual.js'
import { attachStatuePhysics } from '../StaticProp.js'

// Props removed from the social area (3D clutter + unused platform icons)
const SOCIAL_PROP_SKIP = /twitch|youtube|xPhysical|mail|bluesky|onlyfans|linkedIn/i
const CENTER_STATUE_SKIP = /^physicalFixed\.002$|^socialArrayReference$|^boyPhysicalDynamic$|^baguiraPhysicalDynamic$|^linkedInPhysicalDynamic$|^onlyfansPhysicalDynamic$/
const CENTER_STATUE_RADIUS = 5
const NEON_JESUS_HEIGHT = 8.5
const NEON_JESUS_WIDTH_SCALE = 1.4

function isUnderNamedParent(node, name)
{
    let current = node

    while(current)
    {
        if(current.name === name)
            return true

        current = current.parent
    }

    return false
}

export class SocialArea extends Area
{
    constructor(model)
    {
        for(const child of [...model.children])
        {
            if(CENTER_STATUE_SKIP.test(child.name) || SOCIAL_PROP_SKIP.test(child.name))
                model.remove(child)
        }

        super(model)

        this.center = this.references.items.get('center')[0].position

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '👨‍🦲 Social',
                expanded: false,
            })
        }

        this.setLinks()
        this.setStatue()
        this.setVehicleGarage()
        // this.setFWA()
        this.setAchievement()
    }

    setObjects()
    {
        this.objects = {}
        this.objects.items = []
        this.objects.hideable = []

        for(const child of [...this.model.children])
        {
            if(CENTER_STATUE_SKIP.test(child.name) || SOCIAL_PROP_SKIP.test(child.name))
                continue

            if(typeof child.userData.preventAutoAdd === 'undefined' || child.userData.preventAutoAdd === false)
            {
                const object = this.game.objects.addFromModel(
                    child,
                    {},
                    {
                        position: child.position.add(this.model.position),
                        rotation: child.quaternion,
                        sleeping: true,
                        mass: child.userData.mass,
                    }
                )

                this.objects.items.push(object)

                if(child.name === 'refStatuePhysicalDynamic')
                    this.stripStatueVisualMeshes(object)

                if(
                    object.visual &&
                    (!object.physical || object.physical?.type === 'fixed') &&
                    (typeof child.userData.preventFrustum === 'undefined' || child.userData.preventFrustum === false)
                )
                {
                    this.objects.hideable.push(object.visual.object3D)
                }
            }

            this.references.parse(child)
        }
    }

    setLinks()
    {
        const radius = 6
        const count = socialData.length
        let i = 0

        for(const link of socialData)
        {
            const angle = count > 1 ? i * Math.PI / (count - 1) : 0
            const position = this.center.clone()
            position.x += Math.cos(angle) * radius
            position.y = 1
            position.z -= Math.sin(angle) * radius

            this.interactivePoint = this.game.interactivePoints.create(
                position,
                link.name,
                link.align === 'left' ? InteractivePoints.ALIGN_LEFT : InteractivePoints.ALIGN_RIGHT,
                InteractivePoints.STATE_CONCEALED,
                () =>
                {
                    if(link.url)
                        window.open(link.url, '_blank')
                    else if(link.modal)
                        this.game.modals.open(link.modal)
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
            
            i++
        }
    }

    setStatue()
    {
        this.purgeCenterStatueMeshes()
        this.addCenterStatue()

        const statueRef = this.references.items.get('statuePhysicalDynamic')?.[0]
            ?? this.references.items.get('statue')?.[0]
        const statueObject = statueRef?.userData?.object

        if(statueObject?.visual)
        {
            this.stripStatueVisualMeshes(statueObject)

            const hideIndex = this.objects.hideable.indexOf(statueObject.visual.object3D)

            if(hideIndex !== -1)
                this.objects.hideable.splice(hideIndex, 1)
        }

        this.events.on('frustumIn', () =>
        {
            this.purgeCenterStatueMeshes()
        })

        if(!statueObject?.physical)
            return

        this.statue = {}
        this.statue.body = statueObject.physical.body
        this.statue.down = false
    }

    stripStatueVisualMeshes(object)
    {
        const object3D = object?.visual?.object3D

        if(!object3D)
            return

        const meshes = []

        object3D.traverse((child) =>
        {
            if(child.isMesh)
                meshes.push(child)
        })

        for(const mesh of meshes)
            mesh.removeFromParent()
    }

    purgeCenterStatueMeshes()
    {
        const centerRef = this.references.items.get('center')?.[0]

        if(!centerRef)
            return

        const center = new THREE.Vector3()
        centerRef.getWorldPosition(center)

        const keepPattern = /^socialCenterStatue$|^refStatue$|^gitHub$|^discord$/i

        for(const object of [...this.objects.items])
        {
            const object3D = object.visual?.object3D

            if(!object3D)
                continue

            const name = object3D.name ?? ''

            if(keepPattern.test(name))
                continue

            if(CENTER_STATUE_SKIP.test(name) || /^\.002$|^hull$|^Cube\.133$/i.test(name))
            {
                this.removeObjectFromArea(object)
                continue
            }

            const world = new THREE.Vector3()
            object3D.getWorldPosition(world)

            if(world.distanceTo(center) > CENTER_STATUE_RADIUS)
                continue

            this.removeObjectFromArea(object)
        }

        const toRemove = []

        this.game.scene.traverse((node) =>
        {
            if(isUnderNamedParent(node, 'socialCenterStatue'))
                return

            if(!node.isMesh)
                return

            const world = new THREE.Vector3()
            node.getWorldPosition(world)

            if(world.distanceTo(center) > CENTER_STATUE_RADIUS)
                return

            toRemove.push(node)
        })

        for(const node of toRemove)
            node.parent?.remove(node)
    }

    removeObjectFromArea(object)
    {
        const object3D = object.visual?.object3D

        if(!object3D)
            return

        this.stripStatueVisualMeshes(object)

        const hideIndex = this.objects.hideable.indexOf(object3D)

        if(hideIndex !== -1)
            this.objects.hideable.splice(hideIndex, 1)

        this.game.objects.disable(object)
    }

    addCenterStatue()
    {
        const source = this.game.resources.neonJesus?.scene

        if(!source)
        {
            console.warn('SocialArea: neonJesus resource missing')
            return
        }

        if(this.centerStatue)
            this.centerStatue.removeFromParent()

        const centerRef = this.references.items.get('center')?.[0]

        if(!centerRef)
            return

        const point = new THREE.Vector3()
        centerRef.getWorldPosition(point)
        point.y = 0

        const visual = createGroundedPropVisual(source, NEON_JESUS_HEIGHT, {
            materialPrefix: 'socialCenterNeonJesus',
            targetHeight: NEON_JESUS_HEIGHT,
            widthScale: NEON_JESUS_WIDTH_SCALE,
        })

        const fittedBox = new THREE.Box3().setFromObject(visual)
        const fittedCenter = fittedBox.getCenter(new THREE.Vector3())

        visual.position.x -= fittedCenter.x
        visual.position.z -= fittedCenter.z
        visual.position.y -= fittedBox.min.y

        const group = new THREE.Group()
        group.name = 'socialCenterStatue'
        group.position.copy(point)

        this.game.materials.applyObjectMaterials(visual, { useCache: false })
        group.add(visual)
        this.game.scene.add(group)

        group.updateMatrixWorld(true)
        const fittedSize = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3())
        const jesusColliderLength = Math.max(fittedSize.x, fittedSize.z)

        attachStatuePhysics(group, jesusColliderLength, {
            position: group.position,
            rotation: group.quaternion,
        })

        this.centerStatue = group
    }

    setVehicleGarage()
    {
        const garagePosition = new THREE.Vector3(
            GARAGE_WORLD_POSITION.x,
            GARAGE_WORLD_POSITION.y,
            GARAGE_WORLD_POSITION.z,
        )

        this.game.vehicleGarage.setParkingSpot(garagePosition, 0)

        const interactPosition = garagePosition.clone()
        interactPosition.y += 1.5

        this.game.interactivePoints.create(
            interactPosition,
            'Garage',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.garageModal.open()
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

    setFWA()
    {
        this.fwa = {}

        // Confetti
        let i = 0
        this.fwa.positions = [
            new THREE.Vector3(23.5, 0, -18.5),
            new THREE.Vector3(27, 0, -19.5),
        ]
        const pop = () =>
        {
            i++
            const position = this.fwa.positions[i % this.fwa.positions.length]
            this.game.world.confetti.pop(position)
            
            setTimeout(pop, 500 + Math.random() * 1500)
        }
        setTimeout(pop, 2000)
        
        // Interactive points
        game.interactivePoints.temporaryHide()

        // Input => start
        this.game.inputs.addActions([
            { name: 'startFWA', categories: [ 'intro', 'modal', 'menu', 'racing', 'cinematic', 'wandering' ], keys: [ 'Keyboard.k' ] },
            { name: 'winFWA', categories: [ 'intro', 'modal', 'menu', 'racing', 'cinematic', 'wandering' ], keys: [ 'Keyboard.j' ] },
        ])
        this.game.inputs.events.on('startFWA', (action) =>
        {
            if(action.active)
            {
                // View
                game.view.zoom.baseRatio = 0.55
                game.view.zoom.ratio = 0.55
                game.view.zoom.smoothedRatio = 0.55
                game.view.focusPoint.position.set(25, 0, -19.2)
                game.view.focusPoint.isTracking = false
                window.setTimeout(() =>
                {
                    this.game.view.setMode(View.MODE_FREE)
                }, 1000)

                // Weather
                this.game.weather.override.start(
                    {
                        humidity: 0,
                        electricField: 0,
                        clouds: 0,
                        wind: 0
                    },
                    0
                )
        
                // Day cycles
                this.game.dayCycles.override.start(
                    {
                        progress: 0.87
                    },
                    0
                )
                
                // Buttons
                document.querySelector('.js-menu-trigger').style.display = 'none'
                document.querySelector('.js-map-trigger').style.display = 'none'
            }
        })
        this.game.inputs.events.on('winFWA', (action) =>
        {
            if(action.active)
            {
                this.game.achievements.setProgress('foty', 1)
            }
        })
    }

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'social')
        })
    }

    update()
    {
        if(this.statue && !this.statue.down && !this.statue.body.isSleeping())
        {
            const statueUp = new THREE.Vector3(0, 1, 0)
            statueUp.applyQuaternion(this.statue.body.rotation())
            if(statueUp.y < 0.25)
            {
                this.statue.down = true
                this.game.achievements.setProgress('statueDown', 1)
            }
        }
    }
}