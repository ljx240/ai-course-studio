import type { Parameters } from '../subject-sdk'
import { middlePhysics } from '../subject-sdk/middle-physics'
import type { Vec3 } from './buoyancy-space'
import { add, createBench, material, sampleTone, X, type Bench, type EvidenceSample } from './physics-bench'

const terminals: Vec3 = [.17,.19,.17]
const circuitY = .28

function resistor(b: Bench, x: number, z: number, powered: boolean, name: string, y = circuitY) {
  const from: Vec3 = [x-.49,y,z], to: Vec3 = [x+.49,y,z]
  b.segment(from,to,.067,'metal')
  b.segment([x-.35,y,z],[x+.35,y,z],.25,powered?'cyan':'board')
  for (const offset of [-.34,.34]) {
    b.segment([x+offset-.032,y,z],[x+offset+.032,y,z],.27,'metal')
  }
  b.label(name,[x,y+.21,z-.03])
}

function knifeSwitch(b: Bench, x: number, z: number, closed: boolean, key = 'closed') {
  const left: Vec3 = [x-.25,.26,z], right: Vec3 = [x+.25,.26,z]
  b.box([x,.112,z],[.77,.12,.49],'body')
  b.box(left,terminals,'brass')
  b.box(right,terminals,'brass')
  for (const terminal of [left,right]) b.object('cylinder',[terminal[0],.36,z],[.11,.04,.11],'metal')
  b.segment(left,[right[0],closed ? .28 : .67,z],.095,'metal')
  const handle: Vec3 = [right[0],closed ? .39 : .72,z]
  b.object('sphere',handle,[.18,.18,.18],closed ? 'green' : 'red')
  b.action(closed ? '断开开关' : '闭合开关',handle,[.45,.53,.43],{[key]:Number(!closed)},'↕',closed)
}

export function circuitBench(p: Parameters, references: EvidenceSample[]) {
  const b = createBench({target:[0,.83,0],distance:10.55,pitch:.52,yaw:.35})
  const { split, joined, i1, i2, u1 } = middlePhysics['physics.circuit'](p)
  const route = i1 > 0 ? 'cyan' : 'metal'
  const branch = i2 > 0 ? 'cyan' : 'metal'
  const left=-2.98,right=2.88, sourceZ=1.21, topZ=-.95
  const wire = (a: number, az: number, c: number, cz: number, live: typeof route = route) =>
    b.segment([a,circuitY,az],[c,circuitY,cz],.062,live)
  wire(left,topZ,left,sourceZ)
  wire(right,topZ,right,sourceZ)
  wire(left,sourceZ,-1.87,sourceZ)
  wire(.17,sourceZ,right,sourceZ)
  b.box([-.85,.34,sourceZ],[2.08,.49,.78],'board')
  b.box([-.85,.58,sourceZ],[2.01,.043,.71],'edge')
  for (const x of [-1.81,.11]) b.object('cylinder',[x,.52,sourceZ],[.20,.22,.20],x<0?'brass':'metal')
  const voltageX=-1.52+p.voltage*.112
  b.box([-.85,.596,sourceZ],[1.46,.026,.075],'body')
  b.object('sphere',[voltageX,.66,sourceZ],[.24,.15,.23],'brass')
  b.drag('拖动电源调压旋钮',[voltageX,.67,sourceZ],[.35,.27,.33],'voltage',X,1/.112)
  b.label('电源 '+p.voltage.toFixed(1)+' V',[-.85,.84,sourceZ])
  b.label('+',[-1.87,.52,sourceZ],'brass')
  b.label('−',[.17,.52,sourceZ],'metal')
  if (split) {
    wire(left,topZ,-1.79,topZ)
    resistor(b,-1.3,topZ,i1>0,'R₁')
    wire(-.81,topZ,right,topZ)
    const z=.06, r2=-1.60+p.r2*.032
    wire(left,z,r2-.49,z,branch)
    resistor(b,r2,z,i2>0,'R₂')
    wire(r2+.49,z,1.36,z,branch)
    knifeSwitch(b,1.61,z,joined)
    wire(1.86,z,right,z,branch)
    b.drag('移动 R₂ 电阻调节触点',[r2,.32,z],[.76,.35,.32],'r2',X,1/.032)
    if (i2>0) b.arrow([.55,.32,z],[1.05,.32,z],'cyan')
  } else {
    const r2=.12+p.r2*.026
    wire(left,topZ,-2.05,topZ)
    resistor(b,-1.56,topZ,i1>0,'R₁')
    wire(-1.07,topZ,r2-.49,topZ)
    resistor(b,r2,topZ,i2>0,'R₂')
    wire(r2+.49,topZ,1.87,topZ)
    knifeSwitch(b,2.12,topZ,joined)
    wire(2.37,topZ,right,topZ)
    b.drag('移动 R₂ 电阻调节触点',[r2,.33,topZ],[.76,.35,.32],'r2',X,1/.026)
  }
  const config: Vec3 = [2.16,.31,1.06]
  b.box(config,[.83,.19,.58],'board')
  b.action(split?'切换为串联':'切换为并联',config,[.83,.24,.60],{parallel:Number(!split)},split?'并':'串')
  if (i1>0) b.arrow([-1.02,.34,topZ],[-.66,.34,topZ],'cyan')

  const graphZ = -1.59, graphX=.59, graphY=.89, w=2.67, h=1.44
  b.box([graphX+w/2,graphY+h/2,graphZ-.064],[w+.38,h+.28,.14],'edge')
  b.box([graphX+w/2,graphY+h/2,graphZ+.015],[w+.12,h+.09,.041],'body')
  const at = (volts: number, current: number): Vec3 => [graphX+w*volts/12,graphY+h*current/3,graphZ+.039]
  for (let i=0;i<=4;i++) b.trace([at(i*3,0),at(i*3,3)],'edge')
  for (let i=0;i<=3;i++) b.trace([at(0,i),at(12,i)],'edge')
  b.trace([at(0,3),at(0,0),at(12,0)],'metal')
  b.trace([at(0,0),at(12,12/p.r1)],'cyan')
  b.object('sphere',at(u1,i1),[.115,.115,.115],'brass',5)
  if (split || joined) {
    const ratio=split ? 1 : p.r1/(p.r1+p.r2)
    const slope=12/3*h/(w*p.r1)
    const direction:Vec3=[1,slope,0]
    b.drag('拖动 I–U 采样点',at(u1,i1),[.32,.29,.25],'voltage',direction,12/(w*ratio*Math.hypot(...direction)))
  }
  b.label('I–U 曲线',[graphX+w/2,2.52,graphZ],'cyan')
  b.label('U₁ / V',at(12,-.15),'metal')
  b.label('I₁ / A',at(-.55,3),'metal')
  const spots = references.map(({label,parameters}) => {
    const point = middlePhysics['physics.circuit'](parameters)
    return {label, position:at(point.u1,point.i1)}
  })
  for (const [index, { label, position }] of spots.entries()) {
    const shared = index===1 && spots[0].position.every((v,i)=>v===position[i])
    const tone=sampleTone[label]
    b.object('sphere',position,[.088,.088,.088],tone,material.signal)
    b.label(label,add(position,[shared?.25:0,.18,0]),tone)
  }
  return b
}

