import { Game } from './Game.js'

export class RecruiterGuide
{
    static show()
    {
        const game = Game.getInstance()

        if(localStorage.getItem('recruiterGuideSeen'))
            return

        game.ticker.wait(2, () =>
        {
            const html = /* html */`
                <div class="top">
                    <div class="title">New here?</div>
                </div>
                <div class="bottom">
                    <div class="description">Press <strong>M</strong> for the map, or open the menu → <strong>Portfolio</strong> to jump to skills, projects, and career.</div>
                    <div class="open-icon"></div>
                </div>
            `

            game.notifications.show(
                html,
                'recruiter-guide',
                14,
                () =>
                {
                    game.inputs.interactiveButtons.clearItems()
                    game.menu.open('portfolio')
                },
                'recruiter-guide'
            )

            localStorage.setItem('recruiterGuideSeen', '1')
        })
    }
}
