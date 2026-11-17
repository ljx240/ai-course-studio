import type { Camera, Vec3 } from './buoyancy-space'

const vertex = `
  precision mediump float;
  attribute vec3 a_position;
  attribute vec3 a_normal;
  uniform vec3 u_center, u_size, u_eye, u_right, u_up, u_forward;
  uniform vec2 u_tan;
  uniform mat3 u_basis;
  varying vec3 v_world, v_local, v_normal;
  void main() {
    v_local = a_position;
    v_world = u_basis * (a_position * u_size) + u_center;
    v_normal = u_basis * (a_normal / u_size);
    vec3 relative = v_world - u_eye;
    float d = dot(relative, u_forward);
    gl_Position = vec4(dot(relative, u_right) / u_tan.x,
      dot(relative, u_up) / u_tan.y, 1.004008 * d - 0.1002004, d);
  }
`

const fragment = `
  precision mediump float;
  uniform vec3 u_tone, u_highlight, u_eye;
  uniform float u_alpha, u_mode, u_motion, u_clock;
  varying vec3 v_world, v_local, v_normal;
  void main() {
    vec3 n = normalize(v_normal);
    vec3 eye = normalize(u_eye - v_world);
    vec3 light = normalize(vec3(-0.65, 0.9, 0.55));
    float diffuse = max(0.0, dot(n, light));
    float reflected = pow(max(0.0, dot(n, normalize(light + eye))), 32.0);
    float grazing = pow(1.0 - abs(dot(n, eye)), 3.0);
    vec3 tone = u_tone * (0.49 + 0.58 * diffuse) + reflected * 0.28 * u_highlight;
    float alpha = u_alpha;
    if (u_mode == 1.0) {
      vec2 cells = abs(fract(v_world.xz * 2.0 + 0.5) - 0.5);
      float grid = 1.0 - smoothstep(0.008, 0.024, min(cells.x, cells.y));
      float shadow = exp(-1.75 * dot(v_world.xz * vec2(0.46, 0.63), v_world.xz * vec2(0.46, 0.63)));
      tone = (u_tone + 0.15 * grid * u_highlight) * (1.0 - 0.43 * shadow);
      alpha = 0.96 - 0.75 * smoothstep(1.9, 6.5, length(v_world.xz));
    } else if (u_mode == 2.0) {
      float radius = length(v_world.xz);
      float band = sin(21.0 * radius - 8.0 * u_clock) * exp(-1.35 * radius);
      float ripples = 0.50 + 0.16 * sin(v_world.x * 13.0 + v_world.z * 8.0)
        + 0.10 * cos(v_world.z * 17.0 - v_world.x * 6.0) + u_motion * 0.24 * band;
      tone = mix(u_tone, u_highlight, 0.18 * grazing + 0.26 * ripples);
      alpha = u_alpha + 0.28 * grazing + u_motion * 0.06 * band;
    } else if (u_mode == 3.0) {
      vec3 rim = step(vec3(0.457), abs(v_local));
      float edge = clamp(rim.x + rim.y + rim.z - 1.0, 0.0, 1.0);
      float grain = 0.018 * sin(v_local.y * 650.0 + 3.0 * v_local.x);
      tone = tone * (1.0 + grain) + edge * 0.19 * u_highlight;
    } else if (u_mode == 4.0) {
      tone = mix(u_tone, u_highlight, 0.25 * grazing);
      alpha = u_alpha + 0.15 * grazing;
    } else if (u_mode == 5.0) {
      tone = u_tone;
    } else if (u_mode == 6.0) {
      vec2 p = v_world.xz;
      vec2 grid = abs(fract(p * 2.0 + 0.5) - 0.5);
      float line = 1.0 - smoothstep(0.006, 0.018, min(grid.x, grid.y));
      float contact = exp(-1.5 * dot(p * vec2(0.55, 0.78), p * vec2(0.55, 0.78)));
      float pool = exp(-0.13 * dot(p, p));
      vec2 bounce = (p - vec2(0.0, 1.28)) * vec2(0.78, 2.0);
      float spill = exp(-dot(bounce, bounce)) * smoothstep(1.07, 1.28, p.y);
      tone = u_tone * (0.43 + 0.72 * pool - 0.55 * contact) + 0.08 * line * pool * u_highlight
        + vec3(0.025, 0.13, 0.20) * spill;
      alpha = 0.96 * (1.0 - smoothstep(2.4, 7.0, length(p)));
    } else if (u_mode == 7.0 || u_mode == 8.0) {
      vec3 mirror = reflect(-eye, n);
      float key = mirror.x + 0.43, fill = mirror.z + 0.12;
      float softbox = exp(-42.0 * key * key) * smoothstep(-0.15, 0.72, mirror.y);
      float strip = exp(-65.0 * fill * fill) * max(0.0, mirror.y + 0.26);
      vec3 cool = vec3(0.28, 0.52, 0.91);
      vec3 warm = vec3(1.0, 0.64, 0.30);
      float submerged = u_mode == 8.0 ? 1.0 - smoothstep(-0.024, 0.008, v_world.y) : 0.0;
      vec3 material = mix(u_tone, u_tone * vec3(0.19, 0.55, 0.83) + 0.09 * cool, submerged);
      float grain = 1.0 + 0.025 * sin(186.0 * v_local.y + 9.0 * v_local.z);
      tone = material * (0.24 + 0.54 * diffuse) * grain
        + 0.62 * softbox * u_highlight + 0.24 * strip * warm
        + 0.33 * grazing * cool + reflected * 0.32 * u_highlight;
      if (u_mode == 8.0) {
        float nearSurface = max(0.0, 1.0 - abs(v_world.y) / 0.025);
        tone = mix(tone, 0.67 * u_highlight, nearSurface * 0.64);
      }
    } else if (u_mode == 9.0) {
      vec2 p = v_world.xz;
      float radius = length(p);
      float wash = sin(13.0 * p.x + 8.0 * p.y) + cos(18.0 * p.y - 9.0 * p.x);
      float wave = sin(23.0 * radius - 10.0 * u_clock) * exp(-2.8 * radius) * u_motion;
      vec3 surface = normalize(vec3(0.065 * wash + 0.2 * wave, 1.0, 0.034 * wash - 0.14 * wave));
      float fresnel = pow(1.0 - abs(dot(surface, eye)), 4.0);
      float glint = pow(max(0.0, dot(surface, normalize(eye + vec3(-0.45, 0.55, -0.62)))), 24.0);
      float rim = smoothstep(0.455, 0.5, max(abs(v_local.x), abs(v_local.z)));
      tone = u_tone + (0.25 * fresnel + 0.39 * glint + 0.16 * rim) * u_highlight;
      alpha = u_alpha + 0.26 * fresnel + 0.20 * glint + 0.13 * rim;
    } else if (u_mode == 10.0 || u_mode == 11.0) {
      float edge = smoothstep(0.455, 0.5, max(abs(v_local.y), max(abs(v_local.x), abs(v_local.z))));
      float strip = dot(v_world, vec3(0.43, -0.11, 0.30)) + 0.26;
      float streak = exp(-55.0 * strip * strip);
      float depth = 0.5 - v_local.y;
      float absorption = u_mode == 11.0 ? 0.12 * depth : 0.0;
      tone = mix(u_tone, u_highlight, 0.26 * grazing + 0.15 * streak);
      alpha = u_alpha + absorption + 0.10 * grazing + 0.06 * streak + 0.10 * edge;
    } else if (u_mode == 12.0) {
      vec2 p = v_world.xz;
      float sweep = sin(p.x * 17.0 + sin(p.y * 12.0)) + cos(p.y * 16.0 - sin(p.x * 13.0));
      float gleam = pow(0.5 * abs(sweep), 4.0);
      float falloff = 1.0 - smoothstep(0.26, 0.74, length(v_local.xz));
      tone = mix(u_tone, u_highlight, 0.55);
      alpha = (0.035 + 0.14 * gleam) * falloff;
    } else if (u_mode == 13.0 || u_mode == 14.0) {
      float grain = sin(v_world.x * 94.0 + v_world.z * 77.0) * sin(v_world.y * 113.0 - v_world.z * 93.0);
      if (u_mode == 14.0) grain = sin(v_world.z * 105.0 + 3.1 * sin(v_world.x * 6.0));
      tone = u_tone * (0.44 + 0.59 * diffuse + 0.06 * grain)
        + (0.075 * grazing + 0.085 * reflected) * vec3(0.40, 0.66, 0.96);
    }
    gl_FragColor = vec4(tone, alpha);
  }
`

