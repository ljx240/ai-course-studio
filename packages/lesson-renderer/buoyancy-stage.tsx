import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { Button } from '../design-system/ui'
import { engines } from '../subject-sdk'
import { buoyancyBlock } from '../subject-sdk/middle-physics'
import type { Scene } from '../subject-sdk/scene'
import { createBuoyancyRenderer, forceGeometry, forceScale, specimenHeight, specimenWidth, type BuoyancyReading, type DepthMark } from './buoyancy-renderer'
import { blockCenter, buoyancyCamera, heightAtPointer, hitsBlock, initialOrbit, project, tank, waterlineOrbit, type Vec3 } from './buoyancy-space'

type Gesture = { pointerId: number } & (
  { kind: 'block'; startHeight: number; depth: number }
  | { kind: 'orbit'; x: number; y: number; yaw: number; pitch: number }
)

const depthParameter = engines['physics.buoyancy'].parameters.depth
const clampPitch = (pitch: number) => Math.max(.065, Math.min(1.02, pitch))

export default function BuoyancyStage({ depth, reading, marks, scene }: {
  depth: number; reading: BuoyancyReading; marks: DepthMark[]; scene: Scene
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const renderer = useRef<ReturnType<typeof createBuoyancyRenderer>>(null)
  const gesture = useRef<Gesture>(null)
  const [orbit, setOrbit] = useState(initialOrbit)
  const [size, setSize] = useState({ width: 640, height: 400 })
  const [active, setActive] = useState<Gesture['kind']>()
  const [vectors, setVectors] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const camera = buoyancyCamera(orbit.yaw, orbit.pitch, size.width / size.height)

  useLayoutEffect(() => {
    const node = canvas.current!
    try {
      renderer.current = createBuoyancyRenderer(node)
    } catch {
      setUnavailable(true)
      return
    }
    if (!renderer.current) {
      setUnavailable(true)
      return
    }
    const contextLost = (event: Event) => {
      event.preventDefault()
      setUnavailable(true)
    }
    const contextRestored = () => {
      try {
        renderer.current = createBuoyancyRenderer(node)
        setUnavailable(!renderer.current)
      } catch {
        setUnavailable(true)
      }
    }
    node.addEventListener('webglcontextlost', contextLost)
    node.addEventListener('webglcontextrestored', contextRestored)
    const measure = () => {
      const { clientWidth: width, clientHeight: height } = node
      setSize((old) => old.width === width && old.height === height ? old : { width, height })
    }
    const observer = new ResizeObserver(measure)
    measure()
    observer.observe(node)
    return () => {
      observer.disconnect()
      node.removeEventListener('webglcontextlost', contextLost)
      node.removeEventListener('webglcontextrestored', contextRestored)
      renderer.current?.dispose()
      renderer.current = null
    }
  }, [])

  useLayoutEffect(() => {
    const crossesSurface = reading.immersed > 0 && reading.immersed < buoyancyBlock.height
    if (!unavailable) renderer.current?.render({ camera, depth, reading, vectors, marks, motion: active === 'block' && crossesSurface })
  })

  function setDepth(value: number) {
    const { min, max, step } = depthParameter
    const snapped = Number((Math.round(value / step) * step).toFixed(1))
    scene.setParameters({ depth: Math.max(min, Math.min(max, snapped)) })
  }

  function pointer(event: PointerEvent<HTMLDivElement>): [number, number] {
    const bounds = event.currentTarget.getBoundingClientRect()
    return [(event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height]
  }

  function place(world: Vec3): CSSProperties {
    const [x, y] = project(camera, world)
    return { left: `${x * 100}%`, top: `${y * 100}%` }
  }

  function finish(event: PointerEvent<HTMLDivElement>) {
    if (gesture.current?.pointerId !== event.pointerId) return
    gesture.current = null
    setActive(undefined)
  }

  const percent = Math.round(reading.immersed / buoyancyBlock.height * 100)
  const state = percent === 0 ? '未浸入' : percent === 100 ? '完全浸没' : '部分浸入'
  const forceAnchors = vectors ? forceGeometry(depth, reading).filter((arrow) => arrow.force > 0) : []
  const showScale = Math.cos(orbit.yaw) > 0.2

  return <div className="buoyancy-bench">
    <div className="physics-frame buoyancy-viewport" data-dragging={active}
      data-camera-yaw={orbit.yaw.toFixed(3)} data-camera-pitch={orbit.pitch.toFixed(3)}
      aria-label="三维浮力实验台。拖动空白处旋转视角，方向键也可旋转。" tabIndex={unavailable ? undefined : 0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        const yaw = event.key === 'ArrowLeft' ? -.12 : event.key === 'ArrowRight' ? .12 : 0
        const pitch = event.key === 'ArrowUp' ? .08 : event.key === 'ArrowDown' ? -.08 : 0
        if (!yaw && !pitch) return
        event.preventDefault()
        setOrbit((old) => ({ yaw: old.yaw + yaw, pitch: clampPitch(old.pitch + pitch) }))
      }}
      onPointerDown={(event) => {
        if (unavailable || !event.isPrimary || event.button !== 0) return
        const point = pointer(event)
        const grip = (event.target as HTMLElement).closest('[data-buoyancy-grip]')
        const grab = grip || hitsBlock(camera, point, depth, specimenHeight, specimenWidth)
        gesture.current = grab
          ? { pointerId: event.pointerId, kind: 'block', startHeight: heightAtPointer(camera, point), depth }
          : { pointerId: event.pointerId, kind: 'orbit', x: event.clientX, y: event.clientY, ...orbit }
        setActive(gesture.current.kind)
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const drag = gesture.current
        if (drag?.pointerId !== event.pointerId) return
        if (drag.kind === 'block') {
          setDepth(drag.depth - (heightAtPointer(camera, pointer(event)) - drag.startHeight) * 10)
        } else {
          setOrbit({
            yaw: drag.yaw - (event.clientX - drag.x) * .010,
            pitch: clampPitch(drag.pitch + (event.clientY - drag.y) * .008),
          })
        }
      }}
      onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
      <canvas ref={canvas} role="img" aria-label="透明水槽、悬挂物块和弹簧测力计的 WebGL 三维装置" />
      {unavailable ? <p className="buoyancy-unavailable" role="status">当前浏览器无法显示 WebGL 实验台。可用下方参数读取计算结果。</p> : <>
        <div className="buoyancy-meter" role="meter" aria-label="测力计读数"
          aria-valuemin={0} aria-valuemax={buoyancyBlock.weight} aria-valuenow={Number(reading.tension.toFixed(2))}
          aria-valuetext={reading.metrics['测力计读数']}>
          <span>弹簧测力计</span>
          <strong data-buoyancy-tension>{reading.tension.toFixed(2)} <small>N</small></strong>
          <div className="buoyancy-meter-scale" aria-hidden="true">
            <i style={{ width: `${reading.tension / buoyancyBlock.weight * 100}%` }} />
          </div>
          <div className="buoyancy-meter-ends" aria-hidden="true"><span>0</span><span>5 N</span></div>
        </div>
        <div className="buoyancy-immersion" aria-label={`浸没比例 ${percent}%`}>
          <span>{state}</span><strong>{percent}%</strong>
          <div aria-hidden="true"><i style={{ width: `${percent}%` }} /></div>
          <span className="buoyancy-depth">底面深度 <b>{depth} cm</b></span>
        </div>
        {showScale && <>
          <span className="buoyancy-zero" aria-hidden="true"
            style={place([-tank.halfWidth + .10, 0, tank.halfDepth + .05])}>液面 0 cm</span>
          {[4, 8, 12, 16, 20].map((tick) => <span key={tick} className="buoyancy-ruler-label" aria-hidden="true"
            style={place([tank.halfWidth + .045, -tick / 10, tank.halfDepth + .035])}>{tick}</span>)}
        </>}
        {marks.map((mark) => <span key={mark.label} className="buoyancy-mark" data-group={mark.label}
          style={place([-tank.halfWidth + .10, -mark.depth / 10, tank.halfDepth + .05])}>
          {mark.label} <span>{mark.depth} cm</span>
        </span>)}
        {forceAnchors.map((arrow) => {
          const [x, y, z] = arrow.start
          return <span className={`buoyancy-force ${arrow.key}`} key={arrow.key}
            style={place([x, y + arrow.force * forceScale * arrow.direction, z])}>
            {arrow.title} <b>{Number(arrow.force.toFixed(2))} N</b>
          </span>
        })}
        <div className="buoyancy-grip" data-buoyancy-grip role="slider" tabIndex={0} aria-label="拖动悬挂物块"
          aria-orientation="vertical" aria-valuemin={depthParameter.min} aria-valuemax={depthParameter.max} aria-valuenow={depth}
          aria-valuetext={`物块底面深度 ${depth} 厘米`} style={place(blockCenter(depth, specimenHeight))}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') setDepth(depth - .5)
            else if (event.key === 'ArrowDown') setDepth(depth + .5)
            else if (event.key === 'Home') setDepth(depthParameter.min)
            else if (event.key === 'End') setDepth(depthParameter.max)
            else return
            event.preventDefault()
          }}>↕</div>
      </>}
    </div>
    {!unavailable && <div className="buoyancy-tools">
      <span>拖动物块升降，拖动空白处旋转</span>
      <div className="actions">
        <Button kind="quiet" aria-pressed={vectors} onClick={() => setVectors(!vectors)}>受力箭头</Button>
        <Button kind="quiet" aria-pressed={orbit === waterlineOrbit} onClick={() => setOrbit(waterlineOrbit)}>平视液面</Button>
        <Button kind="quiet" icon="reset" onClick={() => setOrbit(initialOrbit)}>复位视角</Button>
      </div>
    </div>}
  </div>
}
