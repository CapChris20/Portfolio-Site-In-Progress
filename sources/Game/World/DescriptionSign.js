import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { TextCanvas } from '../TextCanvas.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import gsap from 'gsap'

const DEFAULT_SIGN_COLOR = '#12082a'
const DEFAULT_SIGN_ACCENT = '#ffffff'

/** Offsets from the main image board mesh (from areas.glb). */
export const OFFSET_FROM_IMAGES = {
    /** Projects skills — beside board (refAttributes). */
    projectsSign: { x: 4.4706268310546875, y: 0.7339856624603271, z: -1.784593105316162 },
    /** Lab — caption plaque below the main frame. */
    labSign: { x: 0, y: -1.55, z: 0 },
    url: { x: 0.0324249267578125, y: 1.2308721542358398, z: 0.04117393493652344 },
}

export function positionRelativeToImages(imagesMesh, offset)
{
    return new THREE.Vector3(
        imagesMesh.position.x + offset.x,
        imagesMesh.position.y + offset.y,
        imagesMesh.position.z + offset.z,
    )
}

/** Place a caption fully below the image plane (not overlapping it). */
export function positionBelowImages(imagesMesh, objectHeight, gap = 0.1, extraLower = 0)
{
    if(imagesMesh.geometry && !imagesMesh.geometry.boundingBox)
        imagesMesh.geometry.computeBoundingBox()

    const localBottom = imagesMesh.geometry.boundingBox.min.y * imagesMesh.scale.y
    const imageBottom = imagesMesh.position.y + localBottom

    return new THREE.Vector3(
        imagesMesh.position.x,
        imageBottom - gap - extraLower - objectHeight * 0.5,
        imagesMesh.position.z,
    )
}

export function getImagesWidth(imagesMesh)
{
    if(!imagesMesh?.geometry)
        return 4

    if(!imagesMesh.geometry.boundingBox)
        imagesMesh.geometry.computeBoundingBox()

    const box = imagesMesh.geometry.boundingBox

    return (box.max.x - box.min.x) * imagesMesh.scale.x
}

/** Shrink screenshot height and lift it so a description fits on the frame below. */
export function layoutScreenshotForCaption(imagesMesh, heightScale = 0.68, liftY = 0.48)
{
    if(!imagesMesh || imagesMesh.userData.captionLayoutApplied)
        return

    imagesMesh.userData.captionLayoutApplied = true
    imagesMesh.scale.y *= heightScale
    imagesMesh.position.y += liftY
}

export function wrapDescription(text, maxChars = 34, maxLines = 3)
{
    const words = String(text).split(/\s+/).filter(Boolean)
    const lines = []
    let line = ''

    for(const word of words)
    {
        let remaining = word

        while(remaining.length > 0)
        {
            const spaceLeft = maxChars - line.length - (line ? 1 : 0)

            if(spaceLeft <= 0 && line)
            {
                lines.push(line)
                line = ''
                continue
            }

            if(remaining.length <= spaceLeft || spaceLeft <= 0)
            {
                line = line ? `${line} ${remaining}` : remaining
                remaining = ''
            }
            else
            {
                if(line)
                {
                    lines.push(line)
                    line = ''
                }

                lines.push(remaining.slice(0, maxChars))
                remaining = remaining.slice(maxChars)
            }
        }

        if(lines.length >= maxLines)
            break
    }

    if(line)
        lines.push(line)

    return lines.slice(0, maxLines)
}

function findBackdrop(inner)
{
    return inner.children.find((_child) =>
        _child.name.startsWith('panel') ||
        _child.name.startsWith('Cube') ||
        _child.name.startsWith('cube') ||
        _child.name.startsWith('refel'),
    )
}

/**
 * Flat caption sign — same panel + text setup as the project title label in areas.glb.
 */
