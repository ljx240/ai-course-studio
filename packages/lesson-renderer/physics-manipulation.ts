import { boxHitDistance, type Camera } from './buoyancy-space'
import type { Action, Drag } from './physics-bench'

export function closestControl(camera: Camera, point: [number, number], controls: (Action | Drag)[]) {
  let distance = Infinity
  let selected: Action | Drag | undefined
  for (const control of controls) {
    const hit = boxHitDistance(camera, point, control.point, control.size)
    if (hit < distance) {
      distance = hit
      selected = control
    }
  }
  return selected
}

export function snapParameter(field: { min: number; max: number; step: number }, value: number) {
  const { min, max, step } = field
  const snapped = Number((min + Math.round((value-min)/step)*step).toFixed(6))
  return Math.min(max, Math.max(min, snapped))
}
