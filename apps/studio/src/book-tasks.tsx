import { useEffect, useState } from 'react'
import { Button } from '../../../packages/design-system/ui'
import type { Subject } from '../../../packages/lesson-schema'
import { exportJson, request } from './data'
import { Dialog } from './panels'

const endpoint = 'generation/books'
const labels = { queued: '待开始', running: '生成中', failed: '失败', conflict: '待处理冲突', complete: '已保存草稿' }
const sectionLabels = { queued: '待开始', running: '生成中', failed: '失败', ready: '草稿已生成' }

interface Summary {
  id: string
  title: string
  subject: Subject
  status: keyof typeof labels
  mode: 'model' | 'template'
  ready: number
  total: number
}

interface Details extends Pick<Summary, 'id' | 'title' | 'subject' | 'status' | 'mode'> {
  error: string | null
  saved_revision: number | null
  sections: { id: string; title: string; lesson_id: string; status: keyof typeof sectionLabels; error: string | null }[]
}

export function BookTasks({ initial, onClose, onOpen }: {
  initial: string; onClose(subject?: Subject, revision?: number): void
  onOpen(subject: Subject, id: string, revision: number): Promise<void>
}) {
  const [selection, setSelection] = useState(initial)
  const [jobs, setJobs] = useState<Summary[]>()
  const [details, setDetails] = useState<Details>()
  const [readError, setReadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const selected = selection || jobs?.[0]?.id || ''
  const job = jobs?.find((item) => item.id === selected)
  const active = details?.id === selected ? details : undefined

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        const data = await request<{ jobs: Summary[] }>(endpoint, undefined, controller.signal)
        const id = selection || data.jobs[0]?.id
        const next = id ? await request<Details>(endpoint + '/' + id, undefined, controller.signal) : undefined
        setJobs(data.jobs)
        setDetails(next)
        setReadError('')
      } catch (error) {
        if (!controller.signal.aborted) setReadError((error as Error).message)
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(() => void refresh(), 1000)
      }
    }
    void refresh()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [selection])

  async function act(task: () => Promise<void>) {
    setBusy(true)
    setActionError('')
    try { await task() }
    catch (error) { setActionError((error as Error).message) }
    finally { setBusy(false) }
  }

  return <Dialog title="整册生成任务" onClose={() => onClose(active?.subject, active?.saved_revision ?? undefined)}>
    <div className="block-form">
      {!jobs && !readError && <p role="status">正在加载任务…</p>}
      {jobs?.length === 0 && <p className="muted">暂无整册生成任务。</p>}
      {!!jobs?.length && <label>任务<select value={selected} onChange={(event) => {
        setSelection(event.currentTarget.value)
        setActionError('')
      }}>
        {jobs.map((item) => <option key={item.id} value={item.id}>
          {item.title}（{labels[item.status]}）
        </option>)}
      </select></label>}
      {job && active && <>
        <p role="status">{labels[active.status]}，{job.ready} / {job.total} 节，{job.mode === 'model' ? '模型生成' : '本地示例模板'}</p>
        <progress aria-label="整册生成进度" max={job.total} value={job.ready} />
        {active.error && <p className="error">{active.error}</p>}
        <ol className="stage-list book-sections">
          {active.sections.map((item) => <li key={item.id}>
            <div><span>{item.title}</span>{item.error && <p className="muted">{item.error}</p>}</div>
            {active.status === 'complete' ?
              <Button disabled={busy} onClick={() => void act(() => onOpen(active.subject, item.lesson_id, active.saved_revision!))}>
                打开 {item.title}
              </Button> : <b>{sectionLabels[item.status]}</b>}
          </li>)}
        </ol>
        <div className="actions">
          {active.status === 'failed' && <Button kind="primary" disabled={busy} onClick={() => void act(async () => {
            await request(endpoint + '/' + active.id + '/retry', {})
            setDetails({ ...active, status: 'queued', error: null })
          })}>重试失败任务</Button>}
          {job.ready > 0 && <Button icon="download" disabled={busy} onClick={() => void act(async () => {
            const result = await request(endpoint + '/' + active.id + '/drafts')
            exportJson(result, `${active.title}-教材草稿.json`)
          })}>下载已生成草稿</Button>}
        </div>
      </>}
      {(readError || actionError) && <p role="alert" className="error">{actionError || readError}</p>}
    </div>
  </Dialog>
}
