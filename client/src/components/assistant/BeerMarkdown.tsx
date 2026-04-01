import type { ReactNode } from "react"
import styles from "@/components/assistant/BeerMarkdown.module.css"

type MarkdownBlock =
  | {
      type: "summary"
      content: string
    }
  | {
      type: "list"
      title: string
      items: string[]
    }
  | {
      type: "paragraph"
      content: string
    }

export default function BeerMarkdown({ content }: { content: string }) {
  const blocks = content
    .trim()
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  return (
    <div className={styles.markdown}>
      {blocks.map((block, index) => {
        const parsed = parseBlock(block)

        if (parsed.type === "summary") {
          return (
            <section key={`${block}-${index}`} className={`${styles.section} ${styles.summary}`}>
              <p className={styles.sectionLabel}>Summary</p>
              <p className={styles.summaryText}>{renderInline(parsed.content)}</p>
            </section>
          )
        }

        if (parsed.type === "list") {
          return (
            <section key={`${block}-${index}`} className={styles.section}>
              <p className={styles.sectionLabel}>{parsed.title}</p>
              <ul className={styles.list}>
                {parsed.items.map((item, itemIndex) => (
                  <li key={`${item}-${itemIndex}`}>{renderInline(item)}</li>
                ))}
              </ul>
            </section>
          )
        }

        return (
          <p key={`${block}-${index}`} className={styles.paragraph}>
            {renderInline(parsed.content)}
          </p>
        )
      })}
    </div>
  )
}

function parseBlock(block: string): MarkdownBlock {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean)
  const firstLine = lines[0] ?? ""
  const headingMatch = firstLine.match(/^(Summary|Details|Next actions):?\s*(.*)$/i)

  if (headingMatch) {
    const title = headingMatch[1]
    const inlineContent = headingMatch[2]
    const remainder = lines.slice(1)

    if (title.toLowerCase() === "summary") {
      return {
        type: "summary",
        content: [inlineContent, ...remainder].filter(Boolean).join(" ").trim(),
      }
    }

    const items = [...remainder]
    if (inlineContent) {
      items.unshift(inlineContent)
    }

    const normalizedItems = items
      .map((line) => line.replace(/^- /, "").trim())
      .filter(Boolean)

    return {
      type: "list",
      title,
      items: normalizedItems.length ? normalizedItems : [block],
    }
  }

  const isBulletList = lines.length > 0 && lines.every((line) => line.startsWith("- "))

  if (isBulletList) {
    return {
      type: "list",
      title: "Details",
      items: lines.map((line) => line.replace(/^- /, "")),
    }
  }

  return {
    type: "paragraph",
    content: block,
  }
}

function renderInline(text: string) {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean)

  return tokens.map((token, index): ReactNode => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return (
        <strong key={`${token}-${index}`} className={styles.strong}>
          {token.slice(2, -2)}
        </strong>
      )
    }

    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code key={`${token}-${index}`} className={styles.code}>
          {token.slice(1, -1)}
        </code>
      )
    }

    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      return (
        <a
          key={`${token}-${index}`}
          className={styles.link}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
        >
          {linkMatch[1]}
        </a>
      )
    }

    return token
  })
}
