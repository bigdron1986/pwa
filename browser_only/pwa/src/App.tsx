// App.tsx — корневой компонент: нижняя навигация (роутинг по вкладкам), тема, экраны
import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Tags, Sparkles, ShoppingCart, Moon, Sun } from 'lucide-react'
import Settings from './components/Settings'
import PriceManager from './components/PriceManager'
import MenuGenerator from './components/MenuGenerator'
import ShoppingList from './components/ShoppingList'
import { loadTheme, saveTheme } from './lib/storage'

// Навигация через состояние activeTab (без react-router)
type Tab = 'settings' | 'prices' | 'menu' | 'list'

const TABS: { id: Tab; label: string; icon: typeof SettingsIcon }[] = [
  { id: 'settings', label: 'Настройки', icon: SettingsIcon },
  { id: 'prices', label: 'Цены', icon: Tags },
  { id: 'menu', label: 'Меню', icon: Sparkles },
  { id: 'list', label: 'Покупки', icon: ShoppingCart }
]

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('settings')
  const [dark, setDark] = useState(false)

  // Применение темы: сохранённая настройка + системная
  useEffect(() => {
    loadTheme().then((t) => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setDark(t === 'dark' || (t === 'system' && prefersDark))
    })
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    saveTheme(next ? 'dark' : 'light')
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {/* Шапка */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-green-600 px-4 py-3 text-white shadow">
        <h1 className="text-lg font-bold">Бюджет на продукты</h1>
        <button
          onClick={toggleTheme}
          aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}
          className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl bg-white/15 active:scale-95"
        >
          {dark ? <Sun size={22} /> : <Moon size={22} />}
        </button>
      </header>

      {/* Контент вкладки */}
      <main className="flex-1 px-3 py-4 pb-24">
        {activeTab === 'settings' && <Settings onSaved={() => {}} />}
        {activeTab === 'prices' && <PriceManager />}
        {activeTab === 'menu' && <MenuGenerator onGoToCart={() => setActiveTab('list')} />}
        {activeTab === 'list' && <ShoppingList />}
      </main>

      {/* Нижняя навигация */}
      <nav className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-md border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition
              ${activeTab === id
                ? 'text-green-600 dark:text-green-400'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            aria-current={activeTab === id ? 'page' : undefined}
          >
            <Icon size={22} strokeWidth={activeTab === id ? 2.5 : 2} />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
