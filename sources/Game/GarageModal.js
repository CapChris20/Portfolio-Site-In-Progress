import { Game } from './Game.js'
import { VEHICLE_DEFINITIONS, VEHICLE_ORDER } from './VehicleGarage.js'

export class GarageModal
{
    constructor()
    {
        this.game = Game.getInstance()

        const element = document.querySelector('.js-modal[data-name="garage"]')

        this.element = element
        this.choicesElement = element.querySelector('.js-garage-choices')
        this.cancelButton = element.querySelector('.js-garage-cancel')

        this.cancelButton.addEventListener('click', () =>
        {
            this.game.modals.close()
        })

        this.game.modals.items.get('garage').events.on('open', () =>
        {
            this.render()
        })
    }

    open()
    {
        this.game.inputs.interactiveButtons.clearItems()
        this.game.modals.open('garage')
    }

    render()
    {
        const garage = this.game.vehicleGarage
        const activeId = garage.activeId

        this.choicesElement.innerHTML = ''

        for(const id of VEHICLE_ORDER)
        {
            const definition = VEHICLE_DEFINITIONS[id]
            const resource = this.game.resources[definition.resourceKey]
            const isActive = id === activeId
            const isMissing = !resource?.scene

            const button = document.createElement('button')
            button.type = 'button'
            button.className = 'button garage-choice'

            if(isActive)
            {
                button.classList.add('is-disabled')
                button.textContent = `${definition.label} (current)`
            }
            else if(isMissing)
            {
                button.classList.add('is-disabled')
                button.textContent = `${definition.label} (unavailable)`
            }
            else
            {
                button.textContent = `Swap to ${definition.label}`
                button.addEventListener('click', () =>
                {
                    if(garage.select(id))
                        this.game.modals.close()
                })
            }

            this.choicesElement.append(button)
        }
    }
}
