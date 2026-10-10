"""Парсер цен Монетки (https://монетка.рф / https://monetka.ru).

У Монетки нет публичного API доставки из большинства регионов, поэтому:
1. Пробуем JSON-API мобильного приложения (если доступен).
2. Fallback-демо-цены. При необходимости подключите Playwright (см. magnit.py).
"""
import os
from typing import Dict, List

import requests

from . import DEFAULT_HEADERS, logger, dedupe, make_product

STORE_ID = "monetka"
API_URL = os.environ.get(
    "MONETKA_API_URL",
    "https://api.monetka.ru/v1/products?limit=50",
)

FALLBACK_PRODUCTS: List[Dict] = [
    {"name": "Молоко 3.2% 1л", "price": 84.50, "category": "молочка"},
    {"name": "Макароны 450г", "price": 55.00, "category": "бакалея"},
    {"name": "Фарш говяжий 800г", "price": 549.00, "category": "мясо"},
    {"name": "Капуста 1кг", "price": 39.90, "category": "овощи"},
    {"name": "Сыр российский 200г", "price": 169.00, "category": "молочка"},
]


def _parse_json_api() -> List[Dict]:
    try:
        resp = requests.get(API_URL, headers=DEFAULT_HEADERS, timeout=15)
        if resp.status_code != 200:
            logger.warning("monetka: API вернул %s", resp.status_code)
            return []
        data = resp.json()
        items = data.get("products") or data.get("items") or []
        products = []
        for it in items:
            products.append(
                make_product(
                    it.get("name", ""),
                    it.get("price"),
                    it.get("category", "прочее"),
                )
            )
        products = dedupe(products)
        if products:
            logger.info("monetka: %d товаров из JSON-API", len(products))
        return products
    except Exception as e:  # noqa: BLE001
        logger.warning("monetka: JSON-API не сработал: %s", e)
        return []


def get_products() -> Dict:
    products = _parse_json_api()
    source = "api"
    if not products:
        logger.warning("monetka: отдаём fallback-цены")
        products, source = FALLBACK_PRODUCTS, "fallback"
    return {"products": products, "source": source}
