// PriceManager.tsx — получение актуальных цен из Yandex Cloud Function + хранение в IndexedDB
import { useEffect, useState } from 'react'
import { RefreshCw, CalendarClock, Store as StoreIcon, AlertTriangle } from 'lucide-react'
import type { Settings, StoreId, StorePrices, PriceItem } from '../types'
import { STORE_LABELS } from '../types'
import { loadSettings, savePrices, loadAllPrices, getLastPricesUpdate } from '../lib/storage'

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

  /** Обновить цены по всем выбранным магазинам */
  const refreshPrices = async () => {
    if (!settings) return
    setLoading(true)
    setError(null)
    setNotice(null)

    const base = settings.cloudFunctionUrl.replace(/\/+$/, '') // убираем хвостовой слэш
    const results: Record<string, StorePrices> = {}

    for (const store of settings.stores) {
      try {
        if (base) {
          // Реальный запрос к Yandex Cloud Function
          const resp = await fetch(`${base}/api/prices?store=${store}`, {
            headers: { Accept: 'application/json' }
          })
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
          const data = (await resp.json()) as StorePrices
          results[store] = data
          await savePrices(store, data)
        } else {
          // Демо-режим: URL функции не задан в настройках
          results[store] = {
            store,
            updated_at: new Date().toISOString(),
            products: DEMO_PRICES[store] ?? []
          }
          await savePrices(store, results[store])
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(
          `${STORE_LABELS[store]}: не удалось получить цены (${msg}). ` +
            'Проверьте URL облачной функции и интернет-соединение.'
        )
      }
    }

    setAllPrices(results)
    setLastUpdate(await getLastPricesUpdate())
    if (!error && !Object.keys(results).length === false) {
      setNotice('Цены обновлены')
      setTimeout(() => setNotice(null), 2500)
    }
    setLoading(false)
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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

      {Object.entries(allPrices).map(([store, data]) => (
        <section key={store} className="card">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
            <StoreIcon size={18} className="text-green-600" />
            {STORE_LABELS[store as StoreId] ?? store}
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
                <div className="font-semibold tabular-nums">
                  {p.price.toFixed(2)} ₽
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {!settings?.cloudFunctionUrl && Object.keys(allPrices).length > 0 && (
        <p className="px-1 text-sm text-slate-500 dark:text-slate-400">
          Сейчас используются демо-цены. Укажите URL Yandex Cloud Function в настройках,
          чтобы получать реальные цены с сайтов магазинов.
        </p>
      )}
    </div>
  )
}
