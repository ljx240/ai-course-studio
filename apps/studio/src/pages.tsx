import { useEffect, useEffectEvent, useState, type ReactNode } from 'react'
import { Button, Card, Icon } from '../../../packages/design-system/ui'
import { readLesson, type Block, type Lesson, type Subject } from '../../../packages/lesson-schema'
import { configureScene, engines } from '../../../packages/subject-sdk'
import type { OutlineNode } from '../../../packages/subject-sdk/legacy'
import type { Scene } from '../../../packages/subject-sdk/scene'
import { Goals, LessonBanner, LessonBlock, LessonDocument } from '../../../packages/lesson-renderer'
import { Experiment } from '../../../packages/lesson-renderer/experiments'
import { isMiddlePhysicsEngine, middlePhysicsChoices } from '../../../packages/subject-sdk/middle-physics'
import { MathFields } from './math-fields'
import { exportJson, knowledgeTitle, subjects, type Attempt, type ExperimentRun } from './data'

export function Columns({ left, children, right, presentation = false }: {
  left: ReactNode; children: ReactNode; right?: ReactNode; presentation?: boolean
}) {
  return <div className={presentation ? 'workspace physics-presentation' : 'workspace'}>
    <aside className="panel left-panel">{left}</aside>
    <main className="panel main-panel" id="main-content" tabIndex={-1}>{children}</main>
    {right && <aside className="panel right-panel">{right}</aside>}
  </div>
}

export function SubjectList({ subject, onSubject }: { subject: Subject; onSubject(subject: Subject): void }) {
  return <nav aria-label="切换学科" className="subject-list">
    {subjects.map((item) => <button key={item.id} className={`tree-button ${item.id === subject ? 'selected' : ''}`}
      aria-pressed={item.id === subject} data-subject={item.id} onClick={() => onSubject(item.id)}>
      <span className="subject-symbol" aria-hidden="true">{item.symbol}</span>{item.name}<Icon name="chevron" size={13} />
    </button>)}
  </nav>
}

export function ReaderSide({ lesson, onSubject, attempts, visited }: {
  lesson: Lesson; onSubject(subject: Subject): void; attempts: Attempt[]; visited: string[]
}) {
  const [knowledge, setKnowledge] = useState(false)
  const questions = lesson.blocks.filter((block) => block.type === 'assessment')
  const answered = new Set(attempts.map((attempt) => attempt.block))
  return <>
    <div className="tabs">
      <button aria-pressed={!knowledge} onClick={() => setKnowledge(false)}>教材目录</button>
      <button aria-pressed={knowledge} onClick={() => setKnowledge(true)}>知识要点</button>
    </div>
    {knowledge ? <ul className="objective-list">{lesson.objectives.map((goal) => <li key={goal}>{goal}</li>)}</ul> : <>
      <p className="muted tree-caption">{lesson.grade}</p>
      <details open className="chapter-tree"><summary>{lesson.chapter || lesson.title}</summary>
        <div className="selected tree-lesson">{lesson.number} {lesson.title}</div>
        {lesson.blocks.filter((block) => block.type !== 'objectives').map((block) =>
          <button className="tree-button anchor" key={block.id} onClick={() =>
            document.getElementById('block-' + block.id)?.scrollIntoView({ block: 'start' })}>{block.title}</button>)}
      </details>
    </>}
    <h2 className="side-title bordered">学科</h2>
    <SubjectList subject={lesson.subject} onSubject={onSubject} />
    <div className="side-foot">
      <h2>阅读进度</h2>
      <progress aria-label="阅读进度" value={lesson.blocks.filter((block) => visited.includes(block.id)).length}
        max={lesson.blocks.length} />
      <h2>练习进度</h2>
      <span>{questions.filter((item) => answered.has(item.id)).length} / {questions.length} 题已作答</span>
    </div>
  </>
}

export function Reader({ lesson, getScene, onExpand, onPractice, onVisit, onClassroom, presentation = false }: {
  lesson: Lesson; getScene(block: Block): Scene; onExpand(block: Block): void; onPractice(block: Block): void
  onVisit(ids: string[], active: string): void; onClassroom(): void; presentation?: boolean
}) {
  const report = useEffectEvent(onVisit)
  useEffect(() => {
    const main = document.getElementById('main-content')!
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
      if (visible.length) {
        const active = visible.reduce((first, entry) => first.intersectionRatio >= entry.intersectionRatio ? first : entry)
        report(visible.map((entry) => entry.target.id.slice(6)), active.target.id.slice(6))
      }
    }, { threshold: 0.25 })
    main.querySelectorAll('article section[id]').forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [lesson])

  return <>
    <LessonBanner lesson={lesson} action={<Button icon="play" onClick={onClassroom}>{presentation ? '互动演示' : '课堂讲解'}</Button>} />
    <LessonDocument {...{ lesson, getScene, onExpand, onPractice }} />
  </>
}

