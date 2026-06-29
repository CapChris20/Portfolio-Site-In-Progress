import { Events } from './Events.js'

export class Viewport
{
    constructor(domElement)
    {
        this.domElement = domElement

        this.events = new Events()

        this.pixelRatioMax = 2
        
        this.measure()
        this.setResize()
    }

    measure()
    {
        const bounding = this.domElement.getBoundingClientRect()

        this.width = bounding.width
        this.height = bounding.height
        this.ratio = this.width / this.height

        this.pixelRatioPure = window.devicePixelRatio
        this.updatePixelRatio()
    }

    setPixelRatioMax(max)
    {
        this.pixelRatioMax = max
        this.updatePixelRatio()
    }

    updatePixelRatio()
    {
        this.pixelRatio = Math.min(this.pixelRatioPure, this.pixelRatioMax)
    }

    setResize()
    {
        const throttleDuration = 400
        let throttleTimeout = null
        addEventListener('resize', () =>
        {
            this.measure()
            this.events.trigger('change')

            if(throttleTimeout)
            {
                clearTimeout(throttleTimeout)
            }

            throttleTimeout = setTimeout(() =>
            {
                throttleTimeout = null
                this.events.trigger('throttleChange')
            }, throttleDuration)
        })
    }
}