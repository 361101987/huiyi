# 绘漪 — 项目说明文档

> **⚠️ 维护约定：修改网页时，必须同步更新本文档。**  
> 文档与网页放同一目录，文件名 `绘漪-README.md`，方便 AI 直接读取。

---

## 一、项目概述

**绘漪** 是一个纯前端的 AI 图片生成工具，通过 Grsai API 调用 GPT-Image-2 模型生成图片，可选集成 DeepSeek API 做提示词增强。

- **文件**：`gpt-image2-studio.html`（单文件，含 CSS + HTML + JS）
- **外部依赖**：JSZip（CDN `https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js`）
- **无需服务器**：双击 HTML 即可在浏览器运行
- **API 提供方**：Grsai（全球节点 `grsaiapi.com`，国内节点 `grsai.dakka.com.cn`）

---

## 二、文件结构（单文件内部三段式）

```
gpt-image2-studio.html
├── <head>
│   ├── JSZip CDN <script>
│   └── <style> 全部 CSS（约 500 行）
├── <body>
│   └── HTML 结构（约 200 行）
│       ├── .app（主布局：.sidebar + .main）
│       ├── 模态框 ×6（对比、变体、灵感库、结构化、图片查看器、快捷键面板）
│       ├── 浮动栏（选择栏、Toast）
│       └── <script> 全部 JS（约 700 行）
└── </html>
```

---

## 三、布局结构

### 3.1 整体布局
```
┌──────────────────────────────────────────────────────┐
│  .app (flex, 100vh)                                   │
│ ┌──────────┬─────────────────────────────────────────┐│
│ │ .sidebar │ .main                                    ││
│ │ (340px)  │ ┌──────────────────────────────────────┐││
│ │          │ │ .prompt-area（提示词输入+操作按钮）   │││
│ │ API Key  │ ├──────────────────────────────────────┤││
│ │ 节点     │ │ .content                              │││
│ │ 模型     │ │  ├── 生成中任务区 (#tasksSection)      │││
│ │ 尺寸     │ │  ├── 失败记录区 (#failedSection)       │││
│ │ 参考图   │ │  └── 历史记录区（标签+搜索+卡片网格）  │││
│ │ DeepSeek │ └──────────────────────────────────────┘││
│ │ 风格预设 │                                         ││
│ └──────────┴─────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

### 3.2 侧边栏（.sidebar）各区块（从上到下）

| 区块 | HTML 区域 | 功能 |
|------|----------|------|
| 标题栏 | `.header` | 标题 + 主题切换/快捷键按钮 |
| API Key | `.sidebar-section` #apiKey | Grsai API 密钥输入（可显隐） |
| 节点 | `.node-toggle` | 全球 / 国内 两个节点切换 |
| 模型 | `#model` select | gpt-image-2 / gpt-image-2-vip |
| 尺寸 | `#sizeGrid` | 11 种宽高比 × 1~3 种分辨率 |
| 参考图 | `#refImages` + `#refDropZone` | 最多 4 张参考图（点击/拖拽/粘贴） |
| DeepSeek | `.ds-section`（可折叠） | DeepSeek API Key + 中译英/AI增强/一键生成 |
| 风格预设 | `#templateBar` | 12 种风格芯片（点击添加前缀到提示词） |

### 3.3 主内容区（.main）

**提示词区（.prompt-area）**：
- 提示词输入框 `#prompt`
- 负向提示词 `#negativePrompt`（排除元素）
- 操作按钮：生成、增强、灵感库、结构化
- 批量数量 `#batchCount`（1~10 张）
- 字数统计 `#charCount`

**内容区（.content）**：
- 生成中任务：实时显示运行中的任务卡片
- 失败记录：持久化显示失败任务+原因+重试
- 历史记录：标签页（全部/收藏）+ 搜索 + 模型筛选 + 卡片网格

---

## 四、模态框清单

| 模态框 | 容器 ID | 触发方式 | 功能 |
|--------|---------|---------|------|
| 图片对比 | `#compareModal` | 点击「⚖ 对比」或历史卡片的 A/B 按钮 | 左右对比两张图及提示词 |
| 变体生成 | `#variateModal` | 点击历史卡片的「🔄 变体」 | 以现有图为参考图，修改提示词重新生成 |
| 提示词灵感库 | `#libModal` | 点击「📚 灵感库」 | 7 大类 20+ 模板，点击使用即填入提示词 |
| 结构化构建器 | `#structModal` | 点击「🧩 结构化」 | 4 字段输入（主体/风格/布局/约束）+ 实时预览 |
| 图片查看器 | `#viewer` | 点击任意图片 | 全屏大图 + 左右翻页 + 下载 |
| 快捷键面板 | `#shortcutsPanel` | 点击「⌨」或按 `?` | 浮动面板显示快捷键列表 |