function OutlineTree({ nodes, selected, onSelect, query, onRead, onMove }: {
  nodes: OutlineNode[]; selected: string; query: string; onSelect(node: OutlineNode): void
  onRead(node: OutlineNode): void; onMove(from: string, to: string): void
}) {
  const contains = (node: OutlineNode): boolean => node.title.toLocaleLowerCase().includes(query)
    || !!node.knowledgePoints?.some((point) => point.title.toLocaleLowerCase().includes(query))
    || node.children.some(contains)
  return <ul className="outline-tree">
    {nodes.filter(contains).map((node) => <li key={node.id}>
      <div className={`outline-line ${selected === node.id ? 'selected' : ''}`}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes('application/zhijing-node')) event.preventDefault()
        }}
        onDrop={(event) => {
          event.preventDefault()
          const from = event.dataTransfer.getData('application/zhijing-node')
          if (from) onMove(from, node.id)
        }}>
        <button onClick={() => onSelect(node)} aria-pressed={selected === node.id}>
          <Icon name={node.children.length ? 'layers' : 'note'} size={15} />{node.title}
        </button>
        {node.lessonId && <Button kind="quiet" onClick={() => onRead(node)}>进入教材</Button>}
        <span className="drag-handle" title="拖动到目标节点下" draggable
          onDragStart={(event) => event.dataTransfer.setData('application/zhijing-node', node.id)} aria-hidden="true">⠿</span>
      </div>
      {node.children.length > 0 && <OutlineTree nodes={node.children} {...{ selected, onSelect, query, onRead, onMove }} />}
    </li>)}
  </ul>
}

export function Outline({ lesson, nodes, selected, query, onSelect, onRead, onGenerate, onImport, onAdd, onMove, onBooks }: {
  lesson: Lesson; nodes: OutlineNode[]; selected: OutlineNode | undefined; query: string
  onSelect(node: OutlineNode): void; onRead(node: OutlineNode): void
  onGenerate(): void; onImport(): void; onAdd(): void
  onMove(from: string, to: string): void
  onBooks?(): void
}) {
  return <>
    <header className="outline-cover">
      <div className="cover-art"><Icon name="book" size={30} /><strong>{subjects.find((item) => item.id === lesson.subject)!.name}</strong></div>
      <div><h1>{lesson.grade}</h1><p>{lesson.chapter}</p><span className="tag">示范课程</span></div>
    </header>
    <div className="toolbar">
      <Button kind="primary" icon="spark" onClick={onGenerate} disabled={!selected}>生成教材</Button>
      {onBooks && <Button icon="clock" onClick={onBooks}>整册任务</Button>}
      <Button icon="upload" onClick={onImport}>导入大纲</Button>
      <Button icon="plus" onClick={onAdd}>添加章节</Button>
      <Button icon="download" onClick={() => exportJson(nodes, '知境-教学大纲.json')}>导出</Button>
    </div>
    <div className="section-heading"><h2>章节大纲</h2><span className="muted">{query ? `搜索「${query}」` : '选择节点查看详情'}</span></div>
    {nodes.length === 0 && <p className="empty">导入大纲或添加章节。</p>}
    <OutlineTree nodes={nodes} selected={selected?.id ?? ''} {...{ onSelect, query, onRead, onMove }} />
  </>
}

export function OutlineDetail({ lesson, selected, onGenerate, onRead, onRename, onOrder, onAddChild, onDelete, onMove }: {
  lesson: Lesson; selected?: OutlineNode; onGenerate(): void; onRead(node: OutlineNode): void
  onRename(): void; onOrder(delta: number): void; onAddChild(): void; onDelete(): void; onMove(): void
}) {
  if (!selected) return <Card title="节点详情" icon="layers"><p className="muted">从大纲选择章节或知识点。</p></Card>
  return <>
    <Card title="节点详情" icon="layers" tone="tinted">
      <h3>{selected.title}</h3>
      <div className="actions">
        {selected.lessonId && <Button icon="book" onClick={() => onRead(selected)}>进入教材</Button>}
        <Button icon="spark" kind="primary" onClick={onGenerate}>生成草稿</Button>
      </div>
    </Card>
    <Card title="节点编辑" icon="pen">
      <div className="actions">
        <Button onClick={onRename}>重命名</Button><Button onClick={onAddChild}>添加子节点</Button>
        <Button onClick={() => onOrder(-1)}>上移</Button><Button onClick={() => onOrder(1)}>下移</Button>
        <Button onClick={onMove}>移动层级</Button><Button onClick={onDelete}>删除节点</Button>
      </div>
    </Card>
    {!selected.knowledgePoints && selected.lessonId === lesson.id && <Goals lesson={lesson} />}
    {selected.knowledgePoints && <Card title="知识点" icon="note"><ul className="objective-list">
      {selected.knowledgePoints.map((point) => <li key={point.id}>{point.title}</li>)}</ul></Card>}
  </>
}

