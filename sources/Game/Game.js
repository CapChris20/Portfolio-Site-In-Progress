import * as THREE from 'three/webgpu'

import { Debug } from './Debug.js'
import { Inputs } from './Inputs/Inputs.js'
import { Physics } from './Physics/Physics.js'
import { Rendering } from './Rendering.js'
import { ResourcesLoader } from './ResourcesLoader.js'
import { Ticker } from './Ticker.js'
import { Time } from './Time.js'
import { Player } from './Player.js'
import { View } from './View.js'
import { Viewport } from './Viewport.js'
import { World } from './World/World.js'
import { Tracks } from './Tracks.js'
// import { Monitoring } from './Monitoring.js'
import { Lighting } from './Ligthing.js'
import { Materials } from './Materials.js'
import { Objects } from './Objects.js'
import { Fog } from './Fog.js'
import { DayCycles } from './Cycles/DayCycles.js'
import { Weather } from './Weather.js'
import { Noises } from './Noises.js'
import { Wind } from './Wind.js'
import { Terrain } from './Terrain.js'
import { Explosions } from './Explosions.js'
import { YearCycles } from './Cycles/YearCycles.js'
import { Server } from './Server.js'
import { Modals } from './Modals.js'
import { PhysicsVehicle } from './Physics/PhysicsVehicle.js'
import { PhysicsWireframe } from './Physics/PhysicsWireframe.js'
import { Zones } from './Zones.js'
import { Overlay } from './Overlay.js'
import { Tornado } from './Tornado.js'
import { InteractivePoints } from './InteractivePoints.js'
import { Respawns } from './Respawns.js'
import { Audio } from './Audio.js'
import { ClosingManager } from './ClosingManager.js'
import { RayCursor } from './RayCursor.js'
import { Water } from './Water.js'
import { Reveal } from './Reveal.js'
import { KonamiCode } from './KonamiCode.js'
import { Achievements } from './Achievements.js'
import { Notifications } from './Notifications.js'
import { Quality } from './Quality.js'
import { Menu } from './Menu.js'
import { Title } from './Title.js'
import { PreRenderer } from './PreRenderer.js'
import { Options } from './Options.js'
import { Portfolio } from './Portfolio.js'
import { CareerModal } from './CareerModal.js'
import gsap from 'gsap'
import { Map } from './Map.js'
import { extractGlbColorMap } from './World/extractGlbColorMap.js'
import { VehicleGarage } from './VehicleGarage.js'
import { GarageModal } from './GarageModal.js'

export class Game
{
    static getInstance()
    {
        return Game.instance
    }

    constructor()
    {
        // Singleton
        if(Game.instance)
            return Game.instance

        Game.instance = this

        this.init().catch((error) =>
        {
            console.error('Game failed to start', error)

            document.documentElement.classList.add('is-started')

            const message = document.createElement('div')
            message.textContent = `Failed to load: ${error?.message ?? error}. Hard refresh (Cmd+Shift+R).`
            message.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:Nunito,sans-serif;font-size:18px;color:#fff;background:#14002a;z-index:99999;'
            document.body.append(message)
        })
    }

