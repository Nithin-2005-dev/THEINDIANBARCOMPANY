import type { AssistantAction } from './assistant.types';

export function createNavigateAssistantAction(
  id: string,
  label: string,
  href: string,
  description?: string,
): AssistantAction {
  return {
    id,
    type: 'NAVIGATE',
    label,
    href,
    description,
  };
}

export function createDraftAssistantAction(
  id: string,
  label: string,
  text: string,
  description?: string,
): AssistantAction {
  return {
    id,
    type: 'APPLY_DRAFT',
    label,
    description,
    payload: {
      text,
    },
  };
}

export function createCopyAssistantAction(
  id: string,
  label: string,
  text: string,
  description?: string,
): AssistantAction {
  return {
    id,
    type: 'COPY_TEXT',
    label,
    description,
    payload: {
      text,
    },
  };
}

export function dedupeAssistantActions(actions: AssistantAction[]) {
  const seen = new Set<string>();

  return actions.filter((action) => {
    const key = `${action.type}:${action.href ?? ''}:${action.label}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
