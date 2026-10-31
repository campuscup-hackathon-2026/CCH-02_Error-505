import asyncio
import json
from typing import Any

from app.core.config import settings


class AIProvider:
    _azure_timeout_seconds = 30.0
    _gemini_timeout_seconds = 25.0

    def __init__(self) -> None:
        # Defer heavy client initialization until first use to avoid import-time failures.
        self.azure_openai_client = None
        self.openai_client = None
        self.gemini_client = None
        self.legacy_gemini_model = None
        self._initialized = False

    @staticmethod
    def _is_azure_openai_v1_endpoint(endpoint: str | None) -> bool:
        return bool(endpoint and endpoint.rstrip("/").endswith("/openai/v1"))

    @staticmethod
    def _chat_completion_options(model: str | None) -> dict[str, Any]:
        if model and model.lower().startswith("gpt-5"):
            return {}
        return {"temperature": 0.2}

    @staticmethod
    def _uses_responses_api(model: str | None) -> bool:
        return bool(model and model.lower().startswith("gpt-5"))

    async def _azure_response_text(self, model: str, system_prompt: str, user_prompt: str) -> str:
        response = await self.azure_openai_client.responses.create(
            model=model,
            input=f"{system_prompt}\n\n{user_prompt}",
        )
        return (getattr(response, "output_text", "") or "").strip()

    def _ensure_initialized(self) -> None:
        if self._initialized:
            return
        self._initialized = True

        chatgpt_key = settings.chatgpt_api_key or settings.openai_api_key
        if settings.azure_openai_endpoint:
            try:
                endpoint = settings.azure_openai_endpoint.rstrip("/")
                if self._is_azure_openai_v1_endpoint(endpoint):
                    from openai import AsyncOpenAI

                    api_key = settings.azure_openai_api_key
                    if not api_key:
                        from azure.identity import DefaultAzureCredential, get_bearer_token_provider  # type: ignore[import]

                        api_key = get_bearer_token_provider(
                            DefaultAzureCredential(),
                            "https://ai.azure.com/.default",
                        )

                    self.azure_openai_client = AsyncOpenAI(base_url=endpoint, api_key=api_key)
                elif settings.azure_openai_api_key:
                    from openai import AsyncAzureOpenAI

                    self.azure_openai_client = AsyncAzureOpenAI(
                        api_key=settings.azure_openai_api_key,
                        azure_endpoint=endpoint,
                        api_version=settings.azure_openai_api_version,
                    )
            except Exception:
                self.azure_openai_client = None

        if chatgpt_key:
            try:
                from openai import AsyncOpenAI

                self.openai_client = AsyncOpenAI(api_key=chatgpt_key)
            except Exception:
                self.openai_client = None

        if settings.gemini_api_key:
            try:
                from google import genai

                self.gemini_client = genai.Client(api_key=settings.gemini_api_key)
            except Exception:
                # Keep compatibility with environments that have not upgraded yet.
                try:
                    import google.generativeai as legacy_genai

                    legacy_genai.configure(api_key=settings.gemini_api_key)
                    self.legacy_gemini_model = legacy_genai.GenerativeModel(settings.gemini_model)
                except Exception:
                    self.legacy_gemini_model = None

    @staticmethod
    def _extract_json(content: str) -> dict[str, Any] | None:
        try:
            return json.loads(content)
        except Exception:
            start = content.find("{")
            end = content.rfind("}")
            if start != -1 and end != -1 and end > start:
                try:
                    return json.loads(content[start : end + 1])
                except Exception:
                    return None
        return None

    @staticmethod
    def _safe_error_summary(prefix: str, error: Exception) -> str:
        status_code = getattr(error, "status_code", None)
        code = getattr(error, "code", None)
        message = str(error).replace("\n", " ").strip()
        if len(message) > 120:
            message = f"{message[:117]}..."

        parts = [prefix, error.__class__.__name__]
        if status_code:
            parts.append(f"status {status_code}")
        if code:
            parts.append(f"code {code}")
        if message:
            parts.append(message)
        return ": ".join(parts)

    async def _generate_gemini_text(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        json_mode: bool = False,
    ) -> str:
        if self.gemini_client:
            from google.genai import types

            is_gemini_3_or_newer = settings.gemini_model.lower().startswith(("gemini-3", "gemini-4"))
            config = {
                "system_instruction": system_prompt,
                "max_output_tokens": 2048 if json_mode else 1024,
            }
            if is_gemini_3_or_newer:
                # Gemini 3+ rejects sampling overrides; low thinking keeps chat responsive.
                config["thinking_config"] = types.ThinkingConfig(thinking_level="low")
            else:
                config["temperature"] = 0.2
            if json_mode:
                config["response_mime_type"] = "application/json"

            response = await self.gemini_client.aio.models.generate_content(
                model=settings.gemini_model,
                contents=user_prompt,
                config=types.GenerateContentConfig(**config),
            )
        elif self.legacy_gemini_model:
            generation_config = {}
            if not settings.gemini_model.lower().startswith(("gemini-3", "gemini-4")):
                generation_config["temperature"] = 0.2
            if json_mode:
                generation_config["response_mime_type"] = "application/json"
            response = await self.legacy_gemini_model.generate_content_async(
                f"{system_prompt}\n\n{user_prompt}",
                generation_config=generation_config,
            )
        else:
            raise RuntimeError("Gemini client is unavailable; check GEMINI_API_KEY and installed SDK")

        return (getattr(response, "text", "") or "").strip()

    async def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
        fallback: dict[str, Any],
        provider: str | None = None,
    ) -> dict[str, Any]:
        # Ensure provider clients are initialized lazily
        self._ensure_initialized()

        requested_provider = (provider or "auto").lower()
        json_system_prompt = f"{system_prompt}\nRespond with a valid JSON object only."

        if requested_provider in {"auto", "azure"}:
            result = None
            if self.azure_openai_client and settings.azure_openai_deployment:
                try:
                    if self._uses_responses_api(settings.azure_openai_deployment):
                        content = await asyncio.wait_for(
                            self._azure_response_text(
                                settings.azure_openai_deployment, json_system_prompt, user_prompt
                            ),
                            timeout=self._azure_timeout_seconds,
                        ) or "{}"
                    else:
                        response = await asyncio.wait_for(
                            self.azure_openai_client.chat.completions.create(
                                model=settings.azure_openai_deployment,
                                response_format={"type": "json_object"},
                                messages=[
                                    {"role": "system", "content": json_system_prompt},
                                    {"role": "user", "content": user_prompt},
                                ],
                                **self._chat_completion_options(settings.azure_openai_deployment),
                            ),
                            timeout=self._azure_timeout_seconds,
                        )
                        content = response.choices[0].message.content or "{}"
                    result = self._extract_json(content)
                except TimeoutError:
                    result = None
                except Exception:
                    result = None

            if result is not None:
                result.setdefault("provider", "azure")
                return result

            if requested_provider == "azure":
                fallback.setdefault("provider", "fallback")
                return fallback

        if requested_provider in {"auto", "gemini"}:
            result = None
            try:
                content = await asyncio.wait_for(
                    self._generate_gemini_text(
                        json_system_prompt,
                        user_prompt,
                        json_mode=True,
                    ),
                    timeout=self._gemini_timeout_seconds,
                )
                result = self._extract_json(content)
            except Exception:
                result = None

            if result is not None:
                result.setdefault("provider", "gemini")
                return result

            if requested_provider == "gemini":
                fallback.setdefault("provider", "fallback")
                return fallback

        if requested_provider in {"auto", "openai"}:
            result = None
            if self.openai_client:
                try:
                    response = await asyncio.wait_for(
                        self.openai_client.chat.completions.create(
                            model=settings.openai_model,
                            response_format={"type": "json_object"},
                            messages=[
                                {"role": "system", "content": json_system_prompt},
                                {"role": "user", "content": user_prompt},
                            ],
                            **self._chat_completion_options(settings.openai_model),
                        ),
                        timeout=self._azure_timeout_seconds,
                    )
                    content = response.choices[0].message.content or "{}"
                    result = self._extract_json(content)
                except TimeoutError:
                    result = None
                except Exception:
                    result = None

            if result is not None:
                result.setdefault("provider", "openai")
                return result

        fallback.setdefault("provider", "fallback")
        return fallback

    async def complete_text(
        self,
        system_prompt: str,
        user_prompt: str,
        fallback: str,
        provider: str | None = None,
    ) -> dict[str, Any]:
        self._ensure_initialized()

        requested_provider = (provider or "auto").lower()
        if requested_provider not in {"auto", "azure", "gemini", "openai"}:
            requested_provider = "auto"
        failures: list[str] = []

        if requested_provider in {"auto", "azure"}:
            if self.azure_openai_client and settings.azure_openai_deployment:
                try:
                    if self._uses_responses_api(settings.azure_openai_deployment):
                        content = await asyncio.wait_for(
                            self._azure_response_text(
                                settings.azure_openai_deployment, system_prompt, user_prompt
                            ),
                            timeout=8.0,
                        )
                    else:
                        response = await asyncio.wait_for(
                            self.azure_openai_client.chat.completions.create(
                                model=settings.azure_openai_deployment,
                                messages=[
                                    {"role": "system", "content": system_prompt},
                                    {"role": "user", "content": user_prompt},
                                ],
                                **self._chat_completion_options(settings.azure_openai_deployment),
                            ),
                            timeout=8.0,
                        )
                        content = (response.choices[0].message.content or "").strip()
                    if content:
                        return {
                            "answer": content,
                            "provider": "azure",
                            "model": settings.azure_openai_deployment,
                        }
                except TimeoutError:
                    failures.append("Azure OpenAI request timed out")
                except Exception as exc:
                    failures.append(self._safe_error_summary("Azure OpenAI request failed", exc))
            elif settings.azure_openai_endpoint or settings.azure_openai_api_key or settings.azure_openai_deployment:
                missing = []
                if not settings.azure_openai_endpoint:
                    missing.append("AZURE_OPENAI_ENDPOINT")
                if not settings.azure_openai_api_key and not self._is_azure_openai_v1_endpoint(settings.azure_openai_endpoint):
                    missing.append("AZURE_OPENAI_API_KEY")
                if not settings.azure_openai_deployment:
                    missing.append("AZURE_OPENAI_DEPLOYMENT")
                if self.azure_openai_client is None and not missing:
                    failures.append("Azure OpenAI client unavailable")
                else:
                    failures.append(f"Azure OpenAI missing {', '.join(missing)}")
            else:
                failures.append("Azure OpenAI is not configured")

            if requested_provider == "azure":
                return {"answer": fallback, "provider": "fallback", "reason": "; ".join(failures)}

        if requested_provider in {"auto", "gemini"}:
            if not settings.gemini_api_key:
                failures.append("GEMINI_API_KEY is not configured")
            else:
                try:
                    text = await asyncio.wait_for(
                        self._generate_gemini_text(system_prompt, user_prompt),
                        timeout=self._gemini_timeout_seconds,
                    )
                    if text:
                        return {"answer": text, "provider": "gemini", "model": settings.gemini_model}
                    failures.append("Gemini returned an empty response")
                except TimeoutError:
                    failures.append("Gemini request timed out")
                except Exception as exc:
                    failures.append(self._safe_error_summary("Gemini request failed", exc))

            if requested_provider == "gemini":
                return {"answer": fallback, "provider": "fallback", "reason": "; ".join(failures)}

        if requested_provider in {"auto", "openai"}:
            if self.openai_client:
                try:
                    response = await asyncio.wait_for(
                        self.openai_client.chat.completions.create(
                            model=settings.openai_model,
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt},
                            ],
                            **self._chat_completion_options(settings.openai_model),
                        ),
                        timeout=8.0,
                    )
                    content = (response.choices[0].message.content or "").strip()
                    if content:
                        return {"answer": content, "provider": "openai"}
                except TimeoutError:
                    failures.append("OpenAI request timed out")
                except Exception as exc:
                    failures.append(self._safe_error_summary("OpenAI request failed", exc))
            elif settings.chatgpt_api_key or settings.openai_api_key:
                failures.append("OpenAI client unavailable")
            else:
                failures.append("CHATGPT_API_KEY or OPENAI_API_KEY is not configured")

        reason = "; ".join(list(dict.fromkeys(failures))[:3]) or "No AI provider returned a response"
        return {"answer": fallback, "provider": "fallback", "reason": reason}

ai_provider = AIProvider()