模态框通用规则：
- 都用 `.modal-overlay` + `.active` 类控制显隐
- 点击遮罩层关闭、Esc 关闭、关闭按钮关闭

---

## 五、核心数据结构

### 5.1 全局状态（`state` 对象）

```javascript
state = {
  node: 'global',           // API 节点：'global' | 'china'
  model: 'gpt-image-2',     // 当前模型
  selectedSize: '1024x1024',// 选中尺寸（像素值）
  selectedRatio: '1:1',     // 选中宽高比
  selectedQuality: '1K',    // 选中画质等级
  refImages: [],            // 参考图 base64 数组（最多4）
  tasks: [],                // 正在进行的任务
  history: [],              // 历史记录（localStorage 持久化，最多200条）
  favorites: Set,           // 收藏的图片 ID
  pollingTimers: {},        // 轮询定时器 { taskId: intervalId }
  currentViewerUrl: '',     // 当前查看的大图 URL
  currentViewerList: [],    // 大图浏览的 URL 列表
  currentViewerIdx: -1,     // 大图浏览当前索引
  theme: 'dark',            // 主题：'dark' | 'light' | 'sakura'
  selectedIds: Set,         // 多选的图片 ID
  compareA: null,           // 对比图 A
  compareB: null,           // 对比图 B
  searchQuery: '',          // 搜索关键词
  filterModel: 'gpt-image-2',// 模型筛选
  activeTab: 'all',         // 历史标签：'all' | 'favs'
  variateSrcUrl: '',        // 变体源图 URL
  variateSrcPrompt: '',     // 变体源提示词
  failedRecords: []         // 失败记录（localStorage 持久化）
}
```

### 5.2 任务对象（tasks[] / history[] 的元素）

```javascript
// tasks[] 中的任务
{
  id: string,           // API 返回的任务 ID
  prompt: string,       // 提示词（含负向提示词拼接）
  model: string,        // 使用的模型
  size: string,         // 尺寸
  status: string,       // 'running' | 'succeeded' | 'failed' | 'violation'
  progress: number,     // 进度百分比
  results: [{url}],     // 生成结果
  error: string|null,   // 错误信息
  createdAt: number     // 时间戳
}

// history[] 中的记录
{
  url: string,          // 图片 URL
  prompt: string,       // 提示词
  model: string,        // 模型
  size: string,         // 尺寸
  timestamp: number,    // 时间戳
  id: string            // 唯一 ID
}

// failedRecords[] 中的记录
{
  prompt: string,
  model: string,
  size: string,
  error: string,
  status: string,       // 'failed' | 'violation'
  timestamp: number,
  id: string
}
```

### 5.3 localStorage 键

| 键 | 内容 | 说明 |
|----|------|------|
| `gis2_settings` | API Key、节点、模型、尺寸、主题、收藏 | 页面设置 |
| `gis2_history` | 历史记录数组（最多200条） | 生成历史 |
| `gis2_failed` | 失败记录数组 | 失败记录 |
| `gis2_dskey` | DeepSeek API Key | DeepSeek 密钥 |

---

## 六、核心业务流程

### 6.1 图片生成流程

```
用户点击「生成」
  → handleGenerate()
    → 拼接负向提示词（prompt += ' 不要包含：' + neg）
    → 循环 batchCount 次调用 submitGeneration()
      → POST /v1/api/generate { model, prompt, aspectRatio, images, replyType:'async' }
      → 返回 { id } → addTask(id, prompt)
        → startPolling(id)
          → 每 2s GET /v1/api/result?id=xxx
          → updateTask() 更新状态/进度
          → 成功：移入 history[]，保存 localStorage
          → 失败：移入 failedRecords[]，保存 localStorage
          → 2~3秒后从 tasks[] 移除卡片
```

### 6.2 DeepSeek API 调用流程

