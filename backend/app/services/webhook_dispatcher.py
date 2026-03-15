import httpx
import asyncio

async def dispatch_webhook(url: str, secret: str | None, payload: dict):
    headers = {"Content-Type": "application/json"}
    if secret:
        headers["X-ScreenFlow-Secret"] = secret
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(url, json=payload, headers=headers)
    except Exception as e:
        # Swallow errors silently — webhook delivery is best-effort.
        # Do not let a failing webhook crash the heartbeat response.
        print(f"Webhook dispatch failed to {url}: {e}")
        pass
