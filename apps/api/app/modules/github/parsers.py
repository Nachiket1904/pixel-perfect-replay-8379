"""Turns one source file into imports, symbols (functions/classes) and raw call names.

Python uses the real parser (ast), so it's accurate. JavaScript/TypeScript uses regular
expressions: good for typical code, approximate for unusual formatting.
"""

import ast
import re
from dataclasses import dataclass, field

PY_EXTS = (".py",)
JS_EXTS = (".js", ".jsx", ".mjs", ".cjs")
TS_EXTS = (".ts", ".tsx")
CODE_EXTS = PY_EXTS + JS_EXTS + TS_EXTS
MAX_CALLS = 40


@dataclass
class RawImport:
    module: str  # "a.b" (Python), "./x" or "react" (JS)
    level: int = 0  # Python relative-import dots
    names: dict[str, str] = field(default_factory=dict)  # local name -> imported name
    alias: str | None = None  # `import a.b as c` / `import * as ns`


@dataclass
class Symbol:
    name: str  # "func", "Class" or "Class.method"
    kind: str  # function | class | method | component
    line: int
    summary: str | None = None
    raw_calls: list[str] = field(default_factory=list)


@dataclass
class ParsedFile:
    path: str
    lang: str  # python | javascript | typescript
    lines: int
    summary: str | None = None
    imports: list[RawImport] = field(default_factory=list)
    symbols: list[Symbol] = field(default_factory=list)
    module_calls: list[str] = field(default_factory=list)  # calls made at import time / in __main__
    default_export: str | None = None
    is_entry: bool = False
    parse_error: bool = False


def lang_for(path: str) -> str | None:
    if path.endswith(PY_EXTS):
        return "python"
    if path.endswith(TS_EXTS) and not path.endswith(".d.ts"):
        return "typescript"
    if path.endswith(JS_EXTS) and not path.endswith(".min.js"):
        return "javascript"
    return None


def first_sentence(text: str | None, limit: int = 200) -> str | None:
    if not text:
        return None
    line = " ".join(text.strip().split("\n\n")[0].split())
    if not line:
        return None
    return line if len(line) <= limit else line[: limit - 1] + "…"


def parse_file(path: str, source: str) -> ParsedFile:
    lang = lang_for(path)
    if lang == "python":
        return parse_python(path, source)
    return parse_js(path, source, lang or "javascript")


# ---------------------------------------------------------------- Python