```
用户点击「中译英/AI增强/一键生成/AI优化」
  → dsTranslate() / dsEnhance() / dsAutoGenerate() / dsStructOptimize()
    → dsCall(messages)
      → POST https://api.deepseek.com/v1/chat/completions
        { model:'deepseek-chat', messages, max_tokens:2048, temperature:0.7 }
      → 返回结果填入提示词框
```

### 6.3 参考图流程

```
添加方式：点击 '+' | 拖拽到放置区 | ⌘V 粘贴截图
  → fileToBase64() 转 base64
  → push 到 state.refImages[]（最多4张）
  → 提交时作为 images 参数传给 API
```

---

## 七、关键函数索引

### 7.1 API 与生成

| 函数 | 作用 |
|------|------|
| `submitGeneration(prompt, images)` | 提交生成请求到 Grsai API |
| `pollResult(taskId)` | 轮询任务结果 |
| `addTask(taskId, prompt)` | 添加任务到 tasks[] |
| `updateTask(taskId, data)` | 更新任务状态/进度/结果 |
| `removeTask(taskId)` | 从 tasks[] 移除 |
| `startPolling(taskId)` | 启动轮询定时器 |
| `stopPolling(taskId)` | 停止轮询定时器 |
| `handleGenerate()` | 生成按钮入口（拼接负向提示词、批量、提交） |
| `handleVariate()` | 变体生成（以现有图为参考图） |
| `downloadImage(url, btnEl)` | 下载图片（fetch→blob→a.click） |

### 7.2 DeepSeek 集成

| 函数 | 作用 |
|------|------|
| `dsCall(messages, showLoading)` | DeepSeek API 统一调用（含 loading 状态、错误处理） |
| `dsTranslate()` | 中文提示词 → 英文 |
| `dsEnhance()` | 提示词增强（添加细节） |
| `dsAutoGenerate()` | 简短描述 → 完整提示词 |
| `dsStructOptimize()` | 结构化提示词 → AI 优化版 |

### 7.3 提示词工具

| 函数 | 作用 |
|------|------|
| `enhancePrompt()` | 本地增强提示词（关键词匹配+质量词追加） |
| `openPromptLibrary()` | 打开灵感库模态框 |
| `renderLibTemplates(catIdx)` | 渲染指定分类的模板列表 |
| `useLibTemplate(key)` | 使用模板（填入提示词框） |
| `openStructBuilder()` | 打开结构化构建器 |
| `updateStructPreview()` | 实时更新结构化预览 |
| `useStructPrompt()` | 使用结构化提示词 |
| `generateFromStruct()` | 直接用结构化提示词生成 |
| `translateError(msg)` | 英文错误信息 → 中文 |

### 7.4 界面渲染

| 函数 | 作用 |
|------|------|
| `init()` | 初始化入口 |
| `loadSettings()` | 从 localStorage 加载设置 |
| `saveSettings()` | 保存设置到 localStorage |
| `saveHistory()` | 保存历史到 localStorage |
| `saveFailed()` | 保存失败记录到 localStorage |
| `renderSizeGrid()` | 渲染尺寸选择网格 |
| `renderTemplates()` | 渲染风格预设芯片 |
| `renderRefImages()` | 渲染参考图缩略图 |
| `renderTasks()` | 渲染生成中任务卡片 |
| `renderFailed()` | 渲染失败记录列表 |
| `renderHistory()` | 渲染历史记录卡片（含搜索/筛选/收藏/多选） |
| `applyTheme()` | 应用主题（暗黑/明亮/夜樱） |
| `toggleTheme()` | 切换主题 |
| `updateCharCount()` | 更新字数统计 |

### 7.5 交互操作

| 函数 | 作用 |
|------|------|
| `viewImage(url)` | 查看单张大图 |
| `viewImageList(filteredIdx)` | 在历史列表中查看大图（可翻页） |
| `closeViewer()` | 关闭大图查看器 |
| `viewerNavDir(dir)` | 大图翻页（-1 上一张 / +1 下一张） |
| `reusePrompt(index)` | 复用历史提示词 |
| `toggleFavorite(id)` | 切换收藏 |
| `toggleSelection(id)` | 切换多选 |
| `clearSelection()` | 清空多选 |
| `selectAllVisible()` | 全选当前可见图片 |
| `updateSelectionBar()` | 更新底部选择栏 |
| `setCompareA(idx)` / `setCompareB(idx)` | 设置对比图 A/B |
| `openVariate(idx)` | 打开变体生成 |
| `showToast(msg, type)` | 显示 Toast 提示 |
| `addRefImagesFromFiles(files)` | 批量添加参考图文件 |
| `addRefImageFromBlob(blob)` | 从 Blob 添加参考图 |
| `fileToBase64(file)` | 文件转 base64 |

