import { buoyancyBlock, middlePhysics } from '../subject-sdk/middle-physics'
import { createBenchRenderer, type Tone } from './bench-webgl'
import { blockCenter, dot, tank, type Camera, type Vec3 } from './buoyancy-space'

export const specimenHeight = buoyancyBlock.height / 10
export const specimenWidth = Math.sqrt(buoyancyBlock.crossSection) / 10
export type BuoyancyReading = ReturnType<typeof middlePhysics['physics.buoyancy']>
export type DepthMark = { label: 'A' | 'B'; depth: number }

export interface BuoyancyFrame {
  camera: Camera
  depth: number
  reading: BuoyancyReading
  vectors: boolean
  marks: DepthMark[]
  motion: boolean
}

export function forceGeometry(depth: number, reading: BuoyancyReading) {
  const y = blockCenter(depth, specimenHeight)[1]
  const bottom = -depth / 10
  return [
    { key: 'weight', title: '重力', tone: 'brass', force: buoyancyBlock.weight, start: [.59, y, .14] as Vec3, direction: -1 },
    { key: 'tension', title: '拉力', tone: 'white', force: reading.tension, start: [-.58, y + .36, .08] as Vec3, direction: 1 },
    { key: 'float', title: '浮力', tone: 'cyan', force: reading.floatForce,
      start: [.98, bottom + reading.immersed / 20, .10] as Vec3, direction: 1 },
  ] as const
}

export const forceScale = 0.117

