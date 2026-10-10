// ShoppingList.tsx — список покупок по КОНКРЕТНЫМ магазинам (сеть + ID филиала),
// внутри магазина — группировка по категориям, чекбоксы с зачёркиванием,
// итоговая сумма по каждому магазину и общая, автосохранение в IndexedDB
import { useEffect, useMemo, useState } from 'react'
import { ShoppingCart, Trash2, MapPin } from 'lucide-react'
import type { GeneratedMenu, ShoppingItem, StoreId } from '../types'
import { STORE_LABELS } from '../types'
import { loadMenu, saveMenu, clearMenu } from '../lib/storage'

export default function ShoppingList() {
  const [menu, setMenu] = useState<GeneratedMenu | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadMenu().then((m) => {
      setMenu(m)
      setLoaded(true)
    })
  }, [])

  /** Обновление чекбокса позиции + автосохранение в IndexedDB */
  const toggleItem = async (id: string) => {
    if (!menu) return
    const items = menu.items.map((it) =>
      it.id === id ? { ...it, checked: !it.checked } : it
    )
    const updated = { ...menu, items }
    setMenu(updated)
    await saveMenu(updated) // состояние сохраняется при каждом клике
  }

  const handleClear = async () => {
    if (!confirm('Удалить меню и список покупок?')) return
    await clearMenu()
    setMenu(null)
  }

  // Группировка: конкретный магазин ("store:storeId") -> категория -> позиции
  const grouped = useMemo(() => {
    if (!menu) return []
    const byStore = new Map<string, Map<string, ShoppingItem[]>>()
    for (const it of menu.items) {
      const key = `${it.store}:${it.storeId}`
      if (!byStore.has(key)) byStore.set(key, new Map())
      const cats = byStore.get(key)!
      const cat = it.category || 'прочее'
      if (!cats.has(cat)) cats.set(cat, [])
      cats.get(cat)!.push(it)
    }
    return [...byStore.entries()].map(([key, cats]) => ({
      key,
      store: key.split(':')[0] as StoreId,
      storeId: key.split(':')[1] || '',
      categories: [...cats.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru'))
    }))
  }, [menu])

  // Автоматический подсчёт сумм: общая, по магазинам, «уже в корзине»
  const sumOf = (items: ShoppingItem[]) =>
    items.reduce((s, it) => s + it.price * it.qty, 0)
  const total = menu ? sumOf(menu.items) : 0
  const boughtTotal = menu ? sumOf(menu.items.filter((it) => it.checked)) : 0
  const checkedCount = menu ? menu.items.filter((it) => it.checked).length : 0

  if (loaded && !menu) {
    return (
      <div className="card flex flex-col items-center gap-3 py-10 text-center">
        <ShoppingCart size={48} className="text-slate-400" />
        <p className="text-slate-600 dark:text-slate-400">
          Список покупок пуст.
          <br />
          Сначала сгенерируйте меню на вкладке «Меню».
        </p>
      </div>
    )
  }

  if (!menu) return null

  return (
    <div className="space-y-4">
      {/* Общие итоги */}
      <section className="card">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">Итого по списку</div>
            <div className="text-2xl font-bold tabular-nums">{total.toFixed(2)} ₽</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-500">Уже в корзине</div>
            <div className="text-lg font-semibold tabular-nums text-green-600">
              {boughtTotal.toFixed(2)} ₽
            </div>
          </div>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: total ? `${(boughtTotal / total) * 100}%` : '0%' }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>Отмечено {checkedCount} из {menu.items.length}</span>
          <button
            onClick={handleClear}
            className="inline-flex min-h-[48px] items-center gap-1 px-2 text-red-600 hover:underline"
          >
            <Trash2 size={16} /> Очистить список
          </button>
        </div>
      </section>

      {/* По конкретным магазинам (сеть + ID филиала) -> категории */}
      {grouped.map(({ key, store, storeId, categories }) => {
        const storeItems = categories.flatMap(([, items]) => items)
        const storeSum = sumOf(storeItems)
        const storeBought = sumOf(storeItems.filter((it) => it.checked))
        return (
          <section key={key} className="card">
            <h2 className="mb-1 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 text-lg font-bold dark:border-slate-800">
              <MapPin size={18} className="text-green-600" />
              {STORE_LABELS[store] ?? store}
              {storeId && (
                <span className="rounded bg-slate-100 px-1.5 text-xs font-normal text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  ID {storeId}
                </span>
              )}
              <span className="ml-auto text-sm font-semibold tabular-nums">
                {storeSum.toFixed(2)} ₽
              </span>
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              В корзине из этого магазина: {storeBought.toFixed(2)} ₽ · позиций {storeItems.length}
            </p>

            {categories.map(([category, items]) => (
              <div key={category} className="mb-3 last:mb-0">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {category}
                </h3>
                <ul>
                  {items.map((it) => (
                    <li key={it.id}>
                      <label className="flex min-h-[48px] cursor-pointer items-center gap-3 py-1">
                        <input
                          type="checkbox"
                          checked={it.checked}
                          onChange={() => toggleItem(it.id)}
                          className="h-6 w-6 shrink-0 accent-green-600"
                        />
                        <span className={`flex-1 ${it.checked ? 'line-through text-slate-400 dark:text-slate-600' : ''}`}>
                          {it.name}
                          <span className="ml-1 text-sm text-slate-500">× {it.qty} {it.unit}</span>
                        </span>
                        <span className={`font-medium tabular-nums ${it.checked ? 'line-through text-slate-400' : ''}`}>
                          {(it.price * it.qty).toFixed(2)} ₽
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