type Face = { points: [Vec3, Vec3, Vec3, Vec3]; normal: Vec3 }
const faces: Face[] = [
  { points: [[-.5,-.5,.5], [.5,-.5,.5], [.5,.5,.5], [-.5,.5,.5]], normal: [0,0,1] },
  { points: [[.5,-.5,-.5], [-.5,-.5,-.5], [-.5,.5,-.5], [.5,.5,-.5]], normal: [0,0,-1] },
  { points: [[.5,-.5,.5], [.5,-.5,-.5], [.5,.5,-.5], [.5,.5,.5]], normal: [1,0,0] },
  { points: [[-.5,-.5,-.5], [-.5,-.5,.5], [-.5,.5,.5], [-.5,.5,-.5]], normal: [-1,0,0] },
  { points: [[-.5,.5,.5], [.5,.5,.5], [.5,.5,-.5], [-.5,.5,-.5]], normal: [0,1,0] },
  { points: [[-.5,-.5,-.5], [.5,-.5,-.5], [.5,-.5,.5], [-.5,-.5,.5]], normal: [0,-1,0] },
]

function quad(points: Face['points'], normal: Vec3) {
  return [0, 1, 2, 0, 2, 3].flatMap((index) => [...points[index], ...normal])
}

function roundMesh(cone = false) {
  const vertices: number[] = []
  for (let index = 0; index < 24; index++) {
    const a = index * Math.PI / 12
    const b = (index + 1) * Math.PI / 12
    const x = Math.cos(a), z = Math.sin(a), nextX = Math.cos(b), nextZ = Math.sin(b)
    const base: Vec3 = [x / 2, -.5, z / 2]
    const nextBase: Vec3 = [nextX / 2, -.5, nextZ / 2]
    const upper: Vec3 = cone ? [0, .5, 0] : [x / 2, .5, z / 2]
    const nextUpper: Vec3 = cone ? upper : [nextX / 2, .5, nextZ / 2]
    const normal: Vec3 = [x, cone ? .5 : 0, z]
    const nextNormal: Vec3 = [nextX, cone ? .5 : 0, nextZ]
    vertices.push(...base, ...normal, ...nextBase, ...nextNormal, ...upper, ...normal)
    if (!cone) vertices.push(...nextBase, ...nextNormal, ...nextUpper, ...nextNormal, ...upper, ...normal)
    vertices.push(...base, 0,-1,0, ...nextBase, 0,-1,0, 0,-.5,0, 0,-1,0)
    if (!cone) vertices.push(...upper, 0,1,0, ...nextUpper, 0,1,0, 0,.5,0, 0,1,0)
  }
  return vertices
}