function EditedBlock({ block, lesson, getScene, onSave }: {
  block: Block; lesson: Lesson; getScene(block: Block): Scene; onSave(block: Block): void
}) {
  const [draft, setDraft] = useState(block)
  return <>
    <form className="block-form" onSubmit={(event) => { event.preventDefault(); onSave(draft) }}>
      <label>内容块标题<input required maxLength={150} value={draft.title}
        onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })} /></label>
      {draft.type === 'assessment' ? <>
        <label>题干<textarea required value={draft.question ?? ''}
          onChange={(event) => setDraft({ ...draft, question: event.currentTarget.value })} /></label>
        {draft.options!.map((option, index) => <label key={index}>选项 {index + 1}
          <input required value={option} onChange={(event) => {
            const options = [...draft.options!]
            options[index] = event.currentTarget.value
            setDraft({ ...draft, options })
          }} /></label>)}
        <label>正确选项<select value={draft.answer ?? 0}
          onChange={(event) => setDraft({ ...draft, answer: Number(event.currentTarget.value) })}>
          {draft.options!.map((_, index) => <option key={index} value={index}>{index + 1}</option>)}
        </select></label>
        <label>解析<textarea value={draft.explanation ?? ''}
          onChange={(event) => setDraft({ ...draft, explanation: event.currentTarget.value })} /></label>
        <label>关联知识点（每行一项）<textarea value={(draft.knowledge_points ?? []).join('\n')}
          onChange={(event) => setDraft({ ...draft, knowledge_points: event.currentTarget.value.split('\n') })} /></label>
      </> : <>
        {draft.type !== 'objectives' && <label>{draft.type === 'formula' ? '适用条件' : '正文'}<textarea maxLength={5000} value={draft.body ?? ''}
          onChange={(event) => setDraft({ ...draft, body: event.currentTarget.value })} /></label>}
        <MathFields draft={draft} onChange={setDraft} />
        {draft.type === 'interactive' && draft.engine && <>
          <p className="muted">互动引擎 {draft.engine}</p>
          {Object.entries(engines[draft.engine].parameters).map(([key, field]) => {
            const value = draft.params?.[key] ?? field.initial
            return <label key={key}>{field.name} {value} {field.unit}
              <input type="range" min={field.min} max={field.max} step={field.step} value={value}
                onChange={(event) => setDraft({ ...draft, params: { ...draft.params, [key]: event.currentTarget.valueAsNumber } })} />
            </label>
          })}
        </>}
      </>}
      <Button type="submit" icon="check" kind="primary">保存修改</Button>
    </form>
    <div className="preview inset">
      <h2>实时预览</h2>
      <LessonBlock block={draft} lesson={lesson} getScene={getScene} />
    </div>
  </>
}

export function EditorSide({ lesson, block, onSelect, onAdd, onMove, onRemove }: {
  lesson: Lesson; block: Block; onSelect(id: string): void; onAdd(): void
  onMove(from: string, to: string): void; onRemove(): void
}) {
  const index = lesson.blocks.findIndex((item) => item.id === block.id)
  return <>
    <h2 className="side-title">内容结构 <Button kind="quiet" icon="plus" onClick={onAdd}>添加</Button></h2>
    <nav aria-label="教材内容块" className="block-list">
      {lesson.blocks.map((item) => <div key={item.id} className="block-row" onDragOver={(event) => {
        if (event.dataTransfer.types.includes('application/zhijing-block')) event.preventDefault()
      }} onDrop={(event) => {
        event.preventDefault()
        const from = event.dataTransfer.getData('application/zhijing-block')
        if (from) onMove(from, item.id)
      }}>
        <button onClick={() => onSelect(item.id)} className={`tree-button ${item.id === block.id ? 'selected' : ''}`}>
          <Icon name={item.type === 'interactive' ? 'flask' : 'note'} size={15} />{item.title}
        </button>
        <span className="drag-handle" title="拖动调整内容块顺序" draggable aria-hidden="true"
          onDragStart={(event) => event.dataTransfer.setData('application/zhijing-block', item.id)}>⠿</span>
      </div>)}
    </nav>
    <div className="actions block-actions">
      <Button disabled={index === 0} onClick={() => onMove(block.id, lesson.blocks[index - 1].id)}>上移</Button>
      <Button disabled={index === lesson.blocks.length - 1} onClick={() => onMove(block.id, lesson.blocks[index + 1].id)}>下移</Button>
      <Button disabled={lesson.blocks.length <= 3} onClick={onRemove}>删除内容块</Button>
    </div>
    <div className="side-foot"><h2>教材版本</h2><span className="tag">{lesson.version}</span></div>
  </>
}

