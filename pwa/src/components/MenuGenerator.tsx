// MenuGenerator.tsx — генерация меню на 3 дня (mock GigaChat) + список покупок с актуальными ценами
import { useEffect, useState } from 'react'
import { Sparkles, Loader2, ArrowRight, BookOpen } from 'lucide-react'
import recipesData from '../data/recipes.json'
import type {
  Recipe, Settings, StorePrices, ShoppingItem, GeneratedMenu, MenuDay, StoreId
} from '../types'
import { STORE_LABELS } from '../types'
import { loadSettings, loadAllPrices, saveMenu, loadMenu } from '../lib/storage'

const RECIPES = recipesData as Recipe[]
const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда']

/** Простейший поиск цены продукта по размытому совпадению имени во всех загруженных магазинах */
function findPrice(
  name: string,
  allPrices: Record<string, StorePrices>,
  preferredStores: StoreId[]
): { store: StoreId; price: number; category: string; matchedName: string } | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^а-яёa-z0-9]/gi, '')
  const key = norm(name)
  let best: { store: StoreId; price: number; category: string; matchedName: string; score: number } | null = null

  for (const [storeStr, data] of Object.entries(allPrices)) {
    const store = storeStr as StoreId
    for (const p of data.products) {
      const pn = norm(p.name)
      // Совпадение: полное вхождение одного слова из названия или начала строки
      const tokens = key.split(' ').filter(Boolean)
      const hit = tokens.some((t) => t.length > 3 && pn.includes(t)) || pn.includes(key)
      if (!hit) continue
      const preferred = preferredStores.includes(store) ? 0 : 1000
      const candidate = { store, price: p.price, category: p.category, matchedName: p.name, score: preferred + p.price }
      if (!best || candidate.score < best.score) best = candidate
    }
  }
  return best
}

/**
 * ЗАГЛУШКА генерации меню.
 * Возвращает JSON: меню на 3 дня + список покупок с ценами.
 */
async function generateMenuMock(
  settings: Settings,
  allPrices: Record<string, StorePrices>
): Promise<GeneratedMenu> {
  // ЗДЕСЬ БУДЕТ ВЫЗОВ API GigaChat
  // Пример реального кода:
  //   const resp = await fetch('/api/gigachat', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  //     body: JSON.stringify({ prompt: buildPrompt(settings, recipes, allPrices) })
  //   })
  //   return parseGigaChatResponse(await resp.json())
  //
  // Пока имитируем задержку модели и собираем меню детерминированно из локальной базы рецептов.
  await new Promise((r) => setTimeout(r, 1500))

  const people = settings.adults + settings.children
  const allergyWords = settings.allergies
    .toLowerCase()
    .split(/[,\n;.]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2)

  // Фильтр рецептов по аллергиям/нелюбимым продуктам
  const allowed = RECIPES.filter((r) => {
    const text = (r.name + ' ' + r.ingredients.map((i) => i.name).join(' ')).toLowerCase()
    return !allergyWords.some((w) => text.includes(w))
  })

  const byCat = (cat: Recipe['category']) => allowed.filter((r) => r.category === cat)
  const pick = <T,>(arr: T[], i: number): T => arr[i % arr.length]

  const days: MenuDay[] = DAY_NAMES.map((day, di) => ({
    day,
    breakfast: pick(byCat('завтрак'), di).name,
    lunch: pick(byCat('обед'), di + 1).name,
    dinner: pick(byCat('ужин'), di).name
  }))

  // Сбор ингредиентов выбранных рецептов -> позиции списка покупок
  const chosenRecipes = days
    .flatMap((d) => [d.breakfast, d.lunch, d.dinner])
    .map((name) => allowed.find((r) => r.name === name))
    .filter((r): r is Recipe => Boolean(r))

  const merged = new Map<string, { qty: number; unit: string; name: string }>()
  for (const r of chosenRecipes) {
    for (const ing of r.ingredients) {
      const k = ing.name.toLowerCase()
      const cur = merged.get(k)
      if (cur) cur.qty += ing.qty
      else merged.set(k, { name: ing.name, qty: ing.qty, unit: ing.unit })
    }
  }

  const items: ShoppingItem[] = []
  let total = 0
  for (const [, ing] of merged) {
    // Порция масштабируется на количество человек (база ~2 порции)
    const scaledQty = Math.round((ing.qty * people) / 2 * 10) / 10
    const found = findPrice(ing.name, allPrices, settings.stores)
    const store = found?.store ?? settings.stores[0] ?? 'magnit'
    const price = found?.price ?? 0
    const subtotal = Math.round(price * scaledQty * 100) / 100
    total += subtotal
    items.push({
      id: `${store}-${ing.name}`,
      name: found?.matchedName ?? ing.name,
      qty: scaledQty,
      unit: ing.unit,
      store,
      category: found?.category ?? 'прочее',
      price,
      checked: false
    })
  }

  return {
    days,
    items,
    total: Math.round(total * 100) / 100,
    generatedAt: new Date().toISOString()
  }
}

