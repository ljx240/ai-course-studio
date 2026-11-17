import { useState } from 'react'
import { Button } from '../../../packages/design-system/ui'
import type { Block, Lesson } from '../../../packages/lesson-schema'
import { configureScene } from '../../../packages/subject-sdk'
import { middlePhysics, type MiddlePhysicsEngine } from '../../../packages/subject-sdk/middle-physics'
import type { Scene } from '../../../packages/subject-sdk/scene'
import { PhysicsExperiment } from '../../../packages/lesson-renderer/middle-physics'
import { physicsActivity } from './physics-lesson-activities'

type Sample = { parameters: ReturnType<typeof configureScene>; metrics: Record<string, string> }

export function PhysicsDemonstration({ reference, block, engine, scene }: {
  reference: Lesson; block: Block; engine: MiddlePhysicsEngine; scene: Scene
}) {
  const [prediction, setPrediction] = useState<number>()
  const [samples, setSamples] = useState<Partial<Record<0 | 1, Sample>>>({})
  const original = reference.blocks.find((item) => item.id === block.id && item.engine === engine)
  const activity = original && physicsActivity(reference.number, engine)
  const references = ([0, 1] as const).flatMap((trial) => {
    const sample = samples[trial]
    return sample ? [{ label: trial === 0 ? 'A' as const : 'B' as const, parameters: sample.parameters }] : []
  })

  return <div className={activity ? 'physics-demonstration' : undefined} data-engine={engine}>
    <section className="presentation-apparatus" aria-label={block.title}>
      <h2>{block.title}</h2>
      <p>{activity?.gesture ?? block.body}</p>
      <PhysicsExperiment engine={engine} title={block.title} scene={scene} presentation references={references} />
    </section>
    {activity && original && <section className="prediction" aria-label="预测与对照">
      <fieldset>
        <legend>{activity.question}</legend>
        {activity.choices.map((choice, index) => <label key={choice} className={prediction === index ? 'selected' : undefined}>
          <input type="radio" name="experiment-prediction" checked={prediction === index}
            onChange={() => setPrediction(index)} />{choice}
        </label>)}
      </fieldset>
      <div className="trial-controls" aria-label="两组实验条件">
        {activity.trials.map(([label, values], index) => {
          const trial = index as 0 | 1
          const group = trial === 0 ? 'A' : 'B'
          return <Button key={group} data-group={group} onClick={() => {
            const parameters = { ...configureScene(original), ...values }
            scene.setParameters(parameters)
            const sample = { parameters, metrics: middlePhysics[engine](parameters).metrics }
            setSamples((previous) => ({ ...previous, [trial]: sample }))
          }}><span>{`加载 ${group} 组`}</span><small>{label}</small></Button>
        })}
      </div>
      {(samples[0] || samples[1]) && <table className="trial-results" aria-label="实验对照读数">
        <thead><tr><th scope="col">A/B 记录</th>
          <th scope="col" data-group="A">A 组</th><th scope="col" data-group="B">B 组</th></tr></thead>
        <tbody>{activity.readouts.map((label) => <tr key={label}>
          <th scope="row">{label}</th>
          <td>{samples[0]?.metrics[label] ?? '待加载'}</td>
          <td>{samples[1]?.metrics[label] ?? '待加载'}</td>
        </tr>)}</tbody>
      </table>}
      {samples[0] && samples[1] && <div className="trial-feedback" role="status">
        <strong>{prediction === undefined ? '实验结论' : prediction === activity.correct ? '读数支持你的预测' : '用读数修正预测'}</strong>
        <p>{activity.explanation}</p>
      </div>}
    </section>}
  </div>
}
