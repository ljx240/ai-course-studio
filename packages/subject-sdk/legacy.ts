// The offline scripts also serve the standalone V0.2 entry. Reuse their numeric models here.
import '../../web/js/data.js'
import '../../web/js/store.js'
import '../../web/js/engines/math.js'
import '../../web/js/engines/physics.js'
import type { Lesson, Subject } from '../lesson-schema'

export interface OutlineNode {
  id: string
  title: string
  children: OutlineNode[]
  type?: string
  subject?: Subject
  lessonId?: string
  knowledgePoints?: { id: string; title: string }[]
}

interface Legacy {
  data: {
    subjects: { id: Subject; name: string; symbol: string; level: string; chapter: string; lesson: string; status: string }[]
    lessons: Record<Subject, Lesson>
    iconPaths: Record<string, string>
  }
  store: {
    outlineFromText(text: string): OutlineNode[]
    exportJson(value: unknown, name: string): void
  }
  engines: {
    math: {
      calc(a: number, b: number, c: number): { vertex: [number, number] | null; axis: number | null; roots: number[]; direction: string }
    }
    physics: {
      calc(speed: number, height: number, gravity: number): { flight: number; range: number; impact: number; vy: number }
    }
  }
}

export const legacy = (window as Window & { ZJ?: Legacy }).ZJ!
