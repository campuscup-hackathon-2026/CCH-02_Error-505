"""Compatibility for the backend's existing split module layout."""

import importlib
import sys
from pathlib import Path
from types import ModuleType

_backend_root = Path(__file__).resolve().parents[1]

# Most implementation packages are siblings of ``app`` but are imported by
# the API using the ``app.*`` namespace.
for _package in ("core", "db", "services", "middleware", "utils"):
    sys.modules.setdefault(f"{__name__}.{_package}", importlib.import_module(_package))

# ``models/__init__.py`` imports through ``app.models`` itself, so register its
# package path before any model module is imported.
_models = ModuleType(f"{__name__}.models")
_models.__path__ = [str(_backend_root / "models")]
_models.__package__ = f"{__name__}.models"
sys.modules.setdefault(f"{__name__}.models", _models)
exec(
    compile((_backend_root / "models" / "__init__.py").read_text(encoding="utf-8"), str(_backend_root / "models" / "__init__.py"), "exec"),
    _models.__dict__,
)

del importlib, sys, Path, ModuleType, _backend_root, _package, _models