### 7.6 导出

| 函数 | 作用 |
|------|------|
| `exportZIP()` | 多选图片打包为 ZIP 下载（含 metadata.json） |
| `exportJSON()` | 多选图片导出 JSON 报告 |

---

## 八、常量配置

| 常量 | 值 | 说明 |
|------|----|------|
| `BASE_URLS` | `{ global: 'https://grsaiapi.com', china: 'https://grsai.dakka.com.cn' }` | API 节点地址 |
| `SIZE_MAP` | 11 种宽高比 × 1~3 种分辨率 | 所有可用尺寸映射 |
| `POLL_INTERVAL` | `2000` | 轮询间隔（毫秒） |
| `STYLE_TEMPLATES` | 12 种风格预设 | 风格芯片数据 |
| `PROMPT_LIBRARY` | 7 大类 20+ 模板 | 灵感库数据 |
| `DS_BASE_URL` | `'https://api.deepseek.com/v1/chat/completions'` | DeepSeek API 地址 |
| `ERROR_ZH` | 25+ 条英中错误映射 | 错误信息翻译表 |

---

## 九、快捷键

| 快捷键 | 功能 |
|--------|------|
| ⌘/Ctrl + Enter | 生成图片 |
| ⌘/Ctrl + E | 增强提示词 |
| ⌘/Ctrl + D | 切换主题（暗黑 → 明亮 → 夜樱） |
| ⌘/Ctrl + A | 全选（历史区） |
| Space | 查看大图（需焦点不在输入框） |
| Esc | 关闭当前弹窗/查看器 |
| ← / → | 大图翻页 |
| / | 聚焦搜索框 |
| ? | 显示/隐藏快捷键面板 |

---

## 十、CSS 变量体系（暗黑 / 明亮 / 夜樱 三套）

暗色主题（默认）通过 `:root` 定义，亮色主题通过 `[data-theme="light"]` 覆盖，夜樱主题通过 `[data-theme="sakura"]` 覆盖：

| 变量 | 暗色值 | 亮色值 | 夜樱值 | 用途 |
|------|--------|--------|--------|------|
| `--bg` | `#0b0b12` | `#f5f5f7` | `#12101f` | 主背景色 |
| `--surface` | `#13131d` | `#ffffff` | `#1a172a` | 卡片/面板底色 |
| `--surface2` | `#1a1a28` | `#eeeef2` | `#221e36` | 二级表面 |
| `--surface3` | `#22222f` | `#e5e5ea` | `#2a2640` | 三级表面 |
| `--border` | `#2a2a3a` | `#d1d1d6` | `#362f52` | 主边框色 |
| `--border2` | `#33334a` | `#c7c7cc` | `#443c62` | 二级边框 |
| `--text` | `#e4e4ef` | `#1d1d1f` | `#ede8f5` | 主文字色 |
| `--text2` | `#8888a0` | `#6e6e73` | `#9b8fb8` | 次要文字 |
| `--text3` | `#555568` | `#aeaeb2` | `#6b5f88` | 辅助/提示文字 |
| `--accent` | `#7c5cfc` | `#6c4de6` | `#e8829a` | 主强调色 |
| `--accent2` | `#5a3ed8` | `#5538c4` | `#d4607a` | 强调色暗态 |
| `--accent-glow` | `rgba(124,92,252,.15)` | `rgba(108,77,230,.1)` | `rgba(232,130,154,.12)` | 强调色光晕 |
| `--radius` | `12px` | — | — | 圆角大小 |
| `--radius-sm` | `8px` | — | — | 小圆角 |
| `--shadow` | `0 4px 24px rgba(0,0,0,.3)` | `0 4px 24px rgba(0,0,0,.08)` | `0 4px 24px rgba(18,16,31,.5)` | 卡片阴影 |

> 🌸 **夜樱主题（sakura）** 是小鱼设计的专属样式：深蓝紫夜空底色 + 樱花粉主色调，侧边栏带渐变，标题栏有樱花飘落动画，输入框聚焦时有柔和光晕。适合安静的深夜使用。

