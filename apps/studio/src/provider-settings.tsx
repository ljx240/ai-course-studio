import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../../packages/design-system/ui'
import { request } from './data'
import { Dialog } from './panels'

const endpoint = 'settings/ai-provider'

interface Profile {
  base_url: string
  model: string
  timeout: number
  use_api_key: boolean
  has_api_key: boolean
  configured: boolean
  source: 'unset' | 'environment' | 'settings'
}

export function ProviderSettings({ onClose, onConfigured }: {
  onClose(): void
  onConfigured(configured: boolean): void
}) {
  const [profile, setProfile] = useState<Profile>()
  const [useKey, setUseKey] = useState(true)
  const [pending, setPending] = useState<'test' | 'save'>()
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    request<Profile>(endpoint, undefined, controller.signal).then((result) => {
      setProfile(result)
      setUseKey(result.use_api_key)
      onConfigured(result.configured)
    }).catch((err: Error) => {
      if (!controller.signal.aborted) setError(err.message)
    })
    return () => controller.abort()
  }, [onConfigured])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'test' ? 'test' : 'save'
    const form = event.currentTarget
    const values = new FormData(form)
    const key = String(values.get('api_key') ?? '')
    const body = {
      base_url: values.get('base_url'),
      model: values.get('model'),
      timeout: Number(values.get('timeout')),
      use_api_key: useKey,
      api_key: key || undefined,
    }
    setPending(action)
    setNotice('')
    setError('')
    try {
      if (action === 'test') {
        const result = await request<{ ok: boolean; model: string }>(endpoint + '/test', body)
        setNotice(`${result.model} 连接成功。`)
      } else {
        const saved = await request<Profile>(endpoint, body)
        setProfile(saved)
        const input = form.elements.namedItem('api_key') as HTMLInputElement | null
        if (input) input.value = ''
        onConfigured(saved.configured)
        setNotice('配置已保存，立即生效。')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(undefined)
    }
  }

  return <Dialog title="AI 服务设置" onClose={onClose}>
    {profile ? <form className="block-form" onSubmit={submit}>
      <p className="muted">支持 OpenAI 兼容的 Chat Completions 接口，包括 NewAPI 和本机 Ollama。</p>
      <label>服务地址<input type="url" name="base_url" required maxLength={2048}
        placeholder="https://api.openai.com/v1" defaultValue={profile.base_url} disabled={!!pending} /></label>
      <label>模型 ID<input name="model" required maxLength={200}
        defaultValue={profile.model} disabled={!!pending} /></label>
      <label className="review-check"><input type="checkbox" checked={useKey} disabled={!!pending}
        onChange={(event) => setUseKey(event.currentTarget.checked)} />使用 API 密钥</label>
      {useKey && <label>API 密钥<input type="password" name="api_key" maxLength={4096} autoComplete="off"
        disabled={!!pending} placeholder={profile.has_api_key ? '留空可保留同一地址的密钥' : '输入 API 密钥'} /></label>}
      <label>请求超时（秒）<input type="number" name="timeout" required min={1} max={600}
        defaultValue={profile.timeout} disabled={!!pending} /></label>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert" className="error">{error}</p>}
      <div className="actions">
        <Button type="submit" kind="primary" value="save" disabled={!!pending}>
          {pending === 'save' ? '保存中…' : '保存配置'}
        </Button>
        <Button type="submit" value="test" disabled={!!pending}>
          {pending === 'test' ? '测试中…' : '测试连接'}
        </Button>
      </div>
    </form> : error ? <p role="alert" className="error">{error}。请通过本机启动脚本打开工程版。</p>
      : <p role="status">正在读取配置…</p>}
  </Dialog>
}
