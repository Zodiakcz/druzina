// Links this device has opened, so the home screen can offer them again. localStorage only:
// losing it loses nothing but convenience (the GM can resend a link).

export interface SavedLink {
  path: string
  title: string
  subtitle: string
  at: number
}

const KEY = 'druzina.links'

export function savedLinks(): SavedLink[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

export function rememberLink(link: Omit<SavedLink, 'at'>) {
  try {
    const rest = savedLinks().filter((l) => l.path !== link.path)
    localStorage.setItem(KEY, JSON.stringify([{ ...link, at: Date.now() }, ...rest].slice(0, 12)))
  } catch {
    // private mode or storage full: nothing to do
  }
}

export function forgetLink(path: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(savedLinks().filter((l) => l.path !== path)))
  } catch {
    // ignore
  }
}
