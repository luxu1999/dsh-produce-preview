window.__ModuleLoader__.load({ id: "@luxu1999/dsh-produce-preview", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  selectPreviewableFiles: () => selectPreviewableFiles
});
module.exports = __toCommonJS(index_exports);

// src/client/ProducedPreview.tsx
var import_react = require("react");

// src/client/media.ts
var EXT = {
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".webp": "image",
  ".bmp": "image",
  ".svg": "image",
  ".mp4": "video",
  ".webm": "video",
  ".mov": "video",
  ".m4v": "video",
  ".csv": "table",
  ".tsv": "table",
  ".html": "table",
  ".htm": "table"
};
var PREVIEW_EXTENSIONS = Object.keys(EXT).map((ext) => ext.slice(1));
function previewKind(path) {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return "other";
  return EXT[path.slice(dot).toLowerCase()] ?? "other";
}
function isPreviewable(path) {
  return previewKind(path) !== "other";
}
function fileUrl(path) {
  return `/api/produced.file?path=${encodeURIComponent(path)}`;
}
function previewLabel(path) {
  const at = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return at === -1 ? path : path.slice(at + 1);
}

// src/client/ProducedPreview.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function PreviewItem({ path, openFile }) {
  const url = fileUrl(path);
  const label = previewLabel(path);
  const kind = previewKind(path);
  if (kind === "video") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "video",
      {
        controls: true,
        preload: "metadata",
        src: url,
        title: path,
        "aria-label": label,
        style: { display: "block", margin: "6px 0", maxWidth: "100%", maxHeight: 340, borderRadius: 8 },
        onClick: (event) => {
          event.stopPropagation();
          event.preventDefault();
        }
      }
    );
  }
  if (kind === "image") {
    return (
      // click to open the source file
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          title: path,
          "aria-label": label,
          onClick: () => {
            openFile(path);
          },
          style: { display: "block", margin: "6px 0", padding: 0, border: 0, background: "none", cursor: "pointer" },
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "img",
            {
              src: url,
              alt: label,
              loading: "lazy",
              style: { maxWidth: "100%", maxHeight: 420, borderRadius: 8, display: "block" }
            }
          )
        }
      )
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TablePreview, { path, label, openFile });
}
function TablePreview({ path, label, openFile }) {
  const [text, setText] = (0, import_react.useState)(null);
  const [error, setError] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
    let cancelled = false;
    fetch(fileUrl(path)).then(async (response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.text();
    }).then((value) => {
      if (!cancelled) setText(value);
    }).catch(() => {
      if (!cancelled) setError("failed to load");
    });
    return () => {
      cancelled = true;
    };
  }, [path]);
  const body = error !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: error }) : text === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "\u52A0\u8F7D\u4E2D\u2026" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CsvTable, { text });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      "data-table-preview": true,
      title: path,
      role: "button",
      tabIndex: 0,
      onClick: () => {
        openFile(path);
      },
      onKeyDown: (event) => {
        if (event.key === "Enter") openFile(path);
      },
      style: { margin: "6px 0", cursor: "pointer", overflow: "auto", maxHeight: 360, borderRadius: 8, border: "1px solid #d0d3d9" },
      children: body
    }
  );
}
function CsvTable({ text }) {
  const delimiter = text.includes("	") ? "	" : ",";
  const rows = text.split(/\r?\n/u).filter((line) => line.trim() !== "").map((line) => line.split(delimiter));
  if (rows.length === 0) return null;
  const [head, ...body] = rows;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", { style: { borderCollapse: "collapse", fontSize: 13, background: "transparent" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: head.map((cell, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { style: thStyle, children: cell }, index)) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: body.map((row, rowIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", { children: row.map((cell, cellIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", { style: tdStyle, children: cell }, cellIndex)) }, rowIndex)) })
  ] });
}
var thStyle = {
  border: "1px solid #d0d3d9",
  padding: "4px 8px",
  background: "#f2f3f5",
  textAlign: "left"
};
var tdStyle = {
  border: "1px solid #d0d3d9",
  padding: "4px 8px",
  whiteSpace: "nowrap"
};
function ProducedPreview({ matched, openFile }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { "data-produce-preview": true, "data-path-count": matched.length, children: matched.map((path) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewItem, { path, openFile }, path)) });
}

