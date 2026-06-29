import * as THREE from 'three/webgpu'

/**
 * GLB exports often use blank or generic material names ("" / "pbr_material").
 * Materials.js caches by name — collisions steal the wrong texture. Prefix per prop.
 */
export function preparePropMaterials(model, prefix = 'worldProp')
{
    model.traverse((child) =>
    {
        if(!child.isMesh || !child.material)
            return

        const assign = (material, index) =>
        {
            const unique = material.clone()
            const baseName = material.name?.trim() || 'mat'
            unique.name = `${prefix}__${baseName}__${index}`
            return unique
        }

        if(Array.isArray(child.material))
            child.material = child.material.map((material, index) => assign(material, index))
        else
            child.material = assign(child.material, 0)
    })
}

/**
 * Clone a GLB scene, scale to targetLength, center XZ, and sit the base on Y = 0.
 */
export function createGroundedPropVisual(sourceModel, targetLength = 4, options = {})
{
    const castShadow = options.castShadow ?? true
    const receiveShadow = options.receiveShadow ?? true
    const materialPrefix = options.materialPrefix

    const model = sourceModel.clone(true)

    if(materialPrefix)
        preparePropMaterials(model, materialPrefix)

    model.traverse((child) =>
    {
        if(child.isMesh)
        {
            child.castShadow = castShadow
            child.receiveShadow = receiveShadow

            if(child.material)
                child.material.shadowSide = THREE.BackSide
        }
    })

    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const footprint = Math.max(size.x, size.z)
    const footprintScale = targetLength / footprint

    if(options.targetHeight)
    {
        const scale = options.targetHeight / size.y
        const widthScale = options.widthScale ?? 1

        model.scale.set(scale * widthScale, scale, scale * widthScale)
    }
    else
        model.scale.setScalar(footprintScale)
    model.updateMatrixWorld(true)

    const fittedBox = new THREE.Box3().setFromObject(model)
    const center = fittedBox.getCenter(new THREE.Vector3())

    model.position.x -= center.x
    model.position.z -= center.z
    model.position.y -= fittedBox.min.y

    return model
}
