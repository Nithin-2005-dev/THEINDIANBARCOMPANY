import styles from "@/components/assistant/BeerAssistantPromptSuggestions.module.css"
import type { AssistantPromptSuggestion } from "@/types/assistant"

type BeerAssistantPromptSuggestionsProps = {
  suggestions: AssistantPromptSuggestion[]
  onSelect: (prompt: string) => void
}

export default function BeerAssistantPromptSuggestions({
  suggestions,
  onSelect,
}: BeerAssistantPromptSuggestionsProps) {
  if (!suggestions.length) return null

  return (
    <div className={styles.grid}>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          type="button"
          className={styles.card}
          title={suggestion.prompt}
          onClick={() => onSelect(suggestion.prompt)}
        >
          <span className={styles.spark} aria-hidden="true" />
          <span className={styles.copy}>
            <span className={styles.label}>{suggestion.title}</span>
            {suggestion.description ? (
              <span className={styles.description}>{suggestion.description}</span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  )
}
