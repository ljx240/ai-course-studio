import assert from 'node:assert/strict'
import { harmonic, oblique, rightTriangle, tangent, waterBondAngle, waterGeometry } from '../packages/subject-sdk/models.ts'
import { buoyancyBlock, middlePhysics as models } from '../packages/subject-sdk/middle-physics.ts'
import { blockCenter, buoyancyCamera, coordinateOnAxis, heightAtPointer, hitsBlock, initialOrbit, orbitCamera, project, waterlineOrbit } from '../packages/lesson-renderer/buoyancy-space.ts'

const nearlyEqual = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9)
const launch = oblique({ speed: 10, angle: 45, height: 0, gravity: 10 })
nearlyEqual(launch.range, 10)
nearlyEqual(launch.apex, 2.5)
nearlyEqual(launch.position(launch.duration).y, 0)
nearlyEqual(launch.velocity(launch.duration / 2).y, 0)
assert.equal(oblique({ speed: 10, angle: 0, height: 0, gravity: 10 }).duration, 0)
const horizontal = oblique({ speed: 8, angle: 0, height: 2, gravity: 9.8 })
nearlyEqual(horizontal.range, 8 * Math.sqrt(4 / 9.8))

const oscillator = harmonic({ amplitude: 0.5, mass: 1, stiffness: 4 })
nearlyEqual(oscillator.period, Math.PI)
nearlyEqual(oscillator.displacement(0), 0.5)
nearlyEqual(oscillator.velocity(0), 0)
nearlyEqual(oscillator.displacement(oscillator.period / 2), -0.5)
nearlyEqual(oscillator.force(oscillator.period / 2), 2)

assert.deepEqual(rightTriangle(3, 4), { side: 5, areaA: 9, areaB: 16, areaC: 25 })
for (const angle of [0, 45, 90, 180, 270, 360]) {
  const point = tangent(3, angle)
  nearlyEqual(Math.hypot(point.x, point.y), 3)
  nearlyEqual(point.x * point.dx + point.y * point.dy, 0)
}
for (const angle of [0, 45, 90, 180]) {
  const [a, b] = waterGeometry(angle)
  nearlyEqual(Math.hypot(a.x, a.y, a.z), 1)
  nearlyEqual(Math.hypot(b.x, b.y, b.z), 1)
  nearlyEqual(Math.acos(a.x * b.x + a.y * b.y + a.z * b.z) * 180 / Math.PI, waterBondAngle)
}
const supply = { voltage: 6, r1: 6, r2: 12 }
assert.equal(models['physics.circuit']({ ...supply, parallel: 0, closed: 0 }).total, 0)
const parallel = models['physics.circuit']({ ...supply, parallel: 1, closed: 0 })
assert.equal(parallel.i1, 1)
assert.equal(parallel.i2, 0)
const series = models['physics.circuit']({ ...supply, parallel: 0, closed: 1 })
nearlyEqual(series.u1 + series.u2, 6)
assert.equal(models['physics.household']({ kettle: 1, heater: 1, lamp: 0 }).overloaded, true)
assert.equal(models['physics.joule']({ voltage: 6, resistance: 8, time: 0 }).q2, 0)

assert.equal(models['physics.spring-force']({ mass: 0 }).extension, 0)
assert.equal(models['physics.friction']({ pull: 3, normal: 10, rough: 0 }).net, 0)
assert.equal(models['physics.friction']({ pull: 4, normal: 10, rough: 0 }).sliding, true)
assert.equal(models['physics.solid-pressure']({ force: 300, area: 100 }).pressure, 30000)
assert.equal(models['physics.liquid-pressure']({ depth: 0, density: 1000 }).difference, 0)
nearlyEqual(models['physics.liquid-pressure']({ depth: 0.2, density: 1200 }).difference, 0.24)

