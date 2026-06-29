import * as THREE from 'three/webgpu'
import { TextCanvas } from '../TextCanvas.js'
import gsap from 'gsap'

/** Offsets from the main image board mesh (from areas.glb). */
export const OFFSET_FROM_IMAGES = {
    /** Projects skills — beside board (refAttributes). */
    projectsSign: { x: 4.4706268310546875, y: 0.7339856624603271, z: -1.784593105316162 },
    /** Lab — wooden caption below the main frame. */
    labSign: { x: 0.0098114013671875, y: -1.05, z: 0.0016536712646484375 },
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

export class DescriptionSign
{
    constructor({
        frame,
        imagesMesh,
        templateGroup,
        texts,
        fontSizeMultiplier = 0.24,
        textWidth = 4.5,
        textHeight = 1.4,
        offset = OFFSET_FROM_IMAGES.labSign,
        maxChars = 34,
        maxLines = 3,
    })
    {
        this.texts = texts
        this.maxChars = maxChars
        this.maxLines = maxLines
        this.status = 'hidden'
        this.hasShown = false

        this.group = templateGroup.clone(true)
        this.group.name = 'descriptionSign'
        this.group.visible = false

        this.group.traverse((child) =>
        {
            if(child.name?.startsWith('intersect'))
                child.visible = false
        })

        frame.add(this.group)

        if(imagesMesh)
            this.group.position.copy(positionRelativeToImages(imagesMesh, offset))

        this.group.rotation.set(0, 0, 0)
        this.group.scale.copy(templateGroup.scale)

        this.inner = this.group.children.find(_child => _child.name.startsWith('inner')) ?? this.group.children[0]
        this.textMesh = this.inner?.children.find(_child => _child.name.startsWith('text'))
        this.panel = this.inner?.children.find(_child => _child.name.startsWith('panel'))
        this.backdrop = this.inner ? findBackdrop(this.inner) : null

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

        if(this.textMesh.material?.isMeshLambertNodeMaterial)
        {
            this.textMesh.material.side = THREE.DoubleSide
            this.textMesh.material.depthWrite = false
        }

        this.textMesh.renderOrder = 2
    }

    resizeBackdrop(lines)
    {
        const ratio = this.textCanvas.getMeasure().width / this.texts.density
        const backdropWidth = Math.max(ratio + 0.5, 2.2)
        const backdropHeight = 0.3 + lines.length * 0.2

        if(this.panel)
        {
            this.panel.scale.x = backdropWidth
            this.panel.scale.y = backdropHeight
        }

        if(this.backdrop)
        {
            this.backdrop.scale.x = backdropWidth
            this.backdrop.scale.y = backdropHeight
        }
    }

    setText(text)
    {
        if(!this.textMesh)
            return

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
    }

    update(text, direction = 1)
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

        if(!this.hasShown)
        {
            this.hasShown = true
            this.inner.rotation.x = 0
            this.setText(text)
            return
        }

        this.status = 'hiding'
        const rotationDirection = direction === 2 ? -1 : 1

        this.inner.rotation.x = 0
        this.flipTween = gsap.to(this.inner.rotation, { x: Math.PI * rotationDirection, duration: 0.8, ease: 'power2.in', overwrite: true, onComplete: () =>
        {
            this.flipTween = null
            this.setText(text)

            gsap.to(this.inner.rotation, { x: Math.PI * 2 * rotationDirection, duration: 0.8, ease: 'back.out(2)', overwrite: true })
        } })
    }
}