export function createBuoyancyRenderer(canvas: HTMLCanvasElement) {
  const renderer = createBenchRenderer(canvas)
  if (!renderer) return null
  const { draw } = renderer
  function metal(center: Vec3, size: Vec3, color: Tone) {
    draw('bevel', center, size, color, 1, 7)
  }
  function rod(x: number, z: number, bottom: number, top: number, width: number, color: Tone) {
    draw('cylinder', [x, (bottom + top) / 2, z], [width, top - bottom, width], color, 1, 7)
  }

  return {
    render({ camera, depth, reading, vectors, marks, motion }: BuoyancyFrame) {
      renderer.begin(camera, motion)
      const { halfWidth: x, halfDepth: z, bottom: floor, rim } = tank
      draw('flat', [0, -2.62, 0], [14, 1, 14], 'floor', 1, 6)
      metal([-.18, -2.46, 0], [3.81, .24, 2.31], 'edge')
      metal([-.18, -2.32, 0], [3.75, .085, 2.24], 'metal')
      metal([0, floor + .012, 0], [2.65, .07, 1.86], 'body')
      for (const foot of [-1, 1]) for (const side of [-1, 1]) {
        rod(-.18 + foot * 1.60, side * .91, -2.60, -2.53, .26, 'body')
        rod(-.18 + foot * 1.67, side * .94, -2.29, -2.25, .09, 'metal')
      }
      draw('cube', [0, -2.43, 1.15], [2.56, .032, .022], 'seam', 1, 5)

      metal([-1.68, -2.22, -.63], [.46, .15, .45], 'edge')
      draw('cube', [-1.68, -.04, -.63], [.23, 4.29, .24], 'metal', 1, 7)
      for (const slot of [-.064, .064]) {
        draw('cube', [-1.68 + slot, -.04, -.508], [.027, 4.24, .006], 'body')
        draw('cube', [-1.562, -.04, -.63 + slot], [.007, 4.24, .025], 'body')
      }
      metal([-.82, 2.14, -.63], [1.91, .16, .24], 'edge')
      metal([-.83, 2.23, -.63], [1.83, .045, .19], 'metal')
      metal([0, 2.14, -.30], [.24, .16, .84], 'edge')
      metal([-1.68, 2.14, -.63], [.35, .29, .32], 'metal')
      draw('cylinder', [-1.68, 2.14, -.43], [.16, .13, .16], 'brass', 1, 7, [1,0,0, 0,0,1, 0,-1,0])

      metal([0, 1.79, -.17], [.55, .79, .10], 'body')
      metal([0, 2.12, .015], [.59, .12, .42], 'metal')
      metal([0, 1.43, .015], [.56, .09, .40], 'edge')
      for (const side of [-1, 1]) rod(side * .254, .14, 1.46, 2.10, .042, 'metal')
      for (let tick = 0; tick <= 5; tick++) {
        draw('cube', [.190, 1.83 - tick * .055, -.108], [tick % 5 === 0 ? .077 : .038, .009, .013], 'white', 1, 5)
      }
      const extension = .27 + reading.tension * .055
      draw('spring', [0, 2.1 - extension / 2, .035], [.245, extension, .245], 'brass', 1, 7)
      metal([.042, 2.1 - extension, .035], [.30, .034, .085], 'brass')
      draw('cube', [.208, 2.1 - extension, .035], [.052, .016, .020], 'brass', 1, 5)
      const bottom = -depth / 10
      const top = bottom + specimenHeight
      rod(0, .035, top, 2.1 - extension, .014, 'white')
      rod(0, .035, top, top + .064, .15, 'metal')
      draw('bevel', [0, bottom + specimenHeight / 2, 0], [specimenWidth, specimenHeight, specimenWidth], 'brass', 1, 8)

      for (const side of [-1, 1]) {
        metal([0, rim, side * z], [x * 2 + .06, .060, .070], 'seam')
        metal([side * x, rim, 0], [.070, .060, z * 2 + .06], 'seam')
        metal([0, floor + .04, side * z], [x * 2 + .06, .096, .070], 'edge')
        metal([side * x, floor + .04, 0], [.070, .096, z * 2 + .06], 'edge')
        for (const front of [-1, 1]) rod(side * x, front * z, floor + .07, rim, .045, 'seam')
      }

      metal([x - .115, -.99, z + .020], [.19, 2.08, .035], 'body')
      for (let cm = 0; cm <= 20; cm++) {
        const major = cm % 4 === 0
        const color = cm === 0 ? 'cyan' : major ? 'white' : 'metal'
        draw('cube', [x - .118, -cm / 10, z + .040], [major ? .141 : .076, .012, .012], color, 1, 5)
      }
      draw('cube', [-x + .10, 0, z + .024], [.18, .018, .04], 'seam', 1, 5)
      for (const mark of marks) {
        const level = -mark.depth / 10
        const color = mark.label === 'A' ? 'sampleA' : 'sampleB'
        draw('outline', [0, level, 0], [.83, 1, .83], color, 1, 5)
        draw('cube', [-x + .10, level, z + .024], [.18, .026, .04], color, 1, 5)
      }

      const waterHeight = -floor
      const glassHeight = rim - floor
      const panels: { shape: 'flat' | 'wallZ' | 'wallX'; center: Vec3; size: Vec3; tone: Tone; alpha: number; mode: number }[] = [
        { shape: 'flat', center: [0, floor + .057, 0], size: [2*x - .14, 1, 2*z - .14], tone: 'cyan', alpha: 1, mode: 12 },
        { shape: 'flat', center: [0, 0, 0], size: [2*x, 1, 2*z], tone: 'wet', alpha: .36, mode: 9 },
        { shape: 'wallZ', center: [0, 1.775, .216], size: [.52, .63, 1], tone: 'seam', alpha: .045, mode: 10 },
      ]
      for (const side of [-1, 1]) {
        panels.push({ shape: 'wallZ', center: [0, floor / 2, side * (z - .016)], size: [2*x, waterHeight, 1], tone: 'wet', alpha: .095, mode: 11 })
        panels.push({ shape: 'wallX', center: [side * (x - .016), floor / 2, 0], size: [1, waterHeight, 2*z], tone: 'wet', alpha: .095, mode: 11 })
        panels.push({ shape: 'wallZ', center: [0, floor + glassHeight / 2, side * z], size: [2*x, glassHeight, 1], tone: 'seam', alpha: .043, mode: 10 })
        panels.push({ shape: 'wallX', center: [side * x, floor + glassHeight / 2, 0], size: [1, glassHeight, 2*z], tone: 'seam', alpha: .043, mode: 10 })
      }
      renderer.transparent(true)
      panels.sort((a, b) => dot(b.center, camera.forward) - dot(a.center, camera.forward))
      for (const panel of panels) draw(panel.shape, panel.center, panel.size, panel.tone, panel.alpha, panel.mode)
      draw('outline', [0, .005, 0], [2*x - .027, 1, 2*z - .027], 'seam', .68, 5)
      renderer.transparent(false)

      if (vectors) {
        renderer.overlay(true)
        for (const arrow of forceGeometry(depth, reading)) {
          if (arrow.force === 0) continue
          const [ax, ay, az] = arrow.start
          const length = arrow.force * forceScale
          const tip = Math.min(.12, length * .42)
          const end = ay + length * arrow.direction
          const shaftEnd = end - tip * arrow.direction
          const width = Math.min(.11, tip)
          draw('cylinder', [ax, (ay + shaftEnd) / 2, az], [.026, Math.abs(shaftEnd - ay), .026], arrow.tone, 1, 5)
          draw('cone', [ax, end - tip * arrow.direction / 2, az], [width, tip * arrow.direction, width], arrow.tone, 1, 5)
        }
        renderer.overlay(false)
      }
    },
    dispose: renderer.dispose,
  }
}
