import type { Parameters } from '../subject-sdk'
import { middlePhysics } from '../subject-sdk/middle-physics'
import { dot, type Vec3 } from './buoyancy-space'
import { add, coil, createBench, glassTank, material, radians, sampleTone, scaled, X, Y, type Bench, type EvidenceSample } from './physics-bench'

function stand(b: Bench, top: number, x = -1.68, z = -.52) {
  b.box([x,.09,z],[1.37,.17,1.09],'board')
  b.box([x,(top+.15)/2,z],[.22,top-.15,.22],'metal')
  b.box([x,(top+.15)/2,z+.111],[.061,top-.24,.009],'body',material.signal)
  b.box([x/2,top,z],[Math.abs(x)+.28,.16,.23],'edge')
  b.box([0,top,z/2],[.22,.16,Math.abs(z)+.19],'metal')
  b.box([x,top,z],[.31,.28,.32],'metal')
  b.segment([x,top,z+.16],[x,top,z+.22],.14,'brass')
}

export function springBench(p: Parameters, samples: EvidenceSample[]) {
  const b=createBench({target:[-.23,1.25,0],distance:9.0,pitch:.37,deck:[5.2,2.47]})
  const {weight,extension}=middlePhysics['physics.spring-force'](p)
  stand(b,3.1)
  const length=.76+12*extension, y=3.01-length
  coil(b,3.01,length,.22)
  b.object('cylinder',[0,3.00,0],[.43,.066,.43],'metal')
  b.object('cylinder',[0,y,0],[.38,.051,.38],'brass')
  b.segment([0,y,0],[0,y-.18,0],.071,'metal')
  if (p.mass>0) {
    b.object('cylinder',[0,y-.37,0],[.55,.36,.55],'metal')
    for (const offset of [-.50,-.39,-.28]) b.object('cylinder',[0,y+offset,0],[.57,.026,.57],'edge')
    b.object('cylinder',[0,y-.56,0],[.64,.08,.64],'brass')
    const gap=weight*.099
    b.arrow([-.43,y-.36,.17],[-.43,y-.36+gap,.17],'cyan')
    b.arrow([.43,y-.36,.17],[.43,y-.36-gap,.17],'brass')
    b.label('拉力 '+weight.toFixed(1)+' N',[-.55,y-.25+gap,.17],'cyan')
    b.label('重力 '+weight.toFixed(1)+' N',[.58,y-.36-gap,.17],'brass')
  }
  b.drag('上下拖动钩码',[0,y-.34,0],[.58,.52,.58],'mass',Y,-1/1.2)
  b.box([1.14,1.87,-.22],[.26,1.94,.10],'body')
  for(let cm=0;cm<=6;cm++) {
    const tick=2.25-cm*.12
    b.segment([1.045,tick,-.155],[1.23,tick,-.155],.024,'metal')
  }
  b.label('伸长量 / cm',[1.14,2.84,-.20],'metal')
  for (const sample of samples) {
    const mark=2.25-sample.parameters.mass*1.2
    b.segment([.84,mark,-.15],[1.16,mark,-.15],.032,sampleTone[sample.label])
    b.label(sample.label,[1.34,mark,-.13],sampleTone[sample.label])
  }
  return b
}

export function frictionBench(p: Parameters, samples: EvidenceSample[]) {
  const b=createBench({target:[0,.59,0],pitch:.52})
  const {resistance,sliding}=middlePhysics['physics.friction'](p)
  const textured=p.rough>=.5
  b.box([-.24,.11,0],[6.65,.27,2.01],textured?'brass':'board',textured ? material.wood : material.coating)
  for (const z of [-.98,.98]) b.box([-.24,.195,z],[6.64,.097,.093],'edge')
  for (let tick=0;tick<=10;tick++) {
    const x=1.14+tick*.24
    b.trace([[x,.253,.66],[x,.253,.76]],'metal')
  }
  const x=sliding?-.94:-1.45
  b.box([x,.55,0],[1.44,.60,1.10],'brass')
  b.box([x,.90,0],[.72,.11+p.normal*.004,.57],'metal')
  b.box([x,.29,0],[1.42,.074,1.06],'edge')
  const handle=1.14+p.pull*.12
  b.segment([x+.72,.54,0],[handle,.54,0],.059,'metal')
  b.segment([handle,.38,0],[handle,.72,0],.16,'cyan')
  b.drag('水平拖动拉绳手柄',[handle,.54,0],[.48,.59,.49],'pull',X,1/.12)
  b.arrow([x-.72,.69,.33],[x-.72-resistance*.13,.69,.33],'brass')
  b.arrow([x+.64,.76,.33],[x+.64+p.pull*.115,.76,.33],'cyan')
  b.label(sliding?'超过静摩擦上限':'保持静止',[x,1.21,0],sliding?'brass':'white')
  b.label(textured?'较粗糙接触面':'较光滑接触面',[0,.29,1.22],'metal')
  b.action('切换接触面',[2.40,.29,.65],[.75,.19,.54],{rough:Number(!textured)},'面')
  for (const sample of samples) {
    const mark=1.14+sample.parameters.pull*.12
    b.trace([[mark,.258,.70],[mark,.258,.92]],sampleTone[sample.label])
    b.label(sample.label,[mark,.29,1.03],sampleTone[sample.label])
  }
  return b
}

