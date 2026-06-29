import { Game } from './Game.js'

export class Portfolio
{
    constructor()
    {
        this.game = Game.getInstance()
        this.element = this.game.menu.items.get('portfolio').contentElement

        this.setTeleports()
        this.setMapButton()
    }

    setTeleports()
    {
        const buttons = this.element.querySelectorAll('[data-respawn]')

        for(const button of buttons)
        {
            button.addEventListener('click', () =>
            {
                this.go(button.dataset.respawn)
            })
        }
    }

    setMapButton()
    {
        const button = this.element.querySelector('.js-portfolio-map')

        if(!button)
            return

        button.addEventListener('click', () =>
        {
            this.game.menu.close()
            this.game.modals.open('map')
        })
    }

    go(respawnName)
    {
        this.game.menu.close()
        this.game.player.respawn(respawnName, () =>
        {
            this.game.view.focusPoint.isTracking = true
        })
    }
}
