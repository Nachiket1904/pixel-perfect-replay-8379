"""Builds the learner-facing structure of a repo from its tarball.

Output (a JSON-ready dict): overview, folders with roles, file dependency graph,
and per-file symbols with resolved call links. Pure Python, no network or DB, so it
runs in a worker thread and is easy to test.
"""

import io
import json
import posixpath
import re
import sys
import tarfile
from collections import Counter, deque

from app.modules.github.parsers import CODE_EXTS, ParsedFile, first_sentence, lang_for, parse_file

SKIP_DIRS = {
    ".git", "node_modules", "dist", "build", "out", ".next", ".nuxt", ".output", ".vercel", "coverage",
    "__pycache__", ".venv", "venv", "env", "site-packages", "vendor", "third_party", ".tox", ".mypy_cache",
    ".pytest_cache", ".idea", ".vscode", "bower_components", ".turbo", ".cache",
}
MAX_TREE_PATHS = 4000
MAX_CODE_FILES = 800
MAX_FILE_BYTES = 300_000
MAX_TOTAL_SOURCE = 20_000_000
JS_RESOLVE_EXTS = (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")
STDLIB = set(getattr(sys, "stdlib_module_names", ()))

FOLDER_ROLES = {
    ("tests", "test", "__tests__", "spec", "e2e"): "Tests that check the code works",
    ("routes", "routers", "router", "api", "endpoints", "controllers", "views", "handlers"): "Request handlers / API routes",
    ("components", "ui", "widgets"): "Reusable UI components",
    ("pages", "screens", "routes-web"): "Pages / screens of the app",
    ("models", "schemas", "entities", "types", "dto"): "Data models and types",
    ("services", "service", "domain", "logic"): "Core business logic",
    ("core",): "Core building blocks (setup, config, shared logic)",
    ("utils", "util", "lib", "libs", "helpers", "common", "shared"): "Shared helpers used across the code",
    ("hooks",): "React hooks (reusable stateful logic)",
    ("migrations", "alembic", "migrate"): "Database migrations",
    ("db", "database", "repositories", "repository", "store", "stores"): "Data access and storage",
    ("config", "configs", "settings", "conf"): "Configuration",
    ("docs", "doc", "documentation"): "Documentation",
    ("scripts", "bin", "tools", "cli"): "Scripts and command-line tools",
    ("examples", "example", "samples", "demo"): "Examples of how to use the project",
    ("static", "public", "assets"): "Static files (images, fonts, styles)",
    ("styles", "css"): "Stylesheets",
    ("workers", "tasks", "jobs"): "Background jobs",
    ("middleware", "middlewares"): "Middleware that runs around requests",
    ("auth",): "Authentication and permissions",
}
_ROLE_LOOKUP = {name: role for names, role in FOLDER_ROLES.items() for name in names}
AUX_DIRS = {"tests", "test", "__tests__", "e2e", "scripts", "examples", "example", "docs", "benchmarks", "bench"}
ENTRY_NAMES = {
    "main.py", "app.py", "manage.py", "__main__.py", "wsgi.py", "asgi.py", "cli.py",
    "main.ts", "main.tsx", "main.js", "main.jsx", "index.ts", "index.tsx", "index.js", "index.jsx",
    "server.ts", "server.js", "app.ts", "app.tsx", "app.js", "app.jsx",
}


# ---------------------------------------------------------------- tarball


def read_tarball(data: bytes) -> tuple[list[str], dict[str, str], dict[str, str], bool]:
    """Returns (all file paths, code sources, readme/package.json texts, truncated)."""
    tree: list[str] = []
    sources: dict[str, str] = {}
    extras: dict[str, str] = {}
    total = 0
    truncated = False
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:*") as tar:
        for m in tar:
            if not m.isfile():  # skips dirs, symlinks, devices
                continue
            _, _, path = m.name.partition("/")  # strip the "owner-repo-sha/" folder
            if not path:
                continue
            segs = path.split("/")
            if any(s in SKIP_DIRS for s in segs[:-1]):
                continue
            if len(tree) >= MAX_TREE_PATHS:
                truncated = True
                continue
            tree.append(path)
            name = segs[-1].lower()
            is_code = lang_for(path) is not None and path.endswith(CODE_EXTS)
            is_extra = name in ("readme.md", "readme.rst", "readme.txt", "readme", "package.json")
            if not (is_code or is_extra) or m.size > MAX_FILE_BYTES:
                continue
            if is_code and (len(sources) >= MAX_CODE_FILES or total + m.size > MAX_TOTAL_SOURCE):
                truncated = True
                continue
            f = tar.extractfile(m)
            if f is None:
                continue
            text = f.read().decode("utf-8", errors="replace")
            if is_code:
                if "\n" not in text[:5000] and len(text) > 5000:  # minified bundle
                    continue
                sources[path] = text
                total += m.size
            else:
                extras[path] = text
    return sorted(tree), sources, extras, truncated


# ---------------------------------------------------------------- helpers


def readme_summary(text: str | None) -> str | None:
    if not text:
        return None
    for block in re.split(r"\n\s*\n", text):
        b = block.strip()
        if not b or b.startswith(("#", "!", "<", "[!", "[![", "---", "```", "|", "=")):
            continue
        if re.match(r"^([-*+]|\d+\.)\s", b):  # a bullet list, not a description
            continue
        b = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", b)
        b = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", b)
        b = re.sub(r"\[([^\]]+)\](?:\[[^\]]*\])?", r"\1", b)  # reference-style links
        b = re.sub(r"[*_`>]", "", b)
        b = re.sub(r"<[^>]+>", "", b)
        if len(b.split()) >= 5:
            return first_sentence(b, 400)
    return None


def is_aux(path: str) -> bool:
    """Tests, scripts, docs and examples: useful, but not where a learner should start."""
    return any(seg.lower() in AUX_DIRS for seg in path.split("/")[:-1])


def _folder_role(folder: str) -> str | None:
    for seg in reversed(folder.lower().split("/")):
        if seg in _ROLE_LOOKUP:
            return _ROLE_LOOKUP[seg]
    return None


class _PyIndex:
    def __init__(self, py_paths: list[str]) -> None:
        self.paths = set(py_paths)
        self.by_dotted: dict[str, list[str]] = {}
        for p in py_paths:
            parts = p[:-3].split("/")
            if parts[-1] == "__init__":
                parts = parts[:-1]
            for i in range(len(parts)):
                self.by_dotted.setdefault(".".join(parts[i:]), []).append(p)

    def absolute(self, dotted: str) -> str | None:
        cands = self.by_dotted.get(dotted)
        return min(cands, key=lambda p: (p.count("/"), p)) if cands else None

    def relative(self, from_path: str, level: int, module: str) -> str | None:
        base = from_path.split("/")[:-1]
        up = level - 1
        if up > len(base):
            return None
        base = base[: len(base) - up] if up else base
        parts = base + (module.split(".") if module else [])
        for cand in ("/".join(parts) + ".py", "/".join(parts + ["__init__.py"])):
            if cand in self.paths:
                return cand
        return None


def _js_resolve(from_path: str, spec: str, all_paths: set[str], pkg_roots: list[str]) -> str | None:
    if spec.startswith("."):
        base = posixpath.normpath(posixpath.join(posixpath.dirname(from_path), spec))
        bases = [base]
    elif spec.startswith(("@/", "~/")):
        root = next((r for r in pkg_roots if from_path.startswith(r)), "")
        rest = spec[2:]
        bases = [posixpath.join(root, "src", rest), posixpath.join(root, rest)]
    else:
        return None
    for b in bases:
        if b in all_paths and b.endswith(CODE_EXTS):
            return b
        stem = re.sub(r"\.(js|jsx|mjs|cjs)$", "", b)  # TS projects import "./x.js" for x.ts
        for ext in JS_RESOLVE_EXTS:
            for cand in (stem + ext, posixpath.join(b, "index" + ext)):
                if cand in all_paths:
                    return cand
    return None


def _package_name(spec: str) -> str:
    parts = spec.split("/")
    return "/".join(parts[:2]) if spec.startswith("@") and len(parts) > 1 else parts[0]


# ---------------------------------------------------------------- main entry point


def analyze(data: bytes) -> dict:
    tree, sources, extras, truncated = read_tarball(data)
    return build_structure(tree, sources, extras, truncated)


def build_structure(tree: list[str], sources: dict[str, str], extras: dict[str, str], truncated: bool) -> dict:
    parsed: dict[str, ParsedFile] = {p: parse_file(p, s) for p, s in sources.items()}
    all_paths = set(tree)
    py_index = _PyIndex([p for p in parsed if p.endswith(".py")])
    pkg_roots = sorted(
        (posixpath.dirname(p) + "/" if "/" in p else "" for p in extras if p.endswith("package.json")),
        key=len,
        reverse=True,
    )

    imports: dict[str, set[str]] = {p: set() for p in parsed}
    externals: dict[str, set[str]] = {p: set() for p in parsed}
    sym_map: dict[str, dict[str, tuple[str, str]]] = {p: {} for p in parsed}  # local -> (file, symbol)
    mod_map: dict[str, dict[str, str]] = {p: {} for p in parsed}  # alias -> file

    for path, pf in parsed.items():
        for imp in pf.imports:
            if pf.lang == "python":
                _link_python(path, imp, py_index, imports, externals, sym_map, mod_map)
            else:
                target = _js_resolve(path, imp.module, all_paths, pkg_roots)
                if target is None:
                    if not imp.module.startswith((".", "@/", "~/", "/")):
                        externals[path].add(_package_name(imp.module))
                    continue
                if target == path:
                    continue
                imports[path].add(target)
                for local, imported in imp.names.items():
                    sym_map[path][local] = (target, imported)
                if imp.alias:
                    mod_map[path][imp.alias] = target

    symbols_by_file = {p: {s.name: s for s in pf.symbols} for p, pf in parsed.items()}

    def target_symbol(file: str, name: str) -> str | None:
        if name == "default":
            name = parsed[file].default_export or ""
        return f"{file}::{name}" if name in symbols_by_file.get(file, {}) else None

    def resolve_call(path: str, owner: str | None, call: str) -> str | None:
        local = symbols_by_file[path]
        head, _, attr = call.rpartition(".")
        if not head:
            if call in local:
                return f"{path}::{call}"
            if call in sym_map[path]:
                return target_symbol(*sym_map[path][call])
            return None
        if head in ("self", "cls", "this") and owner and "." in owner:
            cls = owner.split(".")[0]
            return f"{path}::{cls}.{attr}" if f"{cls}.{attr}" in local else None
        if head in mod_map[path]:
            return target_symbol(mod_map[path][head], attr)
        if head in local:
            return f"{path}::{head}.{attr}" if f"{head}.{attr}" in local else None
        if head in sym_map[path]:  # e.g. `from .models import Repo` then `Repo.create()`
            file, name = sym_map[path][head]
            return target_symbol(file, f"{name}.{attr}")
        return None

    imported_by: dict[str, set[str]] = {p: set() for p in parsed}
    for src, targets in imports.items():
        for t in targets:
            imported_by[t].add(src)

    files_out = []
    for path in sorted(parsed):
        pf = parsed[path]
        syms = []
        for s in pf.symbols:
            calls = []
            for c in s.raw_calls:
                rid = resolve_call(path, s.name, c)
                if rid and rid != f"{path}::{s.name}" and rid not in calls:
                    calls.append(rid)
            syms.append(
                {"id": f"{path}::{s.name}", "name": s.name, "kind": s.kind, "line": s.line,
                 "summary": s.summary, "calls": calls}
            )
        module_calls = []
        for c in pf.module_calls:
            rid = resolve_call(path, None, c)
            if rid and rid not in module_calls:
                module_calls.append(rid)
        files_out.append(
            {
                "path": path,
                "lang": pf.lang,
                "lines": pf.lines,
                "summary": pf.summary,
                "is_entry": False,  # filled below
                "parse_error": pf.parse_error,
                "imports": sorted(imports[path]),
                "imported_by": sorted(imported_by[path]),
                "externals": sorted(externals[path]),
                "symbols": syms,
                "module_calls": module_calls,
            }
        )

    entry_points = _entry_points(parsed, extras, all_paths, pkg_roots, imported_by)
    for f in files_out:
        f["is_entry"] = f["path"] in entry_points

    core = [p for p, by in sorted(imported_by.items(), key=lambda kv: (-len(kv[1]), kv[0])) if len(by) >= 2][:8]
    reading_order = _reading_order(entry_points, imports, core)

    own_packages = set()
    for p, text in extras.items():
        if p.endswith("package.json"):
            try:
                own_packages.add(json.loads(text).get("name"))
            except (ValueError, AttributeError):
                pass
    lib_counts = Counter(lib for libs in externals.values() for lib in libs if lib not in own_packages)
    libraries = [{"name": n, "files": c} for n, c in lib_counts.most_common(15)]

    folders = _folders(tree, parsed, extras)
    folder_edges = Counter()
    for src, targets in imports.items():
        for t in targets:
            a, b = posixpath.dirname(src), posixpath.dirname(t)
            if a != b:
                folder_edges[(a, b)] += 1

    root_readme = next((extras[p] for p in extras if "/" not in p and p.lower().startswith("readme")), None)
    langs = Counter(pf.lang for pf in parsed.values())
    return {
        "version": 1,
        "stats": {
            "files": len(tree),
            "code_files": len(parsed),
            "lines": sum(pf.lines for pf in parsed.values()),
            "languages": dict(langs.most_common()),
            "truncated": truncated,
        },
        "readme": readme_summary(root_readme),
        "entry_points": entry_points,
        "core_files": core,
        "reading_order": reading_order,
        "libraries": libraries,
        "folders": folders,
        "folder_edges": [{"from": a, "to": b, "count": n} for (a, b), n in folder_edges.most_common()],
        "tree": tree,
        "files": files_out,
    }


def _link_python(path, imp, py_index, imports, externals, sym_map, mod_map) -> None:
    if imp.level:
        target = py_index.relative(path, imp.level, imp.module)
    else:
        target = py_index.absolute(imp.module) if imp.module else None
    if target is None and not imp.level:
        top = imp.module.split(".")[0]
        if top and top not in STDLIB and top != "__future__":
            externals[path].add(top)
        return
    if imp.names:
        for local, name in imp.names.items():
            sub = (
                py_index.relative(path, imp.level, f"{imp.module}.{name}" if imp.module else name)
                if imp.level
                else py_index.absolute(f"{imp.module}.{name}")
            )
            if sub and sub != path:
                imports[path].add(sub)
                mod_map[path][local] = sub
            elif target and target != path:
                imports[path].add(target)
                sym_map[path][local] = (target, name)
    elif target and target != path:
        imports[path].add(target)
        if imp.alias:
            mod_map[path][imp.alias] = target


def _entry_points(parsed, extras, all_paths, pkg_roots, imported_by) -> list[str]:
    entries: list[str] = []
    for p, pf in parsed.items():
        if pf.is_entry:
            entries.append(p)
    for pkg_path, text in extras.items():
        if not pkg_path.endswith("package.json"):
            continue
        try:
            pkg = json.loads(text)
        except ValueError:
            continue
        root = posixpath.dirname(pkg_path)
        fields = [pkg.get("main"), pkg.get("module"), pkg.get("source")]
        bins = pkg.get("bin")
        fields += list(bins.values()) if isinstance(bins, dict) else [bins]
        for fld in fields:
            if isinstance(fld, str):
                t = _js_resolve(posixpath.join(root, "x.js"), "./" + fld.lstrip("./"), all_paths, pkg_roots)
                if t and t in parsed:
                    entries.append(t)
    for p in parsed:
        name = p.rsplit("/", 1)[-1]
        parent = p.split("/")[-2] if "/" in p else ""
        conventional = p.count("/") <= 1 or parent in ("src", "app", "server", "backend", "frontend", "api")
        only_tests_import_it = all(is_aux(i) for i in imported_by[p] - {p})
        if name in ENTRY_NAMES and conventional and only_tests_import_it:
            entries.append(p)

    def rank(e: str) -> tuple:
        return (is_aux(e), e.rsplit("/", 1)[-1] not in ENTRY_NAMES, e.count("/"), e)

    seen: dict[str, None] = {}
    for e in sorted(entries, key=rank):
        seen.setdefault(e, None)
    return list(seen)[:10]


def _reading_order(entries: list[str], imports: dict[str, set[str]], core: list[str]) -> list[str]:
    order: list[str] = []
    queue = deque([e for e in entries if not is_aux(e)] or entries[:1])
    while queue and len(order) < 15:
        p = queue.popleft()
        if p in order:
            continue
        order.append(p)
        queue.extend(sorted(i for i in imports.get(p, ()) if not is_aux(i)))
    for c in core:
        if len(order) >= 15:
            break
        if c not in order and not is_aux(c):
            order.append(c)
    return order


def _folders(tree: list[str], parsed: dict[str, ParsedFile], extras: dict[str, str]) -> list[dict]:
    counts: Counter = Counter()
    code_counts: Counter = Counter()
    for p in tree:
        d = posixpath.dirname(p)
        while True:
            counts[d] += 1
            if p in parsed:
                code_counts[d] += 1
            if not d:
                break
            d = posixpath.dirname(d)
    readmes = {posixpath.dirname(p): t for p, t in extras.items() if p.rsplit("/", 1)[-1].lower().startswith("readme")}
    out = []
    for d in sorted(counts):
        if not d:
            continue
        out.append(
            {
                "path": d,
                "files": counts[d],
                "code_files": code_counts[d],
                "role": _folder_role(d),
                "summary": readme_summary(readmes.get(d)),
            }
        )
    return out
