import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Foliage } from './Foliage.js'
import { attachStatuePhysics } from './StaticProp.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { color, uniform, Fn, mix, texture, uv, luminance, normalWorld } from 'three/tsl'

export class Trees
{
    constructor(name, visual, references, colorA, colorB, foliagePlaneCount = 48)
    {
        this.game = Game.getInstance()

        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: `🌳 ${name}`,
                expanded: false,
            })
        }

        this.visual = visual
        this.references = references
        this.colorA = colorA
        this.colorB = colorB
        this.foliagePlaneCount = foliagePlaneCount

        this.setModelParts()
        this.setBodies()
        this.setLeaves()
        this.setPhysical()
    }

    setModelParts()
    {
        this.modelParts = {}
        this.modelParts.meshes = []
        this.modelParts.leaves = []

        this.visual.updateMatrixWorld(true)

        this.visual.traverse((_child) =>
        {
            if(_child.name.startsWith('treeLeaves') && !_child.isMesh)
                this.modelParts.leaves.push(_child)
            else if(_child.isMesh)
                this.modelParts.meshes.push(_child)
        })

        // Legacy palmTreesVisual.glb fallback
        if(!this.modelParts.meshes.length)
        {
            this.visual.traverse((_child) =>
            {
                if(_child.name.startsWith('treeBody') && _child.isMesh)
                    this.modelParts.meshes.push(_child)
            })
        }
    }

    isLeafMesh(mesh)
    {
        return mesh.name.toLowerCase().includes('leaves')
    }

    prepareTreeMaterial(material)
    {
        if(!material?.isMeshLambertNodeMaterial)
            return material

        material.hasReveal = false
        material.hasWater = false
        material.side = THREE.DoubleSide

        return material
    }

    prepareLeafMaterial(material)
    {
        const leavesColorANode = uniform(color(this.colorA))
        const leavesColorBNode = uniform(color(this.colorB))
        const map = material.map

        const colorNode = Fn(() =>
        {
            const litMix = normalWorld.dot(this.game.lighting.directionUniform).smoothstep(0, 1)
            let foliageColor = mix(leavesColorANode, leavesColorBNode, litMix)

            if(map)
            {
                const texLuma = luminance(texture(map, uv()).rgb)
                const shade = texLuma.div(0.35).clamp(0.55, 1.15)
                foliageColor = foliageColor.mul(shade)
            }

            return foliageColor
        })()

        const result = new MeshDefaultMaterial({
            colorNode,
            hasReveal: false,
            hasWater: false,
        })

        result.side = THREE.DoubleSide

        if(this.game.debug.active)
        {
            this.game.debug.addThreeColorBinding(this.debugPanel, leavesColorANode.value, 'leavesColorA')
            this.game.debug.addThreeColorBinding(this.debugPanel, leavesColorBNode.value, 'leavesColorB')
        }

        return result
    }

    setBodies()
    {
        if(!this.modelParts.meshes.length)
        {
            console.warn('Trees: could not find mesh(es) in visual')
            return
        }

        if(!this.references.length)
        {
            console.warn('Trees: no placement references')
            return
        }

        this.bodies = []

        this.visual.updateMatrixWorld(true)

        for(const sourceMesh of this.modelParts.meshes)
        {
            this.game.materials.updateObject(sourceMesh)

            const materials = Array.isArray(sourceMesh.material) ? sourceMesh.material : [ sourceMesh.material ]
            const prepareMaterial = this.isLeafMesh(sourceMesh)
                ? (material) => this.prepareLeafMaterial(material)
                : (material) => this.prepareTreeMaterial(material)
            const preparedMaterials = materials.map(prepareMaterial)

            const body = new THREE.InstancedMesh(
                sourceMesh.geometry,
                preparedMaterials.length > 1 ? preparedMaterials : preparedMaterials[0],
                this.references.length,
            )

            body.name = `treeBodies_${sourceMesh.name}`
            body.instanceMatrix.setUsage(THREE.StaticDrawUsage)
            body.castShadow = true
            body.receiveShadow = true
            body.frustumCulled = false

            sourceMesh.updateMatrixWorld(true)
            const meshMatrix = sourceMesh.matrixWorld.clone()

            let i = 0

            for(const treeReference of this.references)
            {
                treeReference.updateMatrixWorld(true)
                const instanceMatrix = meshMatrix.clone().premultiply(treeReference.matrixWorld)
                body.setMatrixAt(i, instanceMatrix)
                i++
            }

            body.instanceMatrix.needsUpdate = true
            this.game.scene.add(body)
            this.bodies.push(body)
        }
    }

    setLeaves()
    {
        // Full GLB palms (trunk + leaf meshes) skip billboard foliage.
        if(this.modelParts.meshes.length > 1 || !this.modelParts.leaves.length || !this.references.length)
            return

        const references = []

        for(const treeReference of this.references)
        {
            treeReference.updateMatrixWorld(true)

            for(const leaves of this.modelParts.leaves)
            {
                leaves.updateMatrixWorld(true)
                const finalMatrix = leaves.matrix.clone().premultiply(treeReference.matrixWorld)
                const reference = new THREE.Object3D()
                reference.applyMatrix4(finalMatrix)

                references.push(reference)
            }
        }

        const leavesColorANode = uniform(color(this.colorA))
        const leavesColorBNode = uniform(color(this.colorB))
        this.leaves = new Foliage(references, leavesColorANode, leavesColorBNode, true, this.foliagePlaneCount)

        // Debug
        if(this.game.debug.active)
        {
            this.game.debug.addThreeColorBinding(this.debugPanel, leavesColorANode.value, 'leavesColorA')
            this.game.debug.addThreeColorBinding(this.debugPanel, leavesColorBNode.value, 'leavesColorB')
            this.debugPanel.addBinding(this.leaves.material.shadowOffset, 'value', { label: 'shadowOffset', min: 0, max: 2, step: 0.001 })
            this.debugPanel.addBinding(this.leaves.material.threshold, 'value', { label: 'threshold', min: 0, max: 1, step: 0.001 })
            this.debugPanel.addBinding(this.leaves.material.seeThroughEdgeMin, 'value', { label: 'seeThroughEdgeMin', min: 0, max: 1, step: 0.001 })
            this.debugPanel.addBinding(this.leaves.material.seeThroughEdgeMax, 'value', { label: 'seeThroughEdgeMax', min: 0, max: 1, step: 0.001 })
        }
    }

    setPhysical()
    {
        const colliderLength = 5.5

        for(const treeReference of this.references)
        {
            const anchor = new THREE.Group()
            anchor.name = 'palmTreePhysicalFixed'

            attachStatuePhysics(anchor, colliderLength, {
                position: new THREE.Vector3(treeReference.position.x, 0, treeReference.position.z),
                rotation: treeReference.quaternion.clone(),
            })
        }
    }
}