export function solidPressureBench(p: Parameters, samples: EvidenceSample[]) {
  const b=createBench({target:[0,.55,0],distance:9.3,pitch:.57,deck:[6.15,3.18]})
  const { pressure }=middlePhysics['physics.solid-pressure'](p)
  const width=.32+p.area*.0048
  b.box([0,.11,0],[5.24,.23,2.60],'board')
  for (const x of [-2.23,2.23]) for (const z of [-.93,.93]) {
    b.object('cylinder',[x,.231,z],[.21,.044,.21],'metal')
    b.box([x,.256,z],[.090,.010,.020],'edge',material.signal)
  }
  b.box([0,.14,1.294],[3.55,.061,.040],'edge')
  const patch=p.force===0?'body':pressure<20000?'cyan':pressure<80000?'brass':'red'
  b.box([0,.268,0],[width,.046,1.25],patch,5)
  b.box([0,.56,0],[width,.54,1.23],'metal')
  b.box([0,.70,0],[width*.69,.055,.96],'edge')
  b.box([width/2,.60,0],[.17,.36,.85],'brass')
  b.drag('拖动承压块右边缘',[width/2,.60,0],[.40,.47,1.00],'area',X,2/.0048)
  if(p.force>0) b.arrow([0,1.07+p.force*.00125,0],[0,.85,0],'cyan',.055)
  if(p.force===0) b.label('压力 0 N',[0,1.18,0],'metal')
  else b.label('压力 '+p.force+' N',[0,1.27+p.force*.00125,0],'cyan')
  for (const sample of samples) {
    const edge=(.32+sample.parameters.area*.0048)/2
    const tone=sampleTone[sample.label]
    const front=sample.label==='A' ? .70 : .84
    b.trace([[-edge,.29,front],[edge,.29,front]],tone)
    b.label(sample.label,[edge,.29,front+.17],tone)
  }
  b.label('接触区',[0,.32,1.34],patch==='body'?'metal':patch)
  return b
}

export function liquidPressureBench(p: Parameters, samples: EvidenceSample[]) {
  const b=createBench({target:[0,1.22,0],distance:9.65,pitch:.34,deck:[6.76,2.87]})
  const { difference }=middlePhysics['physics.liquid-pressure'](p)
  const y=2.20-p.depth*3.24
  glassTank(b,[-1.51,.13,0],2.74,1.66,2.39,2.07)
  b.box([-1.51,2.59,-.56],[.93,.16,.18],'metal')
  b.segment([-1.51,2.94,0],[-1.51,y,0],.045,'metal')
  b.object('cylinder',[-1.51,y,.09],[.46,.16,.46],'brass')
  b.object('cylinder',[-1.51,y+.08,.09],[.37,.04,.37],'metal')
  b.drag('上下拖动水槽探头',[-1.51,y,.09],[.55,.34,.51],'depth',Y,-1/3.24)
  b.label('探头 '+Math.round(p.depth*100)+' cm',[-1.51,y+.18,.24],'brass')
  b.wire([[-1.51,2.95,0],[.07,2.95,0],[.87,2.64,0],[.87,2.40,.31]],.069,'metal')
  const z=.31, a=.87, c=2.38, bend=.48
  const arc=Array.from({length:13},(_,i)=>{
    const t=Math.PI+i/12*Math.PI
    return [1.625+.755*Math.cos(t),bend+.31*Math.sin(t),z] as Vec3
  })
  b.trace([[a,2.40,z],...arc,[c,2.40,z]],'seam')
  b.trace([[a-.10,2.40,z],...arc.map(([x,y,z])=>[x<1.625?x-.10:x+.10,y-.055,z] as Vec3),[c+.10,2.40,z]],'seam')
  b.box([1.625,.06,z],[1.96,.105,.77],'edge')
  for (const x of [a,c]) {
    b.object('cylinder',[x,1.44,z],[.17,1.92,.17],'seam',material.glass,.19)
    b.object('cylinder',[x,2.36,z],[.24,.078,.24],'metal')
  }
  const low=1.37-difference*.68, high=1.37+difference*.68
  b.wire([[a,low,z],...arc,[c,high,z]],.092,'cyan')
  b.box([1.625,1.37,z-.10],[.12,1.78,.065],'body')
  for(let i=0;i<=8;i++) {
    const tick=.59+i*.195
    b.segment([1.59,tick,z-.05],[1.72,tick,z-.05],.017,'metal')
  }
  b.label('U 形管液面差',[1.63,2.69,z],'cyan')
  for (const sample of samples) {
    const depth=sample.parameters.depth, mark=2.20-depth*3.24
    b.segment([-2.76,mark,.85],[-2.48,mark,.85],.030,sampleTone[sample.label])
    b.label(sample.label,[-2.98,mark,.85],sampleTone[sample.label])
  }
  return b
}

