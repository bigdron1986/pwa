"""main.py — агрегатор цен продуктовых магазинов.

Запускается в трёх режимах:

1. GOOGLE COLAB (тестирование без установки ПО):
   просто вставьте этот файл + parsers/ в блокнот и запустите ячейку —
   код ниже сам вызовет парсеры и напечатает JSON с ценами.

2. YANDEX CLOUD FUNCTIONS (прод):
   точка входа — функция `handler(event, context)` внизу этого файла.
   При создании функции укажите «HTTP-обработчик» = main.handler.
   Запросы вида GET /api/prices?store=magnit будут приходить в event[['httpRequest']['query']][0]['value'].

3. REPLIT / локально через FastAPI (необязательно):
   см. закомментированный блок в конце файла.

Формат ответа:
{
  "store": "magnit",
  "updated_at": "2024-01-15T10:30:00",
  "products": [{"name": "Молоко 1л", "price": 89.90, "category": "молочка"}]
}
"""
import json
import logging
from datetime import datetime, timezone

# Импорты парсеров. В Colab файлы можно положить в папку parsers/
# или (вариант "один блокнот") скопировать тела модулей прямо в ячейки выше.
try:
    from parsers import magnit, pyaterochka
except ImportError:  # если папки parsers нет — ругаемся понятным текстом
    raise SystemExit(
        "Не найдены модули parsers/magnit.py и parsers/pyaterochka.py. "
        "Загрузите файлы в блокнот (файлы слева -> загрузка) или вставьте их код отдельной ячейкой."
    )

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("prices")

PARSERS = {
    "magnit": magnit.get_products,
    "pyaterochka": pyaterochka.get_products,
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds")


def build_response(store: str) -> dict:
    """Собирает JSON-ответ для магазина. Никогда не бросает исключение наружу."""
    parser = PARSERS.get(store)
    if parser is None:
        logger.warning("Неизвестный магазин: %s", store)
        return {"error": f"Неизвестный магазин '{store}'", "allowed": sorted(PARSERS)}
    try:
        logger.info("Парсинг магазина: %s", store)
        result = parser()
        payload = {
            "store": store,
            "updated_at": now_iso(),
            "products": result["products"],
            "source": result.get("source", "unknown"),
        }
        logger.info("%s: %d товаров (source=%s)",
                    store, len(payload["products"]), payload["source"])
        return payload
    except Exception as e:  # noqa: BLE001 — облачная функция не должна падать в 500
        logger.exception("%s: критическая ошибка парсинга", store)
        return {
            "store": store,
            "updated_at": now_iso(),
            "products": [],
            "error": f"{type(e).__name__}: {e}",
        }


# ---------------------------------------------------------------------------
# РЕЖИМ 1: запуск в Google Colab / обычном Python — просто выполнить файл
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    for shop in ("magnit", "pyaterochka"):
        print(json.dumps(build_response(shop), ensure_ascii=False, indent=2))
        print("-" * 60)


# ---------------------------------------------------------------------------
# РЕЖИМ 2: YANDEX CLOUD FUNCTIONS — HTTP-функция (точка входа main.handler)
# ---------------------------------------------------------------------------
def handler(event, context):
    """Обработчик HTTP-запроса Yandex Cloud Functions.

    Как выглядит вызов из браузера:
      https://functions.yandexcloud.net/<id-функции>?store=magnit
      https://functions.yandexcloud.net/<id-функции>/api/prices?store=pyaterochka

    event — словарь с полями httpRequest / httpContext (в зависимости от
    типа созданной функции обрабатываем оба варианта).
    """
    req = event.get("httpRequest", event) if isinstance(event, dict) else {}
    # query: {'store': [{'value': 'magnit'}]} (Yandex формат) либо обычный dict
    raw_query = req.get("queryStringParameters") or req.get("query") or {}
    store = ""
    path = (req.get("path") or "").strip("/")

    def _extract(v):
        """Достаёт значение из форматов Yandex ([{'value':...}]), list и скаляра."""
        if isinstance(v, list) and v:
            first = v[0]
            return str(first.get("value", first)) if isinstance(first, dict) else str(first)
        return str(v)

    if isinstance(raw_query, dict):
        if "store" in raw_query:
            store = _extract(raw_query["store"])
    elif isinstance(raw_query, list):  # Yandex: [{'name': 'store', 'value': 'magnit'}]
        for q in raw_query:
            if isinstance(q, dict) and q.get("name") == "store":
                store = str(q.get("value", ""))
    if not store:
        # fallback: магазин прямо в пути, например /api/prices/magnit
        parts = path.split("/")
        if parts and parts[-1] in PARSERS:
            store = parts[-1]
    store = store.lower().strip()

    if not store:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json; charset=utf-8"},
            "body": json.dumps(
                {"error": "Укажите параметр ?store=magnit|pyaterochka",
                 "allowed": sorted(PARSERS)}, ensure_ascii=False),
        }

    body = build_response(store)
    code = 503 if body.get("error") and not body.get("products") else 200
    return {
        "statusCode": code,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            # CORS — чтобы PWA из StackBlitz/браузера могла обращаться к функции
            "Access-Control-Allow-Origin": "*",
        },
        "isBase64Encoded": False,
        "body": json.dumps(body, ensure_ascii=False),
    }


# ---------------------------------------------------------------------------
# РЕЖИМ 3 (опционально, Replit): FastAPI.
# Раскомментируйте, если хотите поднимать полноценный HTTP-сервер:
#
# from fastapi import FastAPI, Query
# app = FastAPI(title="Product prices")
#
# @app.get("/api/prices")
# def api_prices(store: str = Query(..., description="magnit | pyaterochka")):
#     return build_response(store.lower())
#
# Запуск: uvicorn main:app --host 0.0.0.0 --port 8080
# ---------------------------------------------------------------------------
