"""Yandex Cloud Function: агрегатор цен продуктовых магазинов.

Два режима запуска:
1. Yandex Cloud Functions — точка входа `handler(event, context)` (HTTP-функция).
2. Локальное тестирование — FastAPI: `uvicorn main:app --reload --port 8080`.

Эндпоинт: GET /api/prices?store=magnit|pyaterochka|monetka|megapolis
Ответ:
{
  "store": "magnit",
  "updated_at": "2024-01-15T10:30:00",
  "products": [{"name": "...", "price": 89.90, "category": "..."}]
}
"""
import json
import logging
from datetime import datetime, timezone

from parsers import magnit, monetka, pyaterochka, megapolis

logger = logging.getLogger("prices")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

PARSERS = {
    "magnit": magnit.get_products,
    "pyaterochka": pyaterochka.get_products,
    "monetka": monetka.get_products,
    "megapolis": megapolis.get_products,
}


def build_response(store: str) -> dict:
    """Собирает JSON-ответ для конкретного магазина с обработкой ошибок."""
    parser = PARSERS.get(store)
    if parser is None:
        return {
            "error": f"Неизвестный магазин '{store}'",
            "allowed": sorted(PARSERS.keys()),
        }
    try:
        logger.info("Запрошены цены магазина: %s", store)
        result = parser()
        payload = {
            "store": store,
            "updated_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds"),
            "products": result["products"],
            "source": result.get("source", "unknown"),
        }
        logger.info("Магазин %s: возвращено %d товаров (source=%s)",
                    store, len(payload["products"]), payload["source"])
        return payload
    except Exception as e:  # noqa: BLE001 — функция не должна падать на 500
        logger.exception("Магазин %s: критическая ошибка парсинга", store)
        return {
            "store": store,
            "updated_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="seconds"),
            "products": [],
            "error": f"Сайт магазина недоступен или изменил структуру: {e}",
        }


# ----------------------------------------------------------------------------
# 1. Точка входа Yandex Cloud Functions (HTTP-вызов)
# ----------------------------------------------------------------------------
def handler(event, context):  # noqa: ARG001
    """event.body может быть закодирован в base64 (при вызове через API Gateway)."""
    body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        import base64
        body = base64.b64decode(body).decode("utf-8")

    try:
        data = json.loads(body) if body else {}
    except json.JSONDecodeError:
        data = {}

    # Параметры могут прийти в query (data.queryStringParameters) или в JSON тела
    params = data.get("queryStringParameters") or data
    store = (params.get("store") or "").strip().lower()

    if not store:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json; charset=utf-8"},
            "body": json.dumps(
                {"error": "Укажите параметр ?store=magnit|pyaterochka|monetka|megapolis"},
                ensure_ascii=False,
            ),
        }

    if store == "all":
        payload = {s: build_response(s) for s in PARSERS}
    else:
        payload = build_response(store)
        if "error" in payload and not payload.get("products"):
            status = 503 if "Неизвестный" not in payload["error"] else 400
            return {
                "statusCode": status,
                "headers": {"Content-Type": "application/json; charset=utf-8"},
                "body": json.dumps(payload, ensure_ascii=False),
            }

    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json; charset=utf-8",
            # PWA открывается с телефона — разрешаем CORS всем (для личного использования)
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(payload, ensure_ascii=False),
    }


# ----------------------------------------------------------------------------
# 2. FastAPI для локального тестирования: uvicorn main:app
# ----------------------------------------------------------------------------
try:
    from fastapi import FastAPI, Query
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI(title="Product prices aggregator", version="1.0.0")
    app.add_middleware(CORSMiddleware, allow_origins=["*"])

    @app.get("/")
    def root():
        return {"ok": True, "endpoints": ["/api/prices?store=magnit", "/api/prices?store=all"]}

    @app.get("/api/prices")
    def api_prices(store: str = Query(..., description="magnit|pyaterochka|monetka|megapolis|all")):
        store = store.strip().lower()
        if store == "all":
            return {s: build_response(s) for s in PARSERS}
        return build_response(store)

except ImportError:  # FastAPI не установлен — функция всё равно работает в Yandex Cloud
    app = None


if __name__ == "__main__":
    # Простой ручной тест без сервера
    print(json.dumps(build_response("magnit"), ensure_ascii=False, indent=2))
