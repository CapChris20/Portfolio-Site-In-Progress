import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Foliage } from './Foliage.js'
import { attachStatuePhysics } from './StaticProp.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { color, uniform, Fn, mix, texture, uv, luminance, normalWorld } from 'three/tsl'

export class Trees
{
    constructor(name, visual, references, colorA, colorB, foliagePlaneCount = 48, options = {})
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
        this.alternateColorA = options.alternateColorA ?? null
        this.alternateColorB = options.alternateColorB ?? null
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

    prepareLeafMaterial(material, colorA, colorB, debugLabel = '')
    {
        const leavesColorANode = uniform(color(colorA))
        const leavesColorBNode = uniform(color(colorB))
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
            const suffix = debugLabel ? `_${debugLabel}` : ''
            this.game.debug.addThreeColorBinding(this.debugPanel, leavesColorANode.value, `leavesColorA${suffix}`)
            this.game.debug.addThreeColorBinding(this.debugPanel, leavesColorBNode.value, `leavesColorB${suffix}`)
        }

        return result
    }

    getReferenceGroups()
    {
        if(!this.alternateColorA || !this.alternateColorB || this.references.length < 2)
        {
            return [
                { references: this.references, colorA: this.colorA, colorB: this.colorB, label: '' },
            ]
        }

        const splitIndex = Math.ceil(this.references.length / 2)

        return [
            { references: this.references.slice(0, splitIndex), colorA: this.colorA, colorB: this.colorB, label: 'retro' },
            { references: this.references.slice(splitIndex), colorA: this.alternateColorA, colorB: this.alternateColorB, label: 'green' },
        ]
    }

    createInstancedBody(sourceMesh, treeReferences, prepareMaterial)
    {
        const materials = Array.isArray(sourceMesh.material) ? sourceMesh.material : [ sourceMesh.material ]
        const preparedMaterials = materials.map(prepareMaterial)

        const body = new THREE.InstancedMesh(
            sourceMesh.geometry,
            preparedMaterials.length > 1 ? preparedMaterials : preparedMaterials[0],
            treeReferences.length,
        )

        body.name = `treeBodies_${sourceMesh.name}`
        body.instanceMatrix.setUsage(THREE.StaticDrawUsage)
        body.castShadow = true
        body.receiveShadow = true
        body.frustumCulled = false

        sourceMesh.updateMatrixWorld(true)
        const meshMatrix = sourceMesh.matrixWorld.clone()

        let i = 0

        for(const treeReference of treeReferences)
        {
            treeReference.updateMatrixWorld(true)
            const instanceMatrix = meshMatrix.clone().premultiply(treeReference.matrixWorld)
            body.setMatrixAt(i, instanceMatrix)
            i++
        }

        body.instanceMatrix.needsUpdate = true
        this.game.scene.add(body)

        return body
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

            const isLeaf = this.isLeafMesh(sourceMesh)

            for(const group of this.getReferenceGroups())
            {
                const prepareMaterial = isLeaf
                    ? (material) => this.prepareLeafMaterial(material, group.colorA, group.colorB, group.label)
                    : (material) => this.prepareTreeMaterial(material)

                const body = this.createInstancedBody(sourceMesh, group.references, prepareMaterial)

                if(group.label)
                    body.name = `${body.name}_${group.label}`

                this.bodies.push(body)
            }
        }
    }

    setLeaves()
    {
        // Full GLB palms (trunk + leaf meshes) skip billboard foliage.
        if(this.modelParts.meshes.length > 1 || !this.modelParts.leaves.length || !this.references.length)
            return

        const references = []

        for(const group of this.getReferenceGroups())
        {
            for(const treeReference of group.references)
            {
                treeReference.updateMatrixWorld(true)

                for(const leaves of this.modelParts.leaves)
                {
                    leaves.updateMatrixWorld(true)
                    const finalMatrix = leaves.matrix.clone().premultiply(treeReference.matrixWorld)
                    const reference = new THREE.Object3D()
                    reference.applyMatrix4(finalMatrix)
                    reference.userData.leafColorA = group.colorA
                    reference.userData.leafColorB = group.colorB
                    reference.userData.leafLabel = group.label

                    references.push(reference)
                }
            }
        }

        // Legacy billboard palms — one Foliage per color group.
        this.leaves = []

        for(const group of this.getReferenceGroups())
        {
            const groupReferences = references.filter((reference) => reference.userData.leafLabel === group.label)

            if(!groupReferences.length)
                continue

            const leavesColorANode = uniform(color(group.colorA))
            const leavesColorBNode = uniform(color(group.colorB))
            const foliage = new Foliage(groupReferences, leavesColorANode, leavesColorBNode, true, this.foliagePlaneCount)

            this.leaves.push(foliage)

            if(this.game.debug.active)
            {
                const suffix = group.label ? `_${group.label}` : ''
                this.game.debug.addThreeColorBinding(this.debugPanel, leavesColorANode.value, `leavesColorA${suffix}`)
                this.game.debug.addThreeColorBinding(this.debugPanel, leavesColorBNode.value, `leavesColorB${suffix}`)
                this.debugPanel.addBinding(foliage.material.shadowOffset, 'value', { label: `shadowOffset${suffix}`, min: 0, max: 2, step: 0.001 })
                this.debugPanel.addBinding(foliage.material.threshold, 'value', { label: `threshold${suffix}`, min: 0, max: 1, step: 0.001 })
                this.debugPanel.addBinding(foliage.material.seeThroughEdgeMin, 'value', { label: `seeThroughEdgeMin${suffix}`, min: 0, max: 1, step: 0.001 })
                this.debugPanel.addBinding(foliage.material.seeThroughEdgeMax, 'value', { label: `seeThroughEdgeMax${suffix}`, min: 0, max: 1, step: 0.001 })
            }
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
