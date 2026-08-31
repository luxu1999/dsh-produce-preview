# dsh-produce-preview

一个**独立的 DeepSeek Harness 插件**：把智能体刚生成的文件——图片、视频、表格——**直接在网页聊天里内联预览**，让你不用再去文件夹里翻找 DeepSeek-Harness 在你机器上生成的东西。这就是"输出直接显示在这里"的体验。

它**完全不改动 DeepSeek-Harness 代码本体**：是一个常规的 DSH 插件包（带宿主半与浏览器/客户端半的 profile "bundle"）。你把它装进某个 profile 运行即可；如果哪里不对，直接卸载——你的 Harness 安装永远不会被改动。

```
  DeepSeek Harness 智能体运行 ComfyUI / 写文件
        │  产出 out/image.png、out/video.mp4、data.csv
        ▼
  浏览器（本插件客户端半）──┐
        │ GET /api/produced.file?path=…   │
        ▼                                 ▼
  宿主（本插件宿主半）  以 content-type + Range 流式送出字节
```

## 它能做什么

- **图片**（`png/jpg/jpeg/gif/webp/bmp/svg`）：内嵌 `<img>` 显示；点击用系统程序打开原文件。
- **视频**（`mp4/webm/mov/m4v`）：真实 `<video controls>`，带 `Accept-Ranges` 流式传输可拖进度条；`preload="metadata"` 用首帧当海报。
- **表格**（`csv/tsv/html`）：从字节路由拉取并渲染成 HTML 表格；点击打开原文件。
- 使用与内置 `ui-deliverables` 相同的"产出文件"事实（一轮中 `write`、`edit`、`str_replace_editor` 的成功变更），因此和现有的"Produced"芯片保持一致——只是**额外**加了一条内联预览通道；即使 `ui-deliverables` 被移出组合也能工作。

文件字节走**授权、限定工作区**的 HTTP 路由（`/api/produced.file`），不是裸 shell 访问；拒绝绝对路径与 `..` 越界，并把服务路径限制在工作区根内。

## 如何安装（隔离测试用）

本包用于装进 **DSH profile**（由 profile 提供 `@deepseek-ai/*` 作用域与 cordis/react），不是发布到 npm。

1. 在运行 DSH 的机器上克隆：

   ```
   git clone https://github.com/luxu1999/dsh-produce-preview.git
   cd dsh-produce-preview
   npm install          # 安装 esbuild/typescript（构建工具）
   npm run build        # 生成 lib/index.js 与 lib/client.js
   ```

   `lib/` 已签入仓库，因此若你信任随包产物，`npm run build` 可省略。

2. 建一个自定义 profile（或复用 `web`）并加入插件：

   ```
   dsh plugin --profile web add @luxu1999/dsh-produce-preview
   dsh plugin --profile web install
   ```

   想用独立 profile 以便干净卸载：

   ```
   dsh plugin --profile preview add @luxu1999/dsh-produce-preview
   dsh plugin --profile preview install
   dsh --profile preview
   ```

3. `@luxu1999/dsh-produce-preview` 必须能被 profile 解析：`resolveBundleDir` 先从 dsh 安装解析，再从 profile 目录解析。若包**未发布**，用本地路径安装（本地 install 到 profile 的 `node_modules`，或 `dsh plugin --profile preview add ./dsh-produce-preview`）。

4. 让智能体生成图片/视频/表格（例如通过 ComfyUI，或直接 `write` 一个 `sample.png`/`report.csv`）。内联预览会出现在该助手消息下方。

## 卸载插件

```
dsh plugin --profile web remove @luxu1999/dsh-produce-preview
```
（或直接删掉整个 profile）。你的 Harness 内核不受影响。

## 插件结构

| 路径 | 作用 |
|---|---|
| `src/index.ts` | 宿主半：注册 `GET/HEAD /api/produced.file` |
| `src/client/index.ts` | 浏览器半：注册 turn-tail 预览槽 |
| `src/client/ProducedPreview.tsx` | 内联 图片/视频/表格 渲染 |
| `src/client/produce-conversation.ts` | 产出路径会话节点 |
| `cordis.patch.yml` | 挂载该插件行的 bundle patch |
| `scripts/build.mjs` | esbuild 构建（宿主 ESM + 闭包工厂客户端 bundle） |

## 配置

宿主路由通过插件行的 `config` 约束（参考 `packages/bundle/web-app/cordis.patch.yml` 的行写法，或本包 `cordis.patch.yml`）：

| key | 默认 | 含义 |
|---|---|---|
| `root` | 自动检测 | 服务文件被限制到的绝对工作区根。自动 = 第一个注册的 workspace，否则 `process.cwd()`。 |
| `maxBytes` | 512 MiB | 单次响应最多流式字节。 |
| `allowRange` | `true` | 启用 `206`/`Range` 以便 `<video>` 拖进度。 |

## 已知限制

- **产出文件来源**：只追踪 `write`/`edit`/`str_replace_editor` 的成功调用（DSH 原生的"产出文件"事实）。若是 ComfyUI **通过裸 shell 命令**落盘（DeepSeek-Harness 没有调用自己的 `write` 工具），则**不在**列表内；让智能体也引用输出路径（或写一个小的 manifest）即可纳入。后续版本可改为扫描工作区新增媒体。
- **`.xlsx`**：不内联解析（仅浏览器端 CSV/TSV/HTML）；文件仍可通过 produced-file 芯片打开。
- **多工作区**：服务根默认取第一个注册的 workspace；尚未实现按会话固定。
- 这是**插件**，正确性依赖运行时契约；请先在隔离 profile 里测试再依赖它（这正是本仓库存在的原因）。

## License

MIT。
