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
        const next = line ? `${line} ${word}` : word

        if(next.length > maxChars && line)
        {
            lines.push(line)
            line = word
        }
        else
        {
            line = next
        }
    }

    if(line)
        lines.push(line)

    return lines.slice(0, maxLines)
}

export class DescriptionSign
{
    constructor({
        frame,
        imagesMesh,
        templateGroup,
        texts,
        shadeMix,
        fontSizeMultiplier = 0.24,
        textWidth = 4.5,
        textHeight = 1.4,
        offset = OFFSET_FROM_IMAGES.labSign,
    })
    {
        this.texts = texts
        this.shadeMix = shadeMix
        this.status = 'hidden'
        this.nextDirection = 1

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

        this.group.rotation.copy(templateGroup.rotation)
        this.group.scale.copy(templateGroup.scale)

        this.inner = this.group.children.find(_child => _child.name.startsWith('inner')) ?? this.group.children[0]
        this.textMesh = this.inner.children.find(_child => _child.name.startsWith('text'))
        this.panel = this.inner.children.find(_child => _child.name.startsWith('panel'))
        this.backdrop = this.inner.children.find(_child => _child.name.startsWith('Cube') || _child.name.startsWith('cuboid'))

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

        texts.createMaterialOnMesh(this.textMesh, this.textCanvas.texture)
    }

    setText(text)
    {
        if(!text)
        {
            this.group.visible = false
            return
        }

        this.group.visible = true

        const lines = wrapDescription(text)
        this.textCanvas.updateText(lines)

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

    update(text, direction = 1)
    {
        this.nextDirection = direction

        if(this.status === 'hiding')
            return

        this.status = 'hiding'

        const rotationDirection = direction === 2 ? -1 : 1

        this.inner.rotation.x = 0
        gsap.to(this.inner.rotation, { x: Math.PI * rotationDirection, duration: 0.8, ease: 'power2.in', overwrite: true, onComplete: () =>
        {
            this.status = 'visible'
            this.setText(text)

            gsap.to(this.inner.rotation, { x: Math.PI * 2 * rotationDirection, duration: 0.8, ease: 'back.out(2)', overwrite: true })
        } })
    }
}
