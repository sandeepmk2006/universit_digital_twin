from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:54322/postgres"
    ANTHROPIC_API_KEY: str | None = None
    VOYAGE_API_KEY: str | None = None
    SUPABASE_URL: str = "http://localhost:54321"
    SUPABASE_PUBLISHABLE_KEY: str = ""
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]


settings = Settings()