const submerged = depth => models['physics.buoyancy']({ depth, density: 1000 })
assert.equal(submerged(-2).floatForce, 0)
assert.equal(submerged(4).floatForce, 1)
assert.equal(submerged(8).floatForce, submerged(20).floatForce)
assert.ok(submerged(20).bottomPressure > submerged(8).bottomPressure)
assert.equal(submerged(20).tension, 3)
const specimenHeight = buoyancyBlock.height / 10
const specimenWidth = Math.sqrt(buoyancyBlock.crossSection) / 10
for (const aspect of [1.69, 1.05]) {
  for (const { yaw, pitch } of [initialOrbit, waterlineOrbit]) {
    const camera = buoyancyCamera(yaw, pitch, aspect)
    for (const point of [[-1.68, 2.24, -.63], [1.72, -2.56, 1.15], [0, -2, 0]]) {
      assert.ok(project(camera, point).every(value => value > 0 && value < 1), 'Apparatus fits the selected view')
    }
    const pointer = project(camera, blockCenter(4, specimenHeight))
    assert.ok(hitsBlock(camera, pointer, 4, specimenHeight, specimenWidth), 'Block is pickable from the selected view')
  }
}
for (const [yaw, pitch, aspect] of [[.51, .25, 1.6], [Math.PI / 2, .66, 1.1], [3.5, .13, 1.6]]) {
  const camera = orbitCamera(yaw, pitch, aspect)
  for (const depth of [-5, 4, 8, 20]) {
    const center = blockCenter(depth, specimenHeight)
    const pointer = project(camera, center)
    assert.ok(hitsBlock(camera, pointer, depth, specimenHeight, specimenWidth))
    nearlyEqual(heightAtPointer(camera, pointer), center[1])
  }
  assert.equal(hitsBlock(camera, [.03, .03], 4, specimenHeight, specimenWidth), false)
  nearlyEqual(coordinateOnAxis(camera, project(camera, [1.3, .6, 0]), [.3,.6,0], [1,0,0]), 1)
  nearlyEqual(coordinateOnAxis(camera, project(camera, [.3,1.1,0]), [.3,.6,0], [0,1,0]), .5)
}
nearlyEqual(models['physics.ship-load']({ cargo: 210, density: 1000 }).draft, 0.025)
nearlyEqual(models['physics.lever']({ load: 60, arm: 0.6, angle: 30 }).drive, 40)
const idealPulley = models['physics.pulley']({ moving: 0, load: 90, height: 0.5, friction: 0 })
assert.equal(idealPulley.useful, idealPulley.input)

const heat = time => models['physics.water-heating']({ time, power: 400 })
assert.equal(heat(84).temperature, 100)
assert.equal(heat(120).temperature, 100)
assert.ok(heat(120).evaporated > heat(84).evaporated)
const equalHeat = models['physics.specific-heat']({ mass: 0.5, heat: 6, capacity: 4200 })
assert.equal(equalHeat.waterRise, equalHeat.otherRise)

assert.equal(models['physics.mirror']({ distance: 30, angle: 0 }).metrics['物像距离'], '60 cm')
const lens = (distance, screen) => models['physics.lens']({ distance, screen, focus: 10 })
assert.equal(lens(10, 15).imageDistance, null)
assert.equal(lens(5, 15).type, '正立虚像')
assert.equal(lens(20, 20).magnification, -1)
assert.equal(lens(30, 15).screenClear, true)
assert.equal(lens(30, 25).screenClear, false)

assert.equal(models['physics.electromagnet']({ turns: 150, current: 0 }).excitation, 0)
assert.equal(models['physics.electromagnet']({ turns: 150, current: -0.5 }).polarity, -1)
const induction = (velocity, closed) => models['physics.induction']({ velocity, closed, field: 0.5 })
assert.equal(induction(0, 1).current, 0)
assert.equal(induction(-2, 1).current, -induction(2, 1).current)
assert.equal(induction(2, 0).current, 0)
assert.equal(induction(2, 0).emf, 0.2)
console.log('PASS: registered physics models, optical and electrical boundaries, heating plateau, math and water geometry')
