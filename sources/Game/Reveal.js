import * as THREE from 'three/webgpu'
import { color, uniform, vec2 } from 'three/tsl'
import { Game } from './Game.js'
import gsap from 'gsap'
import { RecruiterGuide } from './RecruiterGuide.js'

export class Reveal
{
    constructor()
    {
        this.game = Game.getInstance()
        
        this.step = -1
        this.skipPortal = true
        const respawn = this.game.respawns.getDefault()
        this.position = respawn.position.clone()
        this.position2Uniform = uniform(vec2(this.position.x, this.position.z))
        this.distance = uniform(99999)
        this.thickness = uniform(0.05)
        this.color = uniform(color('#e88eff'))
        this.intensity = uniform(5.5)
        this.intensityMultiplier = 1
        this.sound = this.game.audio.register({
            path: 'sounds/reveal/reveal-1.mp3',
            autoplay: false,
            loop: false,
            volume: 0.5,
            preload: true
        })

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '📜 Reveal',
                expanded: false,
            })

            this.debugPanel.addBinding(this.distance, 'value', { label: 'distance', min: 0, max: 20, step: 0.01 })
            this.debugPanel.addBinding(this.thickness, 'value', { label: 'thickness', min: 0, max: 1, step: 0.001 })
            // this.game.debug.addThreeColorBinding(this.debugPanel, this.color.value, 'color')
            this.debugPanel.addBinding(this.intensity, 'value', { label: 'intensity', min: 1, max: 20, step: 0.001 })
        }

        this.update = this.update.bind(this)
        this.game.ticker.events.on('tick', this.update, 10)

        this.heroLoader = document.querySelector('.js-hero-loader')
        document.documentElement.classList.add('has-hero')
    }

    updateStep(step)
    {
        const speedMultiplier = location.hash.match(/skip/i) ? 4 : 1

        // Step 0
        if(step === 0)
        {
            let started = false
            let intersect = null

            const cleanupStart = () =>
            {
                this.game.inputs.events.off('introStart', onIntroStart)
                this.game.canvasElement.removeEventListener('pointerdown', onCanvasPointer)

                if(intersect)
                    this.game.rayCursor.removeIntersect(intersect)
            }

            const start = () =>
            {
                if(started || this.step >= 1)
                    return

                started = true
                cleanupStart()
                this.updateStep(1)
            }

            const onIntroStart = () =>
            {
                start()
            }

            const onCanvasPointer = () =>
            {
                start()
            }

            if(location.hash.match(/skip/i))
            {
                start()
                return
            }

            // Register start immediately — don't wait for the loading ring animation
            this.game.inputs.addActions([
                { name: 'introStart', categories: [ 'intro' ], keys: [ 'Gamepad.cross', 'Keyboard.Enter', 'Keyboard.ArrowUp', 'Keyboard.ArrowDown', 'Keyboard.KeyW', 'Keyboard.KeyD', 'Keyboard.Space' ] },
            ])
            this.game.inputs.events.on('introStart', onIntroStart)
            this.game.canvasElement.addEventListener('pointerdown', onCanvasPointer)

            const position = this.position.clone()
            position.y = 0

            intersect = this.game.rayCursor.addIntersect({
                active: true,
                shape: new THREE.Sphere(position, 6),
                onClick: start,
                onEnter: () =>
                {
                    gsap.to(this, { intensityMultiplier: 1.22, duration: 0.2, overwrite: true })
                },
                onLeave: () =>
                {
                    gsap.to(this, { intensityMultiplier: 1, duration: 0.2, overwrite: true })
                },
            })

            // Intro loader => Hide circle
            this.game.world.intro.circle.hide(() =>
            {
                // Grid
                this.game.world.grid.show()

                // Reveal
                this.distance.value = 0

                gsap.to(
                    this.distance,
                    {
                        value: 3.5,
                        ease: 'back.out(1.7)',
                        duration: 2 / speedMultiplier,
                        overwrite: true,
                    }
                )

                // View
                this.game.view.zoom.smoothedRatio = 0.6
                this.game.view.zoom.baseRatio = 0.6

                gsap.to(
                    this.game.view.zoom,
                    {
                        baseRatio: 0.3,
                        ease: 'power1.inOut',
                        duration: 1.25 / speedMultiplier,
                        overwrite: true,
                    }
                )

                // Intro loader => Show label and sound button
                this.game.world.intro.setText()
                this.game.world.intro.setSoundButton()
                this.game.ticker.wait(1, () =>
                {
                    this.game.world.intro.showLabel()
                })

                // Cherry trees
                if(this.game.world.palmTrees)
                    this.game.world.palmTrees.leaves.seeThroughMultiplier = 0.5
            })
        }
        else if(step === 1)
        {
            // Audio
            this.game.audio.init()
            this.sound.play()

            // Reveal — open fully so the world isn't stuck behind the fog mask
            this.distance.value = 99999

            // Intro loader => Hide label
            this.game.world.intro.hideLabel()

            // Inputs
            this.game.inputs.filters.clear()
            this.game.inputs.filters.add('wandering')

            // View
            this.game.view.focusPoint.isTracking = true
            this.game.view.focusPoint.magnet.active = false

            // View
            gsap.to(
                this.game.view.zoom,
                {
                    baseRatio: 0,
                    // smoothedRatio: 0,
                    ease: 'back.in(1.5)',
                    duration: 1.75 / speedMultiplier,
                    overwrite: true,
                    onComplete: () =>
                    {
                        this.updateStep(2)
                    }
                }
            )

            // Cherry trees
            if(this.game.world.palmTrees)
            {
                gsap.to(
                    this.game.world.palmTrees.leaves,
                    {
                        seeThroughMultiplier: 1,
                        ease: 'power1.inOut',
                        duration: 2 / speedMultiplier,
                        overwrite: true
                    }
                )
            }
        }
        else if(step === 2)
        {
            this.distance.value = 99999

            this.game.interactivePoints.recover()
            
            this.game.world.step(2)
            this.game.world.grid?.destroy()
            this.game.world.intro?.destroy()
            this.game.world.intro = null

            this.game.overlay.moveOnTop()
            this.game.overlay.progress.value = 0
            this.game.overlay.mesh.visible = false

            this.game.notifications.clearAll()
            this.game.server.start()

            RecruiterGuide.show()

            this.game.ticker.events.off('tick', this.update)
        }

        this.step = step
    }

    beginGameplay()
    {
        if(this.step >= 2)
            return

        try
        {
            this.startGameplay()
        }
        catch(error)
        {
            console.error('Reveal.beginGameplay failed', error)
            this.distance.value = 99999
            this.game.inputs.filters.clear()
            this.game.inputs.filters.add('wandering')
        }
    }

    setHeroLoadProgress(progress)
    {
        const loader = this.heroLoader

        if(!loader)
            return

        loader.textContent = progress >= 1 ? 'Ready' : `Loading world… ${Math.round(progress * 100)}%`
    }

    waitForHeroStart()
    {
        this.heroElement = document.querySelector('.js-hero')
        this.heroLoader = document.querySelector('.js-hero-loader')
        this.heroStart = document.querySelector('.js-hero-start')

        if(!this.heroElement)
        {
            this.beginGameplay()
            return
        }

        document.documentElement.classList.add('has-hero')
        this.heroLoader?.classList.remove('is-hidden')
        this.heroStart?.classList.remove('is-visible')

        let started = false

        const cleanup = () =>
        {
            this.game.inputs.events.off('heroStart', onHeroStart)
            this.heroElement?.removeEventListener('pointerdown', onPointer)
            this.heroStart?.removeEventListener('click', onPointer)
        }

        const start = () =>
        {
            if(started || this.step >= 2)
                return

            started = true
            cleanup()

            this.heroElement.classList.add('is-leaving')
            document.documentElement.classList.remove('has-hero')

            window.setTimeout(() =>
            {
                this.heroElement.remove()
                this.beginGameplay()
            }, 550)
        }

        const onHeroStart = (action) =>
        {
            if(action.active)
                start()
        }

        const onPointer = (event) =>
        {
            if(event.type === 'click')
                event.preventDefault()

            start()
        }

        if(location.hash.match(/skip/i))
        {
            start()
            return
        }

        this.game.inputs.addActions([
            {
                name: 'heroStart',
                categories: [ 'intro' ],
                keys: [
                    'Gamepad.cross',
                    'Gamepad.a',
                    'Keyboard.Enter',
                    'Keyboard.Space',
                    'Keyboard.ArrowUp',
                    'Keyboard.KeyW',
                ],
            },
        ])
        this.game.inputs.events.on('heroStart', onHeroStart)
        this.heroElement.addEventListener('pointerdown', onPointer)
        this.heroStart?.addEventListener('click', onPointer)

        this.heroLoader?.classList.remove('is-hidden')
        this.heroStart?.classList.add('is-visible')
    }

    startGameplay()
    {
        this.distance.value = 99999
        this.game.audio.init()

        const intro = this.game.world.intro

        if(intro?.circle?.mesh)
        {
            intro.circle.mesh.removeFromParent()

            if(intro.circle.mesh.geometry)
                intro.circle.mesh.geometry.dispose()

            if(intro.circle.mesh.material)
                intro.circle.mesh.material.dispose()
        }

        if(intro?.label)
            intro.label.visible = false

        this.game.inputs.filters.clear()
        this.game.inputs.filters.add('wandering')

        this.game.view.focusPoint.isTracking = true
        this.game.view.focusPoint.magnet.active = false
        this.game.view.zoom.baseRatio = 0
        this.game.view.zoom.smoothedRatio = 0

        if(this.game.world.palmTrees)
            this.game.world.palmTrees.leaves.seeThroughMultiplier = 1

        this.updateStep(2)
    }

    update()
    {
        this.color.value.copy(this.game.dayCycles.properties.revealColor.value)
        this.intensity.value = this.game.dayCycles.properties.revealIntensity.value * this.intensityMultiplier
    }
}