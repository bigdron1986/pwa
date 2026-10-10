"""Парсер цен «Пятёрочки» (https://m.5ka.ru/) для КОНКРЕТНОГО магазина.

parse_pyaterochka(store_id): store_id — числовой ID филиала со страницы выбора
магазина на сайте сети. Стратегия: JSON-API -> HTML (bs4) -> fallback-демо.
"""
from typing import Dict, List

import requests
from bs4 import BeautifulSoup

from . import DEFAULT_HEADERS, logger, dedupe, make_product

STORE_ID = "pyaterochka"
API_URL = "https://m.5ka.ru/public/api/v1/catalog/products?storeId={store_id}&limit=50"
MOBILE_PAGE = "https://m.5ka.ru/catalog/?store={store_id}"

FALLBACK_PRODUCTS: List[Dict] = [
    {"name": "Молоко 2.5% 950мл", "price": 79.90, "category": "молочка"},
    {"name": "Хлеб нарезной 400г", "price": 42.00, "category": "хлеб"},
    {"name": "Яйцо С1 х10", "price": 99.90, "category": "бакалея"},
    {"name": "Бедро куриное 1кг", "price": 329.00, "category": "мясо"},
    {"name": "Морковь 1кг", "price": 49.90, "category": "овощи"},
    {"name": "Рис 900г", "price": 95.00, "category": "бакалея"},
    {"name": "Сметана 20% 300г", "price": 89.00, "category": "молочка"},
]


def _parse_json_api(store_id: str) -> List[Dict]:
    try:
        resp = requests.get(API_URL.format(store_id=store_id),
                            headers=DEFAULT_HEADERS, timeout=15)
        if resp.status_code != 200:
            logger.warning("pyaterochka[%s]: API вернул %s", store_id, resp.status_code)
            return []
        data = resp.json()
        items = data.get("products") or data.get("items") or []
        products = []
        for it in items:
            name = it.get("name") or it.get("title") or ""
            price = it.get("price") or (it.get("prices") or {}).get("basic")
            cat = it.get("category") or it.get("categoryName") or "прочее"
            if isinstance(cat, dict):
                cat = cat.get("name", "прочее")
            products.append(make_product(name, price, cat))
        products = dedupe(products)
        if products:
            logger.info("pyaterochka[%s]: %d товаров из JSON-API", store_id, len(products))
        return products
    except Exception as e:  # noqa: BLE001
        logger.warning("pyaterochka: JSON-API не сработал: %s", e)
        return []


def _parse_html(store_id: str) -> List[Dict]:
    try:
        resp = requests.get(MOBILE_PAGE.format(store_id=store_id),
                            headers=DEFAULT_HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        products = []
        for card in soup.select(
            "[class*='product-card'], [class*='catalog-product'], article"
        )[:60]:
            name_el = card.select_one("[class*='name'], [class*='title'], a")
            price_el = card.select_one("[class*='price']")
            if not name_el or not price_el:
                continue
            products.append(make_product(name_el.get_text(), price_el.get_text(), "прочее"))
        products = dedupe(products)
        if products:
            logger.info("pyaterochka[%s]: %d товаров из HTML", store_id, len(products))
        return products
    except Exception as e:  # noqa: BLE001
        logger.error("pyaterochka: HTML-парсинг не сработал: %s", e)
        return []


def parse_pyaterochka(store_id: str) -> Dict:
    """Цены конкретного магазина «Пятёрочка». {'products': [...], 'source': ...}."""
    products = _parse_json_api(store_id)
    source = "api"
    if not products:
        products = _parse_html(store_id)
        source = "html"
    if not products:
        logger.warning("pyaterochka[%s]: отдаём fallback-цены", store_id)
        products, source = FALLBACK_PRODUCTS, "fallback"
    return {"products": products, "source": source}
