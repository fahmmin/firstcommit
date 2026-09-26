"""Shared fixtures — force local mode, clean state per test."""
import os
import sys
from pathlib import Path

import pytest

import tempfile
# never let a test (or a TestClient lifespan) touch the dev server's backend/data
os.environ["SAHAYAK_DATA_DIR"] = tempfile.mkdtemp(prefix="sahayak-test-")
os.environ.setdefault("USE_AWS", "0")
# invoice aging is live (store.age_invoice); pin "today" to the date the seed was
# written for so every count in the suite is reproducible
os.environ.setdefault("SAHAYAK_TODAY", "2026-09-20")  # USE_AWS=1 in env → parity suite also runs DynamoStore
os.environ["DEMO_GATE_TOKEN"] = ""  # tests are ungated local dev — .env's real token must not leak in
# google connectors must behave "unconfigured" in tests regardless of local .env
os.environ.pop("GOOGLE_SERVICE_ACCOUNT_JSON", None)
os.environ["GOOGLE_SA_KEY_FILE"] = "/nonexistent/sa.json"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import deps                      # noqa: E402
from app.notifier import ConsoleNotifier  # noqa: E402
from app.store import DATA_DIR, LocalStore  # noqa: E402
from app.agents import registry as reg    # noqa: E402
from app import auth as _auth             # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

# Every TestClient acts as the owner of whichever tenant a request targets
# (auth.HarnessAuth). RBAC tests pass their own Authorization header, which
# HarnessAuth leaves alone — so real enforcement is exercised, not bypassed.
_tc_init = TestClient.__init__


def _tc_init_with_auth(self, *a, **k):
    _tc_init(self, *a, **k)
    self.auth = _auth.HarnessAuth()


TestClient.__init__ = _tc_init_with_auth

import json
SEED = json.loads((Path(__file__).resolve().parent.parent / "app" / "seed" / "seed.json").read_text(encoding="utf-8"))
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
