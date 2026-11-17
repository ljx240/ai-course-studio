import type { Parameters } from './index'

const g = 10
const waterCapacity = 4200
const waterMass = 0.1
const waterLatentHeat = 2.26e6
const startTemperature = 20
const degrees = Math.PI / 180
const unit = (value: number, symbol: string, digits = 2) => `${Number(value.toFixed(digits))} ${symbol}`

function circuit({ voltage, r1, r2, parallel, closed }: Parameters) {
  const split = parallel >= 0.5
  const joined = closed >= 0.5
  const i1 = split ? voltage / r1 : joined ? voltage / (r1 + r2) : 0
  const i2 = joined ? (split ? voltage / r2 : i1) : 0
  const total = split ? i1 + i2 : i1
  const u1 = i1 * r1
  const u2 = i2 * r2
  return { split, joined, i1, i2, total, u1, u2, metrics: {
    '总电流': unit(total, 'A', 3), 'I₁': unit(i1, 'A', 3), 'I₂': unit(i2, 'A', 3),
    'U₁': unit(u1, 'V'), 'U₂': unit(u2, 'V'),
  } }
}

function joule({ voltage, resistance, time }: Parameters) {
  const i = voltage / (4 + resistance)
  const q1 = i ** 2 * 4 * time
  const q2 = i ** 2 * resistance * time
  return { q1, q2, metrics: { '串联电流': unit(i, 'A', 3), 'R₁ 产生的热量': unit(q1, 'J'), 'R₂ 产生的热量': unit(q2, 'J') } }
}

function household({ kettle, heater, lamp }: Parameters) {
  const loads = [
    { name: '电热水壶', power: 1500, on: kettle >= 0.5 },
    { name: '电暖器', power: 1000, on: heater >= 0.5 },
    { name: '台灯', power: 60, on: lamp >= 0.5 },
  ]
  const power = loads.reduce((sum, load) => sum + (load.on ? load.power : 0), 0)
  const current = power / 220
  const overloaded = current > 10
  return { loads, current, overloaded, metrics: {
    '总功率': unit(power, 'W', 0), '负载电流': unit(current, 'A'), '10 A 负载上限': overloaded ? '已超过' : '未超过',
  } }
}

function spring({ mass }: Parameters) {
  const weight = mass * g
  const extension = weight / 100
  return { weight, extension, metrics: { '重力': unit(weight, 'N'), '弹簧拉力': unit(weight, 'N'), '伸长量': unit(extension * 100, 'cm') } }
}

function friction({ pull, normal, rough }: Parameters) {
  const staticLimit = (rough >= 0.5 ? 0.45 : 0.30) * normal
  const sliding = pull > staticLimit
  const resistance = sliding ? (rough >= 0.5 ? 0.30 : 0.20) * normal : pull
  const net = pull - resistance
  return { sliding, resistance, net, metrics: {
    '运动状态': sliding ? '开始滑动' : '保持静止',
    '摩擦力': unit(resistance, 'N'), '静摩擦上限': unit(staticLimit, 'N'), '水平合力': unit(net, 'N'),
  } }
}

function solidPressure({ force, area }: Parameters) {
  const pressure = force / (area / 10000)
  return { pressure, metrics: { '受力面积': unit(area / 10000, 'm²', 4), '平均压强': unit(pressure / 1000, 'kPa') } }
}

function liquidPressure({ depth, density }: Parameters) {
  const pressure = density * g * depth
  const difference = pressure / (1000 * g)
  return { pressure, difference, metrics: {
    '液体附加压强': unit(pressure / 1000, 'kPa'),
    '探头处总压强': unit(101 + pressure / 1000, 'kPa'),
    'U 形管液面差': unit(difference * 100, 'cm'),
  } }
}

export const buoyancyBlock = { height: 8, crossSection: 25, weight: 5 }

function buoyancy({ depth, density }: Parameters) {
  const immersed = Math.max(0, Math.min(buoyancyBlock.height, depth))
  const volume = buoyancyBlock.crossSection * immersed
  const floatForce = density * g * volume / 1e6
  const tension = buoyancyBlock.weight - floatForce
  const bottomPressure = density * g * Math.max(0, depth / 100)
  return { immersed, volume, floatForce, tension, bottomPressure, metrics: {
    '排液体积': unit(volume, 'cm³', 1), '浮力': unit(floatForce, 'N'), '测力计读数': unit(tension, 'N'),
    '底面液体压强': unit(bottomPressure / 1000, 'kPa'),
  } }
}

function ship({ cargo, density }: Parameters) {
  const mass = (40 + cargo) / 1000
  const volume = mass / density
  const draft = volume / 0.01
  const maxCargo = density * 0.01 * 0.025 * 1000 - 40
  return { draft, maxCargo, metrics: {
    '排液体积': unit(volume * 1e6, 'cm³', 1), '吃水深度': unit(draft * 100, 'cm'),
    '安全载荷上限': unit(maxCargo, 'g', 1), '水线状态': cargo <= maxCargo ? '未越过安全线' : '已越过安全线',
  } }
}

function lever({ load, arm, angle }: Parameters) {
  const driveArm = arm * Math.sin(angle * degrees)
  const drive = load * 0.2 / driveArm
  return { driveArm, drive, metrics: {
    '动力臂': unit(driveArm, 'm', 3), '平衡所需动力': unit(drive, 'N'), '两侧力矩大小': unit(load * 0.2, 'N·m'),
  } }
}

