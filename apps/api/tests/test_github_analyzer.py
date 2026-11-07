import io
import tarfile

from app.modules.github.analyzer import analyze, readme_summary
from app.modules.github.parsers import parse_js, parse_python

PY_MAIN = '''"""Command-line entry for the shop."""
from shop.services import checkout
from shop import models


def main():
    order = models.Order()
    checkout(order)


if __name__ == "__main__":
    main()
'''

PY_SERVICES = '''"""Business rules for orders."""
from .models import Order
from .utils import total_price
import requests


def checkout(order: Order) -> float:
    """Charge the customer."""
    order.validate()
    return total_price(order)


class Cart:
    def add(self, item):
        self.recalc()

    def recalc(self):
        return total_price(self)
'''

PY_MODELS = '''class Order:
    """An order placed by a customer."""

    def validate(self):
        return True
'''

PY_UTILS = """import os


def total_price(order):
    return 0
"""

TS_MAIN = """import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
"""

TS_APP = """/** Top-level layout of the web app. */
import { useState } from "react";
import { Header } from "@/components/Header";
import * as api from "./lib/api";

export default function App() {
  const [user, setUser] = useState(null);
  api.loadUser().then(setUser);
  return <Header user={user} />;
}
"""

TS_HEADER = """export const Header = ({ user }: { user: unknown }) => {
  return <nav>{formatName(user)}</nav>;
};

function formatName(user: unknown): string {
  return String(user);
}
"""

TS_API = """export async function loadUser() {
  const res = await fetch("/api/me");
  return res.json();
}
"""


def _tarball(files: dict[str, str]) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for path, text in files.items():
            data = text.encode()
            info = tarfile.TarInfo(f"owner-repo-abc123/{path}")
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def _analysis():
    return analyze(
        _tarball(
            {
                "README.md": (
                    "# Shop\n\n![badge](x.svg)\n\nA tiny shop used to show how the visualizer works.\n"
                ),
                "shop/__init__.py": "",
                "shop/main.py": PY_MAIN,
                "shop/services.py": PY_SERVICES,
                "shop/models.py": PY_MODELS,
                "shop/utils.py": PY_UTILS,
                "tests/test_services.py": (
                    "from shop.services import checkout\n\ndef test_x():\n    checkout(None)\n"
                ),
                "web/package.json": '{"name": "web", "main": "src/main.tsx"}',
                "web/src/main.tsx": TS_MAIN,
                "web/src/App.tsx": TS_APP,
                "web/src/components/Header.tsx": TS_HEADER,
                "web/src/lib/api.ts": TS_API,
                "web/node_modules/react/index.js": "module.exports = {}",
                "web/dist/bundle.js": "x",
            }
        )
    )


def _file(a, path):
    return next(f for f in a["files"] if f["path"] == path)


def _sym(a, path, name):
    return next(s for s in _file(a, path)["symbols"] if s["name"] == name)


def test_skips_vendored_and_build_folders():
    a = _analysis()
    assert not any("node_modules" in p or "/dist/" in p for p in a["tree"])
    assert a["stats"]["languages"] == {"python": 6, "typescript": 4}


def test_python_imports_and_call_flow():
    a = _analysis()
    assert _file(a, "shop/main.py")["imports"] == ["shop/models.py", "shop/services.py"]
    assert "shop/services.py" in _file(a, "shop/models.py")["imported_by"]
    assert _sym(a, "shop/main.py", "main")["calls"] == ["shop/models.py::Order", "shop/services.py::checkout"]
    assert _sym(a, "shop/services.py", "checkout")["calls"] == ["shop/utils.py::total_price"]
    assert _sym(a, "shop/services.py", "Cart.add")["calls"] == ["shop/services.py::Cart.recalc"]
    assert _file(a, "shop/main.py")["module_calls"] == ["shop/main.py::main"]
    assert _file(a, "shop/services.py")["externals"] == ["requests"]  # os is stdlib, not listed


def test_js_imports_aliases_and_components():
    a = _analysis()
    app = _file(a, "web/src/App.tsx")
    assert app["imports"] == ["web/src/components/Header.tsx", "web/src/lib/api.ts"]
    assert app["externals"] == ["react"]
    assert app["summary"] == "Top-level layout of the web app."
    assert set(_sym(a, "web/src/App.tsx", "App")["calls"]) == {
        "web/src/components/Header.tsx::Header",
        "web/src/lib/api.ts::loadUser",
    }
    assert _sym(a, "web/src/components/Header.tsx", "Header")["kind"] == "component"
    assert _sym(a, "web/src/components/Header.tsx", "Header")["calls"] == [
        "web/src/components/Header.tsx::formatName"
    ]
    # default import resolves to the default-exported function
    assert "web/src/App.tsx" in _file(a, "web/src/main.tsx")["imports"]


def test_overview():
    a = _analysis()
    assert a["readme"] == "A tiny shop used to show how the visualizer works."
    assert "shop/main.py" in a["entry_points"]
    assert "web/src/main.tsx" in a["entry_points"]
    assert a["reading_order"][0] in a["entry_points"]
    assert "shop/services.py" in a["core_files"]  # imported by main.py and the test
    roles = {f["path"]: f["role"] for f in a["folders"]}
    assert roles["tests"].startswith("Tests")
    assert roles["web/src/components"] == "Reusable UI components"
    assert {"from": "tests", "to": "shop", "count": 1} in a["folder_edges"]


def test_broken_python_file_does_not_break_analysis():
    pf = parse_python("x.py", "def broken(:\n")
    assert pf.parse_error


def test_js_parser_handles_require_and_multiline_imports():
    pf = parse_js(
        "a.js",
        "const fs = require('fs');\nconst { join } = require('path');\n"
        "import {\n  a,\n  b as c,\n} from './x';\n",
        "javascript",
    )
    mods = {i.module: i for i in pf.imports}
    assert mods["fs"].alias == "fs"
    assert mods["path"].names == {"join": "join"}
    assert mods["./x"].names == {"a": "a", "c": "b"}


def test_readme_summary_skips_headings_and_badges():
    text = "# Title\n\n[![CI](x)](y)\n\nThis library makes **HTTP** simple for [everyone](z).\n"
    assert readme_summary(text) == "This library makes HTTP simple for everyone."