    async init()
    {
        // Setup
        this.domElement = document.querySelector('.game')
        this.canvasElement = this.domElement.querySelector('.js-canvas')
        document.documentElement.classList.add('is-started')

        // First batch for intro
        this.scene = new THREE.Scene()
        this.debug = new Debug()
        this.resourcesLoader = new ResourcesLoader()
        this.quality = new Quality()
        this.server = new Server()
        this.ticker = new Ticker()
        this.time = new Time()
        this.dayCycles = new DayCycles()
        this.yearCycles = new YearCycles()
        this.inputs = new Inputs([], [ 'intro' ])
        this.audio = new Audio()
        this.notifications = new Notifications()
        this.rayCursor = new RayCursor()
        this.viewport = new Viewport(this.domElement)
        this.modals = new Modals()
        this.careerModal = new CareerModal()
        this.menu = new Menu()
        this.rendering = new Rendering()
        await this.rendering.setRenderer()

        const compressed = !!import.meta.env.VITE_COMPRESSED
        const compressedModelSuffix = compressed ? '-compressed' : ''
        const compressedTextureFormat = compressed ? 'textureKtx' : 'texture'
        const compressedTextureExtension = compressed ? 'ktx' : 'png'
        this.vehicleMode = import.meta.env.VITE_VEHICLE || 'custom'

        const cb = '?cb=107'
        const careerTextureFormat = 'texture'
        this.resources = await this.resourcesLoader.load([
            [ 'respawnsReferencesModel',    `respawns/respawnsReferences${compressedModelSuffix}.glb${cb}`, 'gltf' ],
            [ 'behindTheSceneStarsTexture', `behindTheScene/stars.${compressedTextureExtension}${cb}`,      compressedTextureFormat, (resource) => { resource.colorSpace = THREE.SRGBColorSpace; resource.minFilter = THREE.NearestFilter; resource.magFilter = THREE.NearestFilter; resource.generateMipmaps = false; resource.wrapS = THREE.RepeatWrapping; resource.wrapT = THREE.RepeatWrapping; } ],
            [ 'soundTexture',               `intro/sound.${compressedTextureExtension}${cb}`,               compressedTextureFormat, (resource) => { resource.minFilter = THREE.LinearFilter; resource.magFilter = THREE.LinearFilter; resource.generateMipmaps = false; resource.repeat.x = 0.5; } ],
            [ 'paletteTexture',             `palette.${compressedTextureExtension}${cb}`,                   compressedTextureFormat, (resource) => { resource.minFilter = THREE.NearestFilter; resource.magFilter = THREE.NearestFilter; resource.generateMipmaps = false; resource.colorSpace = THREE.SRGBColorSpace; } ],

        ])
        this.options = new Options()
        this.portfolio = new Portfolio()
        this.respawns = new Respawns(import.meta.env.VITE_PLAYER_SPAWN || 'landing')
        this.view = new View()
        this.quality.applyPerformanceSettings()
        this.rendering.setPostprocessing()
        this.rendering.start()
        this.reveal = new Reveal()
        this.noises = new Noises()
        this.weather = new Weather()
        this.wind = new Wind()
        this.tracks = new Tracks()
        this.lighting = new Lighting()
        this.fog = new Fog()
        this.water = new Water()
        this.materials = new Materials()
        this.objects = new Objects()
        this.explosions = new Explosions()
        this.world = new World()

        // Load and init RAPIER
        const rapierPromise = import('@dimforge/rapier3d')

        // Load rest of resources
        const resourcesPromise = this.resourcesLoader.load(
            [
                [ 'foliageTexture',                        `foliage/foliageSDF.${compressedTextureExtension}${cb}`,                              compressedTextureFormat, (resource) => { resource.minFilter = THREE.NearestFilter; resource.magFilter = THREE.NearestFilter; resource.generateMipmaps = false; } ],
                [ 'bushesReferences',                      `bushes/bushesReferences${compressedModelSuffix}.glb${cb}`,                           'gltf' ],
                [ 'vehicle',                               `vehicle/default${compressedModelSuffix}.glb${cb}`,                                   'gltf' ],
                [ 'customVehicle',                         `vehicle/lightningMcqueen.glb${cb}`,                                                'gltf' ],
                [ 'motorcycleVehicle',                     `props/LionMotorcycle.glb${cb}`,                                                    'gltf' ],
                [ 'mechaVehicle',                          `props/Mecha.glb${cb}`,                                                             'gltf' ],
                [ 'retrowaveCar',                          `props/retrowaveCar${compressedModelSuffix}.glb${cb}`,                               'gltf' ],
                [ 'playgroundVisual',                      `playground/playgroundVisual${compressedModelSuffix}.glb${cb}`,                       'gltf' ],
                [ 'playgroundPhysical',                    `playground/playgroundPhysical${compressedModelSuffix}.glb${cb}`,                     'gltf' ],
                [ 'flowersReferencesModel',                `flowers/flowersReferences${compressedModelSuffix}.glb${cb}`,                         'gltf' ],
                [ 'bricksModel',                           `bricks/bricks${compressedModelSuffix}.glb${cb}`,                                     'gltf' ],
                [ 'fencesModel',                           `fences/fences${compressedModelSuffix}.glb${cb}`,                                     'gltf' ],
                [ 'benchesModel',                          `benches/benches${compressedModelSuffix}.glb${cb}`,                                   'gltf' ],
                [ 'lanternsModel',                         `lanterns/lanterns${compressedModelSuffix}.glb${cb}`,                                 'gltf' ],
                [ 'terrainTexture',                        `terrain/terrain.${compressedTextureExtension}${cb}`,                                 compressedTextureFormat, (resource) => { resource.flipY = false; } ],
                [ 'terrainModel',                          `terrain/terrain${compressedModelSuffix}.glb${cb}`,                                   'gltf' ],
                [ 'floorTexture',                          `props/FloorTexture.glb${cb}`,                                                        'gltf', (resource) =>
                {
                    try
                    {
                        const extracted = extractGlbColorMap(resource, { renderer: this.rendering?.renderer })

                        if(extracted)
                        {
                            resource.map = extracted.map
                            resource.tileScale = extracted.tileScale
                        }
                    }
                    catch(error)
                    {
                        console.warn('FloorTexture: could not extract map', error)
                    }
                } ],
                [ 'floorSlabsTexture',                     `floor/slabs.${compressedTextureExtension}`,                                     compressedTextureFormat, (resource) => { resource.wrapS = THREE.RepeatWrapping; resource.wrapT = THREE.RepeatWrapping; resource.minFilter = THREE.LinearFilter; resource.magFilter = THREE.LinearFilter; resource.generateMipmaps = false } ],
                [ 'palmTreesVisualModel',                  `palmTrees/palmTreesVisual.glb${cb}`,                                                 'gltf', (resource) =>
                {
                    resource.scene.traverse((child) =>
                    {
                        if(!child.isMesh || !child.material)
                            return

                        const materials = Array.isArray(child.material) ? child.material : [ child.material ]

                        for(const material of materials)
                        {
                            if(material.map)
                                material.map.colorSpace = THREE.SRGBColorSpace
                        }
                    })
                } ],
                [ 'birchTreesReferencesModel',             `birchTrees/birchTreesReferences${compressedModelSuffix}.glb${cb}`,                   'gltf' ],
                [ 'oakTreesReferencesModel',               `oakTrees/oakTreesReferences${compressedModelSuffix}.glb${cb}`,                                               'gltf' ],
                [ 'cherryTreesReferencesModel',            `cherryTrees/cherryTreesReferences${compressedModelSuffix}.glb${cb}`,                 'gltf' ],
                [ 'sceneryModel',                          `scenery/scenery${compressedModelSuffix}.glb${cb}`,                                   'gltf' ],
                [ 'areasModel',                            `areas/areas${compressedModelSuffix}.glb${cb}`,                                       'gltf' ],
                [ 'poleLightsModel',                       `poleLights/poleLights${compressedModelSuffix}.glb${cb}`,                             'gltf' ],
                [ 'whisperFlameTexture',                   `whispers/whisperFlame.${compressedTextureExtension}${cb}`,                           compressedTextureFormat, (resource) => { resource.minFilter = THREE.LinearFilter; resource.magFilter = THREE.LinearFilter; resource.generateMipmaps = false } ],
                [ 'satanStarTexture',                      `areas/satanStar.${compressedTextureExtension}${cb}`,                                 compressedTextureFormat, (resource) => { resource.minFilter = THREE.LinearFilter; resource.magFilter = THREE.LinearFilter; resource.generateMipmaps = false } ],
                [ 'tornadoPathReferencesModel',            `tornado/tornadoPathReferences${compressedModelSuffix}.glb${cb}`,                     'gltf' ],
                [ 'overlayPatternTexture',                 `overlay/overlayPattern.${compressedTextureExtension}${cb}`,                          compressedTextureFormat, (resource) => { resource.wrapS = THREE.RepeatWrapping; resource.wrapT = THREE.RepeatWrapping; resource.magFilter = THREE.NearestFilter; resource.minFilter = THREE.NearestFilter; resource.generateMipmaps = false } ],
                [ 'interactivePointsKeyIconCrossTexture',  `interactivePoints/interactivePointsKeyIconCross.${compressedTextureExtension}${cb}`, compressedTextureFormat, (resource) => { resource.minFilter = THREE.NearestFilter; resource.magFilter = THREE.NearestFilter; resource.generateMipmaps = false } ],
                [ 'interactivePointsKeyIconEnterTexture',  `interactivePoints/interactivePointsKeyIconEnter.${compressedTextureExtension}${cb}`, compressedTextureFormat, (resource) => { resource.minFilter = THREE.NearestFilter; resource.magFilter = THREE.NearestFilter; resource.generateMipmaps = false } ],
                [ 'interactivePointsKeyIconATexture',      `interactivePoints/interactivePointsKeyIconA.${compressedTextureExtension}${cb}`,     compressedTextureFormat, (resource) => { resource.minFilter = THREE.NearestFilter; resource.magFilter = THREE.NearestFilter; resource.generateMipmaps = false } ],
                [ 'jukeboxMusicNotes',                     `jukebox/jukeboxMusicNotes.${compressedTextureExtension}${cb}`,                       compressedTextureFormat, (resource) => { resource.minFilter = THREE.LinearFilter; resource.magFilter = THREE.LinearFilter; resource.generateMipmaps = false } ],
                [ 'achievementsGlyphsTexture',             `achievements/glyphs.${compressedTextureExtension}${cb}`,                             compressedTextureFormat, (resource) => { resource.minFilter = THREE.LinearFilter; resource.magFilter = THREE.LinearFilter; resource.generateMipmaps = false; resource.wrapS = THREE.RepeatWrapping; } ],
                [ 'careerFreelancerTexture',               `career/careerFreelancer.png${cb}`,                         careerTextureFormat, (resource) => { resource.flipY = false; resource.minFilter = THREE.LinearFilter; resource.magFilter = THREE.LinearFilter; resource.generateMipmaps = false; resource.wrapS = THREE.ClampToEdgeWrapping; resource.wrapT = THREE.ClampToEdgeWrapping; } ],
                [ 'careerHeticTexture',                    `career/careerHetic.png${cb}`,                              careerTextureFormat, (resource) => { resource.flipY = false; resource.minFilter = THREE.LinearFilter; resource.magFilter = THREE.LinearFilter; resource.generateMipmaps = false; resource.wrapS = THREE.ClampToEdgeWrapping; resource.wrapT = THREE.ClampToEdgeWrapping; } ],
                [ 'careerImmersiveGardenTexture',          `career/careerImmersiveGarden.png${cb}`,                    careerTextureFormat, (resource) => { resource.flipY = false; resource.minFilter = THREE.LinearFilter; resource.magFilter = THREE.LinearFilter; resource.generateMipmaps = false; resource.wrapS = THREE.ClampToEdgeWrapping; resource.wrapT = THREE.ClampToEdgeWrapping; } ],
                [ 'careerIRLTeacherTexture',               `career/careerIRLTeacher.png${cb}`,                         careerTextureFormat, (resource) => { resource.flipY = false; resource.minFilter = THREE.LinearFilter; resource.magFilter = THREE.LinearFilter; resource.generateMipmaps = false; resource.wrapS = THREE.ClampToEdgeWrapping; resource.wrapT = THREE.ClampToEdgeWrapping; } ],
                [ 'careerOnlineTeacherTexture',            `career/careerOnlineTeacher.png${cb}`,                      careerTextureFormat, (resource) => { resource.flipY = false; resource.minFilter = THREE.LinearFilter; resource.magFilter = THREE.LinearFilter; resource.generateMipmaps = false; resource.wrapS = THREE.ClampToEdgeWrapping; resource.wrapT = THREE.ClampToEdgeWrapping; } ],
                [ 'careerUzikTexture',                     `career/careerUzik.png${cb}`,                               careerTextureFormat, (resource) => { resource.flipY = false; resource.minFilter = THREE.LinearFilter; resource.magFilter = THREE.LinearFilter; resource.generateMipmaps = false; resource.wrapS = THREE.ClampToEdgeWrapping; resource.wrapT = THREE.ClampToEdgeWrapping; } ],
                [ 'landingStatue',                         `props/landingStatue${compressedModelSuffix}.glb${cb}`,                               'gltf' ],
                [ 'neonJesus',                             `props/neonJesus${compressedModelSuffix}.glb${cb}`,                                   'gltf' ],
                [ 'lionStatue',                            `props/lionStatue${compressedModelSuffix}.glb${cb}`,                                  'gltf' ],
                [ 'gameboy',                               `props/gameboy${compressedModelSuffix}.glb${cb}`,                                     'gltf' ],
                [ 'knuckles',                              `props/knuckles${compressedModelSuffix}.glb${cb}`,                                    'gltf' ],
                [ 'kratos',                                `props/kratos${compressedModelSuffix}.glb${cb}`,                                        'gltf' ],
                [ 'roadSurface',                           `props/road${compressedModelSuffix}.glb${cb}`,                                          'gltf' ],
                [ 'driftMask',                             `props/driftMask${compressedModelSuffix}.glb${cb}`,                                   'gltf' ],
                [ 'pistonHorse',                           `props/pistonHorse${compressedModelSuffix}.glb${cb}`,                                 'gltf' ],
                [ 'sonic',                                 `props/sonic${compressedModelSuffix}.glb${cb}`,                                       'gltf' ],
                [ 'motorcycle',                            `props/motorcycle${compressedModelSuffix}.glb${cb}`,                                  'gltf' ],
                [ 'nameBlocks',                            `props/Name.glb${cb}`,                                                                'gltf', (resource) =>
                {
                    resource.scene.traverse((child) =>
                    {
                        if(!child.isMesh || !child.material)
                            return

                        const materials = Array.isArray(child.material) ? child.material : [ child.material ]

                        for(const material of materials)
                        {
                            for(const mapName of [ 'map', 'metalnessMap', 'roughnessMap', 'normalMap', 'emissiveMap' ])
                            {
                                const map = material[mapName]

                                if(map)
                                    map.colorSpace = mapName === 'map' || mapName === 'emissiveMap'
                                        ? THREE.SRGBColorSpace
                                        : THREE.NoColorSpace
                            }
                        }
                    })
                } ],
                [ 'pyramid',                               `props/pyramid${compressedModelSuffix}.glb${cb}`,                                     'gltf' ],
                [ 'retroMountain',                         `props/RetroMountain.glb${cb}`,                                                       'gltf' ],
                [ 'retrowaveCarRemake',                    `props/retrowaveCarRemake${compressedModelSuffix}.glb${cb}`,                          'gltf' ],
            ],
            (toLoad, total) =>
            {
                const progress = 1 - toLoad / total
                this.reveal?.setHeroLoadProgress(progress)
            }
        )

        const [ newResources, RAPIER ] = await Promise.all([ resourcesPromise, rapierPromise ])
        this.RAPIER = RAPIER
        this.resources = { ...newResources, ...this.resources }

        this.terrain = new Terrain()
        this.physics = new Physics()
        this.wireframe = new PhysicsWireframe()
        this.physicalVehicle = new PhysicsVehicle()
        this.vehicleGarage = new VehicleGarage()
        this.garageModal = new GarageModal()
        this.zones = new Zones()
        this.player = new Player()
        this.closingManager = new ClosingManager()
        this.interactivePoints = new InteractivePoints()
        this.konamiCode = new KonamiCode()
        this.achievements = new Achievements()
        this.tornado = new Tornado()
        this.map = new Map()
        this.title = new Title()
        // this.monitoring = new Monitoring()
        this.world.step(1)
        this.overlay = new Overlay()

        // Pre-render disabled — expensive cube-map pass on startup, minimal visual gain
        // if(this.quality.level === 0 && this.rendering.renderer.backend.isWebGPUBackend)
        //     PreRenderer.render()

        this.reveal.waitForHeroStart()

        // Debug achievement
        if(this.debug.active)
        {
            this.achievements.setProgress('debug', 1)
        }
    }

    reset()
    {
        // Interactive buttons
        this.inputs.interactiveButtons.clearItems()

        // Player respawn
        this.player.respawn(null, () =>
        {
            // Objects reset
            this.objects.resetAll()

            // Bowling
            if(this.world.areas.bowling)
                this.world.areas.bowling.restart()

            // Cookie
            if(this.world.areas.cookie)
                this.world.areas.cookie.cookies.instancedGroup.needsUpdate = true

            // Toilet
            if(this.world.areas.toilet)
                this.world.areas.toilet.cabin.down = false

            // Social
            if(this.world.areas.social)
                this.world.areas.social.statue.down = false
            
            // Benches
            if(this.world.benches)
                this.world.benches.instancedGroup.needsUpdate = true
            
            // Fences
            if(this.world.fences)
                this.world.fences.instancedGroup.needsUpdate = true
            
            // Bricks
            if(this.world.bricks)
                this.world.bricks.instancedGroup.needsUpdate = true
            
            // Lanterns
            if(this.world.lanterns)
                this.world.lanterns.instancedGroup.needsUpdate = true

            // Achievement
            gsap.delayedCall(2, () =>
            {
                this.achievements.setProgress('reset', 1)
            })
        })
    }
}

