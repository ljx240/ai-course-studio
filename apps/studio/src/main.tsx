import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Button, Card, Icon } from '../../../packages/design-system/ui'
import '../../../packages/design-system/studio.css'
import { isSubject, readLesson, type Block, type Lesson, type Subject } from '../../../packages/lesson-schema'
import { FormulaLesson, LessonDocument } from '../../../packages/lesson-renderer'
import { configureScene } from '../../../packages/subject-sdk'
import { isMiddlePhysicsEngine } from '../../../packages/subject-sdk/middle-physics'
import { measurements } from '../../../packages/lesson-renderer/scientific'
import { createScene, type Scene } from '../../../packages/subject-sdk/scene'
import type { OutlineNode } from '../../../packages/subject-sdk/legacy'
import { performAction, type ProposedAction } from '../../../packages/classroom-runtime/actions'
import {
  draftId, findNode, lessons, moveNode, nav, parseOutline, readLocal, reorderNode, request, seedOutline,
  transformNode, writeLocal, type LocalData, type View, type Workspace,
} from './data'
import {
  Columns, Editor, EditorSide, EditorTools, Lab, LabSide, Outline, OutlineDetail, Quiz, QuizAnalysis,
  QuizSide, Reader, ReaderSide, SubjectList,
} from './pages'
import { Dialog, GenerateForm, GenerationLog, ImportForm, LearningPanel, NewBlockForm, ReviewForm, TextDialog, Tutor, VersionHistory } from './panels'
import { Classroom, ClassroomNavigation } from './classroom'
import { BookTasks } from './book-tasks'
import { ProviderSettings } from './provider-settings'

