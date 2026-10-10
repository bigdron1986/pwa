"""Парсер цен «Магнита» (https://magnit.ru/delivery/) для КОНКРЕТНОГО магазина.

parse_magnit(store_id): store_id — ID филиала, который пользователь скопировал
с сайта сети (например, из URL страницы доставки: .../delivery/?shopId=1234).

Стратегия: JSON-API каталога -> HTML мобильной страницы (BeautifulSoup)
-> fallback-демо (если сайт за антиботом; в ответе будет "source": "fallback").
"""
from typing import Dict, List

import requests
from bs4 import BeautifulSoup

from . import DEFAULT_HEADERS, logger, dedupe, make_product

STORE_ID = "magnit"
# Внутренние эндпоинты каталога доставки (могут меняться при редизайне)
API_URLS = [
    "https://magnit.ru/public/api/v2/catalog/products?shopId={store_id}&limit=50",
    "https://magnit.ru/api/checkout/v2/products?storeId={store_id}&limit=50",
]
MOBILE_PAGE = "https://magnit.ru/delivery/?shopId={store_id}"

FALLBACK_PRODUCTS: List[Dict] = [
    {"name": "Молоко 3.2% 1л", "price": 89.90, "category": "молочка"},
    {"name": "Хлеб белый 700г", "price": 45.00, "category": "хлеб"},
    {"name": "Яйцо С1 x10", "price": 109.90, "category": "бакалея"},
    {"name": "Куриное филе 1кг", "price": 389.00, "category": "мясо"},
    {"name": "Картофель 1кг", "price": 54.90, "category": "овощи"},
    {"name": "Гречка 800г", "price": 78.50, "category": "бакалея"},
    {"name": "Творог 5% 200г", "price": 95.00, "category": "молочка"},
]


def _parse_json_api(store_id: str) -> List[Dict]:
    for url_tpl in API_URLS:
        try:
            resp = requests.get(url_tpl.format(store_id=store_id),
                                headers=DEFAULT_HEADERS, timeout=15)
            if resp.status_code != 200:
                logger.warning("magnit[%s]: %s вернул %s", store_id, url_tpl, resp.status_code)
                continue
            data = resp.json()
            items = data.get("products") or data.get("items") or data.get("data") or []
            products = []
            for it in items:
                name = it.get("name") or it.get("title") or ""
                price = (it.get("price") or it.get("retailPrice")
                         or (it.get("prices") or {}).get("basic"))
                cat = it.get("category") or it.get("categoryName") or "прочее"
                if isinstance(cat, dict):
                    cat = cat.get("name", "прочее")
                products.append(make_product(name, price, cat))
            products = dedupe(products)
            if products:
                logger.info("magnit[%s]: %d товаров из JSON-API", store_id, len(products))
                return products
        except Exception as e:  # noqa: BLE001
            logger.warning("magnit[%s]: JSON-API не сработал: %s", store_id, e)
    return []


def _parse_html(store_id: str) -> List[Dict]:
    try:
        resp = requests.get(MOBILE_PAGE.format(store_id=store_id),
                            headers=DEFAULT_HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        products = []
        for card in soup.select(
            "[class*='product-card'], [class*='ProductCard'], article"
        )[:60]:
            name_el = card.select_one("[class*='title'], [class*='name'], h3, h4")
            price_el = card.select_one("[class*='price']")
            cat_el = card.select_one("[class*='category'], [data-category]")
            if not name_el or not price_el:
                continue
            cat = (cat_el.get("data-category")
                   if cat_el and cat_el.has_attr("data-category") else "прочее")
            products.append(make_product(name_el.get_text(), price_el.get_text(), cat))
        products = dedupe(products)
        if products:
            logger.info("magnit[%s]: %d товаров из HTML", store_id, len(products))
        return products
    except Exception as e:  # noqa: BLE001
        logger.error("magnit[%s]: HTML-парсинг не сработал: %s", store_id, e)
        return []


def parse_magnit(store_id: str) -> Dict:
    """Цены конкретного магазина «Магнит». {'products': [...], 'source': api|html|fallback}."""
    products = _parse_json_api(store_id)
    source = "api"
    if not products:
        products = _parse_html(store_id)
        source = "html"
    if not products:
        logger.warning("magnit[%s]: отдаём fallback-цены", store_id)
        products, source = FALLBACK_PRODUCTS, "fallback"
    return {"products": products, "source": source}