// src/client/produce-conversation.ts
function mutationPath(name, argsRaw) {
  let args;
  try {
    args = JSON.parse(argsRaw);
  } catch {
    return null;
  }
  if (!isRecord(args)) return null;
  switch (name) {
    case "write":
      return typeof args.content === "string" ? pathValue(args.file_path) : null;
    case "edit":
      return validEditArgs(args) ? pathValue(args.file_path) : null;
    case "str_replace_editor":
      return editorMutationPath(args);
    default:
      return null;
  }
}
function validEditArgs(args) {
  return typeof args.old_string === "string" && args.old_string.length > 0 && typeof args.new_string === "string" && args.old_string !== args.new_string && (args.replace_all === void 0 || typeof args.replace_all === "boolean");
}
function editorMutationPath(args) {
  const path = pathValue(args.path);
  if (path === null) return null;
  switch (args.command) {
    case "create":
      return typeof args.file_text === "string" ? path : null;
    case "str_replace":
      return typeof args.old_str === "string" && args.old_str.length > 0 && (args.new_str === void 0 || typeof args.new_str === "string") ? path : null;
    case "insert":
      return typeof args.insert_line === "number" && Number.isInteger(args.insert_line) && args.insert_line >= 0 && typeof args.new_str === "string" ? path : null;
    default:
      return null;
  }
}
function pathValue(value) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
var SURFACE_TYPES = /* @__PURE__ */ new Set(["user/message", "assistant/message", "tool/result"]);
function isAppendSurfaceEvent(event) {
  return SURFACE_TYPES.has(event.type) && event.surfaceOp === "append";
}
function producedForClosing(data, seq = Number.POSITIVE_INFINITY) {
  if (data === void 0) return [];
  const paths = [];
  const seen = /* @__PURE__ */ new Set();
  for (const produced of data.produced) {
    if (produced.seq > seq || seen.has(produced.path)) continue;
    seen.add(produced.path);
    paths.push(produced.path);
  }
  return paths;
}
var producePreviewDefinition = {
  kind: "produce-preview",
  match: (event) => {
    if (event.type === "turn/start") return { id: String(event.data.turn), role: "start" };
    if (event.type === "tool/call") return { id: String(event.data.turn), role: "update" };
    if (event.type === "tool/result" && isAppendSurfaceEvent(event)) {
      return { id: String(event.data.turn), role: "update" };
    }
    return null;
  },
  start: (_context, match) => {
    if (match.event.type !== "turn/start") throw new Error("produce-preview start requires turn/start");
    return { turn: match.event.data.turn, calls: /* @__PURE__ */ new Map(), produced: [] };
  },
  update: (context, match) => {
    if (match.event.type === "tool/call") {
      const calls = new Map(context.state.calls);
      calls.set(
        String(match.event.data.callId),
        mutationPath(match.event.data.name, match.event.data.arguments)
      );
      return { ...context.state, calls };
    }
    if (match.event.type !== "tool/result") return context.state;
    const result = match.event.data.message.content[0];
    if (result.isError === true) return context.state;
    const callId = String(match.event.data.message.source.callId);
    const path = context.state.calls.get(callId);
    return path === null || path === void 0 ? context.state : { ...context.state, produced: [...context.state.produced, { seq: match.event.seq, path }] };
  },
  buildLocationData: (context, scope) => scope !== "turn" || context.state === void 0 ? null : {
    kind: "turn",
    turn: context.state.turn,
    key: "produce-preview",
    value: { produced: context.state.produced }
  }
};

// src/client/locales.ts
var NS = "producePreview";
var zh = {
  label: "\u9884\u89C8",
  open: "\u6253\u5F00 {name}",
  loading: "\u52A0\u8F7D\u4E2D\u2026"
};
var en = {
  label: "Preview",
  open: "Open {name}",
  loading: "Loading\u2026"
};

// src/client/index.ts
var inject = ["slots", "locale", "uiConversation"];
function selectPreviewableFiles(owner) {
  const paths = producedForClosing(owner.turn.data.get("produce-preview"), owner.seq);
  const previewable = paths.filter(isPreviewable);
  return previewable.length === 0 ? null : previewable;
}
function apply(ctx) {
  ctx.uiConversation.events.register(producePreviewDefinition);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "produce-preview: dictionaries");
  ctx.slots.inject(
    "conversation.chat.turnTail",
    () => ctx.slots.register({
      name: "conversation.chat.turnTail",
      select: selectPreviewableFiles,
      locale: NS,
      inject: () => ({})
    }, ProducedPreview)
  );
}
return module.exports; } });
//# sourceMappingURL=client.js.map
