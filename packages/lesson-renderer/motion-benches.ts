import type { Parameters } from '../subject-sdk'
import { harmonic, oblique } from '../subject-sdk/models'
import type { Vec3 } from './buoyancy-space'
import { createBench, material, radians, X, Y, type MotionEngine } from './physics-bench'

export function motionBench(engine: MotionEngine, p: Parameters, time: number) {
  if (engine === 'physics.harmonic') {
    const b=createBench({target:[0,.58,0],distance:10.4,pitch:.43})
    const model=harmonic(p)
    const x=model.displacement(time)*1.60
    const y=.53,z=-.18,wall=-2.82
    b.box([0,.12,z],[6.58,.24,1.27],'board')
    b.box([0,.247,z],[6.39,.039,1.23],'edge')
    b.box([wall,.53,z],[.24,.76,1.18],'metal')
    for(const side of [-1,1]) {
      const railZ=z+side*.38
      b.segment([-2.75,.29,railZ],[2.93,.29,railZ],.094,'metal')
      for (const end of [-2.66,2.86]) b.box([end,.28,railZ],[.19,.13,.22],'metal')
    }
    const springStart=wall+.13, springEnd=x-.38
    b.object('spring',[(springStart+springEnd)/2,y,z],[.32,springEnd-springStart,.32],'brass',material.metal,1,
      [0,1,0, -1,0,0, 0,0,1])
    b.box([x,y,z],[.76,.44,.63],'cyan')
    b.box([x,y+.23,z],[.60,.050,.48],'metal')
    for (const side of [-1,1]) b.box([x,.335,z+side*.36],[.65,.098,.15],'edge')
    b.dashed([0,.30,z-.67],[0,.30,z+.78],'metal')
    b.label('平衡位置',[0,.34,z+.98],'metal')
    const force=model.force(time)
    b.arrow([x,.84,z],[x+Math.sign(force)*Math.min(1.05,Math.abs(force)*.065),.84,z],'cyan')
    const boundary=p.amplitude*1.60
    b.object('sphere',[boundary,.32,.92],[.17,.17,.17],'brass')
    b.drag('拖动振幅标记',[boundary,.32,.92],[.34,.28,.39],'amplitude',X,1/1.6)
    b.label('振幅 '+p.amplitude.toFixed(2)+' m',[boundary,.58,.92],'brass')
    const wave=(seconds: number):Vec3=>[-.68+3.49*seconds/model.duration,1.62+.62*model.displacement(seconds),-1.19]
    b.box([1.05,1.62,-1.27],[3.80,1.61,.12],'edge')
    b.box([1.05,1.62,-1.208],[3.66,1.47,.030],'body')
    for (const y of [1.14,1.38,1.62,1.86,2.10]) b.trace([[-.68,y,-1.19],[2.81,y,-1.19]],'edge')
    b.trace([[-.68,2.32,-1.19],[-.68,1.62,-1.19],[2.81,1.62,-1.19]],'metal')
    b.trace(Array.from({length:81},(_,i)=>wave(model.duration*i/80)),'cyan')
    b.object('sphere',wave(time),[.102,.102,.102],'brass',5)
    b.label('位移 / m',[-.68,2.51,-1.18],'cyan')
    b.label('时间 / s',[2.81,1.37,-1.18],'metal')
    return b
  }
  const isHorizontal=engine==='physics.projectile2d'
  const model=oblique(isHorizontal?{...p,angle:0}:p)
  const scale=1/Math.max(1,model.range/5.82,model.apex/3.30)
  const b=createBench({target:[0,1.07,0],distance:12.1,pitch:.40,yaw:.30})
  const start=-3.06, floor=.035
  const point=(t:number):Vec3=>{
    const {x,y}=model.position(t)
    return [start+x*scale,floor+Math.max(0,y)*scale,0]
  }
  const launchY=floor+p.height*scale
  b.box([start-.10,.065,0],[.83,.13,1.03],'edge')
  if(p.height>0) {
    b.box([start-.12,(launchY+floor)/2,0],[.44,launchY-floor,.62],'metal')
    b.box([start-.12,(launchY+floor)/2,.321],[.075,launchY-floor,.019],'edge')
    b.box([start-.05,launchY-.032,0],[.66,.064,.78],'metal')
  }
  b.segment([start,floor,0],[3.12,floor,0],.034,'metal')
  b.segment([start,floor,0],[start,3.51,0],.034,'metal')
  const tickSpacing=Math.max(1,Math.ceil(.65/scale))
  for (let metres=0;metres*scale<=6.18;metres+=tickSpacing) {
    const x=start+metres*scale
    b.trace([[x,floor,-.13],[x,floor,.13]],'white')
  }
  b.label('x / m',[3.16,.15,0],'metal')
  b.label('y / m',[start,3.53,0],'metal')
  const points=Array.from({length:65},(_,index)=>point(model.duration*index/64))
  b.trace(points,'cyan')
  for(let i=8;i<64;i+=8) b.object('sphere',points[i],[.061,.061,.061],'cyan',5)
  const t=Math.min(time,model.duration)
  const [x,y,z]=point(t)
  const ballY=Math.max(y,.13)
  b.object('sphere',[x,ballY,z],[.24,.24,.24],'brass')
  const velocity=model.velocity(t), v=Math.hypot(velocity.x,velocity.y)
  if(v>0 && y>.17) {
    const arrowLength=.72/v
    b.arrow([x,ballY,z],[x+velocity.x*arrowLength,ballY+velocity.y*arrowLength,z],'brass',.035)
  }
  if (isHorizontal) {
    b.segment([start-.37,launchY,.02],[start-.10,launchY,.02],.21,'edge')
    b.segment([start-.21,launchY,.02],[start-.10,launchY,.02],.26,'metal')
    const launch:Vec3=[start-.05,launchY,.42]
    b.drag('上下拖动发射台',[launch[0],launch[1],launch[2]],[.47,.27,.39],'height',Y,1/scale)
  } else {
    const launch:Vec3=[start,launchY,0]
    const a=radians(p.angle)
    const muzzle=(length:number):Vec3=>[start+Math.cos(a)*length,launchY+Math.sin(a)*length,0]
    b.segment(launch,muzzle(.63),.20,'metal')
    b.segment(muzzle(.49),muzzle(.64),.25,'edge')
    b.segment([start,launchY,-.22],[start,launchY,.22],.25,'brass')
    const anglePosition:Vec3=[start+.42,.31+p.angle*.014,.52]
    b.segment([anglePosition[0],.29,.52],[anglePosition[0],1.53,.52],.049,'metal')
    b.object('sphere',anglePosition,[.22,.22,.22],'brass')
    b.drag('拖动发射角调节钮',anglePosition,[.36,.32,.35],'angle',Y,1/.014)
    b.label(p.angle+'°',[anglePosition[0]+.33,anglePosition[1]+.13,.52],'brass')
  }
  b.label('同一实验内等比例缩放',[.24,.28,1.17],'metal')
  return b
}