export function jouleBench(p: Parameters, samples: EvidenceSample[]) {
  const b=createBench({target:[0,.61,0],distance:9.8,pitch:.52})
  const { q1,q2 }=middlePhysics['physics.joule'](p)
  // The indicators show accumulated energy; they are not temperatures.
  for (const [index,q] of [q1,q2].entries()) {
    const x = index===0 ? -1.76 : 1.76
    b.box([x,.25,-.19],[2.48,.36,1.79],'board')
    b.box([x,.451,-.43],[2.13,.070,.93],'edge')
    for (const side of [-1,1]) {
      const contact=x+side*.69
      b.object('cylinder',[contact,.52,-.43],[.20,.12,.20],'metal')
      b.wire([[x+side*.49,.64,-.43],[contact,.64,-.43],[contact,.28,-.43]],.063,'brass')
    }
    resistor(b,x,-.43,p.voltage>0,'R'+(index+1),.64)
    b.object('wallZ',[x,.91,-.98],[2.27,1.13,1],'seam',material.glass,.055)
    for (const side of [-1,1]) {
      b.object('wallX',[x+side*1.10,.91,-.22],[1,1.13,1.52],'seam',material.glass,.06)
      b.box([x+side*1.10,1.48,-.22],[.046,.047,1.52],'metal')
    }
    b.box([x,1.48,-.98],[2.25,.045,.060],'metal')
    const level = 1.72*q/2880
    b.box([x,.46,.43],[1.72,.037,.29],'body')
    if (level>0) b.box([x-.86+level/2,.49,.43],[level,.038,.22],index===0?'brass':'red',5)
    b.label(q.toFixed(1)+' J',[x,.75,.47],index===0?'brass':'red')
    for (const sample of samples) {
      const trial=middlePhysics['physics.joule'](sample.parameters)
      const at=x-.86+1.72*(index===0?trial.q1:trial.q2)/2880
      const front=sample.label==='A'?.59:.83
      const tone=sampleTone[sample.label]
      b.trace([[at,.515,.55],[at,.515,front]],tone)
      b.label(sample.label,[at,.54,front],tone)
    }
  }
  b.wire([[-2.47,.28,-.43],[-3.11,.28,-.43],[-3.11,.28,1.16],[3.11,.28,1.16],[3.11,.28,-.43],[2.47,.28,-.43]],.069,'cyan')
  b.segment([-1.27,.28,-.43],[1.27,.28,-.43],.069,'cyan')
  b.box([0,.33,1.16],[2.78,.30,.56],'body')
  b.segment([-1.10,.51,1.16],[1.10,.51,1.16],.04,'metal')
  const timeX=-1.1+2.2*p.time/180
  b.object('sphere',[timeX,.56,1.16],[.23,.17,.23],'brass')
  b.drag('拖动通电计时旋钮',[timeX,.56,1.16],[.36,.27,.36],'time',X,180/2.2)
  b.label(p.time+' s',[timeX,.77,1.16],'brass')
  return b
}

