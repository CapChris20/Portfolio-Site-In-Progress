import { Game } from '../Game.js'

export class TerrainHeightSampler
{
    constructor()
    {
        this.game = Game.getInstance()
        this.halfSize = this.game.terrain.size * 0.5
        this.subdivision = this.game.terrain.subdivision
        this.rows = 0
        this.heights = null
        this.terrainMask = null
        this.terrainMaskWidth = 0
        this.terrainMaskHeight = 0

        this.setHeightsFromTerrainModel()
        this.setTerrainMaskFromTexture()
    }

    setHeightsFromTerrainModel()
    {
        const geometry = this.game.resources.terrainModel?.scene?.children?.[0]?.geometry

        if(!geometry)
            return

        const position = geometry.attributes.position
        const count = position.count
        this.rows = Math.round(Math.sqrt(count))
        this.heights = new Float32Array(count)

        for(let i = 0; i < count; i++)
        {
            const x = position.getX(i)
            const y = position.getY(i)
            const z = position.getZ(i)
            const indexX = Math.round((x / (this.halfSize * 2) + 0.5) * (this.rows - 1))
            const indexZ = Math.round((z / (this.halfSize * 2) + 0.5) * (this.rows - 1))
            const index = indexZ + indexX * this.rows

            if(index >= 0 && index < this.heights.length)
                this.heights[index] = y
        }
    }

    isDrawableImage(image)
    {
        if(!image)
            return false

        return image instanceof HTMLImageElement
            || image instanceof HTMLCanvasElement
            || image instanceof HTMLVideoElement
            || image instanceof ImageBitmap
            || (typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas)
            || (typeof SVGImageElement !== 'undefined' && image instanceof SVGImageElement)
            || (typeof VideoFrame !== 'undefined' && image instanceof VideoFrame)
    }

    getTerrainMaskTexture()
    {
        const maskTexture = this.game.resources.terrainMaskTexture

        if(this.isDrawableImage(maskTexture?.image))
            return maskTexture

        const terrainTexture = this.game.resources.terrainTexture

        if(this.isDrawableImage(terrainTexture?.image))
            return terrainTexture

        return null
    }

    setTerrainMaskFromTexture()
    {
        const texture = this.getTerrainMaskTexture()
        const image = texture?.image

        if(!image?.width || !image?.height)
            return

        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height

        const context = canvas.getContext('2d', { willReadFrequently: true })

        if(!context)
            return

        context.drawImage(image, 0, 0)

        this.terrainMask = context.getImageData(0, 0, canvas.width, canvas.height).data
        this.terrainMaskWidth = canvas.width
        this.terrainMaskHeight = canvas.height
    }

    worldToTerrainUv(x, z)
    {
        return {
            u: x / this.subdivision / 1.5 + 0.5,
            v: z / this.subdivision / 1.5 + 0.5,
        }
    }

    sampleTerrain(x, z)
    {
        if(!this.terrainMask)
            return null

        const { u, v } = this.worldToTerrainUv(x, z)

        if(u < 0 || u > 1 || v < 0 || v > 1)
            return null

        const px = Math.min(this.terrainMaskWidth - 1, Math.max(0, Math.floor(u * this.terrainMaskWidth)))
        const py = Math.min(this.terrainMaskHeight - 1, Math.max(0, Math.floor((1 - v) * this.terrainMaskHeight)))
        const index = (py * this.terrainMaskWidth + px) * 4

        return {
            grass: this.terrainMask[index + 1] / 255,
            elevation: this.terrainMask[index + 2] / 255,
        }
    }

    getHeightAt(x, z)
    {
        if(!this.heights)
            return 0

        const u = (x / (this.halfSize * 2) + 0.5) * (this.rows - 1)
        const v = (z / (this.halfSize * 2) + 0.5) * (this.rows - 1)

        const x0 = Math.floor(u)
        const z0 = Math.floor(v)
        const x1 = Math.min(x0 + 1, this.rows - 1)
        const z1 = Math.min(z0 + 1, this.rows - 1)
        const tx = u - x0
        const tz = v - z0

        const h00 = this.heights[z0 + x0 * this.rows] ?? 0
        const h10 = this.heights[z0 + x1 * this.rows] ?? 0
        const h01 = this.heights[z1 + x0 * this.rows] ?? 0
        const h11 = this.heights[z1 + x1 * this.rows] ?? 0

        const h0 = h00 * (1 - tx) + h10 * tx
        const h1 = h01 * (1 - tx) + h11 * tx

        return h0 * (1 - tz) + h1 * tz
    }

    isWalkable(x, z)
    {
        const maxX = this.halfSize - 8
        const maxZ = this.halfSize - 8

        if(Math.abs(x) > maxX || Math.abs(z) > maxZ)
            return false

        const minLand = this.game.water.depthElevation + 0.35

        if(this.getHeightAt(x, z) <= minLand)
            return false

        const terrain = this.sampleTerrain(x, z)

        if(!terrain)
            return true

        return terrain.grass > 0.28 && terrain.elevation < 0.55
    }
}
