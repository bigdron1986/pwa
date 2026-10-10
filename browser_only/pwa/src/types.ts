// Общие типы приложения

export type StoreId = 'magnit' | 'monetka' | 'pyaterochka' | 'megapolis'

export const STORE_LABELS: Record<StoreId, string> = {
  magnit: 'Магнит',
  monetka: 'Монетка',
  pyaterochka: 'Пятёрочка',
  megapolis: 'Мегаполис'
}

/** Настройки пользователя */
export interface Settings {
  budgetMin: number // минимальный бюджет на неделю, ₽
  budgetMax: number // максимальный бюджет на неделю, ₽
  adults: number
  children: number
  allergies: string // аллергии и нелюбимые продукты (текст)
  stores: StoreId[] // выбранные магазины
  cloudFunctionUrl: string // URL Yandex Cloud Function с ценами
}

/**Ingredient рецепта */
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

/** Актуальная цена продукта из облачной функции */
export interface PriceItem {
  name: string
  price: number
  category: string
}

/** Ответ Yandex Cloud Function /api/prices */
export interface StorePrices {
  store: StoreId
  updated_at: string
  products: PriceItem[]
}

/** Позиция списка покупок */
export interface ShoppingItem {
  id: string
  name: string
  qty: number
  unit: string
  store: StoreId
  category: string
  price: number // цена за единицу, ₽
  checked: boolean
}

/** Сгенерированное меню */
export interface MenuDay {
  day: string // Понедельник и т.д.
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
