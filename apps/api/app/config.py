from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root is two levels up from this file: apps/api/app/config.py -> apps/api -> repo root.
_REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    mapbox_token: SecretStr = SecretStr("")
    openweather_api_key: SecretStr = SecretStr("")
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: list[str] = ["http://localhost:3000"]
    log_level: str = "INFO"
    http_timeout_s: float = 10.0
    user_agent: str = "RoutePlanner/0.1 (contact: shroff.rohan01@gmail.com)"

    model_config = SettingsConfigDict(
        # Look in two places: the repo root (one .env shared with docker-compose), and the
        # apps/api directory (local override). Later entries win when keys collide.
        env_file=(_REPO_ROOT / ".env", "apps/api/.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
