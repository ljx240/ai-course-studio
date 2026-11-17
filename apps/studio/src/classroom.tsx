import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '../../../packages/design-system/ui'
import { LessonBanner, LessonBlock } from '../../../packages/lesson-renderer'
import type { Block, Lesson } from '../../../packages/lesson-schema'
import type { Scene } from '../../../packages/subject-sdk/scene'
import { isMiddlePhysicsEngine } from '../../../packages/subject-sdk/middle-physics'
import { PhysicsDemonstration } from './physics-demonstration'
import { Quiz } from './pages'

export function narration(lesson: Lesson, block: Block) {
  if (block.type === 'objectives') return lesson.objectives.join('。')
  if (block.type === 'assessment') return block.question ?? block.title
  if (block.steps?.length) return [block.body, ...block.steps.map(({ title, body }) => `${title}。${body}`)]
    .filter(Boolean).join('\n')
  if (block.type === 'formula' && block.explanation) return [block.explanation, block.body].filter(Boolean).join('\n')
  return [block.body ?? block.title, block.formula].filter(Boolean).join('。')
}

export function ClassroomNavigation({ lesson, step, onStep, onBack }: {
  lesson: Lesson; step: Block; onStep(id: string): void; onBack(): void
}) {
  return <>
    <h2 className="side-title">课堂讲解</h2>
    <Button icon="book" onClick={onBack}>返回教材</Button>
    <nav aria-label="讲解步骤" className="block-list">
      {lesson.blocks.map((block) => <button className={`tree-button ${step.id === block.id ? 'selected' : ''}`}
        key={block.id} aria-pressed={step.id === block.id} onClick={() => onStep(block.id)}>{block.title}</button>)}
    </nav>
  </>
}

