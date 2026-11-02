import type { ApiSe7en } from '../shared/ipc'

declare global {
  interface Window {
    se7en: ApiSe7en
  }
}
