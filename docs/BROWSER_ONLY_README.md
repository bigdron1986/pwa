# Browser-only версия проекта

Весь код для работы только через браузер (StackBlitz + Colab/Yandex Cloud):

- pwa/            — фронтенд для StackBlitz (vite-plugin-pwa отключён в vite.config.ts,
                    чтобы не ломать предпросмотр в iframe StackBlitz; остальной стек тот же:
                    React+TS+Tailwind+localforage+lucide-react)
- cloud_function/ — бэкенд ТОЛЬКО на requests + BeautifulSoup (без Playwright/Selenium),
                  main.py запускается в Google Colab как скрипт и как handler для Yandex Cloud Functions

Инструкции без терминала: docs/DEPLOY_BROWSER_ONLY.md