def _dotted(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        base = _dotted(node.value)
        return f"{base}.{node.attr}" if base else None
    return None


def _calls(node: ast.AST) -> list[str]:
    seen: dict[str, None] = {}
    for sub in ast.walk(node):
        if isinstance(sub, ast.Call) and (name := _dotted(sub.func)):
            seen.setdefault(name, None)
            if len(seen) >= MAX_CALLS:
                break
    return list(seen)


def _is_main_guard(node: ast.stmt) -> bool:
    if not isinstance(node, ast.If) or not isinstance(node.test, ast.Compare):
        return False
    parts = [node.test.left, *node.test.comparators]
    names = {p.id for p in parts if isinstance(p, ast.Name)}
    consts = {p.value for p in parts if isinstance(p, ast.Constant)}
    return "__name__" in names and "__main__" in consts


def _leading_comment(source: str, prefix: str) -> str | None:
    lines: list[str] = []
    for raw in source.splitlines():
        s = raw.strip()
        if not s and not lines:
            continue
        if s.startswith(prefix) and not s.startswith(("#!", "# -*-", "# type:", "# noqa")):
            lines.append(s.lstrip(prefix).strip())
        else:
            break
    return first_sentence(" ".join(lines)) if lines else None


def parse_python(path: str, source: str) -> ParsedFile:
    pf = ParsedFile(path=path, lang="python", lines=source.count("\n") + 1)
    filename = path.rsplit("/", 1)[-1]
    pf.is_entry = filename in ("__main__.py", "manage.py")
    try:
        tree = ast.parse(source)
    except (SyntaxError, ValueError):
        pf.parse_error = True
        return pf

    pf.summary = first_sentence(ast.get_docstring(tree)) or _leading_comment(source, "#")

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                pf.imports.append(RawImport(module=a.name, alias=a.asname or a.name))
        elif isinstance(node, ast.ImportFrom):
            names = {(a.asname or a.name): a.name for a in node.names if a.name != "*"}
            pf.imports.append(RawImport(module=node.module or "", level=node.level, names=names))

    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            pf.symbols.append(
                Symbol(node.name, "function", node.lineno, first_sentence(ast.get_docstring(node)), _calls(node))
            )
        elif isinstance(node, ast.ClassDef):
            pf.symbols.append(Symbol(node.name, "class", node.lineno, first_sentence(ast.get_docstring(node))))
            for item in node.body:
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    pf.symbols.append(
                        Symbol(
                            f"{node.name}.{item.name}",
                            "method",
                            item.lineno,
                            first_sentence(ast.get_docstring(item)),
                            _calls(item),
                        )
                    )
        elif _is_main_guard(node):
            pf.is_entry = True
            pf.module_calls.extend(c for c in _calls(node) if c not in pf.module_calls)
        elif isinstance(node, (ast.Expr, ast.Assign, ast.AnnAssign)):
            pf.module_calls.extend(c for c in _calls(node) if c not in pf.module_calls)
    pf.module_calls = pf.module_calls[:MAX_CALLS]
    return pf


# ---------------------------------------------------------------- JavaScript / TypeScript
# Declarations are matched only at column 0 (top level), so nested helpers stay inside
# the function that owns them.

_IMPORT_FROM = re.compile(
    r"""^\s*(?:import|export)\s+(?:type\s+)?(?P<clause>[\w*\s{},$]+?)\s+from\s+['"](?P<mod>[^'"]+)['"]""",
    re.M,
)
_SIDE_EFFECT = re.compile(r"""^\s*import\s+['"](?P<mod>[^'"]+)['"]""", re.M)
_REQUIRE = re.compile(
    r"""(?:const|let|var)\s+(?P<lhs>[\w$]+|\{[^}]*\})\s*=\s*require\(\s*['"](?P<mod>[^'"]+)['"]\s*\)"""
)
_REQUIRE_ANY = re.compile(r"""\brequire\(\s*['"](?P<mod>[^'"]+)['"]\s*\)""")
_DYNAMIC = re.compile(r"""\bimport\(\s*['"](?P<mod>[^'"]+)['"]\s*\)""")

_FUNC_DECL = re.compile(
    r"^(?P<exp>export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s*(?P<name>[\w$]+)\s*[(<]", re.M
)
_ARROW = re.compile(
    r"^(?P<exp>export\s+)?(?:const|let|var)\s+(?P<name>[\w$]+)\s*(?::[^=\n]+)?=\s*(?:async\s+)?"
    r"(?:\([^)]*\)|[\w$]+)\s*(?::[^=\n]+?)?=>",
    re.M,
)
_FUNC_EXPR = re.compile(
    r"^(?P<exp>export\s+)?(?:const|let|var)\s+(?P<name>[\w$]+)\s*(?::[^=\n]+)?=\s*(?:async\s+)?function\b",
    re.M,
)
_CLASS = re.compile(
    r"^(?P<exp>export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+(?P<name>[\w$]+)", re.M
)
_DEFAULT_EXPORT = re.compile(r"^\s*export\s+default\s+(?P<name>[\w$]+)\s*;?\s*$", re.M)
_CALL = re.compile(r"(?<![\w$.])(?P<name>[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)\s*\(")
_JSX = re.compile(r"<(?P<name>[A-Z][\w$]*(?:\.[A-Z][\w$]*)?)[\s/>]")
_KEYWORDS = {
    "if", "for", "while", "switch", "catch", "function", "return", "typeof", "new", "await", "super",
    "import", "require", "constructor", "else", "do", "try", "with", "void", "delete", "in", "of", "class",
}
_LEADING_BLOCK = re.compile(r"^\s*(?:['\"]use \w+['\"];?\s*)*/\*\*?(?P<body>.*?)\*/", re.S)


def _parse_clause(clause: str) -> tuple[dict[str, str], str | None]:
    names: dict[str, str] = {}
    ns = None
    if m := re.search(r"\{([^}]*)\}", clause):
        for part in m.group(1).split(","):
            part = part.strip()
            part = part[5:].strip() if part.startswith("type ") else part
            if not part:
                continue
            imported, _, local = part.partition(" as ")
            names[(local or imported).strip()] = imported.strip()
        clause = clause[: m.start()] + clause[m.end() :]
    if m := re.search(r"\*\s+as\s+([\w$]+)", clause):
        ns = m.group(1)
        clause = clause.replace(m.group(0), "")
    default = clause.strip().strip(",").strip()
    if default and re.fullmatch(r"[\w$]+", default) and default != "type":
        names[default] = "default"
    return names, ns


def _js_summary(source: str) -> str | None:
    if m := _LEADING_BLOCK.match(source):
        body = " ".join(line.strip().lstrip("*").strip() for line in m.group("body").splitlines())
        body = re.sub(r"@\w+.*", "", body)
        return first_sentence(body)
    return _leading_comment(source, "//")


def _line_of(source: str, index: int) -> int:
    return source.count("\n", 0, index) + 1


def parse_js(path: str, source: str, lang: str) -> ParsedFile:
    pf = ParsedFile(path=path, lang=lang, lines=source.count("\n") + 1, summary=_js_summary(source))
    seen_mods: set[str] = set()

    for m in _IMPORT_FROM.finditer(source):
        names, ns = _parse_clause(m.group("clause"))
        pf.imports.append(RawImport(module=m.group("mod"), names=names, alias=ns))
        seen_mods.add(m.group("mod"))
    for m in _REQUIRE.finditer(source):
        lhs = m.group("lhs")
        if lhs.startswith("{"):
            names, _ = _parse_clause(lhs)
            pf.imports.append(RawImport(module=m.group("mod"), names=names))
        else:
            pf.imports.append(RawImport(module=m.group("mod"), alias=lhs))
        seen_mods.add(m.group("mod"))
    for rx in (_SIDE_EFFECT, _REQUIRE_ANY, _DYNAMIC):
        for m in rx.finditer(source):
            if m.group("mod") not in seen_mods:
                pf.imports.append(RawImport(module=m.group("mod")))
                seen_mods.add(m.group("mod"))

    found: dict[str, tuple[int, str, bool]] = {}  # name -> (offset, kind, exported-default)
    for rx, kind in ((_FUNC_DECL, "function"), (_ARROW, "function"), (_FUNC_EXPR, "function"), (_CLASS, "class")):
        for m in rx.finditer(source):
            name = m.group("name")
            if name in found:
                continue
            exp = m.group("exp") or ""
            if kind == "function" and name[:1].isupper():
                kind_ = "component"
            else:
                kind_ = kind
            found[name] = (m.start("name"), kind_, "default" in exp)
            if "default" in exp:
                pf.default_export = name
    if not pf.default_export and (m := _DEFAULT_EXPORT.search(source)):
        pf.default_export = m.group("name")

    ordered = sorted(found.items(), key=lambda kv: kv[1][0])
    for i, (name, (offset, kind, _)) in enumerate(ordered):
        end = ordered[i + 1][1][0] if i + 1 < len(ordered) else len(source)
        body = source[offset:end]
        calls: dict[str, None] = {}
        for rx in (_CALL, _JSX):
            for m in rx.finditer(body):
                c = m.group("name")
                if c != name and c.split(".")[0] not in _KEYWORDS:
                    calls.setdefault(c, None)
        pf.symbols.append(Symbol(name, kind, _line_of(source, offset), None, list(calls)[:MAX_CALLS]))
    return pf