export default function MenuGenerator({ onGoToCart }: { onGoToCart: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(false)
  const [menu, setMenu] = useState<GeneratedMenu | null>(null)
  const [pricesReady, setPricesReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const [s, prices, saved] = await Promise.all([loadSettings(), loadAllPrices(), loadMenu()])
      setSettings(s)
      setMenu(saved)
      setPricesReady(Object.keys(prices).length > 0)
    })()
  }, [])

  const handleGenerate = async () => {
    if (!settings) return
    setLoading(true)
    setError(null)
    try {
      const allPrices = await loadAllPrices()
      const result = await generateMenuMock(settings, allPrices)
      await saveMenu(result)
      setMenu(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <button className="btn-primary" onClick={handleGenerate} disabled={loading}>
        {loading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
        {loading ? 'GigaChat думает...' : 'Сгенерировать меню на неделю'}
      </button>

      {!pricesReady && (
        <p className="card text-sm text-amber-700 dark:text-amber-400">
          Цены ещё не загружены — сначала нажмите «Обновить цены» на вкладке «Цены».
          Без цен список покупок будет без стоимости.
        </p>
      )}

      {error && (
        <p className="card text-sm text-red-700 dark:text-red-400">Ошибка: {error}</p>
      )}

      {menu && (
        <>
          <section className="card">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
              <BookOpen size={20} className="text-green-600" /> Меню на {menu.days.length} дня
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              Сгенерировано: {new Date(menu.generatedAt).toLocaleString('ru-RU')}
            </p>
            <div className="space-y-3">
              {menu.days.map((d) => (
                <div key={d.day} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <div className="mb-1 font-bold text-green-700 dark:text-green-400">{d.day}</div>
                  <ul className="space-y-1 text-sm">
                    <li><span className="text-slate-500">Завтрак:</span> {d.breakfast}</li>
                    <li><span className="text-slate-500">Обед:</span> {d.lunch}</li>
                    <li><span className="text-slate-500">Ужин:</span> {d.dinner}</li>
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="mb-2 text-lg font-bold">Список покупок</h2>
            <p className="mb-3 text-sm">
              Позиций: <b>{menu.items.length}</b> · Итого:{' '}
              <b className={menu.total > settings!.budgetMax ? 'text-red-600' : 'text-green-600'}>
                {menu.total.toFixed(2)} ₽
              </b>{' '}
              <span className="text-slate-500">
                (бюджет {settings!.budgetMin}–{settings!.budgetMax} ₽)
              </span>
            </p>
            <ul className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
              {menu.items.slice(0, 8).map((it) => (
                <li key={it.id} className="flex justify-between py-2">
                  <span>
                    {it.name} <span className="text-slate-500">× {it.qty} {it.unit}</span>
                  </span>
                  <span className="font-medium tabular-nums">{(it.price * it.qty).toFixed(0)} ₽</span>
                </li>
              ))}
            </ul>
            {menu.items.length > 8 && (
              <p className="mt-2 text-xs text-slate-500">…и ещё {menu.items.length - 8} позиций</p>
            )}
          </section>

          <button className="btn-secondary" onClick={onGoToCart}>
            Открыть полный список покупок <ArrowRight size={20} />
          </button>
        </>
      )}

      {!menu && !loading && (
        <p className="px-1 text-center text-sm text-slate-500">
          Нажмите кнопку выше — меню соберётся из {RECIPES.length} локальных рецептов
          с учётом бюджета, состава семьи и аллергий.
        </p>
      )}
    </div>
  )
}

// Переиспользуемая подпись магазина для других компонентов
export const storeLabel = (id: StoreId) => STORE_LABELS[id]
