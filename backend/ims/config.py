from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="IMS_", env_file=".env", extra="ignore")

    kafka_bootstrap: str = "kafka:9092"
    kafka_topic_signals: str = "ims.signals"
    kafka_consumer_group: str = "ims-worker"

    redis_url: str = "redis://redis:6379/0"

    postgres_dsn: str = "postgresql+asyncpg://ims:ims@postgres:5432/ims"
    mongo_uri: str = "mongodb://mongo:27017"
    mongo_db: str = "ims"

    rate_limit_per_sec_per_ip: int = 5000
    rate_limit_per_sec_global: int = 20000

    debounce_window_seconds: int = 10
    debounce_threshold: int = 100

    dashboard_active_set: str = "incidents:active"
    dashboard_incident_prefix: str = "incident:"
    active_incident_prefix: str = "active_incident:"


@lru_cache
def get_settings() -> Settings:
    return Settings()
