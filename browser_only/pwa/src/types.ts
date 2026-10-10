// Общие типы приложения (версия с конкретными магазинами по ID)

export type StoreId = 'magnit' | 'monetka' | 'pyaterochka' | 'megapolis'

export const STORE_LABELS: Record<StoreId, string> = {
  magnit: 'Магнит',
  monetka: 'Монетка',
  pyaterochka: 'Пятёрочка',
  megapolis: 'Мегаполис'
}

/** Как найти ID своего магазина в каждой сети (подсказка в UI) */
export const STORE_ID_HINTS: Record<StoreId, string> = {
  magnit: "magnit.ru/delivery → выберите магазин → ID в URL: .../delivery/?shopId=XXXX",
  pyaterochka: "5ka.ru → переключатель магазина → число после /city/ или в адресе страницы",
  monetka: "ekamonetka.ru → выбор точки на карте → числовой ID в URL страницы магазина",
  megapolis: "mega-polis.ru → «Адреса» → номер магазина из названия страницы/URL"
}

/** Выбор одной сети: включена ли + ID конкретного магазина */
export interface StoreSelection {
  enabled: boolean
  storeId: string // ID конкретного магазина на сайте сети, напр. "1234"
}

/** Настройки пользователя */
export interface Settings {
  budgetMin: number // минимальный бюджет на неделю, ₽
  budgetMax: number // максимальный бюджет на неделю, ₽
  adults: number
  children: number
  allergies: string // аллергии и нелюбимые продукты (текст)
  address: string // мой адрес (для будущего поиска магазинов рядом)
  stores: Record<StoreId, StoreSelection> // чекбокс + ID для каждой сети
  cloudFunctionUrl: string // URL Yandex Cloud Function с ценами
}

/** Ингредиент рецепта */
export interface RecipeIngredient {
  name: string
  qty: number
  unit: string // г, мл, шт, ст.л. ...
}

export type RecipeCategory = 'завтрак' | 'обед' | 'ужин'

export interface Recipe {
  id: string
  name: string
  category: RecipeCategory
  ingredients: RecipeIngredient[]
  steps: string[]
}

/** Товар с актуальной ценой конкретного магазина */
export interface PriceItem {
  name: string
  price: number
  category: string
}

/** Ответ облачной функции по одному магазину */
export interface StorePrices {
  store: StoreId
  store_id: string // ID конкретного магазина (филиала)
  updated_at: string
  products: PriceItem[]
  source?: string // api | html | fallback
  error?: string // если парсинг этого магазина не удался
}

/** Позиция списка покупок */
export interface ShoppingItem {
  id: string
  name: string
  qty: number
  unit: string
  store: StoreId
  storeId: string // ID филиала, к которому идём за покупкой
  category: string
  price: number // цена за единицу, ₽
  checked: boolean
}

export interface MenuDay {
  day: string
  breakfast: string
  lunch: string
  dinner: string
}

export interface GeneratedMenu {
  days: MenuDay[]
  items: ShoppingItem[]
  total: number
  generatedAt: string
}
