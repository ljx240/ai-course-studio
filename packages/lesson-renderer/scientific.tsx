import { useSyncExternalStore } from 'react'
import type { Engine } from '../lesson-schema'
import { engines, physics, type Parameters } from '../subject-sdk'
import { harmonic, oblique, rightTriangle, tangent } from '../subject-sdk/models'
import { isMiddlePhysicsEngine, middlePhysics } from '../subject-sdk/middle-physics'
import type { Scene } from '../subject-sdk/scene'
import { Sliders } from './controls'

const fmt = (value: number) => value.toFixed(2)
type NumericEngine = 'math.pythagorean' | 'math.tangent'

export function measurements(engine: Engine, parameters: Parameters): Record<string, string> {
  if (isMiddlePhysicsEngine(engine)) return middlePhysics[engine](parameters).metrics
  if (engine === 'physics.harmonic') {
    const result = harmonic(parameters)
    return { '振幅': `${fmt(parameters.amplitude)} m`, '周期': `${fmt(result.period)} s` }
  }
  if (engine === 'physics.oblique') {
    const result = oblique(parameters)
    return { '飞行时间': `${fmt(result.duration)} s`, '射程': `${fmt(result.range)} m`, '最高点': `${fmt(result.apex)} m` }
  }
  const result = physics.calculate(parameters)
  return { '飞行时间': `${fmt(result.flight)} s`, '射程': `${fmt(result.range)} m`, '落地速度': `${fmt(result.impact)} m/s` }
}

function Geometry({ engine, scene, parameters }: { engine: NumericEngine; scene: Scene; parameters: Parameters }) {
  if (engine === 'math.pythagorean') {
    const { a, b } = parameters
    const result = rightTriangle(a, b)
    const scale = 12
    const x = a * scale
    const y = b * scale
    const area = (value: number) => `${fmt(value)} cm²`
    return <>
      <svg className="math-stage" viewBox="-160 -215 400 332" aria-label="直角三角形三边上构造的三个正方形">
        <polygon points={`0,0 ${x},0 ${x},${x} 0,${x}`} className="geometry-a" />
        <polygon points={`0,0 0,${-y} ${-y},${-y} ${-y},0`} className="geometry-b" />
        <polygon points={`${x},0 0,${-y} ${y},${-y - x} ${x + y},${-x}`} className="geometry-c" />
        <path d={`M0 0H${x}L0 ${-y}Z M0 -8H8V0`} className="graph-axis" />
        <text x={x / 2} y={x / 2 + 4} textAnchor="middle">a²</text>
        <text x={-y / 2} y={-y / 2 + 4} textAnchor="middle">b²</text>
        <text x={(x + y) / 2} y={(-y - x) / 2 + 4} textAnchor="middle">c²</text>
      </svg>
      <p className="formula">{area(result.areaA)} + {area(result.areaB)} = {area(result.areaC)}，斜边 {fmt(result.side)} cm</p>
    </>
  }
  const { radius, angle } = parameters
  const point = tangent(radius, angle)
  const x = point.x * 21
  const y = -point.y * 21
  const tx = point.dx * 72
  const ty = -point.dy * 72
  return <>
    <svg className="math-stage" viewBox="-190 -145 380 290" aria-label="圆的切线垂直于切点处的半径"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        const rect = event.currentTarget.getBoundingClientRect()
        const angle = Math.round(Math.atan2(rect.top + rect.height / 2 - event.clientY,
          event.clientX - rect.left - rect.width / 2) * 180 / Math.PI)
        scene.setParameters({ angle: (angle + 360) % 360 })
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        const rect = event.currentTarget.getBoundingClientRect()
        const angle = Math.round(Math.atan2(rect.top + rect.height / 2 - event.clientY,
          event.clientX - rect.left - rect.width / 2) * 180 / Math.PI)
        scene.setParameters({ angle: (angle + 360) % 360 })
      }}>
      <path d="M-180 0H180M0 -135V135" className="graph-axis" />
      <circle r={radius * 21} className="geometry-circle" />
      <path d={`M0 0L${x} ${y}M${x - tx} ${y - ty}L${x + tx} ${y + ty}`} className="graph-curve" />
      <circle cx={x} cy={y} r="5" className="graph-point" />
      <text x={x + 8} y={y - 8}>P</text>
    </svg>
    <p className="formula">P = ({fmt(point.x)}, {fmt(point.y)}) cm。OP 与切线的夹角 90°</p>
  </>
}

export function NumericExperiment({ engine, scene, large }: { engine: NumericEngine; scene: Scene; large: boolean }) {
  const state = useSyncExternalStore(scene.subscribe, scene.getSnapshot)
  const caption = engine === 'math.pythagorean' ? '三边以厘米计，正方形面积以平方厘米计。'
    : '坐标以厘米计，角度从 x 轴正向逆时针测量。拖动可改变切点。'
  return <div className="numeric-experiment">
    <div className={large ? 'lab-content' : 'embed-grid'}>
      <Sliders engine={engines[engine]} scene={scene} state={state} />
      <Geometry engine={engine} scene={scene} parameters={state.parameters} />
    </div>
    <p className="muted">{caption}</p>
  </div>
}
