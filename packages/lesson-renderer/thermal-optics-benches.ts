import type { Parameters } from '../subject-sdk'
import { middlePhysics } from '../subject-sdk/middle-physics'
import type { Vec3 } from './buoyancy-space'
import { createBench, material, radians, sampleTone, X, type Bench, type EvidenceSample } from './physics-bench'

function beaker(b: Bench, x: number, z: number, height: number, temperature: number, tone: 'cyan' | 'brass') {
  const bottom=.47
  b.object('cylinder',[x,.19,z],[1.58,.33,1.51],'board')
  b.object('cylinder',[x,.382,z],[1.47,.080,1.44],'edge')
  b.object('ring',[x,.421,z],[1.31,.62,1.31],temperature>20?'brass':'metal')
  b.object('cylinder',[x,bottom,z],[1.22,.08,1.22],'metal')
  if (height>0) {
    b.object('cylinder',[x,bottom+height/2,z],[1.10,height,1.10],tone,material.water,.32)
    b.object('ring',[x,bottom+height,z],[1.10,.18,1.10],tone,material.signal,.55)
  }
  b.object('cylinder',[x,1.20,z],[1.19,1.49,1.19],'seam',material.glass,.075)
  b.object('ring',[x,1.94,z],[1.25,.55,1.25],'seam')
  const tx=x+.39,tz=z+.47
  b.box([tx+.117,1.26,tz-.04],[.178,1.51,.055],'body')
  b.segment([tx,.56,tz],[tx,2.05,tz],.087,'metal')
  b.segment([tx,.57,tz],[tx,.57+temperature/110*1.45,tz],.095,'red','cylinder',material.signal)
  b.object('sphere',[tx,.58,tz],[.17,.17,.17],'red')
  for (let mark=0;mark<=5;mark++) {
    const h=.58+mark*.264
    b.segment([tx+.06,h,tz],[tx+.18,h,tz],.015,'white','cylinder',material.signal)
  }
  b.label(temperature.toFixed(1)+' ℃',[tx+.33,2.03,tz],tone)
}

function slider(b: Bench, key: string, label: string, x: number, z: number, length: number, value: number, limit: number, unit: string) {
  const knob=x-length/2+value*length/limit
  b.box([x,.27,z],[length+.38,.25,.48],'body')
  b.segment([x-length/2,.42,z],[x+length/2,.42,z],.04,'metal')
  for (let i=0;i<=8;i++) {
    const tick=x-length/2+i*length/8
    b.trace([[tick,.405,z+.095],[tick,.405,z+.166]],'edge')
  }
  b.object('sphere',[knob,.46,z],[.25,.17,.25],'brass')
  b.drag(label,[knob,.46,z],[.38,.32,.36],key,X,limit/length)
  b.label(value+' '+unit,[knob,.70,z],'brass')
}

export function heatingBench(p: Parameters, samples: EvidenceSample[]) {
  const b=createBench({target:[0,.87,0],distance:11.15,pitch:.48})
  const {temperature,boilingTime,evaporated}=middlePhysics['physics.water-heating'](p)
  const liquid=.95*(1-evaporated/.1)
  beaker(b,-2.02,.0,liquid,temperature,'cyan')
  b.label(temperature===100?'沸腾':'升温',[-2.02,2.19,-.12],'cyan')
  if (p.time>boilingTime) {
    for (let index=0;index<12;index++) {
      const a=index*2.39, y=.49+liquid*((p.time/6+index*.17)%1)
      const size=.052+.04*(index%3)
      b.object('sphere',[-2.02+.40*Math.cos(a),y,.38*Math.sin(a)],[size,size,size],'seam',material.glass,.53)
    }
  }
  const base=.52, y0=.66, width=2.68,height=1.47,z=-.61
  const point=(t: number,temp: number): Vec3=>[base+width*t/240,y0+height*temp/105,z+.055]
  b.box([base+width/2,y0+height/2,z-.026],[width+.34,height+.27,.16],'edge')
  b.box([base+width/2,y0+height/2,z+.035],[width+.12,height+.10,.025],'body')
  for (const t of [0,60,120,180,240]) b.trace([point(t,0),point(t,105)],'edge')
  for (const temp of [0,20,40,60,80,100]) b.trace([point(0,temp),point(240,temp)],'edge')
  b.trace([point(0,20),point(boilingTime,100),point(240,100)],'cyan')
  b.label('温度 / ℃',[.59,2.34,z],'cyan')
  b.label('加热时间 / s',[2.73,.40,z],'metal')
  b.object('sphere',point(p.time,temperature),[.10,.10,.10],'brass',5)
  const slope=temperature<100 ? height*80/(105*boilingTime)*240/width : 0
  const direction:Vec3=[1,slope,0]
  b.drag('拖动温度曲线采样点',point(p.time,temperature),[.30,.31,.23],'time',direction,240/(width*Math.hypot(...direction)))
  for (const sample of samples) {
    const trial=middlePhysics['physics.water-heating'](sample.parameters)
    const at=point(sample.parameters.time,trial.temperature)
    const tone=sampleTone[sample.label]
    b.object('sphere',at,[.091,.091,.091],tone,material.signal)
    b.label(sample.label,[at[0],at[1]+.20,at[2]],tone)
  }
  slider(b,'time','拖动加热计时器',.72,1.30,3.52,p.time,240,'s')
  return b
}

