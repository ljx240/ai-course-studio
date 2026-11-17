import sceneSpecs from '../../content/schemas/scenes.json'
import type { Block, Engine } from '../lesson-schema'
import { legacy } from './legacy'

export interface Parameter {
  name: string
  unit: string
  min: number
  max: number
  step: number
  initial: number
}

export type Parameters = Record<string, number>

export interface SubjectEngine {
  id: Engine
  template: string
  playback?: boolean
  parameters: Record<string, Parameter>
}

export const physics = {
  id: 'physics.projectile2d',
  ...sceneSpecs['physics.projectile2d'],
  calculate: ({ speed, height, gravity }: Parameters) => legacy.engines.physics.calc(speed, height, gravity),
} satisfies SubjectEngine & { calculate(parameters: Parameters): unknown }

export const math = {
  id: 'math.quadratic',
  ...sceneSpecs['math.quadratic'],
  calculate: ({ a, b, c }: Parameters) => legacy.engines.math.calc(a, b, c),
} satisfies SubjectEngine & { calculate(parameters: Parameters): unknown }

export const engines = Object.fromEntries(Object.entries(sceneSpecs).map(([id, spec]) => [
  id, { id, ...spec },
])) as Record<Engine, SubjectEngine>

export function configureScene(block: Block): Parameters {
  const engine = engines[block.engine!]
  if (block.template && block.template !== engine.template) throw new Error('互动模板未在引擎注册')
  for (const name of Object.keys(block.params ?? {})) {
    if (!Object.hasOwn(engine.parameters, name)) throw new Error('互动参数未在模板注册')
  }
  return Object.fromEntries(Object.entries(engine.parameters).map(([key, field]) => {
    const value = block.params?.[key] ?? field.initial
    if (!Number.isFinite(value) || value < field.min || value > field.max) {
      throw new Error(`${field.name}须介于 ${field.min} 与 ${field.max} ${field.unit}之间`)
    }
    return [key, value]
  }))
}
