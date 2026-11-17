export type Vec3 = [number, number, number]
type Point = readonly [number, number]

export const initialOrbit = { yaw: 0.57, pitch: 0.31 }
export const waterlineOrbit = { yaw: 0.16, pitch: 0.065 }
export const tank = { halfWidth: 1.31, halfDepth: 0.91, bottom: -2.28, rim: 0.45 }

export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const normalize = (a: Vec3): Vec3 => {
  const length = Math.hypot(...a)
  return [a[0] / length, a[1] / length, a[2] / length]
}

export function blockCenter(depth: number, height: number): Vec3 {
  return [0, height / 2 - depth / 10, 0]
}

export function orbitCamera(yaw: number, pitch: number, aspect: number, target: Vec3 = [0, -0.12, 0], radius = 8.25, fit = 1.01) {
  const distance = radius * Math.max(1, fit / aspect)
  const eye: Vec3 = [target[0] + distance * Math.cos(pitch) * Math.sin(yaw),
    target[1] + distance * Math.sin(pitch), target[2] + distance * Math.cos(pitch) * Math.cos(yaw)]
  const forward = normalize(subtract(target, eye))
  const right = normalize(cross(forward, [0, 1, 0]))
  const up = cross(right, forward)
  const tanY = Math.tan(Math.PI * 19 / 180)
  return { eye, forward, right, up, tanX: tanY * aspect, tanY }
}

export type Camera = ReturnType<typeof orbitCamera>

export function buoyancyCamera(yaw: number, pitch: number, aspect: number) {
  return orbitCamera(yaw, pitch, aspect, [-.10, -.34, 0], 9.40)
}

export function project(camera: Camera, world: Vec3): [number, number] {
  const delta = subtract(world, camera.eye)
  const depth = dot(delta, camera.forward)
  return [(1 + dot(delta, camera.right) / (depth * camera.tanX)) / 2,
    (1 - dot(delta, camera.up) / (depth * camera.tanY)) / 2]
}

function rayDirection(camera: Camera, [x, y]: Point): Vec3 {
  const horizontal = (2 * x - 1) * camera.tanX
  const vertical = (1 - 2 * y) * camera.tanY
  return [0, 1, 2].map((axis) => camera.forward[axis] + camera.right[axis] * horizontal + camera.up[axis] * vertical) as Vec3
}

export function hitsBlock(camera: Camera, point: Point, depth: number, height: number, width: number) {
  return boxHitDistance(camera, point, blockCenter(depth, height), [width, height, width]) < Infinity
}

export function boxHitDistance(camera: Camera, point: Point, center: Vec3, size: Vec3) {
  const direction = rayDirection(camera, point)
  const min = center.map((value, axis) => value - size[axis] / 2)
  const max = center.map((value, axis) => value + size[axis] / 2)
  let enter = 0
  let exit = Infinity
  for (let axis = 0; axis < 3; axis++) {
    const origin = camera.eye[axis]
    if (Math.abs(direction[axis]) < 1e-9) {
      if (origin < min[axis] || origin > max[axis]) return Infinity
      continue
    }
    const a = (min[axis] - origin) / direction[axis]
    const b = (max[axis] - origin) / direction[axis]
    enter = Math.max(enter, Math.min(a, b))
    exit = Math.min(exit, Math.max(a, b))
  }
  return enter <= exit ? enter : Infinity
}

export function coordinateOnAxis(camera: Camera, point: Point, origin: Vec3, axis: Vec3) {
  const ray = normalize(rayDirection(camera, point))
  const offset = subtract(camera.eye, origin)
  const along = dot(ray, axis)
  const separation = 1 - along ** 2
  if (separation < 1e-5) return null
  return (dot(offset, axis) - along * dot(offset, ray)) / separation
}

export function heightAtPointer(camera: Camera, point: Point) {
  const ray = rayDirection(camera, point)
  // Intersect the pointer ray with the vertical plane through the suspended block.
  const normal: Vec3 = [camera.forward[0], 0, camera.forward[2]]
  const t = -dot(camera.eye, normal) / dot(ray, normal)
  return camera.eye[1] + t * ray[1]
}