export function specificHeatBench(p: Parameters, samples: EvidenceSample[]) {
  const b=createBench({target:[0,.94,0],distance:9.5,pitch:.45,deck:[5.90,3.52]})
  const {waterRise,otherRise}=middlePhysics['physics.specific-heat'](p)
  const fill=.33+p.mass*.81
  beaker(b,-1.48,-.25,fill,20+waterRise,'cyan')
  beaker(b,1.48,-.25,fill,20+otherRise,'brass')
  b.label('水',[-1.51,2.25,-.25],'cyan')
  b.label('对照液体',[1.49,2.25,-.25],'brass')
  slider(b,'heat','拖动注热旋钮',0,1.24,3.96,p.heat,10,'kJ')
  for (const sample of samples) {
    const trial=middlePhysics['physics.specific-heat'](sample.parameters)
    const level=.57+(20+trial.otherRise)/110*1.45
    const x=sample.label==='A'?2.13:2.38
    const tone=sampleTone[sample.label]
    b.trace([[2.04,level,.25],[x,level,.25]],tone)
    b.label(sample.label,[x,level,.25],tone)
  }
  return b
}

export function mirrorBench(p: Parameters, samples: EvidenceSample[]) {
  const b=createBench({target:[0,.54,0],distance:10.4,pitch:.61,yaw:.23})
  const distance=p.distance*.015
  const offset=distance*Math.tan(radians(p.angle))
  const rayY=.68
  const object:Vec3=[-offset,rayY,distance], image:Vec3=[-offset,rayY,-distance]
  b.box([0,.12,0],[7.06,.21,3.19],'board')
  b.object('wallZ',[0,1.04,0],[4.61,1.79,1],'seam',material.glass,.22)
  b.box([0,.15,0],[4.77,.15,.24],'metal')
  b.box([0,1.94,0],[4.74,.080,.091],'seam')
  for(const x of [-2.33,2.33]) {
    b.box([x,1.04,0],[.079,1.78,.099],'metal')
    b.box([x,.25,0],[.33,.19,.58],'edge')
  }
  b.object('cylinder',[object[0],.22,object[2]],[.37,.11,.37],'metal')
  b.segment([object[0],.24,object[2]],object,.075,'brass')
  b.object('sphere',object,[.20,.20,.20],'brass',5)
  b.object('sphere',image,[.22,.22,.22],'cyan',material.glass,.65)
  b.label('物点',[object[0],.94,object[2]],'brass')
  b.label('虚像',[image[0],.96,image[2]],'cyan')
  for (const [index,hitX] of [0,-.31].entries()) {
    const hit:Vec3=[hitX,rayY,.014], reflected:Vec3=[2*hitX-object[0],rayY,distance]
    if (index===0) {
      b.arrow(object,hit,'brass',.032)
      b.arrow(hit,reflected,'cyan',.032)
    } else {
      b.wire([object,hit],.020,'brass',material.signal)
      b.wire([hit,reflected],.020,'cyan',material.signal)
    }
    b.dashed(hit,image,'cyan')
  }
  b.dashed([0,rayY,-1.5],[0,rayY,1.5],'metal')
  b.label('法线',[0,rayY+.23,1.62],'metal')
  const axis:[number,number,number]=[-Math.tan(radians(p.angle)),0,1]
  b.drag('拖动物点改变物距',object,[.38,.59,.38],'distance',axis,1/(.015*Math.hypot(...axis)))
  const angleX=-2.2+p.angle*.040
  b.segment([-2.20,.27,1.72],[.40,.27,1.72],.036,'metal')
  b.object('sphere',[angleX,.31,1.72],[.19,.14,.20],'brass')
  b.drag('拖动入射角旋钮',[angleX,.31,1.72],[.30,.24,.31],'angle',X,25)
  b.label(p.angle+'°',[angleX,.53,1.72],'brass')
  for (const sample of samples) {
    const distance=sample.parameters.distance*.015
    const x=-distance*Math.tan(radians(sample.parameters.angle))
    b.trace([[x,.247,distance-.13],[x,.247,distance+.13]],sampleTone[sample.label])
    b.label(sample.label,[x,.30,distance],sampleTone[sample.label])
  }
  return b
}

