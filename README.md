# dsh-produce-preview

A **standalone DeepSeek Harness plugin** that renders the files an agent just
produced — images, videos, and tables — **inline in the Web chat**, so you do
not have to dig through folders to see what DeepSeek-Harness made on your
machine. Think of it as the "show me the output right here" experience.

It ships **without touching the DeepSeek-Harness codebase**: it is a normal
DSH plugin package (a profile "bundle" with a host half and a browser/client
half). You install it into a profile, run, and — if anything is off — you can
uninstall it again; your Harness install is never modified.

```
  DeepSeek Harness agent runs ComfyUI / writes files
        │  produces out/image.png, out/video.mp4, data.csv
        ▼
  browser (this plugin's client half) ──┐
        │ GET /api/produced.file?path=…   │
        ▼                                 ▼
  host (this plugin's host half)  streams bytes with content-type + Range
```

## What it does

- **Images** (`png/jpg/jpeg/gif/webp/bmp/svg`): shown as an inline `<img>`; click
  to open the source file with the OS.
- **Videos** (`mp4/webm/mov/m4v`): shown as a real `<video controls>`, streamed
  with `Accept-Ranges` so you can seek. `preload="metadata"` gives a poster
  from the first frame.
- **Tables** (`csv/tsv/html`): rendered as an HTML table from the byte route;
  click to open the source.
- It uses the same produced-file facts the stock `ui-deliverables` row uses
  (`write`, `edit`, `str_replace_editor` mutations in a turn), so it agrees with
  the existing "Produced" chips — it just adds the inline preview lane in
  addition, and works even if `ui-deliverables` is composed out.

The file bytes go through an **authorized, workspace-scoped HTTP route**
(`/api/produced.file`), not through raw shell access. It rejects absolute paths
and `..` escapes and confines the served path to a workspace root.

## How to install (test in isolation)

This package is meant to be installed **into a DSH profile** (which provides the
`@deepseek-ai/*` scope and cordis/react), not published to npm.

1. Clone it somewhere on the machine that runs DSH:

   ```
   git clone https://github.com/luxu1999/dsh-produce-preview.git
   cd dsh-produce-preview
   npm install          # installs esbuild/typescript (build tooling)
   npm run build        # produces lib/index.js and lib/client.js
   ```

   `lib/` is also checked in, so `npm run build` is optional if you trust the
   shipped bundle.

2. Build a custom profile (or reuse `web`) and add the plugin:

   ```
   dsh plugin --profile web add @luxu1999/dsh-produce-preview
   dsh plugin --profile web install
   ```

   If you prefer a dedicated profile so you can remove it cleanly:

   ```
   dsh plugin --profile preview add @luxu1999/dsh-produce-preview   # or: dsh plugin --profile preview new
   dsh plugin --profile preview install
   dsh --profile preview
   ```

3. Because `@luxu1999/dsh-produce-preview` must be resolvable from the profile,
   `resolveBundleDir` looks first at the dsh installation, then at the profile
   directory. If the plugin is **not** published, `dsh plugin add` resolves it
   from the local path you installed it to (npm link / file install into the
   profile's `node_modules`, or `dsh plugin --profile preview add ./dsh-produce-preview`).

4. Ask the agent to make an image/video/table (e.g. via ComfyUI, or just have it
   `write` a `sample.png`/`report.csv`). The inline preview appears under the
   closing assistant message.

## Removing the plugin

```
dsh plugin --profile web remove @luxu1999/dsh-produce-preview
```
(or remove the profile entirely). Your Harness core is untouched.

## Plugin layout

| Path | Role |
|---|---|
| `src/index.ts` | Host half: registers `GET/HEAD /api/produced.file` |
| `src/client/index.ts` | Browser half: registers the turn-tail preview slot |
| `src/client/ProducedPreview.tsx` | Inline image/video/table renderer |
| `src/client/produce-conversation.ts` | Produced-path conversation node |
| `cordis.patch.yml` | Bundle patch that mounts the plugin row |
| `scripts/build.mjs` | esbuild build (host ESM + closure-factory client bundle) |

## Configuration

The host route is bounded through the plugin row's `config` (see
`packages/bundle/web-app/cordis.patch.yml` style rows, or this package's
`cordis.patch.yml`):

| key | default | meaning |
|---|---|---|
| `root` | auto-detect | Absolute workspace root files are confined to. Auto = first registered workspace, else `process.cwd()`. |
| `maxBytes` | 512 MiB | Max bytes one response may stream. |
| `allowRange` | `true` | Enable `206`/`Range` so `<video>` can seek. |

## Known limits

- **Produced-file source**: only `write`/`edit`/`str_replace_editor` success
  calls are tracked (the DSH-native "produced files" facts). Files written by a
  ComfyUI run *through a raw shell command* — where DeepSeek-Harness does not
  call its own `write` tool — are **not** in that list; telling the agent to also
  reference the output path (or write a small manifest) puts them in. A
  future version can scan the workspace for changed media instead.
- **`.xlsx`**: not parsed inline (browser CSV/TSV/HTML only); the file still
  opens via the produced-file chip.
- **Multi-workspace**: served root defaults to the first registered workspace;
  session-scoped pinning is not yet implemented.
- This is a **plugin**, so validation is on the runtime contract; test it in an
  isolated profile before relying on it (that is exactly why this repo exists).

## License

MIT.
