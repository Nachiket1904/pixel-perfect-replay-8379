// Pure helpers for the repo visualizer: indexes, folder tree, graph data and layout.
// No React here, so everything is unit-tested.

import type { RepoAnalysis, RepoFileInfo, RepoFolderInfo, RepoSymbol } from "./repos-api";

export const ROOT = "."; // id used for files that sit at the top of the repo

export const dirOf = (path: string) => {
  const i = path.lastIndexOf("/");
  return i === -1 ? ROOT : path.slice(0, i);
};
export const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
export const folderLabel = (folder: string) => (folder === ROOT ? "(top level)" : folder);

// ---------------------------------------------------------------- indexes

export type RepoIndex = {
  files: Map<string, RepoFileInfo>;
  folders: Map<string, RepoFolderInfo>;
  symbols: Map<string, { symbol: RepoSymbol; file: RepoFileInfo }>;
  calledBy: Map<string, string[]>;
  core: Set<string>;
  entries: Set<string>;
};

export function buildIndex(a: RepoAnalysis): RepoIndex {
  const files = new Map(a.files.map((f) => [f.path, f]));
  const folders = new Map(a.folders.map((f) => [f.path, f]));
  const symbols = new Map<string, { symbol: RepoSymbol; file: RepoFileInfo }>();
  const calledBy = new Map<string, string[]>();
  for (const file of a.files) {
    for (const symbol of file.symbols) symbols.set(symbol.id, { symbol, file });
  }
  const addCaller = (callee: string, caller: string) => {
    const list = calledBy.get(callee) ?? [];
    if (!list.includes(caller)) list.push(caller);
    calledBy.set(callee, list);
  };
  for (const file of a.files) {
    for (const s of file.symbols) for (const c of s.calls) addCaller(c, s.id);
    for (const c of file.module_calls) addCaller(c, `${file.path}::(module)`);
  }
  return { files, folders, symbols, calledBy, core: new Set(a.core_files), entries: new Set(a.entry_points) };
}

/** "src/app.py::App.run" -> { file: "src/app.py", name: "App.run" } */
export function splitSymbolId(id: string) {
  const i = id.lastIndexOf("::");
  return { file: id.slice(0, i), name: id.slice(i + 2) };
}

// ---------------------------------------------------------------- folder tree

export type TreeNode = {
  name: string;
  path: string;
  kind: "folder" | "file";
  children: TreeNode[];
};

/** Tree of code files and the folders that contain them, folders first, alphabetical. */
export function buildTree(codePaths: string[]): TreeNode {
  const root: TreeNode = { name: "", path: ROOT, kind: "folder", children: [] };
  for (const path of codePaths) {
    const parts = path.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      const childPath = parts.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.name === part && c.kind === (isFile ? "file" : "folder"));
      if (!child) {
        child = { name: part, path: childPath, kind: isFile ? "file" : "folder", children: [] };
        node.children.push(child);
      }
      node = child;
    });
  }
  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "folder" ? -1 : 1));
    n.children.forEach(sort);
  };
  sort(root);
  return root;
}

// ---------------------------------------------------------------- graph data

export type GraphNodeData = {
  id: string;
  label: string;
  sublabel: string;
  kind: "folder" | "file";
  lang?: RepoFileInfo["lang"];
  isEntry: boolean;
  isCore: boolean;
  outside: boolean; // a neighbour from another folder, shown for context
};
export type GraphData = { nodes: GraphNodeData[]; edges: { from: string; to: string; count?: number }[] };

/** One node per folder that directly holds code files; edges are imports between folders. */
export function folderGraph(a: RepoAnalysis, index: RepoIndex): GraphData {
  const byFolder = new Map<string, RepoFileInfo[]>();
  for (const f of a.files) byFolder.set(dirOf(f.path), [...(byFolder.get(dirOf(f.path)) ?? []), f]);
  const nodes: GraphNodeData[] = [...byFolder.entries()].map(([folder, files]) => {
    const meta = index.folders.get(folder);
    return {
      id: folder,
      label: folder === ROOT ? "(top level)" : folder,
      sublabel: meta?.role ?? `${files.length} code file${files.length === 1 ? "" : "s"}`,
      kind: "folder",
      isEntry: files.some((f) => index.entries.has(f.path)),
      isCore: files.some((f) => index.core.has(f.path)),
      outside: false,
    };
  });
  const toId = (d: string) => (d === "" ? ROOT : d);
  const edges = a.folder_edges
    .map((e) => ({ from: toId(e.from), to: toId(e.to), count: e.count }))
    .filter((e) => byFolder.has(e.from) && byFolder.has(e.to));
  return { nodes, edges };
}