function readRoute(): { view: View; subject: Subject; lessonId: string } {
  const [path, candidate, id] = location.hash.replace(/^#\//, '').split('/')
  const view = path === 'classroom' ? 'classroom' : nav.find(([name]) => name === path)?.[0] ?? 'reader'
  const subject = candidate && isSubject(candidate) ? candidate : 'physics'
  return { view, subject, lessonId: id && /^[a-z0-9-]+$/i.test(id) ? id : subject }
}

function App() {
  const [route, setRoute] = useState(readRoute)
  const { view, subject, lessonId } = route
  const [data, setData] = useState(readLocal)
  const currentData = useRef(data)
  const server = useRef<Workspace | null | undefined>(undefined)
  const [serverReady, setServerReady] = useState(false)
  const [versions, setVersions] = useState<Record<string, number>>({})
  const [selection, setSelection] = useState('')
  const [blockId, setBlock] = useState('concept')
  const [experimentId, setExperiment] = useState('')
  const [questionId, setQuestion] = useState('')
  const [activeBlock, setActiveBlock] = useState('')
  const [classroomStep, setClassroomStep] = useState<{ lessonId: string; blockId: string }>()
  const [interrupted, setInterrupted] = useState(0)
  const [highlight, setHighlight] = useState('')
  const [actionContent, setActionContent] = useState<{ title: string; text: string } | { title: string; block: Block }>()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [model, setModel] = useState(false)
  const [modal, setModal] = useState<'import' | 'add' | 'child' | 'rename' | 'move' | 'note' | 'block' | 'generate' | 'regenerate' | 'books' | 'provider' | null>(null)
  const [book, setBook] = useState('')
  const [historic, setHistoric] = useState<Lesson>()
  const [publishing, setPublishing] = useState<number>()
  const scenes = useRef(new Map<string, Scene>())
  const base = lessons.get(subject)!
  const published = view !== 'editor' && view !== 'outline' ? data.published[lessonId] : undefined
  const bundled = lessons.get(lessonId)
  const lesson = published ?? data.drafts[lessonId] ?? (bundled?.subject === subject ? bundled : base)
  const subjectTree = seedOutline.flatMap((school) => {
    const children = school.children.filter((item) => item.subject === subject)
    return children.length ? [{ ...school, children }] : []
  })
  const nodes = data.outlines[subject] ?? subjectTree
  const selected = findNode(nodes, selection || 'lesson-' + subject)
  const target = selected ? draftId(selected, subject) : lesson.id
  const editorBlock = lesson.blocks.find((block) => block.id === blockId) ?? lesson.blocks[0]
  const firstModel = lesson.blocks.find((block) => block.type === 'interactive' && block.engine && isMiddlePhysicsEngine(block.engine))
  const presentation = bundled?.id.startsWith('physics-bj-') && firstModel ? bundled : undefined
  const entryStep = (presentation && firstModel) || lesson.blocks[0]
  const stepId = classroomStep?.lessonId === lesson.id ? classroomStep.blockId : undefined
  const step = lesson.blocks.find((block) => block.id === stepId) ?? entryStep
  const activeScene = view === 'classroom' && step.type === 'interactive' ? step : undefined
  const experiment = lesson.blocks.find((block) => block.type === 'interactive' && block.id === experimentId)
    ?? lesson.blocks.find((block) => block.type === 'interactive')
  const tutorScene = activeScene ?? experiment
  const tutorBlock = view === 'classroom' ? step : view === 'lab' ? tutorScene
    : lesson.blocks.find((block) => block.id === activeBlock)
  const question = lesson.blocks.find((block) => block.type === 'assessment' && block.id === questionId)
    ?? lesson.blocks.find((block) => block.type === 'assessment')
  const attempts = data.attempts.filter((attempt) => attempt.lesson === lesson.id)
  const runs = experiment ? data.runs[`${lesson.id}/${experiment.id}`] ?? [] : []

  useEffect(() => {
    function sync() { setRoute(readRoute()); setStatus('') }
    window.addEventListener('hashchange', sync)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 1500)
    request<{ model_configured: boolean }>('health', undefined, controller.signal)
      .then((health) => setModel(health.model_configured))
      .catch(() => setModel(false))
    refreshWorkspace(controller.signal)
      .catch(() => { server.current = null })
      .finally(() => clearTimeout(timeout))
    return () => { window.removeEventListener('hashchange', sync); controller.abort(); clearTimeout(timeout) }
  }, [])

  useEffect(() => {
    document.getElementById('main-content')?.scrollTo(0, 0)
  }, [view, lesson.id])

  useEffect(() => {
    if (!highlight || view !== 'reader') return
    const section = document.getElementById('block-' + highlight)
    if (!section) return
    section.scrollIntoView({ block: 'start' })
    section.classList.add('highlighted-block')
    const timer = setTimeout(() => {
      section.classList.remove('highlighted-block')
      setHighlight('')
    }, 1800)
    return () => { clearTimeout(timer); section.classList.remove('highlighted-block') }
  }, [highlight, view])

  function go(next: View, nextSubject = subject, id = lessonId) {
    location.hash = `/${next}/${nextSubject}${id === nextSubject ? '' : '/' + id}`
  }

  function changeSubject(next: Subject) {
    setSelection('')
    setQuery('')
    go(view === 'outline' ? view : 'reader', next, next)
  }

  function openNode(node: OutlineNode) {
    if (!node.lessonId) return
    const next = node.subject ?? (isSubject(node.lessonId) ? node.lessonId : subject)
    go('reader', next, node.lessonId)
  }

  function commit(next: LocalData, message?: string) {
    writeLocal(next)
    currentData.current = next
    setData(next)
    if (message) setStatus(message)
  }

  async function refreshWorkspace(signal?: AbortSignal) {
    const workspace = await request<Workspace>('studio/workspace', undefined, signal)
    const drafts = Object.fromEntries(Object.entries(workspace.drafts).map(([id, draft]) => [id, readLesson(draft)]))
    const published = Object.fromEntries(Object.entries(workspace.published).map(([id, draft]) => [id, readLesson(draft)]))
    commit({
      ...currentData.current,
      drafts: { ...currentData.current.drafts, ...drafts },
      outlines: { ...currentData.current.outlines, ...workspace.outlines },
      published: { ...currentData.current.published, ...published },
    })
    server.current = workspace
    setVersions(workspace.versions)
    setServerReady(true)
  }

  async function revise(changes: { nodes?: OutlineNode[]; lesson?: Lesson; lessons?: Lesson[] }, message: string) {
    if (server.current === undefined) throw new Error('教材工作区正在加载')
    if (server.current) {
      const workspace = server.current
      const result = await request<{ revision: number; versions: Record<string, number> }>('studio/revision', {
        subject, revision: workspace.revisions[subject] ?? 0, ...changes,
      })
      workspace.revisions[subject] = result.revision
      setVersions((previous) => ({ ...previous, ...result.versions }))
    }
    const next = currentData.current
    const saved = [...(changes.lesson ? [changes.lesson] : []), ...(changes.lessons ?? [])]
    commit({
      ...next,
      outlines: changes.nodes ? { ...next.outlines, [subject]: changes.nodes } : next.outlines,
      drafts: { ...next.drafts, ...Object.fromEntries(saved.map((lesson) => [lesson.id, lesson])) },
    }, message)
  }

  function getScene(block: Block) {
    const key = `${lesson.id}/${block.id}/${block.engine}/${JSON.stringify(block.params)}`
    let scene = scenes.current.get(key)
    if (!scene) {
      scene = createScene(block)
      scenes.current.set(key, scene)
    }
    return scene
  }

  async function saveLesson(draft: Lesson, message: string) {
    try {
      const valid = readLesson(draft)
      valid.blocks.filter((block) => block.type === 'interactive').forEach(configureScene)
      await revise({ lesson: valid }, message)
      return true
    } catch (error) {
      setStatus((error as Error).message)
      return false
    }
  }

  function saveBlock(block: Block) {
    const points = block.knowledge_points?.map((point) => point.trim()).filter(Boolean)
    const content = points ? { ...block, knowledge_points: points } : block
    const next = { ...lesson, version: '1.0.1-draft',
      blocks: lesson.blocks.map((item) => item.id === block.id ? content : item) }
    saveLesson(next, '内容块已保存')
  }

  async function addBlock(block: Block) {
    if (await saveLesson({ ...lesson, version: '1.0.1-draft', blocks: [...lesson.blocks, block] }, '已添加内容块')) {
      setBlock(block.id)
      setModal(null)
    }
  }

  function moveBlock(from: string, to: string) {
    if (from === to) return
    const source = lesson.blocks.findIndex((item) => item.id === from)
    const target = lesson.blocks.findIndex((item) => item.id === to)
    if (source === -1 || target === -1) return
    const blocks = [...lesson.blocks]
    blocks.splice(target, 0, blocks.splice(source, 1)[0])
    void saveLesson({ ...lesson, version: '1.0.1-draft', blocks }, '内容块顺序已保存')
  }

  function expand(block: Block) {
    setExperiment(block.id)
    go('lab')
  }

  function visit(ids: string[], active: string) {
    setActiveBlock(active)
    const visibleExperiment = lesson.blocks.find((block) => block.id === active && block.type === 'interactive')
    if (visibleExperiment) setExperiment(visibleExperiment.id)
    const next = currentData.current
    const visited = next.visited[lesson.id] ?? []
    const unvisited = ids.filter((id) => !visited.includes(id))
    if (unvisited.length) commit({ ...next, visited: { ...next.visited, [lesson.id]: [...visited, ...unvisited] } })
  }

  function tutorContext() {
    const snapshot = tutorScene ? getScene(tutorScene).getSnapshot() : { parameters: {}, time: 0, playing: false }
    return {
      block_id: tutorBlock?.id,
      scene_id: tutorScene?.id,
      scene_state: { parameters: snapshot.parameters, time: snapshot.time, playing: snapshot.playing },
    }
  }

  function executeTutorAction(action: ProposedAction) {
    try {
      performAction(action, {
        lesson, experiment: tutorScene, getScene,
        highlight(block) { setHighlight(block.id); go('reader') },
        show(title, text) { setActionContent({ title, text }) },
        showFormula(block) { setActionContent({ title: block.title, block }) },
        compare: expand,
      })
    } catch (error) { setStatus((error as Error).message) }
  }

  function addRecord(block: Block) {
    const parameters = getScene(block).getSnapshot().parameters
    const key = `${lesson.id}/${block.id}`
    const metrics = measurements(block.engine!, parameters)
    commit({ ...data, runs: { ...data.runs, [key]: [...runs, { parameters, metrics, date: new Date().toISOString() }] } }, '实验已记录')
  }

  function recordAnswer(block: Block, choice: number) {
    commit({ ...data, attempts: [...data.attempts, {
      lesson: lesson.id, block: block.id, choice, correct: choice === block.answer, date: new Date().toISOString(),
    }] })
  }

  async function importText(text: string) {
    function assign(node: OutlineNode): OutlineNode {
      return { ...node, id: crypto.randomUUID(), subject, children: node.children.map(assign) }
    }
    const imported = parseOutline(text).map(assign)
    if (!imported.length) throw new Error('没有可导入的大纲节点')
    await revise({ nodes: [...nodes, ...imported] }, '大纲已导入')
    setSelection(imported[0].id)
    setModal(null)
    go('outline')
  }

  async function addChapter(title: string, parent?: OutlineNode) {
    const node = { id: crypto.randomUUID(), title: title.trim(), subject, children: [] }
    const next = parent ? transformNode(nodes, parent.id, (item) => ({ ...item, children: [...item.children, node] }))
      : [...nodes, node]
    await revise({ nodes: next }, '节点已添加')
    setSelection(node.id)
    setModal(null)
  }

  async function generated(draft: Lesson) {
    const generated = { ...draft, id: target, subject: selected?.subject ?? subject }
    const linked = selected ? transformNode(nodes, selected.id, (node) => ({ ...node, lessonId: target, subject })) : undefined
    await revise({ lesson: generated, nodes: linked }, '教材草稿已生成')
    setBlock(draft.blocks.find((block) => block.type === 'concept')?.id ?? draft.blocks[0].id)
    setModal(null)
    go('editor', subject, target)
  }

  async function generatedChapter(items: { node: OutlineNode; lesson: Lesson }[]) {
    const linked = items.reduce((tree, entry) => transformNode(tree, entry.node.id, (node) => ({
      ...node, subject, lessonId: entry.lesson.id,
    })), nodes)
    const drafts = items.map((entry) => entry.lesson)
    await revise({ nodes: linked, lessons: drafts }, `已保存 ${drafts.length} 节教材草稿`)
    setBlock(drafts[0].blocks.find((block) => block.type === 'concept')?.id ?? drafts[0].blocks[0].id)
    setModal(null)
    go('editor', subject, drafts[0].id)
  }

  async function queueBook(options: object, signal: AbortSignal) {
    const result = await request<{ id: string }>('generation/books', {
      ...options, revision: server.current?.revisions[subject] ?? 0,
    }, signal)
    setBook(result.id)
    setModal('books')
  }

  function showBooks() {
    setBook('')
    setModal('books')
  }

  async function refreshSavedBook(bookSubject: Subject, revision: number) {
    if ((server.current?.revisions[bookSubject] ?? 0) < revision) await refreshWorkspace()
  }

  async function changeTree(change: () => OutlineNode[], message: string) {
    try { await revise({ nodes: change() }, message) }
    catch (error) { setStatus((error as Error).message) }
  }

  async function publish(reviewer: string) {
    const version = publishing!
    await request(`studio/lessons/${lesson.id}/versions/${version}/publish`, { reviewer, confirmed: true })
    const result = await request<{ lesson: unknown }>(`studio/lessons/${lesson.id}/versions/${version}`)
    const snapshot = readLesson(result.lesson)
    const next = currentData.current
    commit({ ...next, published: { ...next.published, [lesson.id]: snapshot } }, '教材已发布')
    setPublishing(undefined)
  }

  const renderTutor = (visible = true) => <Tutor key={lesson.id} lesson={lesson} topic={tutorBlock?.title ?? lesson.title} model={model} context={tutorContext}
    visible={visible}
    onConfigure={() => setModal('provider')}
    onAction={executeTutorAction} onQuestion={() => {
      if (view === 'classroom') {
        setInterrupted((previous) => previous + 1)
        if (tutorScene) getScene(tutorScene).pause()
      }
    }} />
  const onGenerate = () => setModal('generate')
  const onSubject = changeSubject
  const setStep = (blockId: string) => setClassroomStep({ lessonId: lesson.id, blockId })
  let columns
  switch (view) {
    case 'reader':
      columns = <Columns left={<ReaderSide {...{ lesson, onSubject, attempts }} visited={data.visited[lesson.id] ?? []} />}
        right={<LearningPanel tutor={renderTutor} lesson={lesson} notes={data.notes[lesson.id] ?? []}
          checks={data.checks[lesson.id] ?? []} onNote={() => setModal('note')} onCheck={(index) => {
            const checks = data.checks[lesson.id] ?? []
            const next = checks.includes(index) ? checks.filter((value) => value !== index) : [...checks, index]
            commit({ ...data, checks: { ...data.checks, [lesson.id]: next } })
          }} />}>
        <Reader {...{ lesson, getScene }} presentation={!!presentation} onExpand={expand} onPractice={(block) => { setQuestion(block.id); go('quiz') }}
          onVisit={visit} onClassroom={() => { setStep(entryStep.id); go('classroom') }} />
      </Columns>
      break
    case 'classroom':
      columns = <Columns presentation={!!presentation}
        left={<ClassroomNavigation lesson={lesson} step={step} onStep={setStep} onBack={() => go('reader')} />}
        right={presentation ? undefined : renderTutor()}>
        <Classroom key={lesson.id} {...{ lesson, step, getScene, interrupted }} onStep={setStep} onAttempt={recordAnswer}
          presentation={presentation && { reference: presentation, tutor: renderTutor(), onBack: () => go('reader') }} />
      </Columns>
      break
    case 'outline':
      columns = <Columns left={<><h2 className="side-title">课程中心</h2><SubjectList {...{ subject, onSubject }} /></>}
        right={<OutlineDetail {...{ lesson, selected, onGenerate }} onRead={openNode}
          onRename={() => setModal('rename')} onAddChild={() => setModal('child')}
          onMove={() => setModal('move')}
          onOrder={(delta) => void changeTree(() => reorderNode(nodes, selected!.id, delta), '节点顺序已保存')}
          onDelete={() => {
            if (!window.confirm(`删除「${selected!.title}」及其下级节点？已保存的教材仍可查看。`)) return
            void changeTree(() => transformNode(nodes, selected!.id, () => null), '节点已删除')
          }} />}>
        <Outline {...{ lesson, nodes, selected, query, onGenerate }} onRead={openNode}
          onMove={(from, to) => void changeTree(() => moveNode(nodes, from, to), '节点已移动')}
          onSelect={(node) => setSelection(node.id)} onImport={() => setModal('import')} onAdd={() => setModal('add')}
          onBooks={serverReady ? showBooks : undefined} />
      </Columns>
      break
    case 'editor':
      columns = <Columns left={<EditorSide lesson={lesson} block={editorBlock} onSelect={setBlock}
        onAdd={() => setModal('block')} onMove={moveBlock} onRemove={() => {
          if (!window.confirm(`删除「${editorBlock.title}」？`)) return
          void saveLesson({ ...lesson, version: '1.0.1-draft',
            blocks: lesson.blocks.filter((block) => block.id !== editorBlock.id) }, '内容块已删除')
        }} />}
        right={<><EditorTools {...{ lesson, onGenerate }} />
          {serverReady && <Card title="生成任务" icon="clock"><Button onClick={showBooks}>整册任务</Button></Card>}
          {model && <Card title="内容块重生成" icon="spark">
            <Button onClick={() => setModal('regenerate')}>重生成当前块</Button>
          </Card>}
          {lesson.generation_job && <GenerationLog key={lesson.generation_job} jobId={lesson.generation_job} />}
          {serverReady && <VersionHistory key={`${lesson.id}/${!!data.published[lesson.id]}`} lessonId={lesson.id} latest={versions[lesson.id]}
            onView={setHistoric} onPublish={setPublishing} />}</>}>
        <Editor {...{ lesson, getScene }} block={editorBlock} onSave={saveBlock} />
      </Columns>
      break
    case 'lab':
      columns = <Columns left={<LabSide lesson={lesson} block={experiment} onBack={() => go('reader')} onSelect={setExperiment} />}
        right={<>{renderTutor()}<Card title="实验任务" icon="flask">
          <ol className="objective-list"><li>观察并记录当前结果。</li><li>改变一个参数，再记录一组数据作比较。</li></ol>
        </Card></>}>
        <Lab {...{ lesson, getScene, runs }} block={experiment} onRecord={addRecord} />
      </Columns>
      break
    case 'quiz':
      columns = <Columns left={<QuizSide {...{ lesson, attempts }} block={question} onSelect={setQuestion} />}
        right={<QuizAnalysis {...{ lesson, attempts }} />}>
        <Quiz key={`${lesson.id}/${question?.id}`} lesson={lesson} block={question} onAttempt={recordAnswer} />
      </Columns>
      break
  }

  return <div className={`app view-${view}`} data-subject-theme={subject}>
    <a className="skip-link" href="#main-content" onClick={(event) => {
      event.preventDefault()
      document.getElementById('main-content')?.focus()
    }}>跳至主要内容</a>
    <header className="topbar">
      <a className="brand" href={`#/reader/${subject}`}><Icon name="book" size={22} />
        <strong>知境</strong><span>AI 教材与互动教学平台</span></a>
      <div className="breadcrumb"><span>{lesson.grade}</span><Icon name="chevron" size={13} />
        <span>{lesson.chapter}</span><Icon name="chevron" size={13} /><b>{lesson.number} {lesson.title}</b></div>
      <form className="search" onSubmit={(event) => { event.preventDefault(); go('outline') }}>
        <Icon name="search" size={15} /><input type="search" aria-label="搜索教学大纲" placeholder="搜索章节、知识点"
          value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
      </form>
      <Button icon="settings" className="provider-trigger" aria-label="AI 服务设置" onClick={() => setModal('provider')}>
        <span>AI 服务设置</span>
      </Button>
    </header>
    <nav className="rail" aria-label="主导航">
      {nav.map(([name, icon, label]) => <a key={name} href={`#/${name}/${subject}${lessonId === subject ? '' : '/' + lessonId}`}
        aria-current={view === name ? 'page' : undefined}><Icon name={icon} size={23} />{label}</a>)}
    </nav>
    {columns}
    {status && <div role="status" className="status">{status}<Button kind="quiet" onClick={() => setStatus('')}>关闭</Button></div>}
    {modal === 'provider' && <ProviderSettings onClose={() => setModal(null)} onConfigured={setModel} />}
    {modal === 'import' && <Dialog title="导入教学大纲" onClose={() => setModal(null)}>
      <ImportForm {...{ subject, model }} onImport={importText} /></Dialog>}
    {modal === 'add' && <Dialog title="添加章节" onClose={() => setModal(null)}>
      <TextDialog label="章节名称" submitLabel="添加" onSubmit={addChapter} /></Dialog>}
    {modal === 'child' && <Dialog title="添加子节点" onClose={() => setModal(null)}>
      <TextDialog label="节点名称" submitLabel="添加" onSubmit={(title) => addChapter(title, selected)} /></Dialog>}
    {modal === 'rename' && <Dialog title="重命名节点" onClose={() => setModal(null)}>
      <TextDialog label="节点名称" initial={selected!.title} submitLabel="保存名称" onSubmit={async (title) => {
        await revise({ nodes: transformNode(nodes, selected!.id, (node) => ({ ...node, title: title.trim() })) }, '节点名称已保存')
        setModal(null)
      }} /></Dialog>}
    {modal === 'move' && <Dialog title="移动节点" onClose={() => setModal(null)}>
      <form className="block-form" onSubmit={async (event) => {
        event.preventDefault()
        const target = String(new FormData(event.currentTarget).get('target'))
        await changeTree(() => moveNode(nodes, selected!.id, target), '节点已移动')
        setModal(null)
      }}>
        <label>移动到<select name="target"><option value="">大纲根节点</option>
          {function options(items: OutlineNode[], depth = 0): React.ReactNode[] {
            return items.flatMap((node) => node.id === selected!.id ? [] : [
              <option key={node.id} value={node.id}>{'　'.repeat(depth)}{node.title}</option>,
              ...options(node.children, depth + 1),
            ])
          }(nodes)}
        </select></label>
        <Button type="submit" kind="primary">移动</Button>
      </form></Dialog>}
    {modal === 'note' && <Dialog title="添加学习笔记" onClose={() => setModal(null)}>
      <TextDialog label="笔记内容" multiline submitLabel="保存笔记" onSubmit={(text) => {
        commit({ ...data, notes: { ...data.notes, [lesson.id]: [...(data.notes[lesson.id] ?? []), text] } }, '笔记已保存')
        setModal(null)
      }} /></Dialog>}
    {modal === 'block' && <Dialog title="添加内容块" onClose={() => setModal(null)}>
      <NewBlockForm base={base} onAdd={addBlock} /></Dialog>}
    {modal === 'generate' && <Dialog title="从大纲生成教材" onClose={() => setModal(null)}>
      <GenerateForm template={lessons.get(target) ?? base} node={selected} {...{ model, target }}
        onResult={generated} onChapter={generatedChapter} onBook={serverReady ? queueBook : undefined} /></Dialog>}
    {modal === 'books' && <BookTasks initial={book} onClose={(bookSubject, revision) => {
      setModal(null)
      if (bookSubject && revision !== undefined) {
        void refreshSavedBook(bookSubject, revision).catch((error: Error) => setStatus(error.message))
      }
    }} onOpen={async (bookSubject, id, revision) => {
      await refreshSavedBook(bookSubject, revision)
      setBlock('concept')
      setModal(null)
      go('editor', bookSubject, id)
    }} />}
    {modal === 'regenerate' && <Dialog title="重生成教材内容块" onClose={() => setModal(null)}>
      <GenerateForm template={lesson} block={editorBlock} target={lesson.id} {...{ model }} onResult={async (draft) => {
        await revise({ lesson: draft }, '已保存重生成草稿')
        setModal(null)
      }} /></Dialog>}
    {historic && <Dialog title="教材历史版本" onClose={() => setHistoric(undefined)}>
      <LessonDocument lesson={historic} getScene={getScene} /></Dialog>}
    {publishing && <Dialog title="审核教材版本" onClose={() => setPublishing(undefined)}>
      <ReviewForm version={publishing} onPublish={publish} /></Dialog>}
    {actionContent && <Dialog title={actionContent.title} onClose={() => setActionContent(undefined)}>
      {'block' in actionContent ? <FormulaLesson block={actionContent.block} /> : <p className="prose">{actionContent.text}</p>}</Dialog>}
  </div>
}

createRoot(document.getElementById('root')!).render(<App />)