export class DescriptionSign
{
    constructor({
        frame,
        imagesMesh,
        templateGroup,
        texts,
        fontSizeMultiplier = 0.24,
        textWidth = 3.8,
        textHeight = 0.85,
        offset = OFFSET_FROM_IMAGES.labSign,
        maxChars = 32,
        maxLines = 3,
        placeBelowImage = false,
        belowGap = 0.08,
        belowExtraY = 0,
        showPanel = false,
        buildTextMaterial = null,
    })
    {
        this.texts = texts
        this.buildTextMaterial = buildTextMaterial
        this.showPanel = showPanel
        this.maxChars = maxChars
        this.maxLines = maxLines
        this.status = 'hidden'
        this.hasShown = false
        this.imagesMesh = imagesMesh
        this.imageWidth = getImagesWidth(imagesMesh)
        this.placeBelowImage = placeBelowImage
        this.belowGap = belowGap
        this.belowExtraY = belowExtraY
        this.theme = { panelColor: DEFAULT_SIGN_COLOR, textColor: DEFAULT_SIGN_ACCENT }

        this.group = templateGroup.clone(true)
        this.group.name = 'descriptionSign'
        this.group.visible = false

        this.group.traverse((child) =>
        {
            if(child.name?.startsWith('intersect'))
                child.visible = false
        })

        frame.add(this.group)

        this.inner = this.group.children.find(_child => _child.name.startsWith('inner')) ?? this.group.children[0]
        this.textMesh = this.inner?.children.find(_child => _child.name.startsWith('text'))
        this.panel = this.inner?.children.find(_child => _child.name.startsWith('panel'))
        this.backdrop = this.inner ? findBackdrop(this.inner) : null

        this.inner.rotation.set(0, 0, 0)

        if(!this.showPanel)
        {
            if(this.panel)
                this.panel.visible = false

            if(this.backdrop)
                this.backdrop.visible = false
        }

        if(imagesMesh)
        {
            if(placeBelowImage)
            {
                this.group.updateMatrixWorld(true)
                const size = new THREE.Box3().setFromObject(this.group).getSize(new THREE.Vector3())
                this.group.position.copy(positionBelowImages(imagesMesh, size.y, belowGap, belowExtraY))
            }
            else
            {
                this.group.position.copy(positionRelativeToImages(imagesMesh, offset))
            }
        }

        if(!this.textMesh)
        {
            console.warn('DescriptionSign: could not find text mesh in template')
            return
        }

        this.textCanvas = new TextCanvas(
            texts.fontFamily,
            texts.fontWeight,
            texts.fontSizeMultiplier * fontSizeMultiplier,
            textWidth,
            textHeight,
            texts.density,
            'center',
            0.22,
        )

        this.textCanvas.texture.minFilter = THREE.LinearFilter
        this.textCanvas.texture.magFilter = THREE.LinearFilter

        texts.createMaterialOnMesh(this.textMesh, this.textCanvas.texture)

        if(this.showPanel)
            this.applyTheme(this.theme)

        if(this.textMesh.material)
        {
            this.textMesh.material.side = THREE.DoubleSide
            this.textMesh.material.depthWrite = false
        }

        this.textMesh.renderOrder = 2
    }

    applyTheme(theme = {})
    {
        if(!this.showPanel)
        {
            if(this.textMesh && this.textCanvas)
                this.texts.createMaterialOnMesh(this.textMesh, this.textCanvas.texture)

            return
        }

        this.theme = {
            panelColor: theme.panelColor ?? theme.signColor ?? DEFAULT_SIGN_COLOR,
            textColor: theme.textColor ?? theme.signAccent ?? DEFAULT_SIGN_ACCENT,
        }

        const panelMaterial = new MeshDefaultMaterial({
            colorNode: color(this.theme.panelColor),
            hasWater: false,
        })

        for(const mesh of [ this.panel, this.backdrop ])
        {
            if(mesh?.isMesh)
                mesh.material = panelMaterial
        }

        if(!this.textMesh || !this.textCanvas)
            return

        if(this.buildTextMaterial)
            this.textMesh.material = this.buildTextMaterial(this.textCanvas.texture, this.theme.textColor)
        else
            this.texts.createMaterialOnMesh(this.textMesh, this.textCanvas.texture)
    }

    repositionBelowImage()
    {
        if(!this.imagesMesh || !this.placeBelowImage)
            return

        this.group.updateMatrixWorld(true)
        const size = new THREE.Box3().setFromObject(this.group).getSize(new THREE.Vector3())
        this.group.position.copy(positionBelowImages(this.imagesMesh, size.y, this.belowGap, this.belowExtraY))
    }

    resizeBackdrop(lines)
    {
        if(!this.showPanel)
            return

        const backdropWidth = this.imageWidth * 0.96
        const backdropHeight = 0.26 + lines.length * 0.2

        if(this.panel)
        {
            this.panel.scale.x = backdropWidth
            this.panel.scale.y = backdropHeight
        }

        if(this.backdrop && this.backdrop !== this.panel)
        {
            this.backdrop.scale.x = backdropWidth
            this.backdrop.scale.y = backdropHeight
        }
    }

    setText(text, theme = null)
    {
        if(!this.textMesh)
            return

        if(theme)
            this.applyTheme(theme)

        if(!text)
        {
            this.group.visible = false
            this.status = 'hidden'
            return
        }

        const lines = wrapDescription(text, this.maxChars, this.maxLines)

        if(!lines.length)
        {
            this.group.visible = false
            this.status = 'hidden'
            return
        }

        this.group.visible = true
        this.status = 'visible'
        this.textCanvas.updateText(lines)
        this.resizeBackdrop(lines)
        this.repositionBelowImage()
    }

    update(text, direction = 1, theme = null)
    {
        if(!this.textMesh)
            return

        if(this.flipTween)
        {
            this.flipTween.kill()
            this.flipTween = null
        }

        gsap.killTweensOf(this.inner.rotation)

        if(!text)
        {
            this.setText(null)
            return
        }

        const themePayload = theme ?? {}

        if(!this.hasShown)
        {
            this.hasShown = true
            this.inner.rotation.x = 0
            this.setText(text, themePayload)
            return
        }

        this.status = 'hiding'
        const rotationDirection = direction === 2 ? -1 : 1

        this.inner.rotation.x = 0
        this.flipTween = gsap.to(this.inner.rotation, { x: Math.PI * rotationDirection, duration: 0.8, ease: 'power2.in', overwrite: true, onComplete: () =>
        {
            this.flipTween = null
            this.setText(text, themePayload)

            gsap.to(this.inner.rotation, {
                x: Math.PI * 2 * rotationDirection,
                duration: 0.8,
                ease: 'back.out(2)',
                overwrite: true,
                onComplete: () =>
                {
                    this.inner.rotation.x = 0
                },
            })
        } })
    }
}
