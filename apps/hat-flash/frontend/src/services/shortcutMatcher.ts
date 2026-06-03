function normalizeKey(key: string) {
  if (key === ' ') return 'SPACE';
  return key.trim().toUpperCase();
}

function tokenMatches(event: KeyboardEvent, token: string) {
  switch (token.trim().toLowerCase()) {
    case 'commandorcontrol':
      return event.metaKey || event.ctrlKey;
    case 'command':
    case 'cmd':
    case 'meta':
      return event.metaKey;
    case 'control':
    case 'ctrl':
      return event.ctrlKey;
    case 'alt':
    case 'option':
      return event.altKey;
    case 'shift':
      return event.shiftKey;
    default:
      return normalizeKey(event.key) === normalizeKey(token);
  }
}

function requiredModifiers(parts: string[]) {
  return parts.reduce((acc, part) => {
    switch (part.trim().toLowerCase()) {
      case 'commandorcontrol':
        return { ...acc, commandOrControl: true };
      case 'command':
      case 'cmd':
      case 'meta':
        return { ...acc, meta: true };
      case 'control':
      case 'ctrl':
        return { ...acc, ctrl: true };
      case 'alt':
      case 'option':
        return { ...acc, alt: true };
      case 'shift':
        return { ...acc, shift: true };
      default:
        return acc;
    }
  }, { commandOrControl: false, ctrl: false, meta: false, alt: false, shift: false });
}

function modifiersMatchExactly(event: KeyboardEvent, parts: string[]) {
  const required = requiredModifiers(parts);
  const ctrlOrMetaSatisfied = required.commandOrControl && (event.ctrlKey || event.metaKey);
  if (required.commandOrControl && !ctrlOrMetaSatisfied) return false;
  if (!required.commandOrControl && event.ctrlKey !== required.ctrl) return false;
  if (!required.commandOrControl && event.metaKey !== required.meta) return false;
  if (required.commandOrControl && event.ctrlKey && event.metaKey) return false;
  if (event.altKey !== required.alt) return false;
  if (event.shiftKey !== required.shift) return false;
  return true;
}

export function keyboardEventMatchesShortcut(event: KeyboardEvent, shortcut: string) {
  const parts = shortcut.split('+').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  return modifiersMatchExactly(event, parts) && parts.every((part) => tokenMatches(event, part));
}
