"""Парсер цен Мегаполиса (https://megapolis-sib.ru — сеть магазинов юга Сибири).

Принцип тот же: JSON-API → fallback-демо-цены. URL эндпоинта можно
переопределить переменной окружения MEGAPOLIS_API_URL.
"""
import os
from typing import Dict, List

import requests

from . import DEFAULT_HEADERS, logger, dedupe, make_product

STORE_ID = "megapolis"
API_URL = os.environ.get(
    "MEGAPOLIS_API_URL",
    "https://megapolis-sib.ru/api/products?limit=50",
)

FALLBACK_PRODUCTS: List[Dict] = [
    {"name": "Молоко 1л", "price": 92.00, "category": "молочка"},
    {"name": "Скумбрия филе 500г", "price": 420.00, "category": "рыба"},
    {"name": "Банан 1кг", "price": 109.00, "category": "фрукты"},
    {"name": "Помидоры 1кг", "price": 189.00, "category": "овощи"},
    {"name": "Масло сливочное 180г", "price": 149.00, "category": "молочка"},
]


def _parse_json_api() -> List[Dict]:
    try:
        resp = requests.get(API_URL, headers=DEFAULT_HEADERS, timeout=15)
        if resp.status_code != 200:
            logger.warning("megapolis: API вернул %s", resp.status_code)
            return []
        data = resp.json()
        items = data.get("products") or data.get("items") or []
        products = [
            make_product(
                it.get("name", ""), it.get("price"), it.get("category", "прочее")
            )
            for it in items
        ]
        products = dedupe(products)
        if products:
            logger.info("megapolis: %d товаров из JSON-API", len(products))
        return products
    except Exception as e:  # noqa: BLE001
        logger.warning("megapolis: JSON-API не сработал: %s", e)
        return []


def get_products() -> Dict:
    products = _parse_json_api()
    source = "api"
    if not products:
        logger.warning("megapolis: отдаём fallback-цены")
        products, source = FALLBACK_PRODUCTS, "fallback"
    return {"products": products, "source": source}
