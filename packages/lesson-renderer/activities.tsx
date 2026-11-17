import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Button } from '../design-system/ui'
import type { Engine } from '../lesson-schema'
import type { Scene } from '../subject-sdk/scene'

export function speakLocal(text: string, onError: (message: string) => void) {
  const voice = window.speechSynthesis?.getVoices().find((item) => item.localService && item.lang.startsWith('en'))
  if (!voice) {
    onError('当前浏览器未安装本地英语语音。')
    return
  }
  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.onerror = () => onError('当前语音播放失败。')
  onError('')
  speechSynthesis.speak(utterance)
}

export function waterBalance(hydrogen: number, oxygen: number, water: number) {
  return { h: hydrogen * 2, o: oxygen * 2, waterH: water * 2, waterO: water,
    balanced: hydrogen === water && oxygen * 2 === water }
}

function Equation({ scene }: { scene: Scene }) {
  const { interaction } = useSyncExternalStore(scene.subscribe, scene.getSnapshot)
  const hydrogen = Number(interaction.hydrogen ?? 1)
  const oxygen = Number(interaction.oxygen ?? 1)
  const water = Number(interaction.water ?? 1)
  const count = waterBalance(hydrogen, oxygen, water)
  return <>
    <p className="formula">{hydrogen} H₂ + {oxygen} O₂ → {water} H₂O</p>
    <div className="activity-fields">
      {[['hydrogen', '氢气 H₂', hydrogen], ['oxygen', '氧气 O₂', oxygen], ['water', '水 H₂O', water]].map(([key, label, value]) =>
        <label key={key}>{label} 系数 {value}<input type="range" aria-label={String(label) + ' 系数'}
          min="1" max="6" step="1" value={value}
          onChange={(event) => scene.setInteraction(String(key), event.currentTarget.valueAsNumber)} /></label>)}
    </div>
    <table><thead><tr><th>原子</th><th>反应前</th><th>反应后</th></tr></thead><tbody>
      <tr><th>H</th><td>{count.h}</td><td>{count.waterH}</td></tr>
      <tr><th>O</th><td>{count.o}</td><td>{count.waterO}</td></tr>
    </tbody></table>
    <p role="status">{count.balanced ? '已配平，氢和氧的原子数均守恒。' : '调整系数，使两侧各元素的原子数相等。'}</p>
  </>
}

function Dilution({ scene }: { scene: Scene }) {
  const { interaction } = useSyncExternalStore(scene.subscribe, scene.getSnapshot)
  const volume = Number(interaction.volume ?? 0.2)
  const concentration = 0.02 / volume
  return <div className="study-activity">
    <svg className="activity-graphic" viewBox="0 0 260 154" aria-label="定量溶质的稀释示意">
      <path d="M76 19v110q0 9 9 9h90q9 0 9-9V19" className="graph-axis" />
      <rect x="77" y={137 - 104 * volume} width="106" height={104 * volume} className="solution"
        opacity={0.3 + concentration * 3} />
      {[0.2, 0.4, 0.6, 0.8, 1].map((tick) => <g key={tick}>
        <path d={`M176 ${137 - 104 * tick}h8`} className="graph-axis" />
        <text x="193" y={141 - 104 * tick}>{tick.toFixed(1)} L</text>
      </g>)}
    </svg>
    <div><label>溶液体积 {volume.toFixed(2)} L
      <input type="range" min=".1" max="1" step=".05" value={volume} onChange={(event) =>
        scene.setInteraction('volume', event.currentTarget.valueAsNumber)} /></label>
      <p className="formula">c = n / V = {concentration.toFixed(3)} mol/L</p>
      <p className="muted">溶质保持 0.020 mol，调节总体积。液面高度用于示意。</p></div>
  </div>
}

const words = [
  ['menu', '菜单', 'May I see the menu?'],
  ['order', '点餐', 'Are you ready to order?'],
  ['bill', '账单', 'Could we have the bill, please?'],
]

