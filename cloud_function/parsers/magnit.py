"""Парсер цен Магнита (https://magnit.ru/delivery/).

Стратегия:
1. Основная — запрос к внутреннему JSON-API каталога доставки
   (обычно <api-host>/public/api/v2/catalog/products). Если изменится — см. шаг 2.
2. Запасная — Playwright: открываем мобильную страницу доставки и
   вытаскиваем карточки товаров из DOM.
3. Если оба способа не сработали — отдаём демо-набор, чтобы PWA оставалась рабочей,
   но в ответе ставим "source": "fallback".
"""
from typing import Dict, List

import requests
from bs4 import BeautifulSoup

from . import DEFAULT_HEADERS, logger, dedupe, make_product

STORE_ID = "magnit"
CATALOG_URLS = [
    # публичные JSON-эндпоинты каталога доставки (могут меняться)
    "https://magnit.ru/public/api/v2/catalog/products?limit=50",
    "https://magnet-app.ru/api/v1/catalog/products?limit=50",
]
MOBILE_PAGE = "https://magnit.ru/delivery/"

# Демо-цены, если парсинг недоступен (сайт за антиботом / нет сети)
FALLBACK_PRODUCTS: List[Dict] = [
    {"name": "Молоко 3.2% 1л", "price": 89.90, "category": "молочка"},
    {"name": "Хлеб белый 700г", "price": 45.00, "category": "хлеб"},
    {"name": "Яйцо С1 x10", "price": 109.90, "category": "бакалея"},
    {"name": "Куриное филе 1кг", "price": 389.00, "category": "мясо"},
    {"name": "Картофель 1кг", "price": 54.90, "category": "овощи"},
    {"name": "Гречка 800г", "price": 78.50, "category": "бакалея"},
    {"name": "Творог 5% 200г", "price": 95.00, "category": "молочка"},
]


def _parse_json_api() -> List[Dict]:
    """Пробуем получить товары из внутреннего JSON-API."""
    for url in CATALOG_URLS:
        try:
            resp = requests.get(url, headers=DEFAULT_HEADERS, timeout=15)
            if resp.status_code != 200:
                logger.warning("magnit: %s вернул %s", url, resp.status_code)
                continue
            data = resp.json()
            items = data.get("products") or data.get("items") or data.get("data") or []
            products = []
            for it in items:
                name = it.get("name") or it.get("title") or ""
                price = (
                    it.get("price") or it.get("retailPrice")
                    or (it.get("prices") or {}).get("basic")
                )
                cat = (
                    it.get("category") or it.get("categoryName")
                    or (it.get("category") or {}).get("name") or "прочее"
                )
                if isinstance(cat, dict):
                    cat = cat.get("name", "прочее")
                products.append(make_product(name, price, cat))
            products = dedupe(products)
            if products:
                logger.info("magnit: получено %d товаров из JSON-API", len(products))
                return products
        except Exception as e:  # noqa: BLE001
            logger.warning("magnit: JSON-API %s не сработал: %s", url, e)
    return []


def _parse_html() -> List[Dict]:
    """Запасной вариант: HTML мобильной страницы + BeautifulSoup."""
    try:
        resp = requests.get(MOBILE_PAGE, headers=DEFAULT_HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        products = []
        # Типичные селекторы карточек; при редизайне — обновить
        for card in soup.select(
            "[class*='product-card'], [class*='ProductCard'], article"
        )[:60]:
            name_el = card.select_one(
                "[class*='title'], [class*='name'], h3, h4"
            )
            price_el = card.select_one("[class*='price']")
            cat_el = card.select_one("[class*='category'], [data-category]")
            if not name_el or not price_el:
                continue
            cat = cat_el.get("data-category") if cat_el and cat_el.has_attr("data-category") else "прочее"
            products.append(make_product(name_el.get_text(), price_el.get_text(), cat))
        products = dedupe(products)
        if products:
            logger.info("magnit: получено %d товаров из HTML", len(products))
        return products
    except Exception as e:  # noqa: BLE001
        logger.error("magnit: HTML-парсинг не сработал: %s", e)
        return []


def _parse_playwright() -> List[Dict]:
    """Если нужен рендеринг JS — раскомментируйте и установите playwright.

    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        page = browser.new_page(user_agent=DEFAULT_HEADERS["User-Agent"],
                                viewport={"width": 390, "height": 844})
        page.goto(MOBILE_PAGE, timeout=30000)
        page.wait_for_selector("[class*='product']", timeout=15000)
        cards = page.query_selector_all("[class*='product-card']")
        ...
        browser.close()
    """
    return []


def get_products() -> Dict:
    """Возвращает {'products': [...], 'source': 'api|html|fallback'}."""
    products = _parse_json_api()
    source = "api"
    if not products:
        products = _parse_playwright() or _parse_html()
        source = "playwright/html"
    if not products:
        logger.warning("magnit: отдаём fallback-цены")
        products, source = FALLBACK_PRODUCTS, "fallback"
    return {"products": products, "source": source}
