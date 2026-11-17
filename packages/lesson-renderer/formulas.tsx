import { createElement, type ReactNode } from 'react'
import type { Block, WorkedStep } from '../lesson-schema'
import { formulaRows, parseFormula, type MathTerm } from './formula-notation'

function renderTerm(term: MathTerm, key = 0): ReactNode {
  return createElement(term.tag, { key },
    'text' in term ? term.text : term.children.map((child, index) => renderTerm(child, index)))
}

function Equation({ source, block = false }: { source: string; block?: boolean }) {
  return createElement('math', { display: block ? 'block' : 'inline' }, renderTerm(parseFormula(source)))
}

export function FormulaEquations({ source }: { source: string }) {
  return <div className="equation-set">
    {formulaRows(source).map((formula, index) => <div className="equation-line" key={index}>
      <Equation source={formula} block />
    </div>)}
  </div>
}

export function FormulaLesson({ block }: { block: Block }) {
  return <div className="formula-lesson">
    {block.formula && <FormulaEquations source={block.formula} />}
    {!!block.symbols?.length && <table className="formula-symbols" aria-label="符号与单位">
      <thead><tr><th scope="col">符号</th><th scope="col">含义</th><th scope="col">单位</th></tr></thead>
      <tbody>{block.symbols.map(({ symbol, meaning, unit }, index) => <tr key={index}>
        <th scope="row"><Equation source={symbol} /></th><td>{meaning}</td><td>{unit}</td>
      </tr>)}</tbody>
    </table>}
    {block.body && <div className="formula-note"><h3>适用条件</h3><p>{block.body}</p></div>}
    {block.explanation && <div className="formula-note"><h3>怎么用</h3><p>{block.explanation}</p></div>}
  </div>
}

export function ExampleSteps({ steps }: { steps: WorkedStep[] }) {
  return <ol className="worked-steps">
    {steps.map((step, index) => <li key={index}>
      <h3>{step.title}</h3>
      <p>{step.body}</p>
      {step.formula && <FormulaEquations source={step.formula} />}
    </li>)}
  </ol>
}
