// PriceManager.tsx — обновление цен конкретных магазинов (по их ID)
// через Yandex Cloud Function: GET /api/prices?stores=magnit:1234,pyaterochka:9876
import { useEffect, useState } from 'react'
import { RefreshCw, CalendarClock, Store as StoreIcon, AlertTriangle } from 'lucide-react'
import type { Settings, StoreId, StorePrices, PriceItem } from '../types'
import { STORE_LABELS } from '../types'
import {
  loadSettings, savePrices, loadAllPrices, getLastPricesUpdate, getActiveStores
} from '../lib/storage'

/** Демо-цены на случай, если облачная функция не настроена/недоступна */
const DEMO_PRICES: Record<string, PriceItem[]> = {
  magnit: [
    { name: 'Молоко 3.2% 1л', price: 89.9, category: 'молочка' },
    { name: 'Хлеб белый 700г', price: 45.0, category: 'хлеб' },
    { name: 'Яйцо С1 x10', price: 109.9, category: 'бакалея' },
    { name: 'Куриное филе 1кг', price: 389.0, category: 'мясо' },
    { name: 'Картофель 1кг', price: 54.9, category: 'овощи' },
    { name: 'Гречка 800г', price: 78.5, category: 'бакалея' },
    { name: 'Творог 5% 200г', price: 95.0, category: 'молочка' }
  ],
  pyaterochka: [
    { name: 'Молоко 2.5% 950мл', price: 79.9, category: 'молочка' },
    { name: 'Хлеб нарезной 400г', price: 42.0, category: 'хлеб' },
    { name: 'Яйцо С1 х10', price: 99.9, category: 'бакалея' },
    { name: 'Бедро куриное 1кг', price: 329.0, category: 'мясо' },
    { name: 'Морковь 1кг', price: 49.9, category: 'овощи' },
    { name: 'Рис 900г', price: 95.0, category: 'бакалея' },
    { name: 'Сметана 20% 300г', price: 89.0, category: 'молочка' }
  ],
  monetka: [
    { name: 'Молоко 3.2% 1л', price: 84.5, category: 'молочка' },
    { name: 'Макароны 450г', price: 55.0, category: 'бакалея' },
    { name: 'Фарш говяжий 800г', price: 549.0, category: 'мясо' },
    { name: 'Капуста 1кг', price: 39.9, category: 'овощи' },
    { name: 'Сыр российский 200г', price: 169.0, category: 'молочка' }
  ],
  megapolis: [
    { name: 'Молоко 1л', price: 92.0, category: 'молочка' },
    { name: 'Скумбрия филе 500г', price: 420.0, category: 'рыба' },
    { name: 'Банан 1кг', price: 109.0, category: 'фрукты' },
    { name: 'Помидоры 1кг', price: 189.0, category: 'овощи' },
    { name: 'Масло сливочное 180г', price: 149.0, category: 'молочка' }
  ]
}

export default function PriceManager() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [allPrices, setAllPrices] = useState<Record<string, StorePrices>>({})
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const reload = async () => {
    const [s, prices, last] = await Promise.all([
      loadSettings(),
      loadAllPrices(),
      getLastPricesUpdate()
    ])
    setSettings(s)
    setAllPrices(prices)
    setLastUpdate(last)
  }

  useEffect(() => {
    reload()
  }, [])

  /**
   * Обновить цены по всем выбранным магазинам с заполненными ID.
   * Формат запроса: GET {cfUrl}/api/prices?stores=magnit:1234,pyaterochka:9876
   * Ответ функции: {"stores": [{"store":"magnit","store_id":"1234",...}, ...]}
   */
  const refreshPrices = async () => {
    if (!settings) return
    setLoading(true)
    setError(null)
    setNotice(null)

    const active = await getActiveStores()
    if (active.length === 0) {
      setError('Не выбрано ни одного магазина с ID. Укажите сеть и её ID в настройках.')
      setLoading(false)
      return
    }

    const base = settings.cloudFunctionUrl.replace(/\/+$/, '') // без хвостового слэша
    const param = active.map((a) => `${a.store}:${a.storeId}`).join(',')
    const results: Record<string, StorePrices> = {}
    let hadError = false

    try {
      if (base) {
        // Реальный запрос к Yandex Cloud Function
        const resp = await fetch(`${base}/api/prices?stores=${encodeURIComponent(param)}`, {
          headers: { Accept: 'application/json' }
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        // Поддержка двух форм ответа: массив stores или один объект
        const list: StorePrices[] = Array.isArray(data?.stores)
          ? data.stores
          : [data as StorePrices]

        for (const item of list) {
          if (item.error && (!item.products || item.products.length === 0)) {
            hadError = true
            setError(
              `${STORE_LABELS[item.store as StoreId] ?? item.store} ` +
              `(ID ${item.store_id}): ${item.error}`
            )
            continue
          }
          results[`${item.store}:${item.store_id}`] = item
          await savePrices(item.store as StoreId, item.store_id, item)
        }
      } else {
        // Демо-режим: URL функции не задан — генерируем локальные цены
        for (const { store, storeId } of active) {
          results[`${store}:${storeId}`] = {
            store,
            store_id: storeId,
            updated_at: new Date().toISOString(),
            products: DEMO_PRICES[store] ?? [],
            source: 'demo'
          }
          await savePrices(store, storeId, results[`${store}:${storeId}`])
        }
      }
    } catch (e) {
      hadError = true
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Не удалось получить цены (${msg}). Проверьте URL облачной функции и интернет.`)
    }

    setAllPrices(results)
    setLastUpdate(await getLastPricesUpdate())
    if (!hadError) {
      setNotice(`Цены обновлены для ${Object.keys(results).length} магазин(ов)`)
      setTimeout(() => setNotice(null), 3000)
    }
    setLoading(false)
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })

  return (
    <div className="space-y-4">
      <button className="btn-primary" onClick={refreshPrices} disabled={loading}>
        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Обновление...' : 'Обновить цены'}
      </button>

      {error && (
        <div className="card border border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <div className="flex items-start gap-2">
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}
      {notice && (
        <div className="card border border-green-300 bg-green-50 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          {notice}
        </div>
      )}

      <div className="card flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <CalendarClock size={18} className="text-green-600" />
        {lastUpdate
          ? <>Последнее обновление цен: <b>{fmtDate(lastUpdate)}</b></>
          : 'Цены ещё ни разу не обновлялись'}
      </div>

      {Object.entries(allPrices).map(([key, data]) => (
        <section key={key} className="card">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
            <StoreIcon size={18} className="text-green-600" />
            {STORE_LABELS[data.store as StoreId] ?? data.store}
            <span className="rounded bg-slate-100 px-1.5 text-xs font-normal text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              ID {data.store_id}
            </span>
            {data.source === 'fallback' && (
              <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                демо-цены сайта
              </span>
            )}
            <span className="ml-auto text-xs font-normal text-slate-500">
              {fmtDate(data.updated_at)}
            </span>
          </h2>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {data.products.map((p) => (
              <li key={p.name} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.category}</div>
                </div>
                <div className="font-semibold tabular-nums">{p.price.toFixed(2)} ₽</div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {!settings?.cloudFunctionUrl && Object.keys(allPrices).length > 0 && (
        <p className="px-1 text-sm text-slate-500 dark:text-slate-400">
          Сейчас используются локальные демо-цены. Укажите URL Yandex Cloud Function
          в настройках, чтобы получать реальные цены вашего магазина.
        </p>
      )}
    </div>
  )
}
