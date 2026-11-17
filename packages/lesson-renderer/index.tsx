import type { ReactNode } from 'react'
import { Button, Icon } from '../design-system/ui'
import type { Block, Lesson } from '../lesson-schema'
import type { Scene } from '../subject-sdk/scene'
import { Experiment, PhysicsDiagram, ProjectileStage } from './experiments'
import { ExampleSteps, FormulaEquations, FormulaLesson } from './formulas'

export { FormulaLesson } from './formulas'

export function LessonBanner({ lesson, title, action }: { lesson: Lesson; title?: string; action?: ReactNode }) {
  return <header className="lesson-banner">
    <span className="chapter-number">{lesson.number}</span>
    <h1>{title ?? lesson.title}</h1>
    {action && <div className="banner-action">{action}</div>}
  </header>
}

export function Goals({ lesson, anchor }: { lesson: Lesson; anchor?: string }) {
  return <section className="goals" id={anchor}>
    <h2><Icon name="star" />学习目标</h2>
    <ol>{lesson.objectives.map((goal) => <li key={goal}>{goal}</li>)}</ol>
  </section>
}

export function LessonBlock({ block, lesson, getScene, onExpand, onPractice }: {
  block: Block; lesson: Lesson; getScene(block: Block): Scene; onExpand?(block: Block): void; onPractice?(block: Block): void
}) {
  if (block.type === 'objectives') return <Goals lesson={lesson} anchor={`block-${block.id}`} />
  if (block.type === 'interactive') return <section id={`block-${block.id}`} className="experiment">
    <header className="experiment-heading"><Icon name="flask" /><h2>{block.title}</h2>
      {onExpand && <Button icon="expand" onClick={() => onExpand(block)}>沉浸实验</Button>}
    </header>
    <Experiment block={block} scene={getScene(block)} />
  </section>
  const physicsConcept = lesson.id === 'physics' && block.id === 'concept'
  const physicsLaw = lesson.id === 'physics' && block.id === 'law'
  if (block.type === 'formula') return <section id={`block-${block.id}`} className="book-section">
    <h2>{block.title}</h2>
    <FormulaLesson block={block} />
    {physicsLaw && <PhysicsDiagram />}
  </section>
  return <section id={`block-${block.id}`} className="book-section">
    <h2>{block.title}</h2>
    <div className={physicsConcept ? 'illustrated-text' : ''}>
      <div className="prose">
        {block.body && <p>{block.body}</p>}
        {block.formula && <FormulaEquations source={block.formula} />}
        {!!block.steps?.length && <ExampleSteps steps={block.steps} />}
        {block.type === 'assessment' && <>
          <p>{block.question}</p>
          {onPractice && <Button icon="pen" onClick={() => onPractice(block)}>开始答题</Button>}
        </>}
      </div>
      {physicsConcept && <figure className="lesson-diagram">
        <ProjectileStage state={{ parameters: { speed: 8, height: 2, gravity: 9.8 }, time: 0 }} snapshot />
        <figcaption>平抛运动轨迹示意</figcaption>
      </figure>}
    </div>
  </section>
}

export function LessonDocument({ lesson, getScene, onExpand, onPractice }: {
  lesson: Lesson; getScene(block: Block): Scene; onExpand?(block: Block): void; onPractice?(block: Block): void
}) {
  return <article className="lesson-document">
    {lesson.blocks.map((block) => <LessonBlock key={block.id} {...{ block, lesson, getScene, onExpand, onPractice }} />)}
  </article>
}