export function Editor({ lesson, block, getScene, onSave }: {
  lesson: Lesson; block: Block; getScene(block: Block): Scene; onSave(block: Block): void
}) {
  const [preview, setPreview] = useState(false)
  return <>
    <LessonBanner lesson={lesson} action={<Button icon="download"
      onClick={() => exportJson(lesson, `知境-${lesson.id}.json`)}>导出 JSON</Button>} />
    <div className="section-heading"><h2>AI 教材创作工作台</h2>
      <div className="tabs"><button aria-pressed={!preview} onClick={() => setPreview(false)}>编辑内容</button>
        <button aria-pressed={preview} onClick={() => setPreview(true)}>教材预览</button></div>
    </div>
    {preview ? <LessonDocument lesson={lesson} getScene={getScene} /> :
      <EditedBlock key={`${lesson.id}/${block.id}/${lesson.version}/${lesson.generation_job ?? ''}`}
        {...{ block, lesson, getScene, onSave }} />}
  </>
}

export function EditorTools({ lesson, onGenerate }: { lesson: Lesson; onGenerate(): void }) {
  const [result, setResult] = useState('')
  return <>
    <Card title="AI 教材助手" icon="spark" tone="tinted">
      <Button icon="spark" onClick={onGenerate}>从大纲生成草稿</Button>
    </Card>
    <Card title="教材校验" icon="check">
      <Button onClick={() => {
        try {
          readLesson(lesson)
          lesson.blocks.filter((block) => block.type === 'interactive').forEach(configureScene)
          setResult('结构和互动配置通过。专业内容需教师复核。')
        } catch (error) {
          setResult((error as Error).message)
        }
      }}>检查结构</Button>
      {result && <p role="status">{result}</p>}
      <p className="muted">当前版本 {lesson.version}</p>
    </Card>
  </>
}

export function LabSide({ lesson, block, onBack, onSelect }: {
  lesson: Lesson; block?: Block; onBack(): void; onSelect(id: string): void
}) {
  return <>
    <h2 className="side-title">实验导航</h2>
    <Button icon="book" onClick={onBack}>返回教材</Button>
    <nav aria-label="本课实验" className="block-list">
      {lesson.blocks.filter((item) => item.type === 'interactive').map((item) =>
        <button className={`tree-button ${block?.id === item.id ? 'selected' : ''}`} key={item.id}
          onClick={() => onSelect(item.id)}>{item.title}</button>)}
    </nav>
    <ul className="objective-list">{lesson.objectives.map((goal) => <li key={goal}>{goal}</li>)}</ul>
    {block?.engine === 'physics.projectile2d' && <div className="inset">
      <h3>模型假设</h3><p>二维理想运动，忽略空气阻力。水平方向速度恒定，竖直方向加速度为 g。</p>
    </div>}
  </>
}

export function Lab({ lesson, block, getScene, onRecord, runs }: {
  lesson: Lesson; block?: Block; getScene(block: Block): Scene; onRecord(block: Block): void; runs: ExperimentRun[]
}) {
  const parameters = block?.engine ? Object.entries(engines[block.engine].parameters) : []
  const choices = block?.engine && isMiddlePhysicsEngine(block.engine) ? middlePhysicsChoices[block.engine] : undefined
  const metricNames = Object.keys(runs.at(-1)?.metrics ?? { '飞行时间': '', '射程': '' })
  return <>
    <LessonBanner lesson={lesson} title={`沉浸式实验：${lesson.title}`} />
    {!block ? <p className="empty">当前教材没有互动实验。</p> : <div className="lab-content">
      <Experiment block={block} scene={getScene(block)} large onRecord={() => onRecord(block)} />
      {block.engine?.startsWith('physics.') && <section className="inset run-log">
        <h2>实验记录</h2>
        {runs.length ? <div className="table-scroll"><table><thead><tr>
          {parameters.map(([key, field]) => <th key={key}>{field.name} {field.unit}</th>)}
          {metricNames.map((name) => <th key={name}>{name}</th>)}
        </tr></thead><tbody>{runs.map((run, index) => <tr key={index}>
          {parameters.map(([key]) => {
            const value = run.parameters[key]
            return <td key={key}>{choices?.[key]?.[Number(value >= 0.5)] ?? value}</td>
          })}
          {metricNames.map((name) => <td key={name}>{(run.metrics ?? {
            '飞行时间': run.flight?.toFixed(2) + ' s', '射程': run.range?.toFixed(2) + ' m',
          })[name]}</td>)}
        </tr>)}</tbody></table></div> : <p className="muted">记录实验后可比较不同参数下的结果。</p>}
      </section>}
    </div>}
  </>
}

