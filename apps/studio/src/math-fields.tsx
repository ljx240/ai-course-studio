import { Button } from '../../../packages/design-system/ui'
import type { Block } from '../../../packages/lesson-schema'

export function MathFields({ draft, onChange }: { draft: Block; onChange(next: Block): void }) {
  const formula = (draft.type === 'formula' || draft.formula != null) &&
    <label>公式（每行一式）<textarea value={draft.formula ?? ''}
      onChange={(event) => onChange({ ...draft, formula: event.currentTarget.value })} /></label>
  if (draft.type === 'formula') {
    const symbols = draft.symbols ?? []
    return <>
      {formula}
      <p className="muted">分式写作 <code>{'\\frac{分子}{分母}'}</code>，上下标写作 <code>F_&#123;浮&#125;</code>、<code>x^&#123;2&#125;</code>。</p>
      <label>怎么用<textarea value={draft.explanation ?? ''}
        onChange={(event) => onChange({ ...draft, explanation: event.currentTarget.value })} /></label>
      <fieldset className="math-editor-list">
        <legend>符号与单位</legend>
        {symbols.map((symbol, index) => <div className="math-editor-symbol" key={index}>
          {(['symbol', 'meaning', 'unit'] as const).map((field, position) => <label key={field}>{['符号', '含义', '单位'][position]}
            <input required maxLength={field === 'meaning' ? 200 : 100} value={symbol[field]} onChange={(event) => {
              const value = event.currentTarget.value
              onChange({ ...draft, symbols: symbols.map((item, i) => i === index ? { ...item, [field]: value } : item) })
            }} />
          </label>)}
          <Button kind="quiet" onClick={() => onChange({ ...draft, symbols: symbols.filter((_, i) => i !== index) })}>移除</Button>
        </div>)}
        <Button icon="plus" disabled={symbols.length >= 18}
          onClick={() => onChange({ ...draft, symbols: [...symbols, { symbol: '', meaning: '', unit: '' }] })}>添加符号</Button>
      </fieldset>
    </>
  }
  if (draft.type !== 'example') return formula
  const steps = draft.steps ?? []
  return <>{formula}<fieldset className="math-editor-list">
    <legend>解题步骤</legend>
    {steps.map((step, index) => <fieldset className="math-editor-step" key={index}>
      <legend>第 {index + 1} 步</legend>
      <label>步骤标题<input required maxLength={100} value={step.title} onChange={(event) => {
        const title = event.currentTarget.value
        onChange({ ...draft, steps: steps.map((item, i) => i === index ? { ...item, title } : item) })
      }} /></label>
      <label>讲解<textarea required maxLength={800} value={step.body} onChange={(event) => {
        const body = event.currentTarget.value
        onChange({ ...draft, steps: steps.map((item, i) => i === index ? { ...item, body } : item) })
      }} /></label>
      <label>代入与计算（每行一式）<textarea value={step.formula ?? ''} onChange={(event) => {
        const formula = event.currentTarget.value
        onChange({ ...draft, steps: steps.map((item, i) => i === index ? { ...item, formula } : item) })
      }} /></label>
      <Button kind="quiet" onClick={() => onChange({ ...draft, steps: steps.filter((_, i) => i !== index) })}>移除步骤</Button>
    </fieldset>)}
    <Button icon="plus" disabled={steps.length >= 10}
      onClick={() => onChange({ ...draft, steps: [...steps, { title: '', body: '' }] })}>添加步骤</Button>
  </fieldset></>
}
