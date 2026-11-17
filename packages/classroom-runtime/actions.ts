import type { Block, Lesson } from '../lesson-schema'
import { engines } from '../subject-sdk'
import type { Scene } from '../subject-sdk/scene'

export const actionLabels = {
  setParameters: '调整实验参数',
  play: '播放实验',
  pause: '暂停实验',
  reset: '重置实验',
  seek: '定位实验时间',
  highlight: '定位教材块',
  showFormula: '查看公式',
  compareRuns: '查看实验对照',
  askQuestion: '查看思考题',
} as const

export interface ProposedAction {
  type: keyof typeof actionLabels
  scene_id?: string
  engine?: string
  block_id?: string
  time?: number
  parameters?: Record<string, number>
  question?: string
}

interface Context {
  lesson: Lesson
  experiment?: Block
  getScene(block: Block): Scene
  highlight(block: Block): void
  showFormula(block: Block): void
  show(title: string, text: string): void
  compare(block: Block): void
}

export function performAction(action: ProposedAction, context: Context) {
  if (!Object.hasOwn(actionLabels, action.type)) throw new Error('此课堂动作未注册')
  if (action.type === 'highlight' || action.type === 'showFormula') {
    const block = context.lesson.blocks.find((item) => item.id === action.block_id)
    if (!block) throw new Error('动作对应的教材块已变化')
    if (action.type === 'highlight') context.highlight(block)
    else if (block.formula) context.showFormula(block)
    else throw new Error('当前教材块没有公式')
    return
  }
  if (action.type === 'askQuestion') {
    if (typeof action.question !== 'string' || !action.question.trim()) throw new Error('思考题为空')
    context.show('思考题', action.question)
    return
  }

  const { experiment } = context
  if (!experiment?.engine || action.scene_id !== experiment.id || action.engine !== experiment.engine) {
    throw new Error('动作对应的实验已变化')
  }
  const scene = context.getScene(experiment)
  const playback = engines[experiment.engine].playback
  switch (action.type) {
    case 'setParameters': {
      const fields = engines[experiment.engine].parameters
      const parameters = action.parameters
      if (!parameters || !Object.keys(parameters).length || Object.entries(parameters).some(([name, value]) => {
        const field = Object.hasOwn(fields, name) ? fields[name] : undefined
        return !field || !Number.isFinite(value) || value < field.min || value > field.max
      })) throw new Error('动作的参数超出实验范围')
      scene.setParameters(parameters)
      return
    }
    case 'reset': scene.reset(); return
    case 'play': if (playback) { scene.play(); return }; break
    case 'pause': if (playback) { scene.pause(); return }; break
    case 'compareRuns': if (experiment.engine.startsWith('physics.')) { context.compare(experiment); return }; break
    case 'seek':
      if (playback && typeof action.time === 'number' && action.time >= 0 && action.time <= scene.duration()) {
        scene.seek(action.time)
        return
      }
      break
  }
  throw new Error('此动作超出当前实验的能力或范围')
}