export function Classroom({ lesson, step, getScene, onStep, interrupted, presentation, onAttempt }: {
  lesson: Lesson; step: Block; getScene(block: Block): Scene
  onStep(id: string): void; interrupted: number
  presentation?: { reference: Lesson; tutor: ReactNode; onBack(): void }
  onAttempt(block: Block, choice: number): void
}) {
  const [playing, setPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const [notice, setNotice] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [projection, setProjection] = useState(false)
  const active = useRef<SpeechSynthesisUtterance>(null)
  const stage = useRef<HTMLElement>(null)
  const index = lesson.blocks.findIndex((block) => block.id === step.id)
  const text = narration(lesson, step)
  const model = presentation && step.engine && isMiddlePhysicsEngine(step.engine) ? step.engine : undefined
  const quiz = presentation && step.type === 'assessment'
  const formula = presentation && lesson.blocks.find((block) => block.type === 'formula')
  const example = presentation && lesson.blocks.find((block) => block.type === 'example')
  const authoredLecture = (step.type === 'formula' && !!step.explanation) || !!step.steps?.length

  useEffect(() => {
    if (interrupted > 0 && active.current && window.speechSynthesis?.speaking) {
      speechSynthesis.pause()
      setPlaying(false)
      setPaused(true)
    }
  }, [interrupted])

  useEffect(() => {
    setPlaying(false)
    setPaused(false)
    setNotice('')
    return () => {
      if (!active.current) return
      active.current.onend = null
      active.current.onerror = null
      window.speechSynthesis?.cancel()
      active.current = null
    }
  }, [step.id])

  useEffect(() => {
    function syncFullscreen() { setFullscreen(document.fullscreenElement === stage.current) }
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => document.removeEventListener('fullscreenchange', syncFullscreen)
  }, [])

  useEffect(() => {
    if (!projection) return
    function exit(event: KeyboardEvent) {
      if (event.key === 'Escape') setProjection(false)
    }
    document.addEventListener('keydown', exit)
    return () => document.removeEventListener('keydown', exit)
  }, [projection])

  function play() {
    setNotice('')
    if (paused) {
      speechSynthesis.resume()
      setPaused(false)
      setPlaying(true)
      return
    }
    const voice = window.speechSynthesis?.getVoices().find((item) => item.localService && item.lang.startsWith('zh'))
    if (!voice) {
      setNotice('当前设备没有本地中文语音，可按屏幕内容继续讲解。')
      return
    }
    const speech = new SpeechSynthesisUtterance(text)
    speech.voice = voice
    speech.rate = 0.9
    active.current = speech
    speech.onend = () => { active.current = null; setPlaying(false); setPaused(false) }
    speech.onerror = () => {
      active.current = null
      setPlaying(false)
      setPaused(false)
      setNotice('本地语音播放失败，可按屏幕内容继续讲解。')
    }
    speechSynthesis.speak(speech)
    setPlaying(true)
  }

  return <section className={`classroom-stage${presentation ? ' classroom-demonstration' : ''}${projection ? ' is-projecting' : ''}`} ref={stage}>
    <LessonBanner lesson={lesson} title={presentation ? lesson.title : `课堂讲解：${lesson.title}`}
      action={<div className="actions">
        {presentation && <Button icon="book" onClick={presentation.onBack}>返回教材</Button>}
        <Button icon="expand" onClick={async () => {
          if (presentation) {
            setProjection(!projection)
            return
          }
          try {
            if (document.fullscreenElement) await document.exitFullscreen()
            else await stage.current!.requestFullscreen()
          } catch { setNotice('当前浏览器无法进入全屏。') }
        }}>{projection || fullscreen ? '退出投影' : presentation ? '投影视图' : '全屏投影'}</Button></div>} />
    {presentation && <nav className="presentation-tabs" aria-label="演示内容">
      {lesson.blocks.filter((block) => block.type === 'interactive').map((block, position, blocks) =>
        <Button key={block.id} kind="quiet" aria-pressed={step.id === block.id} onClick={() => onStep(block.id)}>
          {blocks.length > 1 ? block.title : '互动实验'}
        </Button>)}
      <Button kind="quiet" aria-pressed={step.type !== 'interactive' && step.type !== 'assessment' && step.type !== 'formula' && step.type !== 'example'}
        onClick={() => onStep((lesson.blocks.find((block) => block.type === 'concept') ?? lesson.blocks[0]).id)}>知识讲解</Button>
      {formula && <Button kind="quiet" aria-pressed={step.type === 'formula'} onClick={() => onStep(formula.id)}>公式</Button>}
      {example && <Button kind="quiet" aria-pressed={step.type === 'example'} onClick={() => onStep(example.id)}>例题</Button>}
      {lesson.blocks.find((block) => block.type === 'assessment') && <Button kind="quiet" aria-pressed={step.type === 'assessment'}
        onClick={() => onStep(lesson.blocks.find((block) => block.type === 'assessment')!.id)}>随堂检测</Button>}
    </nav>}
    <div className="classroom-content">
      {!model && <p className="muted">第 {index + 1} 步，共 {lesson.blocks.length} 步</p>}
      {model && presentation
        ? <PhysicsDemonstration key={step.id} reference={presentation.reference} block={step} engine={model} scene={getScene(step)} />
        : quiz ? <Quiz key={step.id} lesson={lesson} block={step} onAttempt={onAttempt} embedded />
          : <LessonBlock block={step} lesson={lesson} getScene={getScene} />}
    </div>
    {!model && !quiz && !authoredLecture && <div className="classroom-caption" aria-live="polite">{text}</div>}
    <div className="actions classroom-controls">
      <Button onClick={() => onStep(lesson.blocks[index - 1].id)} disabled={index === 0}>上一步</Button>
      {playing ? <Button icon="pause" kind="primary" onClick={() => {
        speechSynthesis.pause()
        setPlaying(false)
        setPaused(true)
      }}>暂停讲解</Button> : <Button icon="play" kind="primary" onClick={play}>{paused ? '继续讲解' : '播放讲解'}</Button>}
      <Button onClick={() => onStep(lesson.blocks[index + 1].id)} disabled={index === lesson.blocks.length - 1}>下一步</Button>
    </div>
    {notice && <p role="status">{notice}</p>}
    {presentation && <details className="presentation-tutor"><summary>向学伴提问</summary>{presentation.tutor}</details>}
  </section>
}
