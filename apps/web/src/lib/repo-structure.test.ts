import { describe, expect, it } from "vitest";
import type { RepoAnalysis, RepoFileInfo } from "./repos-api";
import { buildIndex, buildTree, dirOf, fileGraph, folderGraph, layoutLayers, splitSymbolId } from "./repo-structure";

const file = (path: string, over: Partial<RepoFileInfo> = {}): RepoFileInfo => ({
  path,
  lang: "python",
  lines: 10,
  summary: null,
  is_entry: false,
  parse_error: false,
  imports: [],
  imported_by: [],
  externals: [],
  symbols: [],
  module_calls: [],
  ...over,
});

const analysis: RepoAnalysis = {
  version: 1,
  stats: { files: 4, code_files: 4, lines: 40, languages: { python: 4 }, truncated: false },
  readme: null,
  entry_points: ["main.py"],
  core_files: ["app/models.py"],
  reading_order: ["main.py"],
  libraries: [],
  folders: [{ path: "app", files: 2, code_files: 2, role: "Core business logic", summary: null }],
  folder_edges: [
    { from: "", to: "app", count: 1 },
    { from: "tests", to: "app", count: 1 },
  ],
  tree: [],
  files: [
    file("main.py", {
      imports: ["app/service.py"],
      symbols: [{ id: "main.py::main", name: "main", kind: "function", line: 1, summary: null, calls: ["app/service.py::run"] }],
    }),
    file("app/service.py", {
      imports: ["app/models.py"],
      imported_by: ["main.py", "tests/test_service.py"],
      symbols: [{ id: "app/service.py::run", name: "run", kind: "function", line: 3, summary: null, calls: [] }],
    }),
    file("app/models.py", { imported_by: ["app/service.py"] }),
    file("tests/test_service.py", { imports: ["app/service.py"] }),
  ],
};

describe("indexes", () => {
  it("knows who calls a function", () => {
    const index = buildIndex(analysis);
    expect(index.calledBy.get("app/service.py::run")).toEqual(["main.py::main"]);
    expect(splitSymbolId("a/b.py::C.m")).toEqual({ file: "a/b.py", name: "C.m" });
    expect(dirOf("main.py")).toBe(".");
  });
});

describe("buildTree", () => {
  it("puts folders before files", () => {
    const tree = buildTree(analysis.files.map((f) => f.path));
    expect(tree.children.map((c) => c.name)).toEqual(["app", "tests", "main.py"]);
    expect(tree.children[0]?.children.map((c) => c.path)).toEqual(["app/models.py", "app/service.py"]);
  });
});

describe("graphs", () => {
  const index = buildIndex(analysis);

  it("builds a folder map with the top level as its own node", () => {
    const g = folderGraph(analysis, index);
    expect(g.nodes.map((n) => n.id).sort()).toEqual([".", "app", "tests"]);
    expect(g.edges).toContainEqual({ from: ".", to: "app", count: 1 });
    expect(g.nodes.find((n) => n.id === "app")!.sublabel).toBe("Core business logic");
  });

  it("shows a folder's files plus outside neighbours", () => {
    const g = fileGraph(analysis, index, "app");
    const outside = g.nodes.filter((n) => n.outside).map((n) => n.id);
    expect(outside.sort()).toEqual(["main.py", "tests/test_service.py"]);
    expect(g.edges).toContainEqual({ from: "app/service.py", to: "app/models.py" });
    expect(g.edges).toContainEqual({ from: "main.py", to: "app/service.py" });
  });
});

describe("layoutLayers", () => {
  it("puts importers above what they import", () => {
    const pos = layoutLayers(["a", "b", "c"], [
      { from: "a", to: "b" },
      { from: "b", to: "c" },
    ]);
    expect(pos.get("a")!.y).toBeLessThan(pos.get("b")!.y);
    expect(pos.get("b")!.y).toBeLessThan(pos.get("c")!.y);
  });

  it("survives import cycles", () => {
    const pos = layoutLayers(["a", "b"], [
      { from: "a", to: "b" },
      { from: "b", to: "a" },
    ]);
    expect(pos.size).toBe(2);
    expect(pos.get("a")!.y).not.toBe(pos.get("b")!.y);
  });

  it("wraps wide layers onto more rows", () => {
    const ids = ["root", ...Array.from({ length: 10 }, (_, i) => `n${i}`)];
    const pos = layoutLayers(ids, ids.slice(1).map((to) => ({ from: "root", to })), { maxPerRow: 4 });
    const rows = new Set(ids.slice(1).map((id) => pos.get(id)!.y));
    expect(rows.size).toBe(3);
  });
});