const cssColors = {
  floor: '--bench-grid', metal: '--bench-muted', body: '--bench-base', edge: '--bench-border',
  white: '--bench-text', brass: '--bench-warm', warm: '--bench-warm-fill',
  water: '--bench-water', cyan: '--bench-accent', wet: '--buoyancy-wet', seam: '--buoyancy-glass',
  ghost: '--buoyancy-reference', sampleA: '--sample-a', sampleB: '--sample-b',
  red: '--bench-error', green: '--physics-live', board: '--physics-board',
} as const
export type Tone = keyof typeof cssColors


export type MeshKind = 'cube' | 'cylinder' | 'cone' | 'flat' | 'wallZ' | 'wallX' | 'coils' | 'outline' | 'sphere' | 'bevel' | 'spring' | 'ring'
const identity = [1,0,0, 0,1,0, 0,0,1]

function sphereMesh() {
  const vertices: number[] = []
  const point = (row: number, col: number): Vec3 => {
    const theta = Math.PI * row / 12, phi = Math.PI * col / 12
    return [Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)]
  }
  for (let row = 0; row < 12; row++) for (let col = 0; col < 24; col++) {
    const points: Face['points'] = [point(row,col), point(row+1,col), point(row+1,col+1), point(row,col+1)]
    for (const index of [0,1,2,0,2,3]) vertices.push(...points[index].map((n) => n / 2), ...points[index])
  }
  return vertices
}

