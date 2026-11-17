import type { BenchEngine } from './physics-bench'

export const physicsCaptions: Record<BenchEngine, string> = {
  'physics.circuit': '理想直流电源与定值电阻。电流表等效为导线，电压表并联在被测电阻两端。',
  'physics.joule': '两个纯电阻串联，R₁＝4 Ω。两者通过同一电流，假定通电时阻值保持不变。',
  'physics.household': '纸面电路模型。用 220 V 和铭牌功率估算纯电阻负载，同时开启时的电流相加。',
  'physics.spring-force': '竖直悬挂、钩码静止。g＝10 N/kg，理想弹簧在弹性范围内，劲度系数 k＝100 N/m。',
  'physics.friction': '木块从静止开始。水平拉力向右，摩擦力向左。两种接触面的摩擦系数采用课堂设定值。',
  'physics.solid-pressure': '压力垂直接触面。承压块的宽度随接触面积变化，接触区颜色表示平均压强。',
  'physics.liquid-pressure': '液体静止、密度均匀。g＝10 N/kg，液面气压取 101 kPa，U 形管用水作示液。两装置示意比例不同。',
  'physics.ship-load': '平底船静止漂浮，底面积 100 cm²，空船 40 g，安全吃水 2.5 cm。载荷居中，忽略空气浮力。',
  'physics.lever': '杠杆水平静止，支点在杆上。阻力向下，阻力臂 0.20 m。忽略杆自重与支点摩擦。',
  'physics.pulley': '匀速提升，绳不可伸长且承重段竖直。动滑轮重 10 N，摩擦用绳端等效阻力表示。',
  'physics.water-heating': '0.10 kg 纯水，初温 20 ℃，气压 1 个标准大气压。忽略散热和容器吸热，沸腾后输入能量用于汽化。',
  'physics.specific-heat': '两份液体质量、初温和吸热量相同，初温均为 20 ℃。水的比热容取 4200 J/(kg·℃)，无相变。',
  'physics.mirror': '平面镜截面图。角度从法线量起，虚线是反射光的反向延长线，像与物关于镜面对称。',
  'physics.lens': '理想薄凸透镜的近轴成像。沿主光轴以透镜为原点，右向为正。光屏与实像距离差不超过 0.5 cm 记为对准。',
  'physics.electromagnet': '固定绕向和铁芯。安匝数用来比较励磁强弱，磁场线仅作方向示意。反接电流，磁极对换。',
  'physics.induction': '匀强磁场垂直导轨平面向下，导体在导轨上水平运动。有效长度 0.20 m，闭合时总电阻 2 Ω。',
  'physics.projectile2d': '忽略空气阻力，x 水平向右，y 从地面向上。长度以米计，同次实验中两个坐标轴采用同一比例。',
  'physics.oblique': '忽略空气阻力，x 水平向右，y 从地面向上。发射角以水平向前为零，向上为正，长度以米计。',
  'physics.harmonic': '无阻尼水平弹簧，向右为正，初始位于最大正位移。振幅以米计。',
}