function Vocabulary({ scene }: { scene: Scene }) {
  const { interaction } = useSyncExternalStore(scene.subscribe, scene.getSnapshot)
  const index = Number(interaction.word ?? 0)
  const word = words[index]
  return <div className="study-activity">
    <div className="inset word-card"><strong lang="en">{word[0]}</strong>
      {interaction.reveal === index && <p>{word[1]}</p>}</div>
    <div><p lang="en">{word[2]}</p><div className="actions">
      <Button onClick={() => scene.setInteraction('reveal', index)}>查看词义</Button>
      <Button onClick={() => { scene.setInteraction('word', (index + 1) % words.length); scene.setInteraction('reveal', -1) }}>下一个</Button>
    </div></div>
  </div>
}

function Listening({ scene }: { scene: Scene }) {
  const { interaction } = useSyncExternalStore(scene.subscribe, scene.getSnapshot)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [recordingUrl, setRecordingUrl] = useState('')
  const recorder = useRef<MediaRecorder>(null)
  const objectUrl = useRef('')
  const live = useRef(true)
  const target = 'I’d like a bowl of soup, please.'
  useEffect(() => () => {
    live.current = false
    if (recorder.current?.state === 'recording') recorder.current.stop()
    recorder.current?.stream.getTracks().forEach((track) => track.stop())
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
  }, [])

  async function record() {
    setError('')
    setRequesting(true)
    let stream: MediaStream | undefined
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!live.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const chunks: Blob[] = []
      const media = new MediaRecorder(stream)
      recorder.current = media
      media.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      media.onstop = () => {
        media.stream.getTracks().forEach((track) => track.stop())
        if (!live.current) return
        if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
        objectUrl.current = URL.createObjectURL(new Blob(chunks, { type: media.mimeType }))
        setRecordingUrl(objectUrl.current)
        setRecording(false)
      }
      media.start()
      setRecording(true)
    } catch {
      stream?.getTracks().forEach((track) => track.stop())
      setError('无法使用麦克风。请检查浏览器权限。')
    } finally { if (live.current) setRequesting(false) }
  }

  return <div className="listening">
    <Button icon="play" onClick={() => speakLocal(target, setError)}>播放听力</Button>
    <p>顾客点了什么？</p>
    <div className="actions">
      {['一碗汤', '一杯水', '一份米饭'].map((option, index) => <Button key={option}
        aria-pressed={interaction.answer === index} onClick={() => scene.setInteraction('answer', index)}>{option}</Button>)}
    </div>
    {interaction.answer !== undefined && <p role="status">{interaction.answer === 0 ? '正确。' : '再听一遍，留意 soup。'} <span lang="en">{target}</span></p>}
    {navigator.mediaDevices && 'MediaRecorder' in window && <div className="actions">
      <Button icon="message" disabled={requesting} onClick={() => recording ? recorder.current?.stop() : void record()}>
        {recording ? '停止录音' : '录音跟读'}
      </Button>
      {recordingUrl && <audio src={recordingUrl} controls aria-label="本地跟读录音" />}
    </div>}
    {error && <p role="status">{error}</p>}
  </div>
}

const strokes = {
  山: [['竖', 'M52 19V75'], ['竖折', 'M25 39V76H77'], ['竖', 'M77 36V80']],
  木: [['横', 'M23 38H80'], ['竖', 'M52 18V85'], ['撇', 'M50 42Q41 63 18 77'], ['捺', 'M55 43Q67 66 86 77']],
} as const

