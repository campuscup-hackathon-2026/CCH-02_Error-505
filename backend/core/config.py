import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


def _load_dotenv_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if value and len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]

        if not os.environ.get(key):
            os.environ[key] = value


class Settings(BaseSettings):
    app_name: str = "SentinelAI OS"
    environment: str = "development"
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    # Default to a local SQLite DB for easy local development; override with DATABASE_URL for production/docker
    database_url: str = "sqlite:///./dev.db"
    jwt_secret: str = "change-this-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24
    frontend_origin: str = "http://localhost:5173"

    chatgpt_api_key: str | None = None
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    azure_openai_endpoint: str | None = None
    azure_openai_api_key: str | None = None
    azure_openai_deployment: str | None = None
    azure_openai_api_version: str = "2024-04-01-preview"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-1.5-flash"
    ollama_base_url: str | None = None
    ollama_model: str = "llama3"
    virustotal_api_key: str | None = None
    threatfox_api_key: str | None = None
    abuseipdb_api_key: str | None = None
    shodan_api_key: str | None = None
    rate_limit_requests: int = 120
    rate_limit_window_seconds: int = 60

    simulation_interval_seconds: int = 8
    # Maximum upload size for code scans (bytes). Set to null/None to disable limit.
    max_upload_size_bytes: int | None = 50 * 1024 * 1024  # 50 MB
    unidirectional_enabled: bool = True
    unidirectional_queue_size: int = 1000
    unidirectional_workers: int = 1
    unidirectional_benchmark_enabled: bool = True
    unidirectional_replay_speed: float = 1.0
    max_pcap_size_bytes: int = 250 * 1024 * 1024
    unidirectional_allowed_interfaces: str = ""
    unidirectional_live_emit_interval_seconds: float = 1.0
    unidirectional_protected_cidrs: str = ""

    # Resolve the backend/.env file relative to this config file so env vars are loaded
    # reliably even when the process CWD is elsewhere.
    _env_path = Path(__file__).resolve().parents[2] / ".env"
    _load_dotenv_file(_env_path)
    model_config = SettingsConfigDict(
        env_file=str(_env_path), env_file_encoding="utf-8", extra="ignore"
    )


settings = Settings()
