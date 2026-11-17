import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Button } from '../design-system/ui'
import { engines, type Parameters } from '../subject-sdk'
import type { Scene } from '../subject-sdk/scene'
import { coordinateOnAxis, dot, orbitCamera, project, type Vec3 } from './buoyancy-space'
import { createBenchRenderer } from './bench-webgl'
import { makeBench } from './physics-diagrams'
import { closestControl, snapParameter } from './physics-manipulation'
import { add, type BenchEngine, type Drag, type EvidenceSample } from './physics-bench'

type Gesture = { id: number } & (
  { type: 'orbit'; x: number; y: number; yaw: number; pitch: number }
  | { type: 'part'; control: Drag; start: number; original: number; last: number; clock: number }
)
const noEvidence: EvidenceSample[] = []
const clampPitch = (value: number) => Math.min(1.26, Math.max(.10, value))

export default function PhysicsStage({ engine, title, parameters, scene, time = 0, references = noEvidence }: {
  engine: BenchEngine; title: string; parameters: Parameters; scene: Scene; time?: number; references?: EvidenceSample[]
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const renderer = useRef<ReturnType<typeof createBenchRenderer>>(null)
  const gesture = useRef<Gesture>(null)
  const timeout = useRef(0)
  const model = useMemo(() => makeBench(engine, parameters, references, time), [engine, parameters, references, time])
  const [orbit, setOrbit] = useState({yaw:model.yaw,pitch:model.pitch})
  const [size,setSize] = useState({width:640,height:384})
  const [activity,setActivity] = useState<Gesture['type']>()
  const [unavailable,setUnavailable] = useState(false)
  const camera = orbitCamera(orbit.yaw,orbit.pitch,size.width/size.height,model.target,model.distance,1.40)
  const fields = engines[engine].parameters

  useLayoutEffect(() => {
    const node=canvas.current!
    const init=()=>{
      try {
        renderer.current=createBenchRenderer(node)
        setUnavailable(!renderer.current)
      } catch {
        setUnavailable(true)
      }
    }
    const lost=(event:Event)=>{event.preventDefault();setUnavailable(true)}
    init()
    node.addEventListener('webglcontextlost',lost)
    node.addEventListener('webglcontextrestored',init)
    const measure=()=>{
      const {clientWidth:width,clientHeight:height}=node
      setSize(old=>old.width===width&&old.height===height?old:{width,height})
    }
    const observer=new ResizeObserver(measure)
    observer.observe(node)
    measure()
    return ()=>{
      observer.disconnect()
      node.removeEventListener('webglcontextlost',lost)
      node.removeEventListener('webglcontextrestored',init)
      renderer.current?.dispose()
      renderer.current=null
      window.clearTimeout(timeout.current)
      const drag=gesture.current
      if(drag?.type==='part'&&drag.control.velocity) scene.setParameters({[drag.control.velocity]:0})
    }
  },[scene])

  useLayoutEffect(() => {
    const gl=renderer.current
    if(!gl||unavailable)return
    gl.begin(camera,activity==='part')
    const transparent=[]
    for(const shape of model.solids) {
      if(shape.alpha<1) transparent.push(shape)
      else gl.draw(shape.mesh,shape.center,shape.size,shape.tone,shape.alpha,shape.mode,shape.basis)
    }
    for(const stroke of model.strokes) gl.path(stroke.points,stroke.tone,1,stroke.closed)
    gl.transparent(true)
    transparent.sort((a,b)=>dot(b.center,camera.forward)-dot(a.center,camera.forward))
    for(const shape of transparent) gl.draw(shape.mesh,shape.center,shape.size,shape.tone,shape.alpha,shape.mode,shape.basis)
    gl.transparent(false)
  })

  function pointer(event:PointerEvent<HTMLDivElement>):[number,number] {
    const rect=event.currentTarget.getBoundingClientRect()
    return [(event.clientX-rect.left)/rect.width,(event.clientY-rect.top)/rect.height]
  }
  function finish(event:PointerEvent<HTMLDivElement>) {
    const drag=gesture.current
    if(drag?.id!==event.pointerId)return
    gesture.current=null
    setActivity(undefined)
    window.clearTimeout(timeout.current)
    if(drag.type==='part'&&drag.control.velocity) scene.setParameters({[drag.control.velocity]:0})
  }
  function orient(yaw:number,pitch:number) {
    setOrbit(old=>({yaw:old.yaw+yaw,pitch:clampPitch(old.pitch+pitch)}))
  }
  const position=(point:Vec3)=>{
    const [x,y]=project(camera,point)
    return {left:x*100+'%',top:y*100+'%'}
  }

  return <div className="physics-3d">
    <div className="physics-frame physics-3d-viewport" data-bench={engine} data-camera-yaw={orbit.yaw.toFixed(3)}
      data-dragging={activity} tabIndex={unavailable?undefined:0} aria-label="三维实验台，方向键旋转视角"
      onKeyDown={event=>{
        if(event.target!==event.currentTarget)return
        const yaw=event.key==='ArrowLeft'?-.12:event.key==='ArrowRight'?.12:0
        const pitch=event.key==='ArrowUp'?.08:event.key==='ArrowDown'?-.08:0
        if(!yaw&&!pitch)return
        event.preventDefault()
        orient(yaw,pitch)
      }}
      onPointerDown={event=>{
        if(unavailable||!event.isPrimary||event.button!==0)return
        const point=pointer(event)
        const handle=(event.target as HTMLElement).closest<HTMLElement>('[data-part]')
        const control=handle?model.controls[Number(handle.dataset.part)]:closestControl(camera,point,model.controls)
        if(control&&'change' in control) {
          if(!handle)scene.setParameters(control.change)
          return
        }
        if(control) {
          const start=coordinateOnAxis(camera,point,control.point,control.axis)
          if(start===null)return
          const original=parameters[control.parameter]
          gesture.current={type:'part',id:event.pointerId,control,start,original,last:original,clock:event.timeStamp}
        } else {
          gesture.current={type:'orbit',id:event.pointerId,x:event.clientX,y:event.clientY,...orbit}
        }
        setActivity(gesture.current.type)
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event=>{
        const drag=gesture.current
        if(drag?.id!==event.pointerId)return
        if(drag.type==='orbit') {
          setOrbit({yaw:drag.yaw-(event.clientX-drag.x)*.010,pitch:clampPitch(drag.pitch+(event.clientY-drag.y)*.008)})
          return
        }
        const {control}=drag
        const point=coordinateOnAxis(camera,pointer(event),control.point,control.axis)
        if(point===null)return
        const value=snapParameter(fields[control.parameter],drag.original+(point-drag.start)*control.gain)
        const change:Parameters={[control.parameter]:value}
        if(control.velocity) {
          const velocity=control.velocity
          change[velocity]=snapParameter(fields[velocity],(value-drag.last)*1000/Math.max(1,event.timeStamp-drag.clock))
          window.clearTimeout(timeout.current)
          timeout.current=window.setTimeout(()=>scene.setParameters({[velocity]:0}),110)
        }
        drag.last=value
        drag.clock=event.timeStamp
        scene.setParameters(change)
      }}
      onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish}>
      <canvas ref={canvas} role="img" aria-label={title+'的 WebGL 三维装置'} />
      {unavailable ? <p role="status" className="buoyancy-unavailable">当前浏览器无法显示 WebGL 实验台。可用下方参数读取计算结果。</p> : <>
        {model.labels.map((label,index)=><span key={index} className="physics-part-label" data-tone={label.tone}
          style={position(label.point)}>{label.text}</span>)}
        {model.controls.map((part,index)=>{
          const style=position(part.point)
          if('change' in part) return <button type="button" key={index} className="physics-handle physics-toggle"
            data-part={index} style={style} aria-label={part.label} title={part.label} aria-pressed={part.pressed}
            onClick={()=>scene.setParameters(part.change)}>{part.symbol}</button>
          const field=fields[part.parameter], value=parameters[part.parameter]
          const [a,b]=project(camera,part.point),[c,d]=project(camera,add(part.point,part.axis))
          const vertical=Math.abs(d-b)>Math.abs(c-a)
          return <div key={part.label} className="physics-handle physics-drag" role="slider" tabIndex={0}
            data-part={index} style={style} title={part.label} aria-label={part.label} aria-orientation={vertical?'vertical':'horizontal'}
            aria-valuemin={field.min} aria-valuemax={field.max} aria-valuenow={value} aria-valuetext={value+' '+field.unit}
            onKeyDown={event=>{
              const dx=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0
              const dy=event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0
              let next=value
              if(dx||dy)next+=Math.sign(((c-a)*dx+(d-b)*dy)*part.gain)*field.step
              else if(event.key==='Home')next=field.min
              else if(event.key==='End')next=field.max
              else return
              event.preventDefault()
              scene.setParameters({[part.parameter]:snapParameter(field,next)})
            }} />
        })}
      </>}
    </div>
    {!unavailable&&<div className="buoyancy-tools">
      <span>操作部件，拖动空白处旋转</span>
      <Button kind="quiet" icon="reset" onClick={()=>setOrbit({yaw:model.yaw,pitch:model.pitch})}>复位视角</Button>
    </div>}
  </div>
}