function Strokes({ scene }: { scene: Scene }) {
  const { interaction } = useSyncExternalStore(scene.subscribe, scene.getSnapshot)
  const character = interaction.character === '木' ? '木' : '山'
  const count = Number(interaction.stroke ?? 0)
  const paths = strokes[character]
  return <div className="study-activity">
    <svg className="activity-graphic stroke-grid" viewBox="0 0 104 104" aria-label={`${character}字，已显示 ${count} 笔`}>
      <rect x="4" y="4" width="96" height="96" className="geometry-circle" />
      <path d="M52 4v96M4 52h96" className="graph-guide" />
      {paths.slice(0, count).map(([, path], index) =>
        <path d={path} key={path} className={index === count - 1 ? 'stroke-current' : 'stroke-previous'} />)}
    </svg>
    <div><div className="actions">
      {(['山', '木'] as const).map((name) => <Button key={name} aria-pressed={name === character}
        onClick={() => { scene.setInteraction('character', name); scene.setInteraction('stroke', 0) }}>{name}</Button>)}
      <Button disabled={count === paths.length} onClick={() => scene.setInteraction('stroke', count + 1)}>下一笔</Button>
      <Button onClick={() => scene.setInteraction('stroke', 0)}>重写</Button>
    </div>
    <p>{count > 0 ? `第 ${count} 笔：${paths[count - 1][0]}` : '从第一笔开始。'}</p>
    <p className="muted">笔顺依据 GF 0023—2020。</p></div>
  </div>
}

const annotations = [
  ['明月光', '视觉意象', '室内明亮的月光是诗人所见。'],
  ['地上霜', '比喻', '以地面霜色形容月光，点出清冷感。'],
  ['举头、低头', '动作对照', '两次动作联系起看月与思乡。'],
]

function Annotation({ scene }: { scene: Scene }) {
  const { interaction } = useSyncExternalStore(scene.subscribe, scene.getSnapshot)
  const selected = Number(interaction.annotation ?? 0)
  return <div className="study-activity">
    <div className="inset annotation-list">{annotations.map(([text], index) => <button key={text}
      className={selected === index ? 'selected' : ''} aria-pressed={selected === index}
      onClick={() => scene.setInteraction('annotation', index)}>{text}</button>)}</div>
    <div><h3>{annotations[selected][1]}</h3><p>{annotations[selected][2]}</p></div>
  </div>
}

const places = [
  { name: '未央宫遗址', lat: 34.3044, lon: 108.8572, role: '西汉长安城的重要宫殿遗址。' },
  { name: '悬泉置遗址', lat: 40.2647, lon: 95.3294, role: '河西走廊交通网络中的驿站遗址。' },
  { name: '玉门关遗址', lat: 40.3536, lon: 93.8639, role: '敦煌以西的关隘，联系河西走廊与西域。' },
  { name: '高昌故城', lat: 42.8525, lon: 89.5278, role: '吐鲁番盆地的绿洲城址。' },
  { name: '巴拉沙衮城址', lat: 42.7467, lon: 75.2503, role: '楚河河谷中的遗址，今位于吉尔吉斯斯坦。' },
]
const longitude = (value: number) => 56 + (value - 73) * 13
const latitude = (value: number) => 176 - (value - 33) * 12

function HistoryMap({ scene }: { scene: Scene }) {
  const { interaction } = useSyncExternalStore(scene.subscribe, scene.getSnapshot)
  const selected = Number(interaction.place ?? 0)
  const point = places[selected]
  return <>
    <svg className="math-stage" viewBox="0 0 560 210" aria-label="长安至天山廊道部分遗址的经纬度位置">
      {[75, 85, 95, 105].map((value) => <g key={value}>
        <path d={`M${longitude(value)} 22V178`} className="graph-grid" />
        <text x={longitude(value) - 10} y="194">{value}°E</text>
      </g>)}
      {[35, 40, 45].map((value) => <g key={value}>
        <path d={`M55 ${latitude(value)}H531`} className="graph-grid" />
        <text x="17" y={latitude(value) + 4}>{value}°N</text>
      </g>)}
      <polyline points={places.map((place) => `${longitude(place.lon)},${latitude(place.lat)}`).join(' ')} className="graph-guide" />
      {places.map((place, index) => <g key={place.name}>
        <circle cx={longitude(place.lon)} cy={latitude(place.lat)} r={index === selected ? 8 : 4} className="graph-point" />
        <text x={longitude(place.lon)} y={latitude(place.lat) + (index === 1 ? 18 : -12)} textAnchor="middle">{place.name}</text>
      </g>)}
    </svg>
    <div className="actions">{places.map((place, index) => <Button key={place.name} aria-pressed={selected === index}
      onClick={() => scene.setInteraction('place', index)}>{place.name}</Button>)}</div>
    <p>{point.lat.toFixed(2)}°N，{point.lon.toFixed(2)}°E。{point.role}</p>
    <p className="muted">虚线连接选取的遗址。坐标来源：联合国教科文组织世界遗产中心。</p>
  </>
}