export function QuizSide({ lesson, block, onSelect, attempts }: {
  lesson: Lesson; block?: Block; onSelect(id: string): void; attempts: Attempt[]
}) {
  return <><h2 className="side-title">练习目录</h2>
    {lesson.blocks.filter((item) => item.type === 'assessment').map((item, index) =>
      <button key={item.id} className={`tree-button ${item.id === block?.id ? 'selected' : ''}`}
        onClick={() => onSelect(item.id)}><Icon name={attempts.some((a) => a.block === item.id) ? 'check' : 'pen'} />
        {index + 1}. {item.title}</button>)}
  </>
}

export function Quiz({ lesson, block, onAttempt, embedded = false }: {
  lesson: Lesson; block?: Block; onAttempt(block: Block, choice: number): void; embedded?: boolean
}) {
  const [choice, setChoice] = useState<number>()
  const [submitted, setSubmitted] = useState(false)
  return <>
    {!embedded && <LessonBanner lesson={lesson} title={`${lesson.title}  随堂练习`} />}
    {!block ? <p className="empty">当前教材没有可判分练习。</p> : <form className="quiz-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (choice === undefined || submitted) return
        onAttempt(block, choice)
        setSubmitted(true)
      }}>
      <fieldset disabled={submitted}><legend>{block.question}</legend>
        {block.options!.map((option, index) => <label key={index} className={choice === index ? 'selected' : ''}>
          <input type="radio" name="choice" checked={choice === index} onChange={() => setChoice(index)} />{option}
        </label>)}
      </fieldset>
      {!submitted && <Button type="submit" kind="primary" disabled={choice === undefined}>提交答案</Button>}
      {submitted && <div className={`quiz-feedback ${choice === block.answer ? 'success' : ''}`} role="status">
        <h2>{choice === block.answer ? '回答正确' : '回答有误'}</h2>
        <p>正确答案：{block.options![block.answer!]}</p>
        <p>{block.explanation}</p>
        <Button onClick={() => { setChoice(undefined); setSubmitted(false) }}>再练一次</Button>
      </div>}
    </form>}
  </>
}

export function QuizAnalysis({ attempts, lesson }: { attempts: Attempt[]; lesson: Lesson }) {
  const correct = attempts.filter((attempt) => attempt.correct).length
  const points = new Map<string, { correct: number; total: number }>()
  for (const block of lesson.blocks.filter((item) => item.type === 'assessment')) {
    const records = attempts.filter((item) => item.block === block.id)
    for (const id of block.knowledge_points ?? []) {
      const stats = points.get(id) ?? { correct: 0, total: 0 }
      stats.total += records.length
      stats.correct += records.filter((item) => item.correct).length
      points.set(id, stats)
    }
  }
  return <>
    <Card title="个人练习记录" icon="chart" tone="tinted">
      {attempts.length ? <dl className="metrics">
        <div><dt>作答次数</dt><dd>{attempts.length}</dd></div>
        <div><dt>正确次数</dt><dd>{correct}</dd></div>
        <div><dt>作答正确率</dt><dd>{Math.round(100 * correct / attempts.length)}%</dd></div>
      </dl> : <p className="muted">提交后显示本课程的作答数据。</p>}
    </Card>
    {points.size > 0 && <Card title="知识点作答" icon="check"><dl className="metrics">
      {[...points].map(([id, stats]) => <div key={id}>
        <dt>{knowledgeTitle(id)}</dt><dd>{stats.total ? `${stats.correct} / ${stats.total} 正确` : '待作答'}</dd>
      </div>)}
    </dl></Card>}
    <Card title="复习要点" icon="book"><ul className="objective-list">
      {lesson.objectives.map((goal) => <li key={goal}>{goal}</li>)}
    </ul></Card>
  </>
}