function bevelMesh() {
  const vertices: number[] = []
  const edge = .5, inset = .425
  const axes = [0, 1, 2]
  const signs = [-1, 1]
  for (const axis of axes) {
    const u = (axis + 1) % 3, v = (axis + 2) % 3
    function point(a: number, b: number, c: number): Vec3 {
      const value: Vec3 = [0, 0, 0]
      value[axis] = a; value[u] = b; value[v] = c
      return value
    }
    for (const side of signs) {
      const p = side * edge
      vertices.push(...quad([point(p, -inset, -inset), point(p, inset, -inset),
        point(p, inset, inset), point(p, -inset, inset)], point(side, 0, 0)))
      for (const other of signs) {
        const a = side * inset, b = other * inset, q = other * edge
        vertices.push(...quad([point(-inset, p, b), point(inset, p, b),
          point(inset, a, q), point(-inset, a, q)], point(0, side, other)))
      }
    }
  }
  for (const x of signs) for (const y of signs) for (const z of signs) {
    const normal: Vec3 = [x, y, z]
    vertices.push(x * edge, y * inset, z * inset, ...normal,
      x * inset, y * edge, z * inset, ...normal, x * inset, y * inset, z * edge, ...normal)
  }
  return vertices
}

function springMesh() {
  const vertices: number[] = []
  const rings = 160, sides = 6
  function vertex(ring: number, side: number) {
    const t = ring / rings, angle = t * Math.PI * 20, turn = side * Math.PI * 2 / sides
    const x = Math.cos(angle), z = Math.sin(angle)
    const radius = .42 + .075 * Math.cos(turn)
    return [x * radius, .5 - t + .018 * Math.sin(turn), z * radius,
      x * Math.cos(turn), Math.sin(turn), z * Math.cos(turn)]
  }
  for (let i = 0; i < rings; i++) for (let side = 0; side < sides; side++) {
    const a = vertex(i, side), b = vertex(i + 1, side)
    const c = vertex(i + 1, side + 1), d = vertex(i, side + 1)
    vertices.push(...a, ...b, ...c, ...a, ...c, ...d)
  }
  return vertices
}

function ringMesh() {
  const vertices: number[] = []
  const sections = 40, sides = 8
  function point(section: number, side: number) {
    const angle = section * 2 * Math.PI / sections
    const turn = side * 2 * Math.PI / sides
    const x = Math.cos(angle), z = Math.sin(angle)
    const radius = .454 + .046 * Math.cos(turn)
    return [x*radius, .046*Math.sin(turn), z*radius, x*Math.cos(turn), Math.sin(turn), z*Math.cos(turn)]
  }
  for (let i=0;i<sections;i++) for (let side=0;side<sides;side++) {
    const a=point(i,side), b=point(i+1,side), c=point(i+1,side+1), d=point(i,side+1)
    vertices.push(...a,...b,...c,...a,...c,...d)
  }
  return vertices
}

