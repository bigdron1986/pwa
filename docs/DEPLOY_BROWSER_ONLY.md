# Деплой без терминала (только браузер)

## Шаг А — StackBlitz (фронтенд)
1. Зайдите на stackblitz.com, войдите через Google.
2. «Create New Project» -> шаблон «Vite + React + TS».
3. Создавайте файлы по путям из папки browser_only/pwa (ПКМ по папке -> New File -> вводите путь целиком, например src/components/Settings.tsx). Удаляйте лишние файлы шаблона (src/App.css, src/assets).
4. Откройте файл -> Ctrl+A -> вставьте код -> Ctrl+S. После замены package.json подождите 30-60 сек (установка зависимостей).
5. Справа в предпросмотре увидите приложение. Данные сохраняются в IndexedDB браузера.

## Шаг Б — Google Colab (бэкенд, тест)
1. colab.research.google.com -> Файл -> Новый тетрадь.
2. Ячейка 1: !pip install requests beautifulsoup4 -q (кнопка ▶️).
3. Вкладка «Файлы» слева: загрузите main.py, requirements.txt и папку parsers/__init__.py, parsers/magnit.py, parsers/pyaterochka.py (или выполните !mkdir -p parsers и создайте файлы).
4. Ячейка 2: !python main.py -> ▶️ -> увидите JSON с ценами (вероятно "source": "fallback").

## Шаг В — Yandex Cloud Functions
1. console.yandex.cloud -> Serverless -> Functions -> «Создать функцию».
2. Runtime Python 3.11, роль editor, триггер HTTP (GET), включить публичный доступ.
3. Во встроенном редакторе создайте main.py, requirements.txt и папку parsers с файлами, вставьте код.
4. Энтрипоинт: main.handler -> «Задеплоить».
5. Скопируйте URL триггера и вставьте в поле «URL Yandex Cloud Function» в настройках PWA.
