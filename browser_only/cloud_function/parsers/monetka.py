"""Парсер цен «Монетки» (https://ekamonetka.ru/) для конкретного магазина.

parse_monetka(store_id): store_id — числовой ID филиала на карте сайта сети.
Стратегия: JSON-API каталога -> HTML (BeautifulSoup) -> fallback-демо.
"""
from typing import Dict, List

import requests
from bs4 import BeautifulSoup

from . import DEFAULT_HEADERS, logger, dedupe, make_product

STORE_ID = "monetka"
# Каталог интернет-витрины Монетки; id_shop — ID конкретного магазина
API_URL = "https://ekamonetka.ru/api/v1/catalog/products?id_shop={store_id}&limit=50"
PAGE_URL = "https://ekamonetka.ru/shop/{store_id}/"

FALLBACK_PRODUCTS: List[Dict] = [
    {"name": "Молоко 3.2% 1л", "price": 84.50, "category": "молочка"},
    {"name": "Макароны 450г", "price": 55.00, "category": "бакалея"},
    {"name": "Фарш говяжий 800г", "price": 549.00, "category": "мясо"},
    {"name": "Капуста 1кг", "price": 39.90, "category": "овощи"},
    {"name": "Сыр российский 200г", "price": 169.00, "category": "молочка"},
]


def _parse_json_api(store_id: str) -> List[Dict]:
    try:
        url = API_URL.format(store_id=store_id)
        resp = requests.get(url, headers=DEFAULT_HEADERS, timeout=15)
        if resp.status_code != 200:
            logger.warning("monetka: API вернул %s", resp.status_code)
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
            logger.info("monetka[%s]: %d товаров из JSON-API", store_id, len(products))
        return products
    except Exception as e:  # noqa: BLE001
        logger.warning("monetka: JSON-API не сработал: %s", e)
        return []


def _parse_html(store_id: str) -> List[Dict]:
    try:
        resp = requests.get(PAGE_URL.format(store_id=store_id),
                            headers=DEFAULT_HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        products = []
        for card in soup.select(
            "[class*='product-card'], [class*='goods-item'], article"
        )[:60]:
            name_el = card.select_one("[class*='name'], [class*='title'], a")
            price_el = card.select_one("[class*='price']")
            if not name_el or not price_el:
                continue
            products.append(make_product(name_el.get_text(), price_el.get_text(), "прочее"))
        products = dedupe(products)
        if products:
            logger.info("monetka[%s]: %d товаров из HTML", store_id, len(products))
        return products
    except Exception as e:  # noqa: BLE001
        logger.error("monetka: HTML-парсинг не сработал: %s", e)
        return []


def parse_monetka(store_id: str) -> Dict:
    """Цены конкретного магазина «Монетка». Возвращает {'products': [...], 'source': ...}."""
    products = _parse_json_api(store_id)
    source = "api"
    if not products:
        products = _parse_html(store_id)
        source = "html"
    if not products:
        logger.warning("monetka[%s]: отдаём fallback-цены", store_id)
        products, source = FALLBACK_PRODUCTS, "fallback"
    return {"products": products, "source": source}