export function householdBench(p: Parameters, samples: EvidenceSample[]) {
  const b=createBench({target:[0,.76,0],distance:9.7,pitch:.55})
  const {loads,current,overloaded}=middlePhysics['physics.household'](p)
  for (const [i,load] of loads.entries()) {
    const x = (i-1)*2.1, on=load.on, tone=on?'cyan':'metal'
    const key=(['kettle','heater','lamp'] as const)[i]
    b.box([x,.15,-.45],[1.68,.25,1.41],'board')
    if (i===0) {
      b.object('cylinder',[x,.74,-.43],[.83,1.07,.83],'metal')
      b.object('cylinder',[x,.28,-.43],[.90,.17,.90],'edge')
      b.object('cylinder',[x,1.28,-.43],[.87,.10,.87],'body')
      b.object('sphere',[x,1.37,-.43],[.22,.15,.22],'metal')
      b.segment([x-.34,.85,-.43],[x-.69,1.12,-.43],.23,'metal')
      b.wire([[x+.34,1.11,-.43],[x+.65,1.06,-.43],[x+.68,.71,-.43],[x+.37,.63,-.43]],.105,'body')
    } else if (i===1) {
      b.box([x,.84,-.46],[1.21,1.17,.39],'body')
      for (let n=-3;n<=3;n++) b.box([x+n*.16,.85,-.215],[.093,.96,.16],on?'red':'metal')
      for (const y of [.51,.73,.95,1.17]) b.box([x,y,-.116],[1.24,.030,.026],'edge')
    } else {
      b.object('cylinder',[x,.29,-.43],[.81,.12,.81],'body')
      b.segment([x,.33,-.43],[x,1.43,-.43],.094,'metal')
      b.segment([x,.95,-.43],[x,1.53,-.43],.89,'board','cone')
      b.object('cylinder',[x,.956,-.43],[.91,.037,.91],'metal')
      b.object('sphere',[x,.96,-.43],[.32,.31,.32],on?'brass':'metal',on?5:0)
    }
    b.label(load.name,[x,1.61,-.37],on?'cyan':'white')
    b.label(load.power+' W',[x,.43,.36],'metal')
    b.segment([x,.29,.12],[x,.29,1.26],.056,tone)
    b.segment([x,.29,-.98],[x,.29,-1.28],.056,tone)
    b.box([x,.25,1.04],[.50,.16,.34],on?'green':'edge')
    b.action('切换'+load.name,[x,.37,1.04],[.58,.24,.50],{[key]:Number(!on)},'↕',on)
  }
  b.segment([-3.17,.27,1.26],[3.18,.27,1.26],.071,overloaded?'red':'cyan')
  b.segment([-3.17,.27,-1.28],[3.18,.27,-1.28],.071,'metal')
  b.label('火线',[-3.12,.38,1.26],'brass')
  b.label('零线',[-3.12,.38,-1.28],'metal')
  b.box([0,.24,-1.46],[3.84,.22,.36],'body')
  b.segment([-1.68,.365,-1.46],[1.68,.365,-1.46],.030,'metal')
  const gaugeX=(amps:number)=>-1.68+3.36*amps/12
  b.segment([gaugeX(10),.37,-1.53],[gaugeX(10),.37,-1.39],.022,'brass')
  b.label('10 A 上限',[gaugeX(10),.45,-1.48],'brass')
  b.object('sphere',[gaugeX(current),.37,-1.46],[.098,.098,.098],overloaded?'red':'cyan',material.signal)
  b.label(current.toFixed(2)+' A',[0,.27,1.63],overloaded?'red':'cyan')
  for (const sample of samples) {
    const x=gaugeX(middlePhysics['physics.household'](sample.parameters).current)
    b.label(sample.label,[x,.57,-1.46],sampleTone[sample.label])
  }
  return b
}