---

## 十一、历史卡片操作按钮

每张历史卡片有这些操作（从左到右）：

| 按钮 | 功能 | 调用 |
|------|------|------|
| ⬇ 下载 | 下载图片到本地 | `downloadImage()` |
| ♻ 重用 | 将提示词填回输入框 | `reusePrompt()` |
| A | 选为对比图 A | `setCompareA()` |
| B | 选为对比图 B | `setCompareB()` |
| 🔄 变体 | 以此图为参考图重新生成 | `openVariate()` |

卡片还有：
- 左上角 ☑ 多选框（hover 显示）
- 右上角 ☆/★ 收藏按钮（hover 显示）

---

## 十二、API 接口说明

### Grsai API

**提交生成**：
```
POST {BASE_URL}/v1/api/generate
Headers: Authorization: Bearer {apiKey}, Content-Type: application/json
Body: {
  model: "gpt-image-2" | "gpt-image-2-vip",
  prompt: "提示词",
  aspectRatio: "1024x1024",   // 或其他尺寸
  images: ["data:image/..."],  // 参考图（可选）
  replyType: "async"
}
Response: { id: "taskId" }
```

**轮询结果**：
```
GET {BASE_URL}/v1/api/result?id={taskId}
Headers: Authorization: Bearer {apiKey}
Response: {
  status: "running" | "succeeded" | "failed" | "violation",
  progress: 0~100,
  results: [{ url: "https://..." }],
  error: "error message" | null
}
```

### DeepSeek API

```
POST https://api.deepseek.com/v1/chat/completions
Headers: Authorization: Bearer {dsApiKey}, Content-Type: application/json
Body: {
  model: "deepseek-chat",
  messages: [{ role, content }],
  max_tokens: 2048,
  temperature: 0.7
}
```

---

## 十三、负向提示词机制

GPT-Image-2 不支持独立的 negative_prompt 参数，但支持中文语法 `不要包含：[元素]`。

实现方式：在 `handleGenerate()` 中，如果 `#negativePrompt` 输入框有内容，自动拼接到提示词末尾：
```javascript
if(neg) prompt += ' 不要包含：' + neg;
```

---

## 十四、功能完整清单

| # | 功能 | 状态 | 关键 ID / 函数 |
|---|------|------|----------------|
| 1 | API Key 输入（显隐切换） | ✅ | `#apiKey`, `#keyToggle` |
| 2 | 节点切换（全球/国内） | ✅ | `.node-btn[data-node]` |
| 3 | 模型选择 | ✅ | `#model` |
| 4 | 尺寸选择（11比例×多分辨率） | ✅ | `#sizeGrid` |
| 5 | 参考图上传（点击/拖拽/粘贴） | ✅ | `#refImages`, `#refDropZone`, `#refInput` |
| 6 | 提示词输入 + 字数统计 | ✅ | `#prompt`, `#charCount` |
| 7 | 负向提示词 | ✅ | `#negativePrompt` |
| 8 | 风格预设（12种芯片） | ✅ | `#templateBar` |
| 9 | 批量生成（1~10张） | ✅ | `#batchCount` |
| 10 | 图片生成 + 轮询 | ✅ | `handleGenerate()`, `submitGeneration()` |
| 11 | 生成进度条 | ✅ | `.progress-bar .fill` |
| 12 | 失败记录（持久化） | ✅ | `#failedSection`, `#failedList` |
| 13 | 历史记录（持久化，最多200条） | ✅ | `#historyGrid` |
| 14 | 搜索提示词 | ✅ | `#searchInput` |
| 15 | 模型筛选 | ✅ | `.filter-chip[data-model]` |
| 16 | 标签页（全部/收藏） | ✅ | `.history-tab[data-tab]` |
| 17 | 收藏 | ✅ | `.card-fav` |
| 18 | 多选 + 批量操作 | ✅ | `.card-select`, `#selectionBar` |
| 19 | ZIP 导出（含 metadata.json） | ✅ | `exportZIP()` |
| 20 | JSON 报告导出 | ✅ | `exportJSON()` |
| 21 | 图片对比（A/B） | ✅ | `#compareModal` |
| 22 | 变体生成 | ✅ | `#variateModal` |
| 23 | 图片查看器（大图+翻页） | ✅ | `#viewer` |
| 24 | 图片下载 | ✅ | `downloadImage()` |
| 25 | 提示词增强（本地） | ✅ | `enhancePrompt()` |
| 26 | 提示词灵感库（7类20+模板） | ✅ | `#libModal` |
| 27 | 结构化提示词构建器 | ✅ | `#structModal` |
| 28 | DeepSeek 中译英 | ✅ | `dsTranslate()` |
| 29 | DeepSeek AI增强 | ✅ | `dsEnhance()` |
| 30 | DeepSeek 一键生成 | ✅ | `dsAutoGenerate()` |
| 31 | DeepSeek 结构化AI优化 | ✅ | `dsStructOptimize()` |
| 32 | 暗黑/明亮/夜樱主题切换 | ✅ | `toggleTheme()` |
| 33 | 快捷键系统 | ✅ | keydown 监听 |
| 34 | Toast 提示 | ✅ | `showToast()` |
| 35 | 错误信息中英翻译 | ✅ | `translateError()`, `ERROR_ZH` |
| 36 | localStorage 持久化 | ✅ | 4 个键 |
| 37 | 移动端响应式 | ✅ | `@media(max-width:768px)` |

