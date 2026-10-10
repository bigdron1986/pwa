// Settings.tsx — настройки: бюджет, люди, аллергии, адрес/геолокация,
// выбор сетей + ID конкретного магазина для каждой сети
import { useEffect, useState } from 'react'
import { Save, Users, Wallet, Cloud, MapPin, LocateFixed, Search } from 'lucide-react'
import type { Settings as TSettings, StoreId, StoreSelection } from '../types'
import { STORE_LABELS, STORE_ID_HINTS } from '../types'
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../lib/storage'

const ALL_STORES: StoreId[] = ['magnit', 'monetka', 'pyaterochka', 'megapolis']

export default function Settings({ onSaved }: { onSaved?: () => void }) {
  const [s, setS] = useState<TSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [geoMsg, setGeoMsg] = useState<string | null>(null)

  useEffect(() => {
    loadSettings().then(setS)
  }, [])

  const patch = (p: Partial<TSettings>) => {
    setS((prev) => ({ ...prev, ...p }))
    setSaved(false)
  }

  const patchStore = (id: StoreId, p: Partial<StoreSelection>) => {
    setS((prev) => ({
      ...prev,
      stores: { ...prev.stores, [id]: { ...prev.stores[id], ...p } }
    }))
    setSaved(false)
  }

  /** Кнопка «Определить геолокацию» — браузерный API */
  const handleGeolocate = () => {
    if (!('geolocation' in navigator)) {
      setGeoMsg('Геолокация не поддерживается браузером')
      return
    }
    setGeoMsg('Определяю местоположение...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        // Пока просто сохраняем координаты как текст адреса;
        // позже здесь будет геокодинг (координаты -> читаемый адрес)
        patch({ address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` })
        setGeoMsg(`Координаты получены: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
      },
      (err) => setGeoMsg(`Ошибка геолокации: ${err.message}. Разрешите доступ или введите адрес вручную.`),
      { timeout: 10000 }
    )
    setTimeout(() => setGeoMsg(null), 5000)
  }

  /** ЗАГЛУШКА: поиск ближайших магазинов сети. Позже — реальный запрос к API сети */
  const findNearby = (id: StoreId) => {
    alert(
      `Поиск магазинов «${STORE_LABELS[id]}» рядом с адресом\n"${s.address || '(адрес не указан)'}"\n\n` +
      'Эта функция появится позже. Пока впишите ID вашего магазина вручную — ' +
      'его легко найти на сайте сети (см. подсказку под полем).'
    )
  }

  const handleSave = async () => {
    const clean: TSettings = {
      ...s,
      budgetMin: Math.max(0, s.budgetMin),
      budgetMax: Math.max(s.budgetMin, s.budgetMax),
      adults: Math.max(1, s.adults),
      children: Math.max(0, s.children),
      cloudFunctionUrl: s.cloudFunctionUrl.trim(),
      address: s.address.trim()
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
            <input id="bmin" type="number" inputMode="numeric" className="input"
              value={s.budgetMin || ''}
              onChange={(e) => patch({ budgetMin: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label" htmlFor="bmax">Максимум, ₽</label>
            <input id="bmax" type="number" inputMode="numeric" className="input"
              value={s.budgetMax || ''}
              onChange={(e) => patch({ budgetMax: Number(e.target.value) })} />
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
            <input id="adults" type="number" inputMode="numeric" min={1} className="input"
              value={s.adults || ''}
              onChange={(e) => patch({ adults: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label" htmlFor="children">Дети</label>
            <input id="children" type="number" inputMode="numeric" min={0} className="input"
              value={s.children || ''}
              onChange={(e) => patch({ children: Number(e.target.value) })} />
          </div>
        </div>
      </section>

      {/* Аллергии */}
      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Аллергии и нелюбимые продукты</h2>
        <textarea className="input min-h-[96px] resize-y"
          placeholder="Например: непереносимость лактозы, аллергия на орехи, не едим печень..."
          value={s.allergies}
          onChange={(e) => patch({ allergies: e.target.value })} />
      </section>

      {/* Адрес + геолокация */}
      <section className="card">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <MapPin size={20} className="text-green-600" /> Мой адрес
        </h2>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="г. Екатеринбург, ул. Ленина, 45"
            value={s.address}
            onChange={(e) => patch({ address: e.target.value })} />
          <button type="button" onClick={handleGeolocate}
            className="btn-secondary !w-auto shrink-0 px-3" title="Определить геолокацию">
            <LocateFixed size={20} />
          </button>
        </div>
        {geoMsg && <p className="mt-2 text-sm text-slate-500">{geoMsg}</p>}
        <p className="mt-2 text-xs text-slate-500">
          Нужен для будущего поиска магазинов рядом. Сейчас достаточно ввести один раз.
        </p>
      </section>

      {/* Магазины: чекбокс сети + ID конкретного филиала */}
      <section className="card">
        <h2 className="mb-1 text-lg font-bold">Магазины</h2>
        <p className="mb-3 text-sm text-slate-500">
          Отметьте нужные сети и впишите <b>ID вашего магазина</b> — цены будут браться
          именно из этого филиала.
        </p>

        <div className="space-y-4">
          {ALL_STORES.map((id) => {
            const sel = s.stores[id]
            return (
              <div key={id}
                className={`rounded-xl border p-3 transition ${
                  sel.enabled ? 'border-green-600 bg-green-600/5' : 'border-slate-300 dark:border-slate-700'
                }`}>
                <label className="flex min-h-[48px] cursor-pointer items-center gap-2 text-base">
                  <input type="checkbox" className="h-5 w-5 accent-green-600"
                    checked={sel.enabled}
                    onChange={(e) => patchStore(id, { enabled: e.target.checked })} />
                  <span className="font-semibold">{STORE_LABELS[id]}</span>
                  {sel.enabled && sel.storeId.trim() && (
                    <span className="ml-auto rounded-full bg-green-600/15 px-2 py-0.5 text-xs text-green-700 dark:text-green-400">
                      ID: {sel.storeId}
                    </span>
                  )}
                </label>

                {sel.enabled && (
                  <div className="mt-2 space-y-2">
                    <label className="label" htmlFor={`sid-${id}`}>ID моего магазина</label>
                    <div className="flex gap-2">
                      <input id={`sid-${id}`} className="input flex-1" inputMode="numeric"
                        placeholder="например, 1234"
                        value={sel.storeId}
                        onChange={(e) => patchStore(id, { storeId: e.target.value })} />
                      <button type="button" onClick={() => findNearby(id)}
                        className="btn-secondary !w-auto shrink-0 px-3" title="Найти магазины рядом">
                        <Search size={20} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">💡 {STORE_ID_HINTS[id]}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Yandex Cloud Function */}
      <section className="card">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <Cloud size={20} className="text-green-600" /> Источник актуальных цен
        </h2>
        <label className="label" htmlFor="cfurl">URL Yandex Cloud Function (/api/prices)</label>
        <input id="cfurl" type="url" inputMode="url" className="input"
          placeholder="https://functions.yandexcloud.net/d4exxxxxxxxxx"
          value={s.cloudFunctionUrl}
          onChange={(e) => patch({ cloudFunctionUrl: e.target.value })} />
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
