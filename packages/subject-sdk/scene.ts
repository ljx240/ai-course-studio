import { configureScene, physics, type Parameters } from './index'
import type { Block } from '../lesson-schema'
import { harmonic, oblique } from './models'

export function createScene(block: Block) {
  const initial = configureScene(block)
  let state = { parameters: initial, time: 0, playing: false, interaction: {} as Record<string, string | number> }
  let frame = 0
  const listeners = new Set<() => void>()

  function update(patch: Partial<typeof state>) {
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener())
  }

  function pause() {
    cancelAnimationFrame(frame)
    update({ playing: false })
  }

  function seek(time: number) {
    pause()
    update({ time })
  }

  function duration() {
    switch (block.engine) {
      case 'physics.harmonic': return harmonic(state.parameters).duration
      case 'physics.oblique': return oblique(state.parameters).duration
      case 'physics.projectile2d': return physics.calculate(state.parameters).flight
      default: return 0
    }
  }

  function play() {
    if (state.playing) return
    const end = duration()
    if (end <= 0) return
    const time = state.time < end ? state.time : 0
    const start = performance.now() - time * 1000
    update({ time, playing: true })
    function tick(now: number) {
      const elapsed = Math.min(end, (now - start) / 1000)
      update({ time: elapsed, playing: elapsed < end })
      if (elapsed < end) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    setParameters(parameters: Parameters) {
      pause()
      update({ parameters: { ...state.parameters, ...parameters }, time: 0 })
    },
    setInteraction(name: string, value: string | number) {
      update({ interaction: { ...state.interaction, [name]: value } })
    },
    reset() {
      cancelAnimationFrame(frame)
      update({ parameters: initial, time: 0, playing: false, interaction: {} })
    },
    pause, play, seek, duration,
  }
}

export type Scene = ReturnType<typeof createScene>