---

## 十五、给 AI 的使用指南

### 场景 A：你只有这份文档，想修改网页

1. **先读这份文档**，了解架构和功能
2. **打开 HTML 文件**，根据文档中的 ID 和函数名定位代码位置
3. 修改完成后，**同步更新本文档**

### 场景 B：你想从零理解这个网页

1. 读这份文档的「布局结构」和「核心业务流程」
2. 在 HTML 中搜索 `// ============` 注释分段（Config → State → DOM → Init → API → Tasks → History → ...）
3. JS 代码按功能分段，每段有注释标记

### 场景 C：你想添加新功能

1. 在本文档找到最接近的现有功能，参考其实现模式
2. 需要的步骤：
   - HTML：在对应区域添加元素（给 ID）
   - CSS：在 `<style>` 中添加样式（用 CSS 变量）
   - JS：添加函数 + 在 `bindEvents()` 中绑定事件
   - 如果需要持久化：在 `state` 对象添加字段 + `loadSettings()`/`saveSettings()` 中处理
   - 如果是模态框：参照现有模态框模式（`.modal-overlay` + `.active` 类）
3. **修改完成后更新本文档**

---

## 十六、JS 代码分段标记

在 HTML 的 `<script>` 中，代码按以下 `// ============` 注释分段：

```
Config          — 常量配置（BASE_URLS, SIZE_MAP, STYLE_TEMPLATES, PROMPT_LIBRARY, DS_BASE_URL, ERROR_ZH）
State           — 全局状态对象 state
DOM             — DOM 元素引用（$ = getElementById 简写）
Init            — 初始化、设置加载/保存
Theme           — 主题切换
Size Grid       — 尺寸选择网格
Templates       — 风格预设芯片
Reference Images — 参考图管理
API             — Grsai API 调用（submitGeneration, pollResult）
Tasks           — 任务管理（添加、更新、轮询、渲染）
Failed Records  — 失败记录（渲染、重试、复用）
History         — 历史记录（筛选、渲染）
Selection       — 多选管理
Export          — ZIP / JSON 导出
Compare         — 图片对比
Variate         — 变体生成
Enhance         — 本地提示词增强
Actions         — 生成、下载、查看器、复用、收藏
Event Bindings  — 所有事件绑定（一个巨大的 bindEvents() 函数）
DeepSeek API    — DeepSeek 统一调用 + 4 个具体功能函数
Prompt Library  — 灵感库（打开、渲染、使用）
Structured Builder — 结构化构建器（打开、预览、使用、生成、AI优化）
Start           — init() 调用
```

---

## 十七、已知限制与待改进

| 问题 | 说明 |
|------|------|
| 历史记录上限 200 条 | 超过自动截断，无法配置 |
| 无图片本地缓存 | 历史记录存的是 URL，如果服务器删除图片则丢失 |
| DeepSeek 密钥明文存储 | 存在 localStorage，无加密 |
| 代码无压缩/注释 | 单文件直接手写，未做构建优化 |
| 无撤销操作 | 删除历史/收藏等操作不可逆 |
| 移动端体验一般 | 响应式布局有但交互未针对触屏优化 |

---

_最后更新：2026-05-13_
