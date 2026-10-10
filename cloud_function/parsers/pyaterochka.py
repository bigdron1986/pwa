"""Парсер цен Пятёрочки (https://5ka.ru/).

Стратегия:
1. Внутренний JSON-API каталога https://api.5ka.ru/v1/... (нужный endpoint
   подставляется в 5KA_API_URL; часто меняется — проверяйте в DevTools сайта).
2. Запасной — HTML страницы через BeautifulSoup.
3. Fallback-демо-цены, если сайт недоступен / сработал антибот.
"""
import os
from typing import Dict, List

import requests
from bs4 import BeautifulSoup

from . import DEFAULT_HEADERS, logger, dedupe, make_product

STORE_ID = "pyaterochka"
# Эндпоинт можно переопределить переменной окружения при деплое функции
API_URL = os.environ.get(
    "5KA_API_URL",
    "https://api.5ka.ru/v1/cache/products?limit=50",
)
MOBILE_PAGE = "https://m.5ka.ru/catalog/"

FALLBACK_PRODUCTS: List[Dict] = [
    {"name": "Молоко 2.5% 950мл", "price": 79.90, "category": "молочка"},
    {"name": "Хлеб нарезной 400г", "price": 42.00, "category": "хлеб"},
    {"name": "Яйцо С1 х10", "price": 99.90, "category": "бакалея"},
    {"name": "Бедро куриное 1кг", "price": 329.00, "category": "мясо"},
    {"name": "Морковь 1кг", "price": 49.90, "category": "овощи"},
    {"name": "Рис 900г", "price": 95.00, "category": "бакалея"},
    {"name": "Сметана 20% 300г", "price": 89.00, "category": "молочка"},
]


def _parse_json_api() -> List[Dict]:
    """Пробуем внутренний JSON-API каталога."""
    try:
        resp = requests.get(API_URL, headers=DEFAULT_HEADERS, timeout=15)
        if resp.status_code != 200:
            logger.warning("pyaterochka: API вернул %s", resp.status_code)
            return []
        data = resp.json()
        items = data.get("products") or data.get("items") or data.get("results") or []
        products = []
        for it in items:
            name = it.get("name") or it.get("title") or ""
            price = it.get("price") or it.get("minPrice") or (it.get("cost") or {}).get("value")
            cat = it.get("category_name") or (it.get("category") or {}).get("name") or "прочее"
            if isinstance(cat, dict):
                cat = cat.get("name", "прочее")
            # у 5ka цены часто в копейках
            if isinstance(price, (int, float)) and price > 5000:
                price = price / 100.0
            products.append(make_product(name, price, cat))
        products = dedupe(products)
        if products:
            logger.info("pyaterochka: %d товаров из JSON-API", len(products))
        return products
    except Exception as e:  # noqa: BLE001
        logger.warning("pyaterochka: JSON-API не сработал: %s", e)
        return []


def _parse_html() -> List[Dict]:
    """Запасной вариант: мобильная HTML-витрина."""
    try:
        resp = requests.get(MOBILE_PAGE, headers=DEFAULT_HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        products = []
        for card in soup.select(
            "[class*='product-card'], [class*='ProductCard'], [class*='catalog-item']"
        )[:60]:
            name_el = card.select_one("[class*='name'], [class*='title'], h3")
            price_el = card.select_one("[class*='price']")
            if not name_el or not price_el:
                continue
            products.append(make_product(name_el.get_text(), price_el.get_text(), "прочее"))
        products = dedupe(products)
        if products:
            logger.info("pyaterochka: %d товаров из HTML", len(products))
        return products
    except Exception as e:  # noqa: BLE001
        logger.error("pyaterochka: HTML-парсинг не сработал: %s", e)
        return []


def get_products() -> Dict:
    """Возвращает {'products': [...], 'source': 'api|html|fallback'}."""
    products = _parse_json_api()
    source = "api"
    if not products:
        products = _parse_html()
        source = "html"
    if not products:
        logger.warning("pyaterochka: отдаём fallback-цены")
        products, source = FALLBACK_PRODUCTS, "fallback"
    return {"products": products, "source": source}