const evidence = [
  ['驿站遗址', '道路交通', '驿站可说明人员往来与信息传递所需的交通设施。'],
  ['绿洲城址', '定居与贸易', '绿洲城市与供水设施可用于研究干旱地区的聚落和商旅。'],
  ['石窟遗址', '宗教与艺术', '石窟及其图像为研究宗教传播与艺术交流提供实物资料。'],
]

function Evidence({ scene }: { scene: Scene }) {
  const { interaction } = useSyncExternalStore(scene.subscribe, scene.getSnapshot)
  const index = Number(interaction.evidence ?? 0)
  return <div className="study-activity">
    <div className="annotation-list">{evidence.map(([label], i) => <Button key={label} aria-pressed={i === index}
      onClick={() => scene.setInteraction('evidence', i)}>{label}</Button>)}</div>
    <div className="inset"><h3>{evidence[index][1]}</h3><p>{evidence[index][2]}</p></div>
  </div>
}

const decisions = [
  ['延长开放时间', '覆盖晚间人群，增加值守时长。'],
  ['在周末增加场次', '集中使用现有人员，工作日需求仍需评估。'],
  ['先试行一个月', '收集使用量与投诉，按数据决定后续安排。'],
]
function Decision({ scene }: { scene: Scene }) {
  const { interaction } = useSyncExternalStore(scene.subscribe, scene.getSnapshot)
  const selected = interaction.decision
  return <>
    <p>社区阅览室现有值守人力有限。请选择一个试行方案。</p>
    <div className="actions">{decisions.map(([title], index) => <Button key={title} aria-pressed={index === selected}
      onClick={() => scene.setInteraction('decision', index)}>{title}</Button>)}</div>
    {typeof selected === 'number' && <p className="inset">{decisions[selected][1]} 接下来需听取读者和管理人员的反馈。</p>}
  </>
}

const relations = [
  ['居民', '提出意见并使用公共设施'],
  ['管理方', '负责运营与开放安排'],
  ['公共议题', '在人员和预算约束下协调公共需要'],
]
function Relations({ scene }: { scene: Scene }) {
  const { interaction } = useSyncExternalStore(scene.subscribe, scene.getSnapshot)
  const selected = Number(interaction.relation ?? 0)
  return <>
    <div className="relation-diagram">{relations.map(([title], index) => <Button key={title}
      aria-pressed={selected === index} onClick={() => scene.setInteraction('relation', index)}>{title}</Button>)}</div>
    <p>{relations[selected][1]}。</p>
  </>
}

export function OtherExperiment({ engine, scene }: { engine: Engine; scene: Scene }) {
  switch (engine) {
    case 'chemistry.equation': return <Equation scene={scene} />
    case 'chemistry.dilution': return <Dilution scene={scene} />
    case 'english.vocabulary': return <Vocabulary scene={scene} />
    case 'english.listening': return <Listening scene={scene} />
    case 'chinese.strokes': return <Strokes scene={scene} />
    case 'chinese.annotation': return <Annotation scene={scene} />
    case 'history.map': return <HistoryMap scene={scene} />
    case 'history.evidence': return <Evidence scene={scene} />
    case 'politics.decision': return <Decision scene={scene} />
    case 'politics.relations': return <Relations scene={scene} />
  }
}
