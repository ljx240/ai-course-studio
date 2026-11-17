import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button, Card, Icon } from '../../../packages/design-system/ui'
import { blockLabels, readLesson, type Block, type Lesson, type Subject } from '../../../packages/lesson-schema'
import { configureScene, type Parameters } from '../../../packages/subject-sdk'
import { actionLabels, type ProposedAction } from '../../../packages/classroom-runtime/actions'
import type { OutlineNode } from '../../../packages/subject-sdk/legacy'
import { draftId, importDocument, request, useTemplate, type Version } from './data'

export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current!.showModal() }, [])
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="dialog-title">
    <header className="section-heading"><h2 id="dialog-title">{title}</h2>
      <Button kind="quiet" onClick={onClose}>关闭</Button></header>
    {children}
  </dialog>
}

export function TextDialog({ label, multiline, submitLabel, initial = '', onSubmit }: {
  label: string; multiline?: boolean; submitLabel: string; initial?: string; onSubmit(text: string): void | Promise<void>
}) {
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <form className="block-form" onSubmit={async (event) => {
    event.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError('')
    try { await onSubmit(text.trimEnd()) }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }}>
    <label>{label}
      {multiline ? <textarea autoFocus required value={text} maxLength={100000}
        onChange={(event) => setText(event.currentTarget.value)} /> :
        <input autoFocus required value={text} maxLength={150} onChange={(event) => setText(event.currentTarget.value)} />}
    </label>
    {error && <p className="error" role="alert">{error}</p>}
    <Button type="submit" kind="primary" disabled={busy || !text.trim()}>{submitLabel}</Button>
  </form>
}

