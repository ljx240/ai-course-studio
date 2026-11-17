import { useId, useState, useSyncExternalStore } from 'react'
import { Button } from '../design-system/ui'
import { engines, math, physics } from '../subject-sdk'
import type { Scene } from '../subject-sdk/scene'
import type { Block } from '../lesson-schema'
import { Sliders } from './controls'
import { NumericExperiment } from './scientific'
import { OtherExperiment, speakLocal } from './activities'
import { waterBondAngle, waterGeometry } from '../subject-sdk/models'
import { isMiddlePhysicsEngine } from '../subject-sdk/middle-physics'
import { isMotionEngine, PhysicsExperiment } from './middle-physics'

type PhysicsState = ReturnType<Scene['getSnapshot']>
const fmt = (n: number) => n.toFixed(2)

export function ProjectileStage({ state, snapshot = false }: { state: Pick<PhysicsState, 'parameters' | 'time'>; snapshot?: boolean }) {
  const { parameters, time } = state
  const { speed, height, gravity } = parameters
  const { flight, range } = physics.calculate(parameters)
  const arrow = useId()
  const width = 800
  const ground = 296
  const horizontal = Math.max(6.5, Math.ceil(range))
  const scaleX = 665 / horizontal
  const scaleY = 225 / Math.max(height + 0.4, 2.8)
  const origin = 72
  const top = ground - height * scaleY
  const x = (t: number) => origin + speed * t * scaleX
  const y = (t: number) => top + 0.5 * gravity * t ** 2 * scaleY
  const vx = speed * scaleX
  const vy = gravity * time * scaleY
  const vectorScale = 46 / Math.hypot(vx, vy)
  const curve = Array.from({ length: 41 }, (_, index) => {
    const t = flight * index / 40
    return `${index === 0 ? 'M' : 'L'}${fmt(x(t))} ${fmt(y(t))}`
  }).join(' ')
  const ticks = Array.from({ length: Math.floor(horizontal) + 1 }, (_, index) => index)
  return <div className={`projectile-stage ${snapshot ? 'snapshot' : ''}`}>
    <svg viewBox={`0 0 ${width} 350`} aria-label="平抛运动轨迹，横轴水平位移，纵轴距地面高度">
      <defs><marker id={arrow} viewBox="0 0 6 6" refX="5" refY="3" markerWidth="3" markerHeight="3" orient="auto">
        <path d="M0 0L6 3L0 6Z" className="velocity-tip" />
      </marker></defs>
      <rect x="20" y={top} width="62" height={ground - top} className="platform-leg" />
      <rect x="8" y={top} width="84" height="9" rx="1" className="platform-top" />
      <path d={`M${origin} 47V${ground}H773`} className="scene-axis" />
      {ticks.map((tick) => <g key={tick}>
        <path d={`M${origin + tick * scaleX} ${ground}v6`} className="scene-axis" />
        <text x={origin + tick * scaleX} y={318} textAnchor="middle">{tick}</text>
      </g>)}
      {[1, 2, 3].filter((tick) => ground - tick * scaleY > 50).map((tick) => <g key={tick}>
        <path d={`M${origin - 6} ${ground - tick * scaleY}h6`} className="scene-axis" />
        <text x={origin - 12} y={ground - tick * scaleY + 4} textAnchor="end">{tick}</text>
      </g>)}
      <text x="40" y="42">h / m</text><text x="750" y="319">x / m</text>
      <path data-projectile-curve d={curve} className="scene-curve" />
      {Array.from({ length: 13 }, (_, index) => {
        const t = index * flight / 12
        return <circle key={index} cx={x(t)} cy={y(t)} r={2.5} className="scene-mark" />
      })}
      <path d={`M${x(time)} ${y(time)}l${vx * vectorScale} ${vy * vectorScale}`}
        markerEnd={`url(#${arrow})`} className="velocity-vector" />
      <circle cx={x(time)} cy={y(time)} r={6.5} className="scene-ball" />
    </svg>
    {!snapshot && <dl className="scene-hud">
      <div><dt>实时数据</dt><dd /></div>
      <div><dt>运动时间</dt><dd data-scene-time>{fmt(time)} s</dd></div>
      <div><dt>水平位移</dt><dd>{fmt(speed * time)} m</dd></div>
      <div><dt>竖直下落</dt><dd>{fmt(0.5 * gravity * time ** 2)} m</dd></div>
      <div><dt>速度大小</dt><dd>{fmt(Math.hypot(speed, gravity * time))} m/s</dd></div>
    </dl>}
  </div>
}

