import * as THREE from 'three/webgpu'
import { cameraPosition, color, dot, float, Fn, luminance, max, mix, normalWorld, positionWorld, pow, smoothstep, texture, uniform, uv, vec3 } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

function saturateColor(threeColor, saturation = 1, lightness = 1)
{
    const out = threeColor.clone()
    const hsl = {}

    out.getHSL(hsl)
    out.setHSL(
        hsl.h,
        Math.min(1, hsl.s * saturation),
        Math.min(1, hsl.l * lightness),
    )

    return out
}

function buildUltraPolishedVehicleColorNode(map)
{
    const lightDir = vec3(0.35, 1, 0.25).normalize()

    return Fn(() =>
    {
        let paint = texture(map, uv()).rgb

        // Subtle grade — clearer colors without blowing out
        paint = paint.sub(0.5).mul(1.1).add(0.5).clamp(0, 1)
        const luma = luminance(paint)
        paint = mix(vec3(luma), paint, float(1.25))
        paint = paint.pow(0.96).mul(1.05)

        // Light punch on bright areas only
        const bright = smoothstep(0.5, 0.88, luma)
        paint = paint.add(paint.mul(bright.mul(0.1)))

        // Soft specular
        const normal = normalWorld
        const viewDir = positionWorld.sub(cameraPosition).normalize()
        const halfDir = lightDir.add(viewDir).normalize()
        const spec = pow(max(dot(normal, halfDir), 0), float(64)).mul(0.15)
        const specular = vec3(1, 0.98, 0.96).mul(spec)

        // Subtle rim
        const fresnel = float(1).sub(max(dot(normal, viewDir), 0).abs()).pow(3.5).mul(0.08)
        const rim = vec3(1, 0.95, 0.9).mul(fresnel)

        return paint.add(specular).add(rim).clamp(0, 1)
    })()
}

function buildUltraPolishedSolidColorNode(sourceColor)
{
    const paint = uniform(saturateColor(sourceColor.clone(), 1.18, 1.02))
    const lightDir = vec3(0.35, 1, 0.25).normalize()

    return Fn(() =>
    {
        const normal = normalWorld
        const viewDir = positionWorld.sub(cameraPosition).normalize()
        const halfDir = lightDir.add(viewDir).normalize()
        const spec = pow(max(dot(normal, halfDir), 0), float(48)).mul(0.1)
        const fresnel = float(1).sub(max(dot(normal, viewDir), 0).abs()).pow(3).mul(0.06)

        return paint.add(vec3(spec).mul(0.5)).add(vec3(fresnel).mul(0.4)).clamp(0, 1)
    })()
}

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
 * Same textured MeshDefaultMaterial pipeline as the custom vehicle — preserves GLB maps and colors.
 */
export function applyVehicleStyleMaterials(object, options = {})
{
    const {
        materialNamePrefix = 'vehicle',
        polished = false,
        hasFog = false,
        hasReveal = false,
        hasWater = false,
        hasLightBounce = false,
        hasCoreShadows = true,
        hasDropShadows = true,
    } = options

    const game = Game.getInstance()
    const capabilities = game.rendering?.renderer?.capabilities
    const maxAnisotropy = typeof capabilities?.getMaxAnisotropy === 'function'
        ? capabilities.getMaxAnisotropy()
        : 8

    object.traverse((child) =>
    {
        if(!child.isMesh || !child.material)
            return

        const convert = (sourceMaterial, index) =>
        {
            if(sourceMaterial.userData?.prevent)
                return sourceMaterial

            let colorNode = null

            if(sourceMaterial.map)
            {
                sourceMaterial.map.colorSpace = THREE.SRGBColorSpace
                sourceMaterial.map.anisotropy = maxAnisotropy
                sourceMaterial.map.minFilter = THREE.LinearMipmapLinearFilter
                sourceMaterial.map.magFilter = THREE.LinearFilter
                sourceMaterial.map.generateMipmaps = true

                if(polished)
                {
                    colorNode = buildUltraPolishedVehicleColorNode(sourceMaterial.map)
                }
                else
                {
                    colorNode = texture(sourceMaterial.map, uv()).rgb.pow(0.88).mul(1.38)
                }
            }
            else if(sourceMaterial.color)
            {
                colorNode = polished
                    ? buildUltraPolishedSolidColorNode(sourceMaterial.color)
                    : uniform(sourceMaterial.color.clone())
            }

            const material = new MeshDefaultMaterial({
                colorNode: colorNode ?? color(0xffffff),
                hasFog,
                hasReveal,
                hasWater,
                hasLightBounce,
                hasCoreShadows,
                hasDropShadows,
            })

            if(sourceMaterial.map)
                material.map = sourceMaterial.map

            material.name = `${materialNamePrefix}_${sourceMaterial.name || 'body'}_${index}`
            material.shadowSide = THREE.BackSide

            return material
        }

        if(Array.isArray(child.material))
            child.material = child.material.map((material, index) => convert(material, index))
        else
            child.material = convert(child.material, 0)
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
