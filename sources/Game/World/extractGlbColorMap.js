import * as THREE from 'three/webgpu'

export function extractGlbColorMap(gltf, options = {})
{
    let map = null

    gltf.scene.traverse((child) =>
    {
        if(!child.isMesh || !child.material || map)
            return

        const materials = Array.isArray(child.material) ? child.material : [ child.material ]

        for(const material of materials)
        {
            if(material.map)
            {
                map = material.map
                break
            }
        }
    })

    if(!map)
        return null

    const capabilities = options.renderer?.capabilities
    const maxAnisotropy = typeof capabilities?.getMaxAnisotropy === 'function'
        ? capabilities.getMaxAnisotropy()
        : 8

    map.colorSpace = THREE.SRGBColorSpace
    map.wrapS = THREE.RepeatWrapping
    map.wrapT = THREE.RepeatWrapping
    map.anisotropy = maxAnisotropy
    map.minFilter = THREE.LinearMipmapLinearFilter
    map.magFilter = THREE.LinearFilter
    map.generateMipmaps = true
    map.needsUpdate = true

    return {
        map,
        tileScale: new THREE.Vector2(0.5, 0.65),
    }
}
