import type { Parameters } from './index'

// x points forward, y is height above the ground, and all lengths are in meters.
export function oblique({ speed, angle, height, gravity }: Parameters) {
  const radians = angle * Math.PI / 180
  const vx = speed * Math.cos(radians)
  const vy = speed * Math.sin(radians)
  const duration = (vy + Math.sqrt(vy * vy + 2 * gravity * height)) / gravity
  return {
    duration, range: vx * duration, apex: height + vy ** 2 / (2 * gravity),
    position(t: number) { return { x: vx * t, y: height + vy * t - 0.5 * gravity * t ** 2 } },
    velocity(t: number) { return { x: vx, y: vy - gravity * t } },
  }
}

// Undamped Hooke-law oscillator, initially at positive maximum displacement.
export function harmonic({ amplitude, mass, stiffness }: Parameters) {
  const omega = Math.sqrt(stiffness / mass)
  const period = 2 * Math.PI / omega
  return {
    period, duration: 2 * period,
    displacement: (t: number) => amplitude * Math.cos(omega * t),
    velocity: (t: number) => -amplitude * omega * Math.sin(omega * t),
    force: (t: number) => -stiffness * amplitude * Math.cos(omega * t),
  }
}

export function rightTriangle(a: number, b: number) {
  return { side: Math.hypot(a, b), areaA: a * a, areaB: b * b, areaC: a * a + b * b }
}

export function tangent(radius: number, angle: number) {
  const radians = angle * Math.PI / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { x: radius * cos, y: radius * sin, dx: -sin, dy: cos }
}

export const waterBondAngle = 104.48

// Coordinates in relative O–H bond lengths. Rotate the fixed geometry about the y axis.
export function waterGeometry(rotation: number) {
  const radians = rotation * Math.PI / 180
  const half = waterBondAngle * Math.PI / 360
  const y = Math.cos(half)
  const x = Math.sin(half)
  return [-x, x].map((horizontal) => ({
    x: horizontal * Math.cos(radians), y, z: -horizontal * Math.sin(radians),
  }))
}
