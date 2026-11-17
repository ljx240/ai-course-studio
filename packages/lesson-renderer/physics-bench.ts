import type { Parameters } from '../subject-sdk'
import type { MiddlePhysicsEngine } from '../subject-sdk/middle-physics'
import type { MeshKind, Tone } from './bench-webgl'
import { cross, normalize, subtract, type Vec3 } from './buoyancy-space'

export type MotionEngine = 'physics.projectile2d' | 'physics.oblique' | 'physics.harmonic'
export type BenchEngine = Exclude<MiddlePhysicsEngine, 'physics.buoyancy'> | MotionEngine
export type EvidenceSample = { label: 'A' | 'B'; parameters: Parameters }
export const sampleTone = { A: 'sampleA', B: 'sampleB' } as const
export const material = { signal: 5, floor: 6, metal: 7, waterSurface: 9, glass: 10, water: 11, caustics: 12, coating: 13, wood: 14 } as const
export const X: Vec3 = [1,0,0], Y: Vec3 = [0,1,0], Z: Vec3 = [0,0,1]
export const radians = (degrees: number) => degrees * Math.PI / 180
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0]+b[0], a[1]+b[1], a[2]+b[2]]
export const scaled = (point: Vec3, scale: number): Vec3 => [point[0]*scale, point[1]*scale, point[2]*scale]
export const mix = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scaled(subtract(b, a), t))

type Object3D = { mesh: MeshKind; center: Vec3; size: Vec3; tone: Tone; alpha: number; mode: number; basis?: number[] }
type Stroke = { points: Vec3[]; tone: Tone; closed: boolean }
type Label = { text: string; point: Vec3; tone: Tone }
type Manipulator = { label: string; point: Vec3; size: Vec3 }
export type Drag = Manipulator & { parameter: string; axis: Vec3; gain: number; velocity?: string }
export type Action = Manipulator & { change: Parameters; symbol: string; pressed?: boolean }

export function createBench({ target = [0,.60,0] as Vec3, distance = 10.2, yaw = .39, pitch = .55,
  deck = [7.45,3.60] as readonly [number, number] } = {}) {
  const solids: Object3D[] = []
  const strokes: Stroke[] = []
  const labels: Label[] = []
  const controls: (Drag | Action)[] = []
  function finish(tone: Tone) {
    return tone === 'metal' || tone === 'brass' || tone === 'edge' || tone === 'seam' ? material.metal : material.coating
  }
  function object(mesh: MeshKind, center: Vec3, size: Vec3, tone: Tone, mode: number = finish(tone), alpha = 1, basis?: number[]) {
    solids.push({ mesh, center, size, tone, alpha, mode, basis })
  }
  function box(center: Vec3, size: Vec3, tone: Tone, mode: number = finish(tone)) {
    object(mode === material.signal ? 'cube' : 'bevel', center, size, tone, mode)
  }
  function segment(a: Vec3, b: Vec3, width: number, tone: Tone, mesh: 'cylinder' | 'cone' = 'cylinder', mode: number = finish(tone)) {
    const delta = subtract(b, a)
    const length = Math.hypot(...delta)
    if (length === 0) return
    const y = normalize(delta)
    const x = normalize(cross(Math.abs(y[1]) > .95 ? Z : Y, y))
    const z = cross(x, y)
    object(mesh, mix(a,b,.5), [width,length,width], tone, mode, 1, [...x,...y,...z])
  }
  function trace(points: Vec3[], tone: Tone, closed = false) {
    strokes.push({ points, tone, closed })
  }
  function wire(points: Vec3[], width: number, tone: Tone, mode?: number) {
    for (let index = 1; index < points.length; index++) segment(points[index-1], points[index], width, tone, 'cylinder', mode)
  }
  function dashed(a: Vec3, b: Vec3, tone: Tone) {
    const count = Math.max(1, Math.ceil(Math.hypot(...subtract(b,a)) / .19))
    for (let index=0;index<count;index++) trace([mix(a,b,index/count), mix(a,b,(index+.55)/count)], tone)
  }
  function arrow(a: Vec3, b: Vec3, tone: Tone, width = .045) {
    const length = Math.hypot(...subtract(b,a))
    if (length === 0) return
    const end = mix(a,b,1-Math.min(.18/length,.42))
    segment(a,end,width,tone,'cylinder',5)
    segment(end,b,width*2.6,tone,'cone',5)
  }
  function label(text: string, point: Vec3, tone: Tone = 'white') {
    labels.push({ text, point, tone })
  }
  function drag(label: string, point: Vec3, size: Vec3, parameter: string, axis: Vec3, gain: number, velocity?: string) {
    controls.push({ label, point, size, parameter, axis: normalize(axis), gain, velocity })
  }
  function action(label: string, point: Vec3, size: Vec3, change: Parameters, symbol: string, pressed?: boolean) {
    controls.push({ label, point, size, change, symbol, pressed })
  }
  object('flat', [0,-.44,0], [19,1,19], 'floor', material.floor)
  const [width, depth] = deck
  box([0,-.23,0],[width,.28,depth],'edge')
  box([0,-.055,0],[width-.09,.11,depth-.09],'metal')
  box([0,.004,0],[width-.42,.020,depth-.41],'body')
  box([0,-.19,depth/2-.01],[width-.99,.024,.025],'seam',material.signal)
  for (const x of [-(width/2-.27),width/2-.27]) for (const z of [-(depth/2-.26),depth/2-.26]) {
    object('cylinder',[x,-.388,z],[.30,.095,.30],'body')
    object('cylinder',[x,.012,z],[.13,.034,.13],'metal')
    box([x,.030,z],[.08,.006,.017],'body',material.signal)
  }
  return { solids, strokes, labels, controls, target, distance, yaw, pitch, object, box, segment, trace, wire, dashed, arrow, label, drag, action }
}

export type Bench = ReturnType<typeof createBench>

export function coil(b: Bench, top: number, length: number, radius: number) {
  b.object('spring', [0,top-length/2,0], [radius*2,length,radius*2], 'brass')
}

export function glassTank(b: Bench, center: Vec3, width: number, depth: number, height: number, water: number) {
  const [x, y, z] = center
  const edgeX = width / 2, edgeZ = depth / 2
  b.box([x,y-.044,z],[width+.12,.11,depth+.12],'edge')
  b.object('flat',[x,y+.016,z],[width-.10,1,depth-.10],'cyan',material.caustics,.1)
  b.object('flat',[x,y+water,z],[width,1,depth],'wet',material.waterSurface,.32)
  b.object('outline',[x,y+water+.006,z],[width-.016,1,depth-.016],'seam',material.signal,.7)
  for (const sign of [-1,1]) {
    b.box([x,y+height,z+sign*edgeZ],[width+.04,.046,.059],'seam')
    b.box([x+sign*edgeX,y+height,z],[.059,.046,depth+.04],'seam')
    b.object('wallZ',[x,y+height/2,z+sign*edgeZ],[width,height,1],'seam',material.glass,.045)
    b.object('wallX',[x+sign*edgeX,y+height/2,z],[1,height,depth],'seam',material.glass,.045)
    b.object('wallZ',[x,y+water/2,z+sign*(edgeZ-.012)],[width,water,1],'wet',material.water,.080)
    b.object('wallX',[x+sign*(edgeX-.012),y+water/2,z],[1,water,depth],'wet',material.water,.080)
    for (const other of [-1,1]) b.segment([x+sign*edgeX,y,z+other*edgeZ],[x+sign*edgeX,y+height,z+other*edgeZ],.037,'seam')
  }
}
