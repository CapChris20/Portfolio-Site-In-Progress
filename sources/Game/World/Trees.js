import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { Foliage } from './Foliage.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { color, texture, uniform, uv } from 'three/tsl'

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
        this.modelParts.leaves = []
        this.modelParts.body = null
        
        this.visual.traverse((_child) =>
        {
            if(_child.name.startsWith('treeLeaves'))
                this.modelParts.leaves.push(_child)
            else if(_child.name.startsWith('treeBody') && _child.isMesh)
                this.modelParts.body = _child
        })
    }

    createBodyMaterial(sourceMaterial)
    {
        if(sourceMaterial?.map)
        {
            sourceMaterial.map.colorSpace = THREE.SRGBColorSpace

            const material = new MeshDefaultMaterial({
                colorNode: texture(sourceMaterial.map, uv()).rgb,
                hasReveal: false,
                hasWater: false,
                side: THREE.DoubleSide,
            })
            material.map = sourceMaterial.map
            material.name = 'treeBodyInstanced'

            return material
        }

        this.game.materials.applyObjectMaterials(this.modelParts.body, { useCache: false })

        const material = this.modelParts.body.material

        if(material?.isMeshLambertNodeMaterial)
        {
            material.hasReveal = false
            material.hasWater = false
            material.side = THREE.DoubleSide
            material.name = 'treeBodyInstanced'
        }

        return material
    }

    setBodies()
    {
        if(!this.modelParts.body)
        {
            console.warn('Trees: could not find treeBody mesh in visual')
            return
        }

        if(!this.references.length)
        {
            console.warn('Trees: no placement references')
            return
        }

        const geometry = this.modelParts.body.geometry
        const material = this.createBodyMaterial(this.modelParts.body.material)

        this.bodies = new THREE.InstancedMesh(geometry, material, this.references.length)
        this.bodies.name = 'treeBodies'
        this.bodies.instanceMatrix.setUsage(THREE.StaticDrawUsage)
        this.bodies.castShadow = true
        this.bodies.receiveShadow = true
        this.bodies.frustumCulled = false
        
        let i = 0
        for(const treeReference of this.references)
        {
            treeReference.updateMatrix()
            this.bodies.setMatrixAt(i, treeReference.matrix)
            i++
        }

        this.bodies.instanceMatrix.needsUpdate = true
        this.game.scene.add(this.bodies)
    }

    setLeaves()
    {
        if(!this.modelParts.leaves.length || !this.references.length)
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
        if(this.game.quality.level === 1)
            return

        for(const treeReference of this.references)
        {
            const position = treeReference.position.clone().add(new THREE.Vector3(0, 2.5, 0))

            this.game.objects.add(
                null,
                {
                    type: 'fixed',
                    position,
                    rotation: treeReference.quaternion,
                    friction: 0.7,
                    sleeping: true,
                    colliders: [ { shape: 'cylinder', parameters: [ 2.5, 0.15 ], category: 'object' } ],
                    onCollision: (force, position) =>
                    {
                        this.game.audio.groups.get('hitDefault').playRandomNext(force, position)
                    }
                }
            )
        }
    }
}
