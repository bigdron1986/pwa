// Settings.tsx — экран настроек: бюджет, люди, аллергии, магазины, URL облачной функции
import { useEffect, useState } from 'react'
import { Save, Users, Wallet, Cloud } from 'lucide-react'
import type { Settings as TSettings, StoreId } from '../types'
import { STORE_LABELS } from '../types'
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../lib/storage'

const ALL_STORES: StoreId[] = ['magnit', 'monetka', 'pyaterochka', 'megapolis']

export default function Settings({ onSaved }: { onSaved?: () => void }) {
  const [s, setS] = useState<TSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadSettings().then(setS)
  }, [])

  const patch = (p: Partial<TSettings>) => {
    setS((prev) => ({ ...prev, ...p }))
    setSaved(false)
  }

  const toggleStore = (id: StoreId) => {
    patch({
      stores: s.stores.includes(id)
        ? s.stores.filter((x) => x !== id)
        : [...s.stores, id]
    })
  }

  const handleSave = async () => {
    // Валидация диапазона бюджета
    const clean: TSettings = {
      ...s,
      budgetMin: Math.max(0, s.budgetMin),
      budgetMax: Math.max(s.budgetMin, s.budgetMax),
      adults: Math.max(1, s.adults),
      children: Math.max(0, s.children),
      cloudFunctionUrl: s.cloudFunctionUrl.trim()
    }
    await saveSettings(clean)
    setS(clean)
    setSaved(true)
    onSaved?.()
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="space-y-4">
      {/* Бюджет */}
      <section className="card">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <Wallet size={20} className="text-green-600" /> Бюджет на неделю
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="bmin">Минимум, ₽</label>
            <input
              id="bmin" type="number" inputMode="numeric" className="input"
              value={s.budgetMin || ''}
              onChange={(e) => patch({ budgetMin: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label" htmlFor="bmax">Максимум, ₽</label>
            <input
              id="bmax" type="number" inputMode="numeric" className="input"
              value={s.budgetMax || ''}
              onChange={(e) => patch({ budgetMax: Number(e.target.value) })}
            />
          </div>
        </div>
      </section>

      {/* Люди */}
      <section className="card">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <Users size={20} className="text-green-600" /> Количество человек
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="adults">Взрослые</label>
            <input
              id="adults" type="number" inputMode="numeric" min={1} className="input"
              value={s.adults || ''}
              onChange={(e) => patch({ adults: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="label" htmlFor="children">Дети</label>
            <input
              id="children" type="number" inputMode="numeric" min={0} className="input"
              value={s.children || ''}
              onChange={(e) => patch({ children: Number(e.target.value) })}
            />
          </div>
        </div>
      </section>

      {/* Аллергии */}
      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Аллергии и нелюбимые продукты</h2>
        <textarea
          className="input min-h-[96px] resize-y"
          placeholder="Например: непереносимость лактозы, аллергия на орехи, не едим печень..."
          value={s.allergies}
          onChange={(e) => patch({ allergies: e.target.value })}
        />
      </section>

      {/* Магазины */}
      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Магазины</h2>
        <div className="grid grid-cols-2 gap-2">
          {ALL_STORES.map((id) => (
            <label
              key={id}
              className={`flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-base transition
                ${s.stores.includes(id)
                  ? 'border-green-600 bg-green-600/10 font-semibold'
                  : 'border-slate-300 dark:border-slate-700'}`}
            >
              <input
                type="checkbox"
                className="h-5 w-5 accent-green-600"
                checked={s.stores.includes(id)}
                onChange={() => toggleStore(id)}
              />
              {STORE_LABELS[id]}
            </label>
          ))}
        </div>
      </section>

      {/* Yandex Cloud Function */}
      <section className="card">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <Cloud size={20} className="text-green-600" /> Источник актуальных цен
        </h2>
        <label className="label" htmlFor="cfurl">URL Yandex Cloud Function (/api/prices)</label>
        <input
          id="cfurl" type="url" inputMode="url" className="input"
          placeholder="https://functions.yandexcloud.net/d4exxxxxxxxxx"
          value={s.cloudFunctionUrl}
          onChange={(e) => patch({ cloudFunctionUrl: e.target.value })}
        />
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Оставьте пустым, чтобы использовать демо-цены.
        </p>
      </section>

      <button className="btn-primary" onClick={handleSave}>
        <Save size={20} />
        {saved ? 'Сохранено ✓' : 'Сохранить настройки'}
      </button>
    </div>
  )
}