function pulley({ moving, load, height, friction }: Parameters) {
  const segments = moving >= 0.5 ? 2 : 1
  const distance = segments * height
  const force = (load + (segments === 2 ? 10 : 0)) / segments + friction
  const useful = load * height
  const input = force * distance
  return { segments, distance, force, useful, input, metrics: {
    '绳端拉力': unit(force, 'N'), '绳端位移': unit(distance, 'm'), '有用功': unit(useful, 'J'),
    '总功': unit(input, 'J'), '机械效率': unit(100 * useful / input, '%'),
  } }
}

function waterHeating({ power, time }: Parameters) {
  const boilingTime = waterMass * waterCapacity * (100 - startTemperature) / power
  const temperatureAt = (seconds: number) => Math.min(100, startTemperature + power * seconds / (waterMass * waterCapacity))
  const temperature = temperatureAt(time)
  const evaporated = Math.max(0, (time - boilingTime) * power / waterLatentHeat)
  return { boilingTime, temperature, evaporated, temperatureAt, metrics: {
    '水温': unit(temperature, '℃'), '到达沸点时间': unit(boilingTime, 's'),
    '累计汽化质量': unit(evaporated * 1000, 'g'),
  } }
}

function specificHeat({ mass, heat, capacity }: Parameters) {
  const waterRise = heat * 1000 / (mass * waterCapacity)
  const otherRise = heat * 1000 / (mass * capacity)
  return { waterRise, otherRise, metrics: {
    '水温升': unit(waterRise, '℃'), '对照液体温升': unit(otherRise, '℃'),
    '每份液体吸收热量': unit(heat, 'kJ'),
  } }
}

function mirror({ distance, angle }: Parameters) {
  return { metrics: { '像距': unit(distance, 'cm', 0), '物像距离': unit(distance * 2, 'cm', 0), '反射角': unit(angle, '°', 0) } }
}

function lens({ distance, focus, screen }: Parameters) {
  const imageDistance = distance === focus ? null : distance * focus / (distance - focus)
  const magnification = imageDistance === null ? null : -imageDistance / distance
  const type = imageDistance === null ? '无有限位置的像'
    : imageDistance > 0 ? '倒立实像' : '正立虚像'
  const screenClear = imageDistance !== null && imageDistance > 0 && Math.abs(screen - imageDistance) <= 0.5
  return { imageDistance, magnification, type, screenClear, metrics: {
    '成像': type, '像的位置': imageDistance === null ? '出射光平行'
      : `${imageDistance > 0 ? '透镜右侧' : '物体同侧'} ${unit(Math.abs(imageDistance), 'cm')}`,
    '放大倍数': magnification === null ? '无' : `${Math.abs(magnification).toFixed(2)} 倍`,
    '光屏': screenClear ? '在清晰像附近' : '当前位置无清晰像',
  } }
}

function electromagnet({ turns, current }: Parameters) {
  const excitation = Math.abs(turns * current)
  const polarity = Math.sign(current)
  return { excitation, polarity, metrics: {
    '安匝数大小': unit(excitation, 'A·匝'), '线圈右端': polarity === 0 ? '未励磁' : polarity > 0 ? 'N 极' : 'S 极',
  } }
}

function induction({ velocity, field, closed }: Parameters) {
  const connected = closed >= 0.5
  const emf = field * 0.2 * velocity
  const current = connected ? emf / 2 : 0
  return { connected, emf, current, metrics: {
    '导体速度': unit(velocity, 'm/s'),
    '导体感应电动势': unit(emf, 'V', 3),
    '回路电流': unit(current, 'A', 3),
    '约定电流方向': current === 0 ? '无' : current > 0 ? '逆时针' : '顺时针',
  } }
}

export const middlePhysics = {
  'physics.circuit': circuit,
  'physics.joule': joule,
  'physics.household': household,
  'physics.spring-force': spring,
  'physics.friction': friction,
  'physics.solid-pressure': solidPressure,
  'physics.liquid-pressure': liquidPressure,
  'physics.buoyancy': buoyancy,
  'physics.ship-load': ship,
  'physics.lever': lever,
  'physics.pulley': pulley,
  'physics.water-heating': waterHeating,
  'physics.specific-heat': specificHeat,
  'physics.mirror': mirror,
  'physics.lens': lens,
  'physics.electromagnet': electromagnet,
  'physics.induction': induction,
}

export type MiddlePhysicsEngine = keyof typeof middlePhysics

export type ParameterChoices = Record<string, readonly [string, string]>

export const middlePhysicsChoices: Partial<Record<MiddlePhysicsEngine, ParameterChoices>> = {
  'physics.circuit': { parallel: ['串联', '并联'], closed: ['断开', '闭合'] },
  'physics.household': { kettle: ['关闭', '开启'], heater: ['关闭', '开启'], lamp: ['关闭', '开启'] },
  'physics.friction': { rough: ['较光滑', '较粗糙'] },
  'physics.pulley': { moving: ['定滑轮', '定滑轮＋动滑轮'] },
  'physics.induction': { closed: ['断开', '闭合'] },
}

export function isMiddlePhysicsEngine(engine: string): engine is MiddlePhysicsEngine {
  return Object.hasOwn(middlePhysics, engine)
}
