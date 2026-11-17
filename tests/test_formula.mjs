import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formulaRows, parseFormula } from '../packages/lesson-renderer/formula-notation.ts'

test('formula rows split outside text and argument groups', () => {
  assert.deepEqual(formulaRows(String.raw`x=1；\text{比较;说明};` + '\ny=2'), [
    'x=1', String.raw`\text{比较;说明}`, 'y=2',
  ])
})

test('fraction, square root and combined scripts produce structured math', () => {
  const expression = parseFormula(String.raw`v_0^2=\sqrt{\frac{1}{2}}`)
  const [script, , root] = expression.children
  assert.deepEqual(script.children.map(({ tag, text }) => [tag, text]), [
    ['mi', 'v'], ['mn', '0'], ['mn', '2'],
  ])
  assert.equal(script.tag, 'msubsup')
  assert.equal(root.tag, 'msqrt')
  const [fraction] = root.children[0].children
  assert.equal(fraction.tag, 'mfrac')
  assert.deepEqual(fraction.children.map((child) => child.children[0].text), ['1', '2'])
})

test('Unicode indices and negative powers preserve their structure', () => {
  const expression = parseFormula(String.raw`v₀²=10^{-4}\text{ m/s²}`)
  assert.equal(expression.children[0].tag, 'msubsup')
  assert.equal(expression.children[2].tag, 'msup')
  assert.equal(expression.children[2].children[1].children[0].text, '−')
  assert.equal(expression.children[3].text, '\u00a0m/s²')
})

test('malformed expressions and author text remain literal', () => {
  const malformed = String.raw`\frac{1}`
  assert.deepEqual(parseFormula(malformed), { tag: 'mtext', text: malformed })
  const content = '<script>local()</script>'
  assert.deepEqual(parseFormula(String.raw`\text{${content}}`).children, [{ tag: 'mtext', text: content }])
})