export function shipBench(p: Parameters, samples: EvidenceSample[]) {
  const b=createBench({target:[0,.90,0],distance:9.5,pitch:.61})
  const { draft,maxCargo }=middlePhysics['physics.ship-load'](p)
  const surface=1.02, bottom=surface-draft*20, rim=bottom+.86
  glassTank(b,[0,.12,0],5.54,2.85,1.32,.90)
  b.box([0,bottom,0],[3.59,.11,1.49],'board')
  for (const side of [-1,1]) {
    b.box([0,(bottom+rim)/2,side*.75],[3.63,.86,.105],'metal')
    b.box([side*1.80,(bottom+rim)/2,0],[.105,.86,1.54],'metal')
    b.box([0,rim,side*.75],[3.67,.062,.16],'brass')
    for (const x of [-1.42,-.73,0,.73,1.42]) b.box([x,(bottom+rim)/2,side*.689],[.044,.77,.049],'edge')
  }
  const limit=bottom+.5
  b.trace([[-1.82,limit,-.82],[1.82,limit,-.82],[1.82,limit,.82],[-1.82,limit,.82]],p.cargo>maxCargo?'red':'brass',true)
  for(let left=p.cargo,index=0;left>0;left-=50,index++) {
    const mass=Math.min(50,left), height=.09+.002*mass
    const x=(index%3-1)*.66
    const y=bottom+.10+Math.floor(index/3)*.19+height/2
    b.box([x,y,0],[.55,height,.55],'metal')
    b.box([x,y+height/2,.05],[.21,.014,.12],'edge')
  }
  b.action('取下 5 克砝码',[-1.06,rim,.17],[.43,.28,.46],{cargo:Math.max(0,p.cargo-5)},'−')
  b.action('加上 5 克砝码',[1.06,rim,.17],[.43,.28,.46],{cargo:Math.min(300,p.cargo+5)},'+')
  b.label('安全水线',[1.97,limit,.80],p.cargo>maxCargo?'red':'brass')
  b.label(p.cargo+' g 载荷',[0,rim+.24,0],'white')
  for (const sample of samples) {
    const {draft}=middlePhysics['physics.ship-load'](sample.parameters)
    const y=surface-draft*20
    b.segment([-2.77,y,1.44],[-2.33,y,1.44],.027,sampleTone[sample.label])
    b.label(sample.label,[-2.95,y,1.44],sampleTone[sample.label])
  }
  return b
}

export function leverBench(p: Parameters, samples: EvidenceSample[]) {
  const b=createBench({target:[0,1.02,0],distance:9.8,pitch:.38,deck:[6.94,2.62]})
  const {drive}=middlePhysics['physics.lever'](p)
  const pivot:Vec3=[-.65,1.68,0], left=pivot[0]-.84, right=pivot[0]+4.2*p.arm
  b.box([pivot[0],.12,0],[1.30,.23,1.38],'board')
  for (const x of [pivot[0]-.48,pivot[0]+.48]) {
    b.segment([x,.24,0],[pivot[0],1.58,0],.21,'metal')
  }
  b.segment([pivot[0],1.68,-.24],[pivot[0],1.68,.24],.29,'edge')
  b.box([.52,1.70,0],[5.31,.14,.32],'metal')
  for(let i=-3;i<=13;i++) {
    const x=pivot[0]+i*.25
    b.trace([[x,1.78,-.15],[x,1.78,.01]],'body')
  }
  b.object('sphere',pivot,[.28,.28,.39],'brass')
  b.box([left,.93,0],[.64,.43+p.load*.0011,.54],'board')
  b.segment([left,1.63,0],[left,1.12+p.load*.00055,0],.049,'metal')
  b.arrow([left,1.14,.42],[left,.46,.42],'brass')
  b.label('阻力 '+p.load+' N',[left,.35,.43],'brass')
  const direction:Vec3=[-Math.cos(radians(p.angle)),-Math.sin(radians(p.angle)),0]
  const origin:Vec3=[right,1.72,.11]
  const tip=add(origin,scaled(direction,.58+Math.min(1,drive/200)*.44))
  const projected=add(origin,scaled(direction,dot([pivot[0]-right,0,0],direction)))
  b.arrow(origin,tip,'cyan')
  b.dashed([pivot[0],1.72,.11],projected,'ghost')
  b.dashed(projected,origin,'metal')
  b.object('sphere',origin,[.27,.25,.28],'cyan')
  b.drag('沿杠杆拖动施力点',origin,[.44,.41,.44],'arm',X,1/4.2)
  b.label('施力点',[right,2.03,.11],'cyan')
  for (const sample of samples) {
    const a=radians(sample.parameters.angle)
    const ray:Vec3=[-Math.cos(a),-Math.sin(a),0]
    const sampleOrigin:Vec3=[pivot[0]+4.2*sample.parameters.arm,1.72,.11]
    const head=add(sampleOrigin,scaled(ray,1.21))
    b.dashed(sampleOrigin,head,sampleTone[sample.label])
    b.label(sample.label,head,sampleTone[sample.label])
  }
  return b
}

