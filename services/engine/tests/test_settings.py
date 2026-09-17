from pathlib import Path

from app.settings import WORKSPACE_ENV, Settings


def test_the_shared_env_file_may_hold_keys_that_are_not_ours(tmp_path: Path) -> None:
    """
    One .env serves both web apps and this service, so most of it is none of its business.

    Pointing the engine at that shared file made it read every key in it, and the two
    belonging to the apps were rejected as unknown fields. The service then refused to
    start from any shell, which is a worse failure than the one the shared file fixed.

    Constructing without raising is the whole assertion. Which database URL wins cannot
    be checked here: conftest puts one in the real environment, and an environment
    variable outranks any dotenv file.
    """
    shared = tmp_path / ".env"
    shared.write_text(
        "ENGINE_DATABASE_URL=postgresql://example/db\n"
        "AUTH_SECRET=belongs-to-the-web-apps\n"
        "ENGINE_URL=http://127.0.0.1:8000\n"
        "DATABASE_URL=postgresql://example/db\n"
    )

    settings = Settings(_env_file=shared)

    assert not hasattr(settings, "auth_secret")
    # ENGINE_URL loses its prefix on the way in, so a field named url would quietly
    # capture the apps' pointer at this service.
    assert not hasattr(settings, "url")


def test_the_env_file_is_found_from_the_source_tree_not_the_working_directory() -> None:
    """Scripts run from the repository root, the service from services/engine."""
    assert WORKSPACE_ENV.name == ".env"
    assert (WORKSPACE_ENV.parent / "pnpm-workspace.yaml").exists()
