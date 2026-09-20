"""Shared fixtures — force local mode, clean state per test."""
import os
import sys
from pathlib import Path

import pytest

os.environ.setdefault("USE_AWS", "0")  # USE_AWS=1 in env → parity suite also runs DynamoStore
os.environ["DEMO_GATE_TOKEN"] = ""  # tests are ungated local dev — .env's real token must not leak in
# google connectors must behave "unconfigured" in tests regardless of local .env
os.environ.pop("GOOGLE_SERVICE_ACCOUNT_JSON", None)
os.environ["GOOGLE_SA_KEY_FILE"] = "/nonexistent/sa.json"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import deps                      # noqa: E402
from app.notifier import ConsoleNotifier  # noqa: E402
from app.store import DATA_DIR, LocalStore  # noqa: E402
from app.agents import registry as reg    # noqa: E402

import json
SEED = json.loads((Path(__file__).resolve().parent.parent / "app" / "seed" / "seed.json").read_text())
TENANT = "ramesh_auto"


@pytest.fixture(autouse=True)
def clean_state(tmp_path):
    store = LocalStore(data_dir=tmp_path / "data")
    deps.init_deps(store, ConsoleNotifier(data_dir=tmp_path / "data"))
    store.reset(TENANT, SEED)
    reg.reset_registries()
    yield store
    reg.reset_registries()


@pytest.fixture
def tenant():
    return TENANT
