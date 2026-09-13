from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="ENGINE_", env_file=".env")

    database_url: str = Field(
        description="PostgreSQL connection string. The database must have PostGIS."
    )
    log_level: str = "INFO"
    version: str = "0.1.0"

    # Share of road users who do not use the app. The allocator can only place the
    # remaining share, and has to plan around this one as fixed background load.
    non_participant_share: float = Field(default=0.70, ge=0.0, le=1.0)


@lru_cache
def get_settings() -> Settings:
    return Settings()
