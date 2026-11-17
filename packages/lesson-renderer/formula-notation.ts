export type MathTerm =
  | { tag: 'mi' | 'mn' | 'mo' | 'mtext'; text: string }
  | { tag: 'mrow' | 'mfrac' | 'msqrt' | 'msub' | 'msup' | 'msubsup'; children: MathTerm[] }

const row = (children: MathTerm[]): MathTerm => ({ tag: 'mrow', children })
const leaf = (tag: 'mi' | 'mn' | 'mo' | 'mtext', text: string): MathTerm => ({ tag, text })
const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹⁻'
const subscripts = '₀₁₂₃₄₅₆₇₈₉₋'
const digits = '0123456789−'

export function formulaRows(source: string) {
  const rows: string[] = []
  let start = 0
  let depth = 0
  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    if (char === '{') depth++
    if (char === '}') depth = Math.max(0, depth - 1)
    if (!depth && (char === ';' || char === '；' || char === '\n')) {
      rows.push(source.slice(start, index).trim())
      start = index + 1
    }
  }
  rows.push(source.slice(start).trim())
  return rows.filter(Boolean)
}

export function parseFormula(source: string): MathTerm {
  let index = 0
  const number = /\d+(?:\.\d+)?/y
  const words = /[\p{Script=Han}：，、。]+/uy
  const command = /\\[A-Za-z]+/y

  function take(pattern: RegExp) {
    pattern.lastIndex = index
    const match = pattern.exec(source)?.[0]
    if (match) index += match.length
    return match
  }

  function skipSpaces() {
    while (index < source.length && /\s/.test(source[index])) index++
  }

  function group(depth: number): MathTerm | null {
    skipSpaces()
    if (source[index] !== '{' || depth >= 16) return null
    index++
    const items = sequence(depth + 1)
    if (items === null || source[index] !== '}') return null
    index++
    return row(items)
  }

  function atom(depth: number): MathTerm | null {
    const char = source[index]
    if (char === '{') return group(depth)
    if (char === '\\') {
      const name = take(command)
      if (name === '\\frac') {
        const top = group(depth), bottom = group(depth)
        return top && bottom ? { tag: 'mfrac', children: [top, bottom] } : null
      }
      if (name === '\\sqrt') {
        const base = group(depth)
        return base ? { tag: 'msqrt', children: [base] } : null
      }
      if (name === '\\quad') return leaf('mtext', ' ')
      if (name === '\\text') {
        skipSpaces()
        if (source[index] !== '{') return null
        const end = source.indexOf('}', index + 1)
        if (end < 0) return null
        const text = source.slice(index + 1, end).replaceAll(' ', '\u00a0')
        index = end + 1
        return leaf('mtext', text)
      }
      if (name) return leaf('mtext', name)
    }
    const value = take(number)
    if (value) return leaf('mn', value)
    const text = take(words)
    if (text) return leaf('mtext', text)
    index++
    if (char === '½') return { tag: 'mfrac', children: [leaf('mn', '1'), leaf('mn', '2')] }
    if (/[\p{L}]/u.test(char)) return leaf('mi', char)
    return leaf('mo', char === '-' ? '−' : char)
  }

  function sequence(depth: number): MathTerm[] | null {
    const items: MathTerm[] = []
    skipSpaces()
    while (index < source.length && source[index] !== '}') {
      const base = atom(depth)
      if (!base) return null
      let sub: MathTerm | undefined
      let sup: MathTerm | undefined
      while (index < source.length) {
        const char = source[index]
        const set = superscripts.includes(char) ? superscripts : subscripts.includes(char) ? subscripts : ''
        if (!set && char !== '_' && char !== '^') break
        const isSup = set === superscripts || char === '^'
        if (isSup ? sup : sub) return null
        let script: MathTerm | null
        if (set) {
          let converted = ''
          while (index < source.length && set.includes(source[index])) converted += digits[set.indexOf(source[index++])]
          script = leaf('mn', converted)
        } else {
          index++
          skipSpaces()
          if (index === source.length || source[index] === '}') return null
          script = atom(depth)
        }
        if (!script) return null
        if (isSup) sup = script
        else sub = script
      }
      items.push(sub && sup ? { tag: 'msubsup', children: [base, sub, sup] }
        : sub ? { tag: 'msub', children: [base, sub] }
          : sup ? { tag: 'msup', children: [base, sup] } : base)
      skipSpaces()
    }
    return items
  }

  const result = sequence(0)
  return result && index === source.length ? row(result) : leaf('mtext', source)
}
