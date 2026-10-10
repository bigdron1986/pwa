// storage.ts — работа с IndexedDB через localforage
import localforage from 'localforage'
import type { Settings, StorePrices, GeneratedMenu } from '../types'

// Отдельное хранилище приложения
localforage.config({
  name: 'weekly-budget-pwa',
  storeName: 'app_data',
  description: 'Настройки, цены, меню и список покупок'
})

// ---- Настройки ----
const SETTINGS_KEY = 'settings'

export const DEFAULT_SETTINGS: Settings = {
  budgetMin: 3000,
  budgetMax: 5000,
  adults: 2,
  children: 1,
  allergies: 'Лактоза (ограниченно), не любим оливки и сельдерей',
  stores: ['magnit', 'pyaterochka'],
  cloudFunctionUrl: ''
}

export async function loadSettings(): Promise<Settings> {
  const s = await localforage.getItem<Settings>(SETTINGS_KEY)
  return s ? { ...DEFAULT_SETTINGS, ...s } : { ...DEFAULT_SETTINGS }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await localforage.setItem(SETTINGS_KEY, settings)
}

// ---- Цены по магазинам ----
// Ключ вида: prices:magnit => StorePrices
export async function savePrices(store: string, data: StorePrices): Promise<void> {
  await localforage.setItem(`prices:${store}`, data)
}

export async function loadPrices(store: string): Promise<StorePrices | null> {
  return localforage.getItem<StorePrices>(`prices:${store}`)
}

/** Все сохранённые цены: map store -> StorePrices */
export async function loadAllPrices(): Promise<Record<string, StorePrices>> {
  const result: Record<string, StorePrices> = {}
  const keys = await localforage.keys()
  for (const key of keys) {
    if (key.startsWith('prices:')) {
      const data = await localforage.getItem<StorePrices>(key)
      if (data) result[key.slice('prices:'.length)] = data
    }
  }
  return result
}

/** Дата последнего обновления цен по всем магазинам (максимум) */
export async function getLastPricesUpdate(): Promise<string | null> {
  const all = await loadAllPrices()
  const dates = Object.values(all).map((p) => p.updated_at).sort()
  return dates.length ? dates[dates.length - 1] : null
}

// ---- Сгенерированное меню + список покупок ----
const MENU_KEY = 'generated_menu'

export async function saveMenu(menu: GeneratedMenu): Promise<void> {
  await localforage.setItem(MENU_KEY, menu)
}

export async function loadMenu(): Promise<GeneratedMenu | null> {
  return localforage.getItem<GeneratedMenu>(MENU_KEY)
}

export async function clearMenu(): Promise<void> {
  await localforage.removeItem(MENU_KEY)
}

// ---- Тема ----
const THEME_KEY = 'theme' // 'light' | 'dark' | 'system'

export async function loadTheme(): Promise<string> {
  return (await localforage.getItem<string>(THEME_KEY)) ?? 'system'
}

export async function saveTheme(theme: string): Promise<void> {
  await localforage.setItem(THEME_KEY, theme)
}
