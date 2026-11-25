import React from 'react'
import {
  Sparkles,
  List,
  FileText,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react'

/**
 * Sanitizes URLs to prevent javascript: or data: XSS injection.
 */
function sanitizeUrl(url) {
  if (!url) return '#'
  const trimmed = url.trim()
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#')
  ) {
    return trimmed
  }
  return '#'
}

/**
 * Parses inline Markdown into React nodes (bold, italic, code, links).
 * Does not use dangerouslySetInnerHTML.
 */
export function renderInline(text) {
  if (!text) return null
  const regex = /(`[^`]+`|\*\*\*[^*]+\*\*\*|___[^_]+___|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g
  const parts = text.split(regex)

  return parts.map((part, index) => {
    if (!part) return null

    // Code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-brand-600 dark:text-brand-300 font-mono text-[11px] font-semibold"
        >
          {part.slice(1, -1)}
        </code>
      )
    }

    // Bold + Italic: ***text*** or ___text___
    if (
      (part.startsWith('***') && part.endsWith('***') && part.length >= 6) ||
      (part.startsWith('___') && part.endsWith('___') && part.length >= 6)
    ) {
      return (
        <strong key={index} className="font-semibold text-slate-900 dark:text-white">
          <em className="italic">{part.slice(3, -3)}</em>
        </strong>
      )
    }

    // Bold: **text** or __text__
    if (
      (part.startsWith('**') && part.endsWith('**') && part.length >= 4) ||
      (part.startsWith('__') && part.endsWith('__') && part.length >= 4)
    ) {
      return (
        <strong key={index} className="font-semibold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }

    // Italic: *text* or _text_
    if (
      (part.startsWith('*') && part.endsWith('*') && part.length >= 2) ||
      (part.startsWith('_') && part.endsWith('_') && part.length >= 2)
    ) {
      return (
        <em key={index} className="italic text-slate-700 dark:text-slate-300">
          {part.slice(1, -1)}
        </em>
      )
    }

    // Link: [label](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      const [, label, url] = linkMatch
      return (
        <a
          key={index}
          href={sanitizeUrl(url)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 dark:text-brand-400 underline hover:text-brand-700 dark:hover:text-brand-300 font-medium transition-colors"
        >
          {label}
        </a>
      )
    }

    return part
  })
}

const SEMANTIC_SECTIONS = [
  {
    key: 'direct_answer',
    regex: /^(?:#{1,4}\s+|\*\*)?(Direct Answer):?\*?\*?\s*(.*)$/i,
    label: 'Direct Answer',
    badgeClass: 'bg-brand-500/15 text-brand-700 dark:text-brand-300 border-brand-500/30',
    cardClass: 'bg-brand-50/50 dark:bg-brand-950/30 border-brand-200/80 dark:border-brand-800/60 text-slate-800 dark:text-slate-200',
    icon: Sparkles,
  },
  {
    key: 'key_findings',
    regex: /^(?:#{1,4}\s+|\*\*)?(Key Findings|Key Insights):?\*?\*?\s*(.*)$/i,
    label: 'Key Findings',
    badgeClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    cardClass: 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/60 text-slate-800 dark:text-slate-200',
    icon: List,
  },
  {
    key: 'supporting_evidence',
    regex: /^(?:#{1,4}\s+|\*\*)?(Supporting Evidence):?\*?\*?\s*(.*)$/i,
    label: 'Supporting Evidence',
    badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    cardClass: 'bg-purple-50/30 dark:bg-purple-950/20 border-purple-200/70 dark:border-purple-800/50 text-slate-800 dark:text-slate-200',
    icon: FileText,
  },
  {
    key: 'limitations',
    regex: /^(?:#{1,4}\s+|\*\*)?(Limitations|Data Limitations):?\*?\*?\s*(.*)$/i,
    label: 'Limitations',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    cardClass: 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/60 text-amber-950 dark:text-amber-200',
    icon: AlertTriangle,
  },
  {
    key: 'next_action',
    regex: /^(?:#{1,4}\s+|\*\*)?(Suggested Next Actions?|Next Steps?|Recommendations?):?\*?\*?\s*(.*)$/i,
    label: 'Suggested Next Action',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    cardClass: 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-200',
    icon: Lightbulb,
  },
]

/**
 * Parses markdown blocks and structures semantic sections if present.
 */
function parseBlocks(markdownText) {
  if (!markdownText) return []
  const rawLines = markdownText.split('\n')
  const blocks = []

  let currentSection = null
  let currentList = null // { type: 'ul' | 'ol', items: [] }
  let currentTable = null // { headers: [], rows: [] }
  let inCodeBlock = false
  let codeBlockLang = ''
  let codeBlockLines = []

  function flushList() {
    if (currentList) {
      if (currentSection) {
        currentSection.children.push(currentList)
      } else {
        blocks.push(currentList)
      }
      currentList = null
    }
  }

  function flushTable() {
    if (currentTable) {
      if (currentSection) {
        currentSection.children.push(currentTable)
      } else {
        blocks.push(currentTable)
      }
      currentTable = null
    }
  }

  function flushSection() {
    flushList()
    flushTable()
    if (currentSection) {
      blocks.push(currentSection)
      currentSection = null
    }
  }

  function addBlock(block) {
    flushList()
    flushTable()
    if (currentSection) {
      currentSection.children.push(block)
    } else {
      blocks.push(block)
    }
  }

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i]
    const trimmed = line.trim()

    // 1. Code blocks ```
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        addBlock({
          type: 'code_block',
          language: codeBlockLang,
          content: codeBlockLines.join('\n'),
        })
        inCodeBlock = false
        codeBlockLines = []
        codeBlockLang = ''
      } else {
        flushList()
        flushTable()
        inCodeBlock = true
        codeBlockLang = trimmed.slice(3).trim()
        codeBlockLines = []
      }
      continue
    }

    if (inCodeBlock) {
      codeBlockLines.push(line)
      continue
    }

    // 2. Empty line
    if (!trimmed) {
      flushList()
      flushTable()
      continue
    }

    // 3. Horizontal rule
    if (/^(?:---|\*\*\*|___)$/.test(trimmed)) {
      addBlock({ type: 'hr' })
      continue
    }

    // 4. Check for Semantic Section Header
    let matchedSectionConfig = null
    let sectionTrailingText = ''

    for (const sec of SEMANTIC_SECTIONS) {
      const match = trimmed.match(sec.regex)
      if (match) {
        matchedSectionConfig = sec
        sectionTrailingText = (match[2] || '').trim()
        // Strip trailing asterisks or colons
        sectionTrailingText = sectionTrailingText.replace(/^[:* ]+|[:* ]+$/g, '').trim()
        break
      }
    }

    if (matchedSectionConfig) {
      flushSection()
      currentSection = {
        type: 'semantic_section',
        config: matchedSectionConfig,
        children: [],
      }
      if (sectionTrailingText) {
        currentSection.children.push({
          type: 'paragraph',
          text: sectionTrailingText,
        })
      }
      continue
    }

    // 5. Headings (#, ##, ###, ####)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      flushSection()
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()
      addBlock({
        type: 'heading',
        level,
        text,
      })
      continue
    }

    // 6. Blockquote (> text)
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '').trim()
      addBlock({
        type: 'blockquote',
        text: quoteText,
      })
      continue
    }

    // 7. Table row (| col | col |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList()
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim())

      // Divider row
      if (cells.every((c) => /^:?-+:?$/.test(c))) {
        continue
      }

      if (!currentTable) {
        currentTable = {
          type: 'table',
          headers: cells,
          rows: [],
        }
      } else {
        currentTable.rows.push(cells)
      }
      continue
    } else {
      flushTable()
    }

    // 8. Unordered list (- item, * item, + item, • item)
    const ulMatch = trimmed.match(/^[-*+•]\s+(.+)$/)
    if (ulMatch) {
      if (!currentList || currentList.type !== 'ul') {
        flushList()
        currentList = { type: 'ul', items: [] }
      }
      currentList.items.push(ulMatch[1])
      continue
    }

    // 9. Ordered list (1. item)
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/)
    if (olMatch) {
      if (!currentList || currentList.type !== 'ol') {
        flushList()
        currentList = { type: 'ol', items: [] }
      }
      currentList.items.push(olMatch[2])
      continue
    }

    // 10. Fallback: regular paragraph
    flushList()
    addBlock({
      type: 'paragraph',
      text: trimmed,
    })
  }

  if (inCodeBlock) {
    addBlock({
      type: 'code_block',
      language: codeBlockLang,
      content: codeBlockLines.join('\n'),
    })
  }

  flushSection()
  return blocks
}