/** Files in one folder (or the whole repo when folder is null) plus their outside neighbours. */
export function fileGraph(a: RepoAnalysis, index: RepoIndex, folder: string | null, maxOutside = 24): GraphData {
  const inside = a.files.filter((f) => folder === null || dirOf(f.path) === folder);
  const insideSet = new Set(inside.map((f) => f.path));
  const outside: string[] = [];
  if (folder !== null) {
    for (const f of inside) {
      for (const p of [...f.imports, ...f.imported_by]) {
        if (!insideSet.has(p) && !outside.includes(p) && outside.length < maxOutside) outside.push(p);
      }
    }
  }
  const make = (path: string, isOutside: boolean): GraphNodeData => {
    const f = index.files.get(path)!;
    return {
      id: path,
      label: isOutside ? path : baseName(path),
      sublabel: f.summary ?? `${f.lines} lines, ${f.symbols.length} definitions`,
      kind: "file",
      lang: f.lang,
      isEntry: index.entries.has(path),
      isCore: index.core.has(path),
      outside: isOutside,
    };
  };
  const nodes = [...inside.map((f) => make(f.path, false)), ...outside.map((p) => make(p, true))];
  const ids = new Set(nodes.map((n) => n.id));
  const edges: GraphData["edges"] = [];
  for (const n of nodes) {
    for (const target of index.files.get(n.id)!.imports) {
      if (ids.has(target) && (!n.outside || insideSet.has(target))) edges.push({ from: n.id, to: target });
    }
  }
  return { nodes, edges };
}

// ---------------------------------------------------------------- layout

/**
 * Layered layout: importers above the things they import. Cycles are broken by
 * ignoring back edges; wide layers wrap onto extra rows.
 */
export function layoutLayers(
  ids: string[],
  edges: { from: string; to: string }[],
  opts: { colWidth?: number; rowHeight?: number; maxPerRow?: number } = {},
): Map<string, { x: number; y: number }> {
  const colWidth = opts.colWidth ?? 250;
  const rowHeight = opts.rowHeight ?? 120;
  const maxPerRow = opts.maxPerRow ?? 6;
  const idSet = new Set(ids);
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const { from, to } of edges) {
    if (from === to || !idSet.has(from) || !idSet.has(to) || out.get(from)!.includes(to)) continue;
    out.get(from)!.push(to);
    indegree.set(to, indegree.get(to)! + 1);
  }

  // Depth-first search; edges back to a node still on the stack form a cycle and are dropped.
  const state = new Map<string, 1 | 2>();
  const dag = new Map<string, string[]>(ids.map((id) => [id, []]));
  const postorder: string[] = [];
  const visit = (n: string) => {
    state.set(n, 1);
    for (const m of out.get(n)!) {
      const s = state.get(m);
      if (s === 1) continue;
      dag.get(n)!.push(m);
      if (s === undefined) visit(m);
    }
    state.set(n, 2);
    postorder.push(n);
  };
  const roots = [...ids].sort((a, b) => indegree.get(a)! - indegree.get(b)! || a.localeCompare(b));
  for (const id of roots) if (!state.has(id)) visit(id);

  const level = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const n of [...postorder].reverse()) {
    for (const m of dag.get(n)!) level.set(m, Math.max(level.get(m)!, level.get(n)! + 1));
  }

  const layers: string[][] = [];
  for (const id of ids) (layers[level.get(id)!] ??= []).push(id);

  const parents = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const [n, kids] of dag) for (const k of kids) parents.get(k)!.push(n);

  const pos = new Map<string, { x: number; y: number }>();
  let y = 0;
  for (const layer of layers) {
    if (!layer) continue;
    const order = layer
      .map((id) => {
        const xs = parents.get(id)!.map((p) => pos.get(p)?.x).filter((x): x is number => x !== undefined);
        return { id, key: xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : Number.POSITIVE_INFINITY };
      })
      .sort((a, b) => a.key - b.key || a.id.localeCompare(b.id));
    for (let i = 0; i < order.length; i += maxPerRow) {
      const row = order.slice(i, i + maxPerRow);
      row.forEach((item, j) => pos.set(item.id, { x: (j - (row.length - 1) / 2) * colWidth, y }));
      y += rowHeight;
    }
    y += rowHeight * 0.25;
  }
  return pos;
}
