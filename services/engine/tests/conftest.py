import os

# Settings require a database URL, and importing the app builds them. Tests never
# open a connection, so a syntactically valid URL pointing nowhere is enough.
os.environ.setdefault(
    "ENGINE_DATABASE_URL", "postgresql://cityflow:cityflow@127.0.0.1:5432/cityflow_test"
)