export function PhysicsDiagram() {
  return <figure className="lesson-diagram">
    <svg viewBox="0 0 280 115" aria-label="以抛出点为原点，x 向右，y 向下">
      <path d="M32 15H248m-216 0v83" className="graph-axis" />
      <path d="M32 15Q127 15 222 85" className="graph-curve" />
      <path d="M165 49.3V15M32 49.3h133" className="graph-guide" />
      <circle cx="165" cy="49.3" r="3" className="graph-point" />
      <text x="57" y="12">v₀</text><text x="255" y="20">x</text><text x="23" y="107">y</text>
      <text x="173" y="50">(x, y)</text>
    </svg>
    <figcaption>平抛运动的位移分解</figcaption>
  </figure>
}

function Quadratic({ scene }: { scene: Scene }) {
  const state = useSyncExternalStore(scene.subscribe, scene.getSnapshot)
  const { a, b, c } = state.parameters
  const { vertex, direction, roots } = math.calculate(state.parameters)
  const clip = useId()
  const x = (value: number) => 300 + value * 36
  const y = (value: number) => 139 - value * 28
  const points = Array.from({ length: 321 }, (_, index) => -8 + index / 20)
  const path = points.map((u, index) => `${index ? 'L' : 'M'}${fmt(x(u))} ${fmt(y(a * u * u + b * u + c))}`).join(' ')
  return <>
    <p className="formula">y = {a}x² {b >= 0 ? '+' : '−'} {Math.abs(b)}x {c >= 0 ? '+' : '−'} {Math.abs(c)}</p>
    <div className="embed-grid">
      <Sliders engine={math} scene={scene} state={state} />
      <svg className="math-stage" viewBox="0 0 600 278" aria-label="二次函数动态图像，x 与 y 为无量纲坐标">
        <defs><clipPath id={clip}><rect width="600" height="278" /></clipPath></defs>
        <g clipPath={`url(#${clip})`}>
          {Array.from({ length: 17 }, (_, i) => i - 8).map((u) => <path key={u} d={`M${x(u)} 0V278`} className="graph-grid" />)}
          {Array.from({ length: 9 }, (_, i) => i - 4).map((u) => <path key={u} d={`M0 ${y(u)}H600`} className="graph-grid" />)}
          <path d={`M0 ${y(0)}H600M${x(0)} 0V278`} className="graph-axis" />
          <text x="579" y={y(0) - 8}>x</text><text x={x(0) + 8} y="17">y</text>
          <path d={path} className="graph-curve" data-math-curve />
          {vertex && <g><path d={`M${x(vertex[0])} 0V278`} className="graph-guide" />
            <circle cx={x(vertex[0])} cy={y(vertex[1])} r="5" className="graph-point" /></g>}
          {roots.map((root) => <circle key={root} cx={x(root)} cy={y(0)} r="4" className="graph-point" />)}
        </g>
      </svg>
    </div>
    <div className="math-result"><span data-math-direction>{direction}</span>
      {vertex && <span>顶点 ({fmt(vertex[0])}, {fmt(vertex[1])})</span>}
      {roots.length > 0 && <span>零点 {roots.map(fmt).join('、')}</span>}
    </div>
  </>
}

const poems = [
  ['床前明月光', '开篇写月光照进室内，点明夜间独处的场景。'],
  ['疑是地上霜', '以霜比拟月光，表现月夜的清冷。'],
  ['举头望明月', '由低头看地上的光转向抬头望月。'],
  ['低头思故乡', '低头的动作承接望月，引出思乡之情。'],
]
const periods = [
  ['西汉', '张骞出使西域，推动了汉与中亚的交通和交往。'],
  ['隋唐', '长安等城市连接多地商旅，商品、宗教和艺术沿多条线路交流。'],
  ['宋元', '陆路与海路并行，海上贸易网络继续发展。'],
]
const civic = [
  ['确定议题', '明确公共问题、涉及的人群和待解决的冲突。'],
  ['收集事实', '记录调查结果，了解受影响群体的实际需要。'],
  ['讨论方案', '比较多种方案的影响、成本和可行性。'],
  ['决策执行', '依照适用程序选择并落实方案。'],
  ['评估反馈', '公开实施效果，收集反馈并评估是否调整。'],
]
const dialogue = [
  ['服务员', 'What would you like to order?'],
  ['顾客', 'I’d like a bowl of soup, please.'],
  ['服务员', 'Would you like anything to drink?'],
  ['顾客', 'A glass of water, please.'],
]

