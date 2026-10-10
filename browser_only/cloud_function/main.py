"""main.py — облачная функция цен конкретных магазинов (Yandex Cloud).

Формат запроса из PWA:
  GET /api/prices?stores=magnit:1234,pyaterochka:9876,monetka:5678
где после двоеточия — ID филиала, который пользователь взял с сайта сети.

Формат ответа:
{
  "updated_at": "2026-10-10T08:00:00",
  "stores": [
    {"store": "magnit", "store_id": "1234", "updated_at": "...",
     "products": [{"name": "Молоко 1л", "price": 89.9, "category": "молочка"}],
     "source": "api|html|fallback"},
    ...
  ]
}

Режимы запуска:
1. GOOGLE COLAB: загрузите main.py и папку parsers/, выполните ячейку —
   код сам вызовет парсеры и напечатает JSON (см. __main__ ниже).
2. YANDEX CLOUD FUNCTIONS: точка входа main.handler(event, context).
3. REPLIT (опционально): FastAPI — раскомментируйте блок в конце файла.
"""
import json
import logging
from datetime import datetime, timezone

from parsers import magnit, pyaterochka, monetka, megapolis

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("prices")

# Реестр: id сети -> (функция-парсер, параметр для поиска ID)
PARSERS = {
    "magnit": magnit.parse_magnit,
    "pyaterochka": pyaterochka.parse_pyaterochka,
    "monetka": monetka.parse_monetka,
    "megapolis": megapolis.parse_megapolis,
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")


def parse_stores_param(raw: str):
    """'magnit:1234,pyaterochka:9876' -> [('magnit','1234'), ('pyaterochka','9876')].
    Допускается и старый формат без ID: 'magnit' -> store_id=''."""
    pairs = []
    for part in (raw or "").split(","):
        part = part.strip().lower()
        if not part:
            continue
        if ":" in part:
            store, _, sid = part.partition(":")
            pairs.append((store.strip(), sid.strip()))
        else:
            pairs.append((part, ""))
    return pairs


def build_store_response(store: str, store_id: str) -> dict:
    """Собирает блок цен одного конкретного магазина. Не бросает исключений наружу."""
    parser = PARSERS.get(store)
    if parser is None:
        logger.warning("Неизвестная сеть: %s", store)
        return {"store": store, "store_id": store_id, "updated_at": now_iso(),
                "products": [], "error": f"Неизвестная сеть '{store}'"}
    try:
        logger.info("Парсинг: %s (ID магазина: %s)", store, store_id or "—")
        result = parser(store_id)
        payload = {
            "store": store,
            "store_id": store_id,
            "updated_at": now_iso(),
            "products": result["products"],
            "source": result.get("source", "unknown"),
        }
        logger.info("%s[%s]: %d товаров (source=%s)",
                    store, store_id, len(payload["products"]), payload["source"])
        return payload
    except Exception as e:  # noqa: BLE001 — функция не должна падать в 500
        logger.exception("%s[%s]: критическая ошибка парсинга", store, store_id)
        return {"store": store, "store_id": store_id, "updated_at": now_iso(),
                "products": [], "error": f"{type(e).__name__}: {e}"}


def build_all(stores_raw: str) -> dict:
    """Главная бизнес-логика: разбор параметра stores и сборка ответов."""
    pairs = parse_stores_param(stores_raw)
    if not pairs:
        return {"error": "Укажите параметр ?stores=magnit:1234,pyaterochka:9876",
                "allowed": sorted(PARSERS)}
    blocks = [build_store_response(s, sid) for s, sid in pairs]
    return {"updated_at": now_iso(), "stores": blocks}


# ---------------------------------------------------------------------------
# РЕЖИМ 1: запуск в Google Colab / обычном Python
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Меняйте ID на свои реальные магазины!
    demo = "magnit:1234,pyaterochka:9876,monetka:5678,megapolis:42"
    print(json.dumps(build_all(demo), ensure_ascii=False, indent=2))


# ---------------------------------------------------------------------------
# РЕЖИМ 2: YANDEX CLOUD FUNCTIONS — HTTP-функция (entrypoint main.handler)
# ---------------------------------------------------------------------------
def handler(event, context):
    """Обработчик HTTP-запроса. Параметр stores принимает вид 'magnit:1234,...'.

    Query может приходить в разных форматах — поддерживаем все:
      queryStringParameters: {'stores': [{'value': '...'}]} или {'stores': '...'}
      query: [{'name': 'stores', 'value': '...'}]
    """
    req = event.get("httpRequest", event) if isinstance(event, dict) else {}
    raw_query = req.get("queryStringParameters") or req.get("query") or {}
    stores_raw = ""

    def _extract(v):
        if isinstance(v, list) and v:
            first = v[0]
            return str(first.get("value", first)) if isinstance(first, dict) else str(first)
        return str(v)

    if isinstance(raw_query, dict):
        if "stores" in raw_query:
            stores_raw = _extract(raw_query["stores"])
        elif "store" in raw_query:  # обратная совместимость со старым форматом
            stores_raw = _extract(raw_query["store"])
    elif isinstance(raw_query, list):
        for q in raw_query:
            if isinstance(q, dict) and q.get("name") in ("stores", "store"):
                stores_raw = str(q.get("value", ""))

    body = build_all(stores_raw)
    ok = bool(body.get("stores")) and not body.get("error")
    return {
        "statusCode": 200 if ok else 400,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            # CORS — чтобы PWA из браузера могла обращаться к функции
            "Access-Control-Allow-Origin": "*",
        },
        "isBase64Encoded": False,
        "body": json.dumps(body, ensure_ascii=False),
    }


# ---------------------------------------------------------------------------
# РЕЖИМ 3 (опционально, Replit): FastAPI. Раскомментируйте для HTTP-сервера:
#
# from fastapi import FastAPI, Query
# app = FastAPI(title="Product prices")
#
# @app.get("/api/prices")
# def api_prices(stores: str = Query(..., description="magnit:1234,pyaterochka:9876")):
#     return build_all(stores)
#
# Запуск в Replit: uvicorn main:app --host 0.0.0.0 --port 8080
# ---------------------------------------------------------------------------