function sheave(b: Bench, center: Vec3, radius: number) {
  const [x,y,z]=center
  b.segment([x,y,z-.15],[x,y,z+.15],radius*2,'board')
  for (const side of [-1,1]) b.segment([x,y,z+side*.16],[x,y,z+side*.20],radius*2.16,'metal')
  b.segment([x,y,z-.22],[x,y,z+.22],.13,'brass')
  const face=z+.205
  for (let i=0;i<6;i++) {
    const a=i*Math.PI/3
    b.segment([x+.09*Math.cos(a),y+.09*Math.sin(a),face],
      [x+radius*.78*Math.cos(a),y+radius*.78*Math.sin(a),face],.047,'edge')
  }
}

export function pulleyBench(p: Parameters, samples: EvidenceSample[]) {
  const b=createBench({target:[-.23,1.31,0],distance:9.1,pitch:.32,deck:[5.2,2.47]})
  const {segments,distance}=middlePhysics['physics.pulley'](p)
  stand(b,3.19,-1.65,-.40)
  const top=2.80, z=.03, r=.37, lift=p.height*.92
  sheave(b,[0,top,z],r)
  const weightX=segments===2 ? -.74 : -.37
  const weightY=.34+lift
  b.box([weightX,weightY,z],[.57,.38+p.load*.001,.53],'brass')
  const lower=.85+lift
  const upper=Array.from({length:17},(_,i)=>{
    const theta=Math.PI-i/16*Math.PI
    return [r*Math.cos(theta),top+r*Math.sin(theta),z] as Vec3
  })
  if (segments===2) {
    sheave(b,[weightX,lower,z],r)
    const bend=Array.from({length:17},(_,i)=>{
      const theta=Math.PI+i/16*Math.PI
      return [weightX+r*Math.cos(theta),lower+r*Math.sin(theta),z] as Vec3
    })
    b.wire([[-1.11,3.14,z],...bend,...upper,[r,2.50-distance*.92,z]],.041,'brass')
    b.segment([weightX,lower,z],[weightX,weightY+.24,z],.056,'metal')
  } else {
    b.wire([[-r,weightY+.24,z],...upper,[r,2.50-distance*.92,z]],.041,'brass')
  }
  const ropeEnd:Vec3=[r,2.50-distance*.92,z]
  b.object('sphere',ropeEnd,[.17,.17,.17],'cyan')
  b.label('绳端',add(ropeEnd,[.32,0,.04]),'cyan')
  b.drag('上下拖动滑轮重物',[weightX,weightY,z],[.65,.54,.60],'height',Y,1/.92)
  b.action('切换滑轮组',[1.16,.18,.49],[.60,.18,.41],{moving:Number(segments===1)},'组')
  b.label(segments+' 段承重绳',[1.03,2.84,.03],'metal')
  b.box([1.05,1.48,.12],[.20,2.15,.10],'edge')
  for (let i=0;i<=10;i++) b.trace([[.97,.49+i*.19,.176],[1.10,.49+i*.19,.176]],'metal')
  for (const sample of samples) {
    const trial=middlePhysics['physics.pulley'](sample.parameters)
    const level=2.50-trial.distance*.92
    b.trace([[.91,level,.19],[1.15,level,.19]],sampleTone[sample.label])
    b.label(sample.label,[1.30,level,.19],sampleTone[sample.label])
  }
  return b
}
