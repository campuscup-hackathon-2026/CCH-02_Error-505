import asyncio
import json
from typing import Any

from app.core.config import settings


class AIProvider:
    _azure_timeout_seconds = 30.0

    def __init__(self) -> None:
        # Defer heavy client initialization until first use to avoid import-time failures.
        self.azure_openai_client = None
        self.openai_client = None
        self.gemini_model = None
        self.langchain_openai = None
        self.langchain_gemini = None
        self._initialized = False

    @staticmethod
    def _gemini_model_candidates() -> list[str]:
        candidates = [
            settings.gemini_model,
            "gemini-flash-latest",
            "gemini-2.5-flash",
            "gemini-2.0-flash",
        ]
        seen = set()
        ordered: list[str] = []
        for candidate in candidates:
            if candidate and candidate not in seen:
                seen.add(candidate)
                ordered.append(candidate)
        return ordered

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
                import google.generativeai as genai

                genai.configure(api_key=settings.gemini_api_key)
                for model_name in self._gemini_model_candidates():
                    try:
                        self.gemini_model = genai.GenerativeModel(model_name)
                        break
                    except Exception:
                        self.gemini_model = None
            except Exception:
                self.gemini_model = None

        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_openai import ChatOpenAI

            if chatgpt_key:
                try:
                    self.langchain_openai = ChatOpenAI(
                        api_key=chatgpt_key,
                        model=settings.openai_model,
                        temperature=0.2,
                    )
                except Exception:
                    self.langchain_openai = None
            if settings.gemini_api_key:
                try:
                    self.langchain_gemini = ChatGoogleGenerativeAI(
                        google_api_key=settings.gemini_api_key,
                        model=settings.gemini_model,
                        temperature=0.2,
                    )
                except Exception:
                    self.langchain_gemini = None
        except Exception:
            self.langchain_openai = None
            self.langchain_gemini = None

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

    @staticmethod
    def _is_quota_or_rate_limit_error(error: Exception) -> bool:
        status_code = getattr(error, "status_code", None)
        code = str(getattr(error, "code", "") or "").lower()
        message = str(error).lower()
        return (
            status_code == 429
            or "quota" in code
            or "rate" in code
            or "quota" in message
            or "rate limit" in message
            or "resourceexhausted" in message
        )

    async def _complete_with_langchain(self, model: Any, system_prompt: str, user_prompt: str) -> dict[str, Any] | None:
        try:
            from langchain_core.messages import HumanMessage, SystemMessage

            response = await asyncio.wait_for(
                model.ainvoke([SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]),
                timeout=8.0,
            )
            content = getattr(response, "content", "") or ""
            parsed = self._extract_json(content)
            if parsed is not None:
                return parsed
        except TimeoutError:
            return None
        except Exception:
            return None
        return None

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
            if self.langchain_gemini:
                result = await self._complete_with_langchain(self.langchain_gemini, system_prompt, user_prompt)
            if result is None and self.gemini_model:
                try:
                    prompt = (
                        f"{system_prompt}\n\n"
                        "Respond ONLY with a valid JSON object.\n"
                        f"User request:\n{user_prompt}"
                    )
                    response = await asyncio.wait_for(self.gemini_model.generate_content_async(prompt), timeout=8.0)
                    text = response.text.strip()
                    result = self._extract_json(text)
                except TimeoutError:
                    result = None
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
            if self.langchain_openai:
                result = await self._complete_with_langchain(self.langchain_openai, system_prompt, user_prompt)
            if result is None and self.openai_client:
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
            if self.langchain_gemini:
                try:
                    result = await self._complete_text_with_langchain(self.langchain_gemini, system_prompt, user_prompt)
                    if result:
                        return {"answer": result, "provider": "gemini"}
                except Exception as exc:
                    failures.append(self._safe_error_summary("Gemini LangChain request failed", exc))
            elif settings.gemini_api_key:
                failures.append("Gemini LangChain client unavailable")

            if self.gemini_model:
                try:
                    import google.generativeai as genai
                except Exception:
                    genai = None

                for model_name in self._gemini_model_candidates():
                    model = self.gemini_model
                    if genai is not None and model_name != settings.gemini_model:
                        model = genai.GenerativeModel(model_name)

                    try:
                        prompt = f"{system_prompt}\n\n{user_prompt}"
                        response = await asyncio.wait_for(model.generate_content_async(prompt), timeout=8.0)
                        text = (getattr(response, "text", "") or "").strip()
                        if text:
                            return {"answer": text, "provider": "gemini", "model": model_name}
                    except TimeoutError:
                        failures.append(f"Gemini request timed out for {model_name}")
                    except Exception as exc:
                        failures.append(self._safe_error_summary(f"Gemini request failed for {model_name}", exc))
                        if self._is_quota_or_rate_limit_error(exc):
                            break
            elif settings.gemini_api_key:
                failures.append("Gemini client unavailable")
            else:
                failures.append("GEMINI_API_KEY is not configured")

            if requested_provider == "gemini":
                return {"answer": fallback, "provider": "fallback", "reason": "; ".join(failures)}

        if requested_provider in {"auto", "openai"}:
            if self.langchain_openai:
                try:
                    result = await self._complete_text_with_langchain(self.langchain_openai, system_prompt, user_prompt)
                    if result:
                        return {"answer": result, "provider": "openai"}
                except Exception as exc:
                    failures.append(self._safe_error_summary("OpenAI LangChain request failed", exc))
            elif settings.chatgpt_api_key or settings.openai_api_key:
                failures.append("OpenAI LangChain client unavailable")

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

    async def _complete_text_with_langchain(self, model: Any, system_prompt: str, user_prompt: str) -> str | None:
        try:
            from langchain_core.messages import HumanMessage, SystemMessage

            response = await asyncio.wait_for(
                model.ainvoke([SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]),
                timeout=8.0,
            )
            content = getattr(response, "content", "") or ""
            return content.strip() or None
        except TimeoutError:
            return None
        except Exception:
            return None


ai_provider = AIProvider()