/**
 * Renders an individual parsed block element.
 */
function renderBlock(block, index) {
  switch (block.type) {
    case 'semantic_section': {
      const { config, children } = block
      const Icon = config.icon

      return (
        <div
          key={index}
          className={`rounded-xl border p-3 my-2.5 space-y-2 transition-all ${config.cardClass}`}
        >
          <div className="flex items-center gap-1.5 font-bold text-xs">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] uppercase font-bold tracking-wider ${config.badgeClass}`}
            >
              <Icon className="w-3 h-3 shrink-0" />
              <span>{config.label}</span>
            </span>
          </div>
          <div className="space-y-1.5 text-xs leading-relaxed">
            {children.map((child, cIdx) => renderBlock(child, cIdx))}
          </div>
        </div>
      )
    }

    case 'heading': {
      const { level, text } = block
      const inline = renderInline(text)
      if (level === 1) {
        return (
          <h1 key={index} className="text-sm font-bold text-slate-900 dark:text-white mt-3 mb-1.5 pb-1 border-b border-slate-200 dark:border-slate-800">
            {inline}
          </h1>
        )
      }
      if (level === 2) {
        return (
          <h2 key={index} className="text-xs font-bold text-slate-900 dark:text-white mt-2.5 mb-1">
            {inline}
          </h2>
        )
      }
      if (level === 3) {
        return (
          <h3 key={index} className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-2 mb-1">
            {inline}
          </h3>
        )
      }
      return (
        <h4 key={index} className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 mt-1.5 mb-0.5">
          {inline}
        </h4>
      )
    }

    case 'paragraph': {
      return (
        <p key={index} className="leading-relaxed text-xs">
          {renderInline(block.text)}
        </p>
      )
    }

    case 'ul': {
      return (
        <ul key={index} className="space-y-1.5 my-1.5 pl-4 list-disc marker:text-brand-500 text-xs leading-relaxed">
          {block.items.map((item, iIdx) => (
            <li key={iIdx}>{renderInline(item)}</li>
          ))}
        </ul>
      )
    }

    case 'ol': {
      return (
        <ol key={index} className="space-y-1.5 my-1.5 pl-4 list-decimal marker:text-brand-500 marker:font-semibold text-xs leading-relaxed">
          {block.items.map((item, iIdx) => (
            <li key={iIdx}>{renderInline(item)}</li>
          ))}
        </ol>
      )
    }

    case 'code_block': {
      return (
        <pre
          key={index}
          className="my-2 p-2.5 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto border border-slate-800"
        >
          <code>{block.content}</code>
        </pre>
      )
    }

    case 'blockquote': {
      return (
        <blockquote
          key={index}
          className="my-2 pl-3 border-l-2 border-brand-500 text-slate-600 dark:text-slate-400 italic text-xs leading-relaxed"
        >
          {renderInline(block.text)}
        </blockquote>
      )
    }

    case 'table': {
      return (
        <div key={index} className="overflow-x-auto my-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-[11px] divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                {block.headers.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="px-2.5 py-1.5 text-left font-bold text-slate-700 dark:text-slate-300"
                  >
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-navy-950">
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-2.5 py-1 text-slate-700 dark:text-slate-300">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    case 'hr': {
      return <hr key={index} className="my-2.5 border-slate-200 dark:border-slate-800" />
    }

    default:
      return null
  }
}

/**
 * Robust, secure Markdown renderer for ProductMind AI Copilot responses.
 */
export function MarkdownRenderer({ content, className = '' }) {
  if (!content) return null

  const blocks = parseBlocks(content)

  return (
    <div className={`space-y-2 text-xs leading-relaxed break-words ${className}`}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  )
}

export default MarkdownRenderer
