from functools import lru_cache
from pathlib import Path

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

# The workspace root holds the one .env both the apps and this service read. Resolved
# from this file rather than the working directory because the service is started from
# services/engine, the scripts from the repository root, and CI from neither; a
# relative path means the settings a process gets depend on where it was launched.
WORKSPACE_ENV = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    # Later files win, so a .env beside the service overrides the shared one, and a real
    # environment variable overrides both — which is how the host platforms supply theirs.
    #
    # extra="ignore" because that shared file also holds the web apps' settings, and a
    # dotenv source hands over every key it finds rather than only the prefixed ones.
    # Note ENGINE_URL in particular: it tells the apps where to reach this service, but
    # under the ENGINE_ prefix it arrives here as "url", so a field by that name would
    # silently capture it.
    model_config = SettingsConfigDict(
        env_prefix="ENGINE_", env_file=(WORKSPACE_ENV, ".env"), extra="ignore"
    )

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


def configured_database_url() -> str | None:
    """
    The database the engine is pointed at, or None when nothing points it anywhere.

    The scripts take --database-url and fall back to this rather than reading the
    environment directly, so that running one from a shell that has not sourced .env
    behaves the same as running the service from one that has.
    """
    try:
        return get_settings().database_url
    except ValidationError:
        return None
