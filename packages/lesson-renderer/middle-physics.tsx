import { lazy, Suspense, useSyncExternalStore } from 'react'
import { Button } from '../design-system/ui'
import { engines } from '../subject-sdk'
import type { Scene } from '../subject-sdk/scene'
import { isMiddlePhysicsEngine, middlePhysics, middlePhysicsChoices } from '../subject-sdk/middle-physics'
import { Playback, Sliders } from './controls'
import { measurements } from './scientific'
import { physicsCaptions } from './physics-captions'
import type { BenchEngine, EvidenceSample, MotionEngine } from './physics-bench'

const BuoyancyStage = lazy(() => import('./buoyancy-stage'))
const PhysicsStage = lazy(() => import('./physics-stage'))
const buoyancyCaption = '物块高 8 cm，截面积 25 cm²，重 5 N。以液面为零点，深度向下。按各位置静力平衡计算，取 g＝10 N/kg，忽略空气浮力和流体阻力。'

export function isMotionEngine(engine: string): engine is MotionEngine {
  return engine === 'physics.projectile2d' || engine === 'physics.oblique' || engine === 'physics.harmonic'
}

export function PhysicsExperiment({ engine, title, prompt, scene, onRecord, presentation = false, references }: {
  engine: BenchEngine | 'physics.buoyancy'; title: string; prompt?: string | null; scene: Scene
  onRecord?: () => void; presentation?: boolean; references?: EvidenceSample[]
}) {
  const state = useSyncExternalStore(scene.subscribe, scene.getSnapshot)
  const { parameters, time } = state
  const buoyancy = engine === 'physics.buoyancy' ? middlePhysics[engine](parameters) : undefined
  const metrics = buoyancy?.metrics ?? measurements(engine, parameters)
  const playback = isMotionEngine(engine)
  const choices = isMiddlePhysicsEngine(engine) ? middlePhysicsChoices[engine] : undefined
  const controls = <Sliders engine={engines[engine]} choices={choices} scene={scene} state={state} />
  const showCurrent = presentation || playback
  const readouts = <dl className="physics-readouts" aria-label={showCurrent ? '当前读数' : '模型读数'}>
    {playback && <div><dt>运动时间</dt><dd data-scene-time>{time.toFixed(2)} s</dd></div>}
    {Object.entries(metrics).map(([label, value]) => <div key={label}>
      <dt>{label}</dt><dd data-flight={label === '飞行时间' ? true : undefined} data-range={label === '射程' ? true : undefined}>{value}</dd>
    </div>)}
  </dl>

  return <div className="physics-model">
    {prompt && !presentation && <p className="physics-prompt">{prompt}</p>}
    <figure>
      <Suspense fallback={<p className="buoyancy-loading" role="status">正在加载三维实验台</p>}>
        {engine === 'physics.buoyancy'
          ? <BuoyancyStage depth={parameters.depth} reading={buoyancy!} scene={scene}
              marks={references?.map(({ label, parameters }) => ({ label, depth: parameters.depth })) ?? []} />
          : <PhysicsStage key={engine} engine={engine} title={title} scene={scene} parameters={parameters} time={time} references={references} />}
      </Suspense>
      <figcaption>{engine === 'physics.buoyancy' ? buoyancyCaption : physicsCaptions[engine]}</figcaption>
    </figure>
    {showCurrent ? <div className="physics-live-readouts"><h3>当前读数</h3>{readouts}</div> : readouts}
    {playback && <Playback scene={scene} state={state} duration={scene.duration()} />}
    {presentation ? <details className="physics-settings"><summary>精确调参</summary>{controls}</details> : controls}
    <div className="actions">
      <Button icon="reset" onClick={scene.reset}>恢复初始值</Button>
      {onRecord && <Button icon="note" onClick={onRecord}>记录实验</Button>}
    </div>
  </div>
}
