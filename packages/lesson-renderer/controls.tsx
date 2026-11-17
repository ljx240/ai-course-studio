import { Button } from '../design-system/ui'
import { physics, type SubjectEngine } from '../subject-sdk'
import type { Scene } from '../subject-sdk/scene'
import type { ParameterChoices } from '../subject-sdk/middle-physics'

const fmt = (n: number) => n.toFixed(2)
type PhysicsState = ReturnType<Scene['getSnapshot']>

export function Sliders({ engine, scene, state, choices }: {
  engine: SubjectEngine; scene: Scene; state: PhysicsState; choices?: ParameterChoices
}) {
  return <div className="parameters">
    {Object.entries(engine.parameters).map(([key, field]) => choices?.[key] ? <div className="parameter-choice"
      key={key} role="group" aria-label={field.name}>
      <span>{field.name}</span>
      <div className="actions">{choices[key].map((label, value) => <Button key={label} kind="quiet"
        aria-pressed={Number(state.parameters[key] >= 0.5) === value}
        onClick={() => scene.setParameters({ [key]: value })}>{label}</Button>)}</div>
    </div> : <label key={key}>
      <span>{field.name}<output>{fmt(state.parameters[key])} {field.unit}</output></span>
      <input type="range" min={field.min} max={field.max} step={field.step} value={state.parameters[key]}
        aria-label={field.name} data-parameter={key}
        onChange={(event) => scene.setParameters({ [key]: event.currentTarget.valueAsNumber })} />
    </label>)}
  </div>
}

export function Playback({ scene, state, duration = physics.calculate(state.parameters).flight }: {
  scene: Scene; state: PhysicsState; duration?: number
}) {
  return <div className="playback">
    <Button kind="primary" icon={state.playing ? 'pause' : 'play'} disabled={duration <= 0}
      onClick={state.playing ? scene.pause : scene.play}>{state.playing ? '暂停' : '开始实验'}</Button>
    <Button icon="reset" onClick={() => scene.seek(0)}>重置</Button>
    <label className="timeline">
      <span>{fmt(state.time)} s</span>
      <input aria-label="实验时间轴" type="range" min="0" max={duration} step="any" value={state.time} disabled={duration <= 0}
        onChange={(event) => scene.seek(event.currentTarget.valueAsNumber)} />
      <span>{fmt(duration)} s</span>
    </label>
  </div>
}

