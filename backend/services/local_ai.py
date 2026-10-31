from __future__ import annotations

import asyncio

import httpx

from app.core.config import settings


async def summarize_with_ollama(system_prompt: str, user_prompt: str, fallback: str) -> str:
    base_url = getattr(settings, "ollama_base_url", None)
    model = getattr(settings, "ollama_model", "llama3")
    if not base_url:
        return fallback

    url = base_url.rstrip("/") + "/api/chat"
    payload = {
        "model": model,
        "stream": False,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    try:
        timeout = httpx.Timeout(6.0, connect=2.0, read=6.0, write=3.0, pool=2.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await asyncio.wait_for(client.post(url, json=payload), timeout=6.5)
            if response.status_code != 200:
                return fallback
            data = response.json()
            message = data.get("message", {}) if isinstance(data, dict) else {}
            content = message.get("content") if isinstance(message, dict) else None
            return content.strip() if isinstance(content, str) and content.strip() else fallback
    except Exception:
        return fallback