export function createBenchRenderer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('webgl', { alpha: true, antialias: true })
  if (!context) return null
  const gl = context

  function shader(type: number, source: string) {
    const result = gl.createShader(type)!
    gl.shaderSource(result, source)
    gl.compileShader(result)
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result) ?? 'Shader compilation failed')
    return result
  }
  const vs = shader(gl.VERTEX_SHADER, vertex)
  const fs = shader(gl.FRAGMENT_SHADER, fragment)
  const program = gl.createProgram()!
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Shader linking failed')
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  gl.useProgram(program)
  const attributes = [gl.getAttribLocation(program, 'a_position'), gl.getAttribLocation(program, 'a_normal')]
  const uniforms = Object.fromEntries(['center','size','eye','right','up','forward','tan','tone','highlight','alpha','mode','motion','clock','basis']
    .map((name) => [name, gl.getUniformLocation(program, 'u_' + name)]))

  const buffers: WebGLBuffer[] = []
  function mesh(values: number[], primitive: number = gl.TRIANGLES) {
    const buffer = gl.createBuffer()!
    buffers.push(buffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW)
    return { buffer, count: values.length / 6, primitive }
  }
  const cube = mesh(faces.flatMap(({ points, normal }) => quad(points, normal)))
  const cylinder = mesh(roundMesh())
  const cone = mesh(roundMesh(true))
  const flat = mesh(quad([[-.5,0,.5], [.5,0,.5], [.5,0,-.5], [-.5,0,-.5]], [0,1,0]))
  const wallZ = mesh(quad([[-.5,-.5,0], [.5,-.5,0], [.5,.5,0], [-.5,.5,0]], [0,0,1]))
  const wallX = mesh(quad([[0,-.5,.5], [0,-.5,-.5], [0,.5,-.5], [0,.5,.5]], [1,0,0]))
  const coils = mesh(Array.from({ length: 193 }, (_, index) => {
    const t = index / 192, angle = t * Math.PI * 20
    return [Math.cos(angle) / 2, .5 - t, Math.sin(angle) / 2, 0, 1, 0]
  }).flat(), gl.LINE_STRIP)
  const outline = mesh([[-.5,0,-.5], [.5,0,-.5], [.5,0,.5], [-.5,0,.5]]
    .flatMap((point) => [...point, 0, 1, 0]), gl.LINE_LOOP)

  const shapes = { cube, cylinder, cone, flat, wallZ, wallX, coils, outline, sphere: mesh(sphereMesh()) }
  const detailGeometry = { bevel: bevelMesh, spring: springMesh, ring: ringMesh }
  const detailMeshes: Partial<Record<keyof typeof detailGeometry, typeof cube>> = {}
  const stream = gl.createBuffer()!
  buffers.push(stream)
  const css = getComputedStyle(canvas)
  const palette = Object.fromEntries(Object.entries(cssColors).map(([key, name]) => {
    const hex = css.getPropertyValue(name).trim()
    return [key, [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)]
  })) as Record<Tone, Vec3>

  function paint(shape: typeof cube, center: Vec3, size: Vec3, color: Tone, alpha: number, mode: number, basis: readonly number[]) {
    gl.bindBuffer(gl.ARRAY_BUFFER, shape.buffer)
    attributes.forEach((attribute, index) => {
      gl.enableVertexAttribArray(attribute)
      gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 24, index * 12)
    })
    gl.uniformMatrix3fv(uniforms.basis, false, basis)
    gl.uniform3fv(uniforms.center, center)
    gl.uniform3fv(uniforms.size, size)
    gl.uniform3fv(uniforms.tone, palette[color])
    gl.uniform1f(uniforms.alpha, alpha)
    gl.uniform1f(uniforms.mode, mode)
    gl.drawArrays(shape.primitive, 0, shape.count)
  }
  function draw(kind: MeshKind, center: Vec3, size: Vec3, color: Tone, alpha = 1, mode = 0, basis: readonly number[] = identity) {
    const shape = kind === 'bevel' || kind === 'spring' || kind === 'ring'
      ? (detailMeshes[kind] ??= mesh(detailGeometry[kind]())) : shapes[kind]
    paint(shape, center, size, color, alpha, mode, basis)
  }

  function path(points: Vec3[], color: Tone, alpha = 1, closed = false) {
    gl.bindBuffer(gl.ARRAY_BUFFER, stream)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points.flatMap((point) => [...point, 0, 1, 0])), gl.STREAM_DRAW)
    paint({ buffer: stream, count: points.length, primitive: closed ? gl.LINE_LOOP : gl.LINE_STRIP },
      [0, 0, 0], [1, 1, 1], color, alpha, 5, identity)
  }

  gl.enable(gl.DEPTH_TEST)
  gl.enable(gl.BLEND)
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  gl.clearColor(0, 0, 0, 0)

  return {
    begin(camera: Camera, motion = false) {
      const dpr = Math.min(window.devicePixelRatio, 2)
      const width = Math.round(canvas.clientWidth * dpr)
      const height = Math.round(canvas.clientHeight * dpr)
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
      for (const name of ['eye', 'right', 'up', 'forward'] as const) gl.uniform3fv(uniforms[name], camera[name])
      gl.uniform2f(uniforms.tan, camera.tanX, camera.tanY)
      gl.uniform3fv(uniforms.highlight, palette.white)
      gl.uniform1f(uniforms.motion, Number(motion))
      gl.uniform1f(uniforms.clock, performance.now() / 1000 % 1000)

    },
    draw, path,
    transparent: (enabled: boolean) => gl.depthMask(!enabled),
    overlay: (enabled: boolean) => enabled ? gl.disable(gl.DEPTH_TEST) : gl.enable(gl.DEPTH_TEST),
    dispose() {
      buffers.forEach((buffer) => gl.deleteBuffer(buffer))
      gl.deleteProgram(program)
    },
  }
}
