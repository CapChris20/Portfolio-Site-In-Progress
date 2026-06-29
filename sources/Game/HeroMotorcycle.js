import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export class HeroMotorcycle
{
    constructor(canvas)
    {
        this.canvas = canvas
        this.active = true
        this.clock = new THREE.Clock()
        this._onResize = () => this.resize()

        this.scene = new THREE.Scene()

        this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
        this.camera.position.set(0.15, 0.82, 4.6)
        this.baseRotation = Math.PI * 0.38

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
        })
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.setClearColor(0x000000, 0)
        this.renderer.outputColorSpace = THREE.SRGBColorSpace
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping
        this.renderer.toneMappingExposure = 1.15

        this.resize()
        window.addEventListener('resize', this._onResize)

        this.setLights()
        this.loadModel()
        this.tick()
    }

    setLights()
    {
        this.scene.add(new THREE.AmbientLight(0xffd4b8, 0.55))

        const key = new THREE.DirectionalLight(0xffe8d4, 1.35)
        key.position.set(2.5, 4, 3.5)
        this.scene.add(key)

        const fill = new THREE.DirectionalLight(0xc878ff, 0.75)
        fill.position.set(-3, 1.5, 2)
        this.scene.add(fill)

        const rim = new THREE.DirectionalLight(0xff8500, 0.9)
        rim.position.set(0, 2, -4)
        this.scene.add(rim)
    }

    async loadModel()
    {
        const loader = new GLTFLoader()

        try
        {
            const gltf = await loader.loadAsync('/props/motorcycle.glb')
            if(!this.active)
                return

            this.model = gltf.scene
            this.model.rotation.y = this.baseRotation

            const box = new THREE.Box3().setFromObject(this.model)
            const center = box.getCenter(new THREE.Vector3())
            const size = box.getSize(new THREE.Vector3())

            this.model.position.sub(center)
            this.model.position.x -= size.x * 0.06
            this.model.position.y += size.y * 0.02

            const maxDim = Math.max(size.x, size.y, size.z)
            const scale = 2.35 / maxDim
            this.model.scale.setScalar(scale)

            this.model.traverse((child) =>
            {
                if(!child.isMesh)
                    return

                child.castShadow = false
                child.receiveShadow = false

                if(child.material?.map)
                    child.material.map.colorSpace = THREE.SRGBColorSpace
            })

            this.scene.add(this.model)
            this.camera.lookAt(0.05, 0.08, 0)
        }
        catch(error)
        {
            console.warn('HeroMotorcycle: could not load model', error)
        }
    }

    resize()
    {
        if(!this.canvas)
            return

        const width = this.canvas.clientWidth
        const height = this.canvas.clientHeight

        if(!width || !height)
            return

        this.camera.aspect = width / height
        this.camera.updateProjectionMatrix()
        this.renderer.setSize(width, height, false)
    }

    tick()
    {
        if(!this.active)
            return

        const elapsed = this.clock.getElapsedTime()

        if(this.model)
        {
            this.model.rotation.y = this.baseRotation + elapsed * 0.22
            this.model.position.y = Math.sin(elapsed * 0.9) * 0.04
        }

        this.renderer.render(this.scene, this.camera)
        this._frame = requestAnimationFrame(() => this.tick())
    }

    destroy()
    {
        this.active = false

        if(this._frame)
            cancelAnimationFrame(this._frame)

        window.removeEventListener('resize', this._onResize)

        this.model?.traverse((child) =>
        {
            if(!child.isMesh)
                return

            child.geometry?.dispose()

            const materials = Array.isArray(child.material) ? child.material : [ child.material ]

            for(const material of materials)
            {
                if(!material)
                    continue

                for(const value of Object.values(material))
                {
                    if(value?.isTexture)
                        value.dispose()
                }

                material.dispose()
            }
        })

        this.renderer.dispose()
    }
}