export function ImportForm({ subject, model, onImport }: {
  subject: Subject; model: boolean; onImport(text: string): Promise<void>
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(task: () => Promise<void>) {
    setBusy(true)
    setError('')
    try { await task() }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return <form className="block-form" onSubmit={(event) => {
    event.preventDefault()
    if (text.trim()) void run(() => onImport(text))
  }}>
    <label>大纲文件<input type="file" accept=".md,.txt,.docx,.pdf" disabled={busy} onChange={(event) => {
      const file = event.currentTarget.files?.[0]
      if (file) void run(async () => setText(await importDocument(file)))
    }} /></label>
    <label>粘贴 Markdown 或缩进文本
      <textarea autoFocus required maxLength={100000} value={text} disabled={busy}
        onChange={(event) => setText(event.currentTarget.value)} />
    </label>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="actions">
      <Button type="submit" kind="primary" disabled={busy || !text.trim()}>{busy ? '处理中…' : '解析并导入'}</Button>
      {model && <Button icon="spark" disabled={busy || !text.trim() || text.length > 10_000} onClick={() => void run(async () => {
        const result = await request<{ markdown: string }>('generation/outline', { subject, text })
        setText(result.markdown)
      })}>模型辅助整理</Button>}
    </div>
  </form>
}

export function NewBlockForm({ base, onAdd }: { base: Lesson; onAdd(block: Block): Promise<void> }) {
  const [kind, setKind] = useState<Block['type']>('concept')
  const [busy, setBusy] = useState(false)
  return <form className="block-form" onSubmit={async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title')).trim()
    if (!title) return
    const id = crypto.randomUUID()
    const source = base.blocks.find((block) => block.engine === form.get('engine'))
    const block: Block = { id, title, type: kind }
    if (kind === 'interactive' && source) Object.assign(block, { engine: source.engine, template: source.template })
    if (kind === 'assessment') Object.assign(block, {
      question: String(form.get('question')).trim(),
      options: ['first', 'second'].map((key) => String(form.get(key)).trim()),
      answer: Number(form.get('answer')),
    })
    setBusy(true)
    try { await onAdd(block) }
    finally { setBusy(false) }
  }}>
    <label>类型<select value={kind} onChange={(event) => setKind(event.currentTarget.value as Block['type'])}>
      {Object.entries(blockLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <label>标题<input name="title" maxLength={150} required /></label>
    {kind === 'interactive' && <label>互动模板<select name="engine">
      {base.blocks.filter((block) => block.type === 'interactive').map((block) =>
        <option key={block.engine!} value={block.engine!}>{block.title}</option>)}
    </select></label>}
    {kind === 'assessment' && <>
      <label>题干<input required name="question" /></label>
      <label>选项 1<input required name="first" /></label>
      <label>选项 2<input required name="second" /></label>
      <label>正确选项<select name="answer"><option value="0">1</option><option value="1">2</option></select></label>
    </>}
    <Button type="submit" kind="primary" disabled={busy}>添加内容块</Button>
  </form>
}

interface Job {
  id: string
  status: 'queued' | 'running' | 'review' | 'failed'
  stages: { key: string; label: string; status: 'waiting' | 'running' | 'complete' | 'pending' | 'failed' }[]
  lesson?: unknown
  error?: string
  report?: { passed: string[]; review: string[] }
  published_version?: number
}

function Stages({ job }: { job: Job }) {
  const labels = { waiting: '待执行', running: '进行中', complete: '完成', pending: '待审核', failed: '失败' }
  return <ol className="stage-list" aria-label="生成进度">
    {job.stages.map((stage) => <li key={stage.key}><span>{stage.label}</span><b>{labels[stage.status]}</b></li>)}
  </ol>
}

export function GenerationLog({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job>()
  const [error, setError] = useState('')
  return <Card title="生成记录" icon="spark">
    {!job ? <Button onClick={async () => {
      try { setJob(await request<Job>('generation/jobs/' + jobId)) }
      catch (err) { setError((err as Error).message) }
    }}>查看生成记录</Button> : <>
      <Stages job={job} />
      {job.published_version && <p className="muted">已发布版本 {job.published_version}</p>}
      {job.report && <><h3>{job.published_version ? '复核事项' : '待复核事项'}</h3><ul className="objective-list">
        {job.report.review.map((item) => <li key={item}>{item}</li>)}</ul></>}
    </>}
    {error && <p role="alert" className="error">{error}</p>}
  </Card>
}

export function GenerateForm({ template, node, target, model, block, onResult, onChapter, onBook }: {
  template: Lesson; node?: OutlineNode; target: string; model: boolean
  block?: Lesson['blocks'][number]; onResult(lesson: Lesson): Promise<void>
  onChapter?(items: { node: OutlineNode; lesson: Lesson }[]): Promise<void>
  onBook?(options: object, signal: AbortSignal): Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState(model || block ? 'model' : 'template')
  const [job, setJob] = useState<Job>()
  const [scope, setScope] = useState('lesson')
  const [sectionStatus, setSectionStatus] = useState('')
  const active = useRef<AbortController>(null)
  useEffect(() => () => active.current?.abort(), [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const chapter = String(form.get('chapter')).trim()
    const grade = String(form.get('grade')).trim()
    if ((!chapter && scope === 'lesson') || !grade) return
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setError('')
    setJob(undefined)
    const options = {
      subject: template.subject, grade,
      objectives: String(form.get('objectives') ?? '').split('\n').map((line) => line.trim()).filter(Boolean),
      minutes: Number(form.get('minutes') ?? 40), style: form.get('style') ?? 'explore',
      difficulty: form.get('difficulty') ?? 'standard', detail: form.get('detail') ?? 'standard',
      requirements: form.get('requirements') ?? '', interactive: form.has('interactive'),
      practice: form.has('practice'), tutor: form.has('tutor'), engine: form.get('engine'),
    }

    async function oneLesson(topic: string, lessonId: string) {
      let lesson
      if (mode === 'model') {
        const { id } = await request<{ id: string }>('generation/jobs', {
          ...options, lesson_id: lessonId, chapter: topic,
          current: block ? template : undefined, block_id: block?.id,
        }, controller.signal)
        // A full lesson can make two model requests of up to 600 seconds each.
        const until = Date.now() + 21 * 60_000
        while (!lesson && Date.now() < until) {
          const result = await request<Job>('generation/jobs/' + id, undefined, controller.signal)
          setJob(result)
          if (result.status === 'failed') throw new Error(result.error ?? '模型生成失败')
          if (result.status === 'review') lesson = readLesson(result.lesson)
          else await new Promise((resolve) => setTimeout(resolve, 400))
        }
        if (!lesson) throw new Error('等待生成超时，可重试生成')
      } else {
        lesson = readLesson(useTemplate(template, topic, grade))
      }
      lesson.blocks.filter((block) => block.type === 'interactive').forEach(configureScene)
      return { ...lesson, id: lessonId }
    }

    try {
      if (scope === 'book' && node && onBook) {
        await onBook({ ...options, mode, node_id: node.id }, controller.signal)
      } else if (scope === 'chapter' && node && onChapter) {
        const items: { node: OutlineNode; lesson: Lesson }[] = []
        for (const section of node.children) {
          setSectionStatus(`第 ${items.length + 1} / ${node.children.length} 节：${section.title}`)
          setJob(undefined)
          const lesson = await oneLesson(section.title, draftId(section, template.subject))
          items.push({ node: section, lesson })
        }
        await onChapter(items)
      } else {
        await onResult(await oneLesson(chapter, target))
      }
    } catch (err) {
      if (!controller.signal.aborted) setError((err as Error).message)
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return <form className="block-form" onSubmit={submit}>
    {node?.children.length && onChapter ? <label>生成范围<select value={scope} disabled={busy}
      onChange={(event) => { setScope(event.currentTarget.value); setSectionStatus('') }}>
      <option value="lesson">本节点单节教材</option><option value="chapter">本章各小节</option>
      {onBook && <option value="book">整册后台生成</option>}
    </select></label> : null}
    {scope === 'lesson' && <label>课程主题<input name="chapter" required maxLength={150}
      defaultValue={node?.title ?? template.title} readOnly={!!block} /></label>}
    <label>目标年级<input name="grade" required maxLength={60} defaultValue={template.grade} readOnly={!!block} /></label>
    {!block && <label>生成方式<select value={mode} onChange={(event) => setMode(event.currentTarget.value)}>
      <option value="template">复制教材模板</option>
      {model && <option value="model">真实模型生成</option>}
    </select></label>}
    {block && <p>重生成「{block.title}」</p>}
    {mode === 'model' && <>
      <label>教学风格<select name="style"><option value="explore">探究式</option>
        <option value="classic">讲授式</option><option value="story">情境式</option></select></label>
      {!block && <>
        <label>教学目标（每行一项）<textarea name="objectives" maxLength={1000} /></label>
        <div className="form-grid">
          <label>课时（分钟）<input type="number" name="minutes" min={10} max={120} defaultValue={40} required /></label>
          <label>教材难度<select name="difficulty" defaultValue="standard"><option value="foundation">基础</option>
            <option value="standard">标准</option><option value="advanced">进阶</option></select></label>
          <label>内容详略<select name="detail" defaultValue="standard"><option value="brief">简明</option>
            <option value="standard">标准</option><option value="detailed">详尽</option></select></label>
        </div>
        <label className="review-check"><input type="checkbox" name="interactive" defaultChecked />配置学科实验</label>
        <label>实验类型<select name="engine">
          {template.blocks.filter((item) => item.type === 'interactive').map((item) => <option key={item.engine!}
            value={item.engine!}>{item.title}</option>)}
        </select></label>
        <label className="review-check"><input type="checkbox" name="practice" defaultChecked />生成练习与解析</label>
        <label className="review-check"><input type="checkbox" name="tutor" defaultChecked />设计讲解提示</label>
      </>}
      <label>教学要求<textarea name="requirements" maxLength={2000} /></label>
    </>}
    <p className="muted">{mode === 'model' ? '模型草稿需核对知识、公式与例题。' : '复制本学科模板为可编辑草稿。'}</p>
    {scope === 'book' && <p className="muted">提交后可关闭页面。所选节点下的全部小节完成后，系统会统一保存草稿。</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {sectionStatus && <p role="status">{sectionStatus}</p>}
    {job && <Stages job={job} />}
    <Button type="submit" icon="spark" kind="primary" disabled={busy}>
      {busy ? '正在处理…' : scope === 'book' ? '提交整册任务' : scope === 'chapter' ? '生成各小节草稿' : mode === 'template' ? '复制模板草稿' : '生成教材草稿'}
    </Button>
  </form>
}

export function VersionHistory({ lessonId, latest, onView, onPublish }: {
  lessonId: string; latest?: number; onView(lesson: Lesson): void; onPublish(version: number): void
}) {
  const [versions, setVersions] = useState<Version[]>([])
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    request<{ versions: Version[] }>(`studio/lessons/${lessonId}/versions`, undefined, controller.signal)
      .then((result) => setVersions(result.versions))
      .catch((err: Error) => { if (!controller.signal.aborted) setError(err.message) })
    return () => controller.abort()
  }, [open, lessonId, latest])

  return <Card title="教材版本" icon="clock">
    {!latest ? <p className="muted">保存草稿后可查看版本。</p> : <>
      <div className="actions">
        <Button onClick={() => setOpen(!open)}>{open ? '收起版本' : '查看版本'}</Button>
        <Button kind="primary" onClick={() => onPublish(latest)}>审核并发布</Button>
      </div>
      {open && <ul className="version-list">{versions.map((version) => <li key={version.id}>
        <Button kind="quiet" onClick={async () => {
          try {
            const result = await request<{ lesson: unknown }>(`studio/lessons/${lessonId}/versions/${version.id}`)
            onView(readLesson(result.lesson))
          } catch (err) { setError((err as Error).message) }
        }}>版本 {version.id}</Button>
        <span className="tag">{version.published_at ? '已发布' : '草稿'}</span>
      </li>)}</ul>}
    </>}
    {error && <p role="alert" className="error">{error}</p>}
  </Card>
}

export function ReviewForm({ version, onPublish }: { version: number; onPublish(reviewer: string): Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <form className="block-form" onSubmit={async (event) => {
    event.preventDefault()
    const reviewer = String(new FormData(event.currentTarget).get('reviewer')).trim()
    if (!reviewer) return
    setBusy(true)
    setError('')
    try { await onPublish(reviewer) }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }}>
    <p>发布版本 {version}。发布后可继续创建新草稿。</p>
    <label>审核人<input required name="reviewer" maxLength={80} /></label>
    <label className="review-check"><input type="checkbox" required />我已核对教材内容、公式、例题及引用来源。</label>
    {error && <p role="alert" className="error">{error}</p>}
    <Button type="submit" kind="primary" disabled={busy}>发布教材</Button>
  </form>
}

interface Message {
  question: string
  answer: string
  actions: ProposedAction[]
  actions_omitted: boolean
}

const tutorPrompts = [
  { label: '总结本节', icon: 'note', question: '总结本节教材的关键概念、规律和学习要点。' },
  { label: '解释当前内容', icon: 'message', question: '解释当前教材内容的关键概念。' },
  { label: '梳理易错点', icon: 'info', question: '本节有哪些常见误区？' },
]

export function Tutor({ lesson, topic, model, context, onAction, onQuestion, onConfigure, visible = true }: {
  lesson: Lesson; topic: string; model: boolean; visible?: boolean
  context(): { block_id?: string; scene_id?: string; scene_state: { parameters: Parameters; time: number; playing: boolean } }
  onAction(action: ProposedAction): void; onQuestion(): void; onConfigure(): void
}) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState('')
  const [error, setError] = useState('')
  const log = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const inFlight = useRef<AbortController>(null)
  const busy = pending.length > 0

  useEffect(() => () => inFlight.current?.abort(), [])
  useEffect(() => {
    if (visible && log.current) log.current.scrollTop = log.current.scrollHeight
  }, [messages, pending, visible])

  async function ask(text: string) {
    const prompt = text.trim()
    if (!model || inFlight.current || !prompt) return
    const controller = new AbortController()
    inFlight.current = controller
    setPending(prompt)
    setError('')
    setQuestion('')
    composer.current?.focus({ preventScroll: true })
    onQuestion()
    try {
      const history = messages.slice(-3).map(({ question, answer }) => ({ question, answer }))
      const reply = await request<Omit<Message, 'question'>>('studio/tutor', {
        subject: lesson.subject, lesson_id: lesson.id, question: prompt, ...context(),
        history,
      }, controller.signal)
      setMessages((list) => [...list, { question: prompt, ...reply }])
    } catch (err) {
      if (!controller.signal.aborted) {
        setQuestion(prompt)
        setError((err as Error).message)
      }
    } finally {
      inFlight.current = null
      if (!controller.signal.aborted) setPending('')
    }
  }

  return <Card title="AI 学伴" icon="spark" tone="tutor-card" action={
    <span className="tutor-status" data-configured={model}>{model ? '模型已配置' : '待配置模型'}</span>
  }>
    <p className="tutor-context"><Icon name="book" size={15} /><span>{topic}</span></p>
    {!model ? <Button icon="settings" onClick={onConfigure}>配置模型</Button> : <>
      {messages.length === 0 && !busy && <div className="tutor-prompts" aria-label="快捷提问">
        {tutorPrompts.map(({ label, icon, question: prompt }) => <Button key={label} icon={icon}
          onClick={() => void ask(prompt)}>{label}</Button>)}
      </div>}
      <div className="tutor-log" ref={log} role="log" aria-label="学伴对话"
        tabIndex={messages.length || busy ? 0 : undefined}>
        {messages.map((message, index) => <article key={index} className="tutor-turn">
          <p className="tutor-question">{message.question}</p>
          <div className="tutor-reply" role="group" aria-label="模型回答">
            <p>{message.answer}</p>
            {message.actions_omitted && <p className="tutor-action-note">已略过无效的课堂操作</p>}
          </div>
          {message.actions.length > 0 && <div className="actions tutor-actions">
            {message.actions.map((action, number) => <Button key={number} onClick={() => onAction(action)}>
              {actionLabels[action.type]}
            </Button>)}
          </div>}
        </article>)}
        {busy && <div className="tutor-turn">
          <p className="tutor-question">{pending}</p>
          <p className="tutor-pending" role="status">正在生成回答…</p>
        </div>}
      </div>
      {error && <p role="alert" className="tutor-error"><Icon name="info" size={15} /><span>{error}</span></p>}
      <form className="tutor-form" onSubmit={(event) => { event.preventDefault(); void ask(question) }}>
        <textarea ref={composer} aria-label="向 AI 学伴提问" placeholder={messages.length ? '继续追问…' : '输入你的问题…'}
          rows={2} maxLength={2000} readOnly={busy} value={question}
          onChange={(event) => setQuestion(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void ask(question)
            }
          }} />
        <Button type="submit" kind="primary" icon="send" disabled={busy || !question.trim()} aria-label="发送问题" />
      </form>
    </>}
  </Card>
}

const learningTabs = ['AI 学伴', '互动任务', '学习笔记']

export function LearningPanel({ tutor, lesson, notes, checks, onCheck, onNote }: {
  tutor(visible: boolean): ReactNode
  lesson: Lesson; notes: string[]; checks: number[]; onCheck(index: number): void; onNote(): void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [active, setActive] = useState(0)
  const id = useId()
  const toggleLabel = collapsed ? '展开学习面板' : '折叠学习面板'
  const panels = [
    tutor(!collapsed && active === 0),
    <div className="learning-tasks">{lesson.objectives.map((goal, index) => <label key={goal} className="task">
      <input type="checkbox" checked={checks.includes(index)} onChange={() => onCheck(index)} />{goal}</label>)}</div>,
    <div className="learning-notes">
      <Button icon="plus" onClick={onNote}>添加笔记</Button>
      {notes.length ? <ul className="notes">{notes.map((note, index) => <li key={index}>{note}</li>)}</ul>
        : <p className="muted">暂无笔记</p>}
    </div>,
  ]

  return <div className="learning-panel" data-collapsed={collapsed}>
    <div className="learning-toolbar">
      <div className="learning-tabs" role="tablist" aria-label="学习面板" hidden={collapsed} onKeyDown={(event) => {
        const targets: Record<string, number> = {
          ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: learningTabs.length - 1,
        }
        if (!Object.hasOwn(targets, event.key)) return
        event.preventDefault()
        const next = (targets[event.key] + learningTabs.length) % learningTabs.length
        setActive(next)
        event.currentTarget.querySelectorAll('button')[next].focus()
      }}>
        {learningTabs.map((label, index) => <button type="button" key={label} role="tab"
          id={`${id}-tab-${index}`} aria-controls={`${id}-page-${index}`}
          aria-selected={index === active} tabIndex={index === active ? 0 : -1} onClick={() => setActive(index)}>
          {label}
        </button>)}
      </div>
      <Button className="learning-toggle" kind="quiet" icon="chevron" title={toggleLabel} aria-label={toggleLabel}
        aria-expanded={!collapsed} aria-controls={id} onClick={() => setCollapsed(!collapsed)}>
        {collapsed && <span>{toggleLabel}</span>}
      </Button>
    </div>
    <div className="learning-content" id={id} hidden={collapsed}>
      {panels.map((content, index) => <div key={learningTabs[index]} role="tabpanel"
        className={index === 0 ? 'learning-tutor' : 'learning-detail'}
        id={`${id}-page-${index}`} aria-labelledby={`${id}-tab-${index}`} hidden={index !== active}>
        {content}
      </div>)}
    </div>
  </div>
}