function Choices({ items, timeline = false, scene }: { items: string[][]; timeline?: boolean; scene: Scene }) {
  const { interaction } = useSyncExternalStore(scene.subscribe, scene.getSnapshot)
  const selected = Number(interaction.choice ?? 0)
  return <><div className={`activity-options ${timeline ? 'activity-timeline' : ''}`}>
    {items.map(([title], index) => <button key={title} className={index === selected ? 'selected' : ''}
      aria-pressed={index === selected} onClick={() => scene.setInteraction('choice', index)}>{title}</button>)}
  </div><p className="inset">{items[selected][1]}</p></>
}

function Molecule({ scene }: { scene: Scene }) {
  const { interaction } = useSyncExternalStore(scene.subscribe, scene.getSnapshot)
  const angle = Number(interaction.angle ?? 0)
  const atom = interaction.atom ?? 'O'
  const hydrogen = waterGeometry(angle).map((point, id) => ({ ...point, id })).sort((a, b) => a.z - b.z)
  return <div className="molecule">
    <svg viewBox="0 0 330 150" aria-label="水分子三维球棍模型的投影">
      <g transform="translate(165 52)">
        {hydrogen.map((point) => <path key={point.id} d={`M0 0L${point.x * 86} ${point.y * 86}`}
          className="molecule-bond" opacity={0.75 + 0.25 * point.z} />)}
        <circle r="24" className="molecule-o" /><text textAnchor="middle" y="5">O</text>
        {hydrogen.map((point) => <g key={point.id} transform={`translate(${point.x * 86} ${point.y * 86})`}>
          <circle r={17 + 4 * point.z} className="molecule-h" />
          <text y="5" textAnchor="middle">H</text>
        </g>)}
      </g>
    </svg>
    <label>绕竖直轴旋转 {angle}° <input type="range" aria-label="分子观察角度" min="-180" max="180" value={angle}
      onChange={(event) => scene.setInteraction('angle', event.currentTarget.valueAsNumber)} /></label>
    <div className="actions"><Button onClick={() => scene.setInteraction('atom', 'O')}>氧原子</Button>
      <Button onClick={() => scene.setInteraction('atom', 'H')}>氢原子</Button>
      <Button onClick={() => scene.setInteraction('atom', 'bond')}>氧氢键</Button></div>
    <p>{atom === 'O' ? '氧（O）位于水分子中央。' : atom === 'H' ? '两个氢原子分别与一个氧原子相连。'
      : `两个氧氢键的空间夹角约为 ${waterBondAngle.toFixed(1)}°。旋转时平面投影会变化。`}</p>
  </div>
}

function Dialogue() {
  const [error, setError] = useState('')
  return <div className="dialogue">
    {dialogue.map(([role, line]) => <div className="inset" key={line}>
      <b>{role}</b> <span lang="en">{line}</span>
      <Button icon="play" onClick={() => speakLocal(line, setError)}>朗读</Button>
    </div>)}
    {error && <p role="status">{error}</p>}
  </div>
}

export function Experiment({ block, scene, large = false, onRecord }: {
  block: Block; scene: Scene; large?: boolean; onRecord?: () => void
}) {
  if (!block.engine || !Object.hasOwn(engines, block.engine)) return <p role="alert">互动引擎未注册</p>
  if (isMiddlePhysicsEngine(block.engine) || isMotionEngine(block.engine)) {
    return <PhysicsExperiment engine={block.engine} title={block.title} prompt={block.body} scene={scene} onRecord={onRecord} />
  }
  switch (block.engine) {
    case 'math.quadratic': return <Quadratic scene={scene} />
    case 'math.pythagorean':
    case 'math.tangent': return <NumericExperiment engine={block.engine} {...{ scene, large }} />
    case 'chemistry.molecule': return <Molecule scene={scene} />
    case 'english.dialogue': return <Dialogue />
    case 'chinese.poetry': return <Choices items={poems} scene={scene} />
    case 'history.timeline': return <Choices items={periods} scene={scene} timeline />
    case 'politics.flow': return <Choices items={civic} scene={scene} timeline />
    default: return <OtherExperiment engine={block.engine} scene={scene} />
  }
}
