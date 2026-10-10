// storage.ts — работа с IndexedDB через localforage (версия с store-ID)
import localforage from 'localforage'
import type { Settings, StorePrices, GeneratedMenu, StoreId } from '../types'

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
  address: '',
  stores: {
    magnit: { enabled: true, storeId: '' },
    monetka: { enabled: false, storeId: '' },
    pyaterochka: { enabled: true, storeId: '' },
    megapolis: { enabled: false, storeId: '' }
  },
  cloudFunctionUrl: ''
}

/** Совместимость со старыми данными (stores был массивом id) */
function migrateSettings(raw: Partial<Settings>): Settings {
  let stores = raw.stores as Settings['stores'] | undefined
  if (Array.isArray(raw.stores)) {
    // старый формат: StoreId[]
    const oldList = raw.stores as unknown as StoreId[]
    stores = { ...DEFAULT_SETTINGS.stores }
    for (const k of Object.keys(stores) as StoreId[]) {
      stores[k] = { enabled: oldList.includes(k), storeId: '' }
    }
  } else if (!stores) {
    stores = DEFAULT_SETTINGS.stores
  }
  return { ...DEFAULT_SETTINGS, ...raw, stores }
}

export async function loadSettings(): Promise<Settings> {
  const s = await localforage.getItem<Partial<Settings>>(SETTINGS_KEY)
  return s ? migrateSettings(s) : { ...DEFAULT_SETTINGS }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await localforage.setItem(SETTINGS_KEY, settings)
}

/** Список активных сетей с заполненными ID: [{store:'magnit', storeId:'1234'}] */
export async function getActiveStores(): Promise<{ store: StoreId; storeId: string }[]> {
  const s = await loadSettings()
  return (Object.entries(s.stores) as [StoreId, Settings['stores'][StoreId]][])
    .filter(([, sel]) => sel.enabled && sel.storeId.trim())
    .map(([store, sel]) => ({ store, storeId: sel.storeId.trim() }))
}

// ---- Цены по конкретным магазинам ----
// Ключ вида: prices:magnit:1234 => StorePrices
export function priceKey(store: StoreId, storeId: string): string {
  return `prices:${store}:${storeId}`
}

export async function savePrices(store: StoreId, storeId: string, data: StorePrices): Promise<void> {
  await localforage.setItem(priceKey(store, storeId), data)
}

export async function loadPrices(store: StoreId, storeId: string): Promise<StorePrices | null> {
  return localforage.getItem<StorePrices>(priceKey(store, storeId))
}

/** Все сохранённые цены: map "store:storeId" -> StorePrices */
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

// ---- Меню + список покупок ----
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
