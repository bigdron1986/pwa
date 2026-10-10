"""Парсер цен «Мегаполиса» (https://mega-polis.ru/) для конкретного магазина.

parse_megapolis(store_id): store_id — номер филиала со страницы «Адреса».
Стратегия: JSON-API каталога -> HTML (BeautifulSoup) -> fallback-демо.
"""
from typing import Dict, List

import requests
from bs4 import BeautifulSoup

from . import DEFAULT_HEADERS, logger, dedupe, make_product

STORE_ID = "megapolis"
API_URL = "https://mega-polis.ru/api/catalog?shop={store_id}&limit=50"
PAGE_URL = "https://mega-polis.ru/shops/{store_id}/"

FALLBACK_PRODUCTS: List[Dict] = [
    {"name": "Молоко 1л", "price": 92.00, "category": "молочка"},
    {"name": "Скумбрия филе 500г", "price": 420.00, "category": "рыба"},
    {"name": "Банан 1кг", "price": 109.00, "category": "фрукты"},
    {"name": "Помидоры 1кг", "price": 189.00, "category": "овощи"},
    {"name": "Масло сливочное 180г", "price": 149.00, "category": "молочка"},
]


def _parse_json_api(store_id: str) -> List[Dict]:
    try:
        url = API_URL.format(store_id=store_id)
        resp = requests.get(url, headers=DEFAULT_HEADERS, timeout=15)
        if resp.status_code != 200:
            logger.warning("megapolis: API вернул %s", resp.status_code)
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
            logger.info("megapolis[%s]: %d товаров из JSON-API", store_id, len(products))
        return products
    except Exception as e:  # noqa: BLE001
        logger.warning("megapolis: JSON-API не сработал: %s", e)
        return []


def _parse_html(store_id: str) -> List[Dict]:
    try:
        resp = requests.get(PAGE_URL.format(store_id=store_id),
                            headers=DEFAULT_HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        products = []
        for card in soup.select(
            "[class*='product'], [class*='catalog-item'], article"
        )[:60]:
            name_el = card.select_one("[class*='name'], [class*='title'], a")
            price_el = card.select_one("[class*='price']")
            if not name_el or not price_el:
                continue
            products.append(make_product(name_el.get_text(), price_el.get_text(), "прочее"))
        products = dedupe(products)
        if products:
            logger.info("megapolis[%s]: %d товаров из HTML", store_id, len(products))
        return products
    except Exception as e:  # noqa: BLE001
        logger.error("megapolis: HTML-парсинг не сработал: %s", e)
        return []


def parse_megapolis(store_id: str) -> Dict:
    """Цены конкретного магазина «Мегаполис». Возвращает {'products': [...], 'source': ...}."""
    products = _parse_json_api(store_id)
    source = "api"
    if not products:
        products = _parse_html(store_id)
        source = "html"
    if not products:
        logger.warning("megapolis[%s]: отдаём fallback-цены", store_id)
        products, source = FALLBACK_PRODUCTS, "fallback"
    return {"products": products, "source": source}