export function electromagnetBench(p: Parameters, samples: EvidenceSample[]) {
  const b=createBench({target:[0,.73,0],distance:9.95,pitch:.50,deck:[6.5,3.24]})
  const { excitation,polarity }=middlePhysics['physics.electromagnet'](p)
  const y=.73, z=-.37
  b.box([0,.13,z],[4.81,.24,1.24],'board')
  b.segment([-2.31,y,z],[2.31,y,z],.49,'metal')
  b.segment([-1.48,y,z],[1.48,y,z],.77,'body')
  for (const x of [-1.51,1.51]) {
    b.segment([x-.08,y,z],[x+.08,y,z],.91,'edge')
    b.segment([x-.052,y,z],[x+.052,y,z],.88,'metal')
    b.box([x,.30,z],[.28,.23,.85],'edge')
  }
  const turns=Math.round(p.turns/12)
  b.trace(Array.from({length:turns*12+1},(_,i)=>{
    const t=i/(turns*12), a=t*turns*2*Math.PI
    return [-1.48+2.96*t,y+.41*Math.cos(a),z+.41*Math.sin(a)]
  }),'brass')
  if (polarity) {
    b.label(polarity>0?'S':'N',[-2.31,y+.40,z],'white')
    b.label(polarity>0?'N':'S',[2.31,y+.40,z],'cyan')
    for(let ring=1;ring<=3;ring++) {
      const stretch=.26+ring*(.18+.38*excitation/450)
      const field=Array.from({length:48},(_,i)=>{
        const a=i/48*Math.PI*2
        return [2.57*Math.cos(a),y+stretch*.65*Math.sin(a),z+stretch*Math.sin(a)] as Vec3
      })
      b.trace(field,'cyan',true)
      const first=field[10],next=field[14]
      b.arrow(polarity>0?first:next,polarity>0?next:first,'cyan',.032)
    }
  }
  b.box([0,.35,1.10],[3.17,.36,.56],'board')
  b.box([0,.528,1.10],[2.89,.035,.35],'edge')
  b.segment([-1.27,.55,1.10],[1.27,.55,1.10],.036,'metal')
  const handle=(p.current/1.5)*1.27
  b.object('sphere',[handle,.58,1.10],[.26,.15,.24],'brass')
  b.drag('拖动电源滑片改变电流方向',[handle,.59,1.10],[.38,.29,.36],'current',X,1.5/1.27)
  b.label(p.current.toFixed(1)+' A',[handle,.83,1.10],'brass')
  for (const sample of samples) {
    const x=sample.parameters.current/1.5*1.27
    b.label(sample.label,[x,.55,1.48],sampleTone[sample.label])
  }
  return b
}

export function inductionBench(p: Parameters, samples: EvidenceSample[]) {
  const b=createBench({target:[0,.56,0],distance:9.9,pitch:.62,deck:[6.74,3.01]})
  const {connected,current}=middlePhysics['physics.induction'](p)
  const rails=[-.81,.81], x=-2.35+p.position*9.4
  b.box([.22,.10,0],[4.35,.19,2.26],'board')
  for (const z of rails) {
    b.segment([-2.86,.29,z],[2.85,.29,z],.10,'brass')
    b.box([0,.17,z],[5.79,.13,.16],'edge')
    for (const x of [-2.48,-1.64,-.81,0,.81,1.64,2.48]) {
      b.box([x,.13,z],[.15,.11,.28],'metal')
    }
  }
  b.segment([-2.86,.29,-.81],[-2.86,.29,-.25],.085,'metal')
  b.segment([-2.86,.29,.25],[-2.86,.29,.81],.085,'metal')
  const left:Vec3=[-2.86,.29,-.25],right:Vec3=[-2.86,.29,.25]
  b.box(left,terminals,'brass')
  b.box(right,terminals,'brass')
  b.segment(left,[-2.86,connected?.30:.65,.25],.075,'metal')
  b.action(connected?'断开回路':'闭合回路',[-2.86,connected?.38:.68,.25],[.36,.32,.48],{closed:Number(!connected)},'↕',connected)
  b.segment([x,.41,-.95],[x,.41,.95],.18,'metal')
  for (const z of rails) b.box([x,.33,z],[.26,.16,.24],'edge')
  b.drag('沿导轨拖动金属杆',[x,.41,0],[.31,.34,1.76],'position',X,1/9.4,'velocity')
  if (p.field>0) for (const bx of [-1.75,-.60,.55,1.70]) for (const z of [-.49,.49]) {
    b.arrow([bx,.83,z],[bx,.24,z],'cyan',.029)
  }
  b.label('磁场 B 垂直向下',[.2,1.08,-.68],'cyan')
  if (current) b.arrow([x,.60,current>0?.56:-.56],[x,.60,current>0?-.58:.58],'brass')
  if (p.velocity) b.arrow([x,.57,1.28],[x+Math.sign(p.velocity)*.62,.57,1.28],'white')
  for (const sample of samples) {
    const closed=middlePhysics['physics.induction'](sample.parameters).connected
    b.label(sample.label,[-2.86,closed?.35:.71,.47],sampleTone[sample.label])
  }
  return b
}
