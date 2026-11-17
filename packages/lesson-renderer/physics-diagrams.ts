import type { Parameters } from '../subject-sdk'
import { circuitBench, electromagnetBench, householdBench, inductionBench, jouleBench } from './electric-benches'
import { frictionBench, leverBench, liquidPressureBench, pulleyBench, shipBench, solidPressureBench, springBench } from './mechanics-benches'
import { heatingBench, lensBench, mirrorBench, specificHeatBench } from './thermal-optics-benches'
import { motionBench } from './motion-benches'
import type { Bench, BenchEngine, EvidenceSample } from './physics-bench'

const benches: Record<BenchEngine, (p: Parameters, samples: EvidenceSample[], time: number) => Bench> = {
  'physics.circuit': circuitBench,
  'physics.joule': jouleBench,
  'physics.household': householdBench,
  'physics.spring-force': springBench,
  'physics.friction': frictionBench,
  'physics.solid-pressure': solidPressureBench,
  'physics.liquid-pressure': liquidPressureBench,
  'physics.ship-load': shipBench,
  'physics.lever': leverBench,
  'physics.pulley': pulleyBench,
  'physics.water-heating': heatingBench,
  'physics.specific-heat': specificHeatBench,
  'physics.mirror': mirrorBench,
  'physics.lens': lensBench,
  'physics.electromagnet': electromagnetBench,
  'physics.induction': inductionBench,
  'physics.projectile2d': (p, _, time) => motionBench('physics.projectile2d', p, time),
  'physics.oblique': (p, _, time) => motionBench('physics.oblique', p, time),
  'physics.harmonic': (p, _, time) => motionBench('physics.harmonic', p, time),
}

export function makeBench(engine: BenchEngine, parameters: Parameters, samples: EvidenceSample[], time: number) {
  return benches[engine](parameters, samples, time)
}
