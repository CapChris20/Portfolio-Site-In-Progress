import careerData from '../data/career.js'
import { Game } from './Game.js'

export class CareerModal
{
    constructor()
    {
        this.game = Game.getInstance()

        const element = document.querySelector('.js-modal[data-name="career"]')

        this.title = element.querySelector('.js-career-title')
        this.period = element.querySelector('.js-career-period')
        this.summary = element.querySelector('.js-career-summary')
        this.details = element.querySelector('.js-career-details')
        this.highlights = element.querySelector('.js-career-highlights')
        this.projects = element.querySelector('.js-career-projects')
        this.projectsList = element.querySelector('.js-career-projects-list')
    }

    open(id)
    {
        const entry = careerData.find((item) => item.id === id)

        if(!entry)
            return

        this.populate(entry)
        this.game.modals.open('career')
    }

    populate(entry)
    {
        this.title.textContent = entry.title
        this.period.textContent = entry.period
        this.summary.textContent = entry.summary

        this.details.innerHTML = entry.details.map((paragraph) => `<p>${paragraph}</p>`).join('')

        this.highlights.innerHTML = entry.highlights
            .map((highlight) => `<li>${highlight}</li>`)
            .join('')

        if(entry.projects.length)
        {
            this.projects.classList.add('is-visible')
            this.projectsList.innerHTML = entry.projects.map((project) =>
            {
                if(project.url)
                    return `<li><a href="${project.url}" target="_blank" rel="noreferrer">${project.name}</a></li>`

                return `<li>${project.name}</li>`
            }).join('')
        }
        else
        {
            this.projects.classList.remove('is-visible')
            this.projectsList.innerHTML = ''
        }
    }
}