export function lensBench(p: Parameters, samples: EvidenceSample[]) {
  const b=createBench({target:[0,.83,0],distance:9.75,pitch:.44,yaw:.33})
  const result=middlePhysics['physics.lens'](p)
  const scale=.061, y0=.83, h=.53
  const objectX=-p.distance*scale, screenX=p.screen*scale, f=p.focus*scale
  b.box([0,.19,0],[6.65,.21,1.76],'board')
  for(const z of [-.55,.55]) {
    b.segment([-3.28,.34,z],[3.28,.34,z],.105,'metal')
    for (const x of [-3.14,3.14]) b.box([x,.31,z],[.21,.14,.23],'edge')
  }
  for(let cm=-50;cm<=50;cm+=5) {
    const x=cm*scale
    b.trace([[x,.351,.56],[x,.351,.73]],'white')
  }
  b.dashed([-3.15,y0,0],[3.17,y0,0],'metal')
  const carrier=(x: number,tone:'cyan'|'brass'|'metal')=>{
    b.box([x,.36,0],[.35,.14,1.31],tone)
    b.box([x,.431,0],[.25,.035,1.19],'edge')
    b.segment([x,.42,0],[x,y0,0],.099,'metal')
    b.object('cylinder',[x,.48,0],[.18,.085,.18],'edge')
  }
  carrier(objectX,'brass')
  b.arrow([objectX,y0,0],[objectX,y0+h,0],'brass',.089)
  b.label('发光物体',[objectX,y0+h+.25,0],'brass')
  b.drag('沿光具座拖动发光物体',[objectX,y0+h*.6,0],[.35,.71,.42],'distance',X,-1/scale)
  carrier(0,'cyan')
  b.object('sphere',[0,y0+.07,0],[.18,1.58,1.43],'seam',material.glass,.22)
  b.object('ring',[0,y0+.07,0],[1.67,1.12,1.52],'metal',material.metal,1,[0,1,0, 1,0,0, 0,0,-1])
  b.label('凸透镜',[0,1.89,0],'cyan')
  carrier(screenX,'metal')
  b.object('wallX',[screenX,.95,0],[1,1.36,1.24],'white',material.glass,.46)
  for(const z of [-.63,.63]) b.segment([screenX,.24,z],[screenX,1.64,z],.035,'metal')
  for(const y of [.265,1.64]) b.box([screenX,y,0],[.056,.058,1.28],'metal')
  b.label('光屏',[screenX,1.88,0],'white')
  b.drag('沿光具座拖动光屏',[screenX,1.08,0],[.25,1.42,1.26],'screen',X,1/scale)
  for(const x of [-2*f,-f,f,2*f]) b.object('sphere',[x,y0,0],[.059,.059,.059],'cyan',5)
  b.label('F',[f,y0+.14,0],'cyan')

  const slopeTop=-h/f, slopeCenter=h/objectX
  const extend=(startY:number,slope:number):Vec3=>{
    const x=Math.min(3.21,(.36-startY)/slope)
    return [x,startY+slope*x,0]
  }
  b.wire([[objectX,y0+h,0],[0,y0+h,0],extend(y0+h,slopeTop)],.024,'brass',material.signal)
  b.wire([[objectX,y0+h,0],[0,y0,0],extend(y0,slopeCenter)],.024,'cyan',material.signal)
  if (result.imageDistance!==null && result.magnification!==null) {
    const x=result.imageDistance*scale
    const tip=y0+result.magnification*h
    if (x<0) {
      const end=Math.max(-3.2,x)
      b.dashed([0,y0+h,0],[end,y0+h+slopeTop*end,0],'brass')
      b.dashed([0,y0,0],[end,y0+slopeCenter*end,0],'cyan')
    }
    if (x>=-3.2 && x<=3.2 && tip>.35 && tip<2.64) {
      b.arrow([x,y0,0],[x,tip,0],x>0?'green':'cyan',.061)
      b.label(x>0?'实像':'虚像',[x,tip+(tip>y0?.19:-.16),0],x>0?'green':'cyan')
    }
    if(result.screenClear && tip>.27 && tip<1.62) b.arrow([screenX-.023,y0,.055],[screenX-.023,tip,.055],'green',.076)
  }
  for (const sample of samples) {
    const x=-sample.parameters.distance*scale
    b.trace([[x,.36,.64],[x,.36,.82]],sampleTone[sample.label])
    b.label(sample.label,[x,.37,.91],sampleTone[sample.label])
  }
  return b
}
