import { Events } from './Events.js'
import { Game } from './Game.js'

export class Quality
{
    constructor()
    {
        this.game = Game.getInstance()

        this.events = new Events()

        const envQuality = import.meta.env.VITE_QUALITY

        if(envQuality === 'low')
            this.level = 1
        else if(envQuality === 'high')
            this.level = 0
        else
            this.level = 1

        this.applyPerformanceSettings()

        this.events.on('change', () =>
        {
            this.applyPerformanceSettings()
        })

        // Debug
        if(this.game.debug.active)
        {
            const debugPanel = this.game.debug.panel.addFolder({
                title: '⚙️ Quality',
                expanded: false,
            })

            this.game.debug.addButtons(
                debugPanel,
                {
                    low: () =>
                    {
                        this.changeLevel(1)
                    },
                    high: () =>
                    {
                        this.changeLevel(0)
                    },
                },
                'change'
            )
        }
    }

    applyPerformanceSettings()
    {
        const high = this.level === 0

        if(this.game.viewport)
        {
            this.game.viewport.setPixelRatioMax(high ? 1.25 : 0.9)

            if(this.game.rendering?.renderer)
                this.game.rendering.resize()
        }

        if(this.game.lighting)
            this.game.lighting.setShadowQuality(high)

        if(this.game.rendering?.renderer)
            this.game.rendering.renderer.shadowMap.enabled = high

        if(this.game.lighting?.light)
            this.game.lighting.light.castShadow = high
    }

    changeLevel(level = 0)
    {
        // Same
        if(level === this.level)
            return
            
        this.level = level
        this.events.trigger('change', [ this.level ])
    }
}