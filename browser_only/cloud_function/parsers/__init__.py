"""Базовые утилиты парсеров: логирование, HTTP-сессия, нормализация цен."""
import logging
import re
from typing import List, Dict

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("prices")

# Заголовки браузера — многие сайты магазинов блокируют "голые" запросы
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Linux; Android 13; 23013PC75G) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
}


def normalize_price(value) -> float:
    """Приводит цену к float: '1 234,56 ₽' -> 1234.56"""
    if isinstance(value, (int, float)):
        return round(float(value), 2)
    s = re.sub(r"[^\d.,]", "", str(value)).replace(",", ".")
    # если осталось несколько точек — разделитель тысяч
    if s.count(".") > 1:
        s = s.replace(".", "")[:-1].replace(".", ",")[:-1] or "0"
    try:
        return round(float(s), 2)
    except ValueError:
        return 0.0


def make_product(name: str, price, category: str) -> Dict:
    """Собирает корректную запись товара, отбрасывает мусор."""
    name = re.sub(r"\s+", " ", str(name)).strip()
    p = normalize_price(price)
    if not name or p <= 0:
        return {}
    return {"name": name[:120], "price": p, "category": (category or "прочее").lower()}


def dedupe(products: List[Dict]) -> List[Dict]:
    """Убирает дубликаты по названию, сохраняет порядок."""
    seen = set()
    out = []
    for p in products:
        if not p:
            continue
        key = p["name"].lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out
