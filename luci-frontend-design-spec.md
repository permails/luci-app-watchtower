# OpenWrt LuCI 插件前端视觉与交互设计规范（`luci-app-cert` 同款风格指南）

> 本文档完整提取自 `luci-app-cert`（`overview.js` / `settings.js` / `logread.js`）及 `luci-app-secbox` 实机打磨的线上规范，已在 **OpenWrt 23.05（Bootstrap 窄容器）** 与 **OpenWrt 25.12+（Light / Dark 双模式）** 上验证通过。可直接作为后续任何 OpenWrt LuCI 插件开发的 UI 设计基准。

---

## 一、技术基线与核心原则

1. **纯原生 LuCI ES6 架构**
   - 仅依赖 `'use strict'` + `'require view'` / `'require form'` / `'require ui'` / `'require uci'` / `'require fs'` / `'require poll'` / `'require rpc'`，不引入外部 CSS 框架、不引入图标字体或额外第三方 JS。
   - 每个视图通过 `E('style', {}, ...)` 注入局部样式，优先限定在 `#maincontent`、`#cbi-<pkg>`、`#modal_overlay > .modal.cbi-modal` 及专属类名前缀（如 `.cert-*`，新插件可统一替换前缀如 `.app-*`），避免污染全局其他 LuCI 页面。
2. **完全继承系统主题变量，支持自动明暗切换**
   - 所有色彩基于 LuCI 原生 CSS 变量 + `color-mix(in srgb, ...)`，并提供传统 `rgba(...)` / 普通变量兜底，兼容不支持 `color-mix` 的老浏览器。
   - **禁止硬编码纯白/纯黑背景与文字色**（如 `#fff` / `#000`），全部使用 `var(--background-color-*)`、`var(--text-color-*)`、`var(--border-color-*)`。
3. **跨 OpenWrt 版本兼容（23.05 Bootstrap vs 25.x）**
   - 必须显式覆盖 Bootstrap 主题的 `background-image: none; background-size: auto;`（例如 `ul.tabs`），否则 23.05 的渐变背景会破坏分段标签外观。
   - 4 列卡片网格桌面端使用 `repeat(4, minmax(0, 1fr))`，**禁用 `repeat(auto-fit, minmax(220px, 1fr))`**，防止 OpenWrt 23.05 较窄的 `.container`（约 `940px`，内宽约 `900px`）把第 4 张卡片挤成两行。

---

## 二、设计 Token 体系（色彩、圆角、阴影、字号）

### 1. 语义 CSS 变量与混色公式

| 用途 | 浅色模式写法（含兜底） | 深色模式覆盖（`:root[data-darkmode="true"]`） |
| :--- | :--- | :--- |
| 外层大面板底色 | `background: var(--background-color-medium);`<br>`background: color-mix(in srgb, var(--background-color-low) 60%, var(--background-color-high));` | 自动随变量适配 |
| 内层卡片/表格底色 | `var(--background-color-high)` | 自动适配 |
| 表头/次级条带底色 | `color-mix(in srgb, var(--background-color-low) 40%, var(--background-color-high))` | 自动适配 |
| 主边框 / 弱分隔线 | `var(--border-color-medium)` / `var(--border-color-low)` | 自动适配 |
| 主文字 / 次文字 | `var(--text-color-high)` / `var(--text-color-medium)` | 自动适配 |
| 成功态（绿）文字与浅底 | 字：`var(--success-color-low)`<br>底：`rgba(var(--success-color-high-rgb), 0.12)` | 字：`var(--success-color-high)` |
| 信息/主色（蓝）文字与浅底 | 字：`var(--primary-color-low)`<br>底：`color-mix(in srgb, var(--primary-color-high) 12%, transparent)` | 字：`var(--primary-color-high)` |
| 警告态（黄）文字与浅底 | 字：`var(--text-color-high)`<br>底：`color-mix(in srgb, var(--warn-color-high) 22%, transparent)` | 字：`var(--warn-color-low)` |
| 错误/危险态（红）文字与浅底 | 字：`var(--error-color-low)`<br>底：`rgba(var(--error-color-high-rgb), 0.12)` | 字：`var(--error-color-high)` |
| 状态卡语义底色（绿 / 蓝 / 黄 / 红 / 灰） | 绿：`5%` `--success-color-high`<br>蓝：`3%–5%` `--primary-color-high`<br>黄：`7%` `--warn-color-high`<br>红：`5.5%` `--error-color-high`<br>灰（禁用）：`35%` `--background-color-low` | 自动适配 |
| 表格列头 `.th` 底色（克制冰蓝灰） | `color-mix(in srgb, var(--primary-color-high) 2.5%, var(--background-color-high))`<br>底线：`14%` `--primary-color-high` 混 `--border-color-low` | 自动适配 |

### 2. 圆角与阴影层级

| 元素类型 | 圆角 (`border-radius`) | 边框与阴影 (`border` & `box-shadow`) |
| :--- | :--- | :--- |
| 最外层大分区容器 / 弹窗 | `10px` | `1px solid var(--border-color-low)`；弹窗：`0 12px 32px rgba(15, 23, 42, 0.16)` |
| 分段选项卡条 (`ul.tabs` / `.cbi-tabmenu`) | `8px` | 外框 `8px`，选中子项 `6px` + `0 1px 3px rgba(15, 23, 42, 0.08)` |
| 状态卡片 / 表格本体 / 部署子卡片 | `8px` | 卡片：`0 2px 6px rgba(15, 23, 42, 0.05)`；表格容器：`0 2px 8px rgba(15, 23, 42, 0.06)` |
| 独立胶囊表头 (`.cert-panel-head`) | `8px` | 边框 `color-mix(in srgb, var(--primary-color-high) 24%, var(--border-color-medium))`，阴影 `0 1px 3px rgba(15, 23, 42, 0.04)` |
| 下拉浮层菜单 (`.cert-combo-menu`) | `8px` | `1px solid var(--border-color-medium)` + `0 10px 28px rgba(15, 23, 42, 0.16)` |
| 提示条 / 子目标卡片 / 日志输入框 | `4px` - `6px` | `1px solid var(--border-color-low)` |
| 状态标签 / 计数徽章 (`pill` / `tag`) | `999px` | 无阴影，纯浅底高亮或 `1px` 半透明主色边框 |

### 3. 排版字号规范

- 页面主标题 `h2`：继承 LuCI 默认，配合 `display: flex; align-items: center; flex-wrap: wrap; gap: 10px;` 在右侧内联挂载服务总状态胶囊（`font-size: 12px; padding: 3px 10px; line-height: 1.4`）。
- 大分区标题 / 弹窗标题：`14px` - `16px`，`font-weight: 600`。
- 独立表头胶囊：桌面 `13.5px`，移动端 `13px`，`font-weight: 600`。
- 状态卡标题：`12px`（`font-weight: 600`，`var(--text-color-medium)`）；主数字/核心指标：`18px`（移动端 `16px`，`font-weight: 600; line-height: 1.3`）；底部副标题：`12px`。
- 表格列头 `.th`：`11.5px`，`font-weight: 600; letter-spacing: 0.02em; white-space: nowrap`。
- 状态胶囊 / 计数角标：`11px` - `11.5px`，`font-weight: 600`。
- 路径 / 代码 / 日志文本：`font-family: var(--font-mono, monospace); font-size: 12px`。

---

## 三、页面总体骨架与三大页型

### 1. 顶部菜单导航条（所有子页面统一 Segmented Control）

将 LuCI 原生 `#maincontent ul.tabs` 统一改造为浅灰圆角槽 + 白色高亮浮块：

```css
#maincontent ul.tabs {
  display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; margin: 0 0 16px 0;
  border-radius: 8px;
  background: var(--background-color-medium);
  background: color-mix(in srgb, var(--background-color-low) 60%, var(--background-color-high));
  border: 1px solid var(--border-color-low);
  background-image: none; background-size: auto;
}
#maincontent ul.tabs > li {
  height: auto !important; max-width: none; margin: 0 !important;
  border-radius: 6px; border: 1px solid transparent;
  background: transparent; background-image: none;
  color: var(--text-color-medium);
  transition: background 0.15s ease, color 0.15s ease;
}
#maincontent ul.tabs > li > a {
  padding: 6px 14px; line-height: 1.4; font-size: 13.5px; font-weight: 500;
  border-radius: 6px; background: transparent;
}
#maincontent ul.tabs > li:not(.active):hover {
  background: var(--background-color-high); background-image: none; color: var(--primary-color-high);
}
#maincontent ul.tabs > li.active {
  background: var(--background-color-high); background-image: none;
  border-color: var(--border-color-low); color: var(--primary-color-high);
  font-weight: 600; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}
```

### 2. 三种标准页型

| 页型 | 适用场景 | 外层容器规范 |
| :--- | :--- | :--- |
| **概览仪表盘页 (`overview.js`)** | 状态面板 + 多张数据表 | 外层 `#maincontent #cbi-<pkg>` 透明无边框；内部拆成两个独立 `#f8f8f8`（`color-mix(low 60%, high)`）圆角大框：<br>1. `#<pkg>_status_panel`（顶栏标题+操作工具栏 + 4 列卡片 + 提示条）<br>2. `.<pkg>-tables-box`（内含多张带独立胶囊表头的表格）<br>两框间距 `margin: 0 0 16px 0`。 |
| **配置表单页 (`settings.js`)** | 纯配置项表单 (`TypedSection`) | `#cbi-<pkg>` 本身作为外层圆角大框（`padding: 18px 20px; border-radius: 10px`）；内部每个 `cbi-section` 是独立白底圆角卡片（`border-radius: 8px; margin-top: 16px`），自带 `h3` 卡片顶栏（`padding: 12px 16px; border-bottom`）与 `.cbi-value` 分割线列表。 |
| **日志查看页 (`logread.js`)** | 实时日志 / 终端输出 | `#cbi-<pkg>` 为外层圆角大框；内部单个 `.cert-panel` 白底卡片：顶栏 `.cert-panel-head` 左放标题+行数胶囊，右放「等级筛选 + 关键词搜索 + 刷新/置底/置顶」工具栏；主体 `.cert-log-body` 内嵌只读等宽 `<textarea>`（`height: 500px; white-space: pre; overflow: auto`）。 |

---

## 四、核心组件规范

### 1. 运行状态总览栏（Header Bar + Toolbar）

- **页面总标题**：`h2` 右侧紧跟 `#cert_service_badge`（`.cert-dot-ok`「运行中」或 `.cert-dot-err`「已停止」）。
- **状态面板顶栏 `.cert-header-bar`**：左右两端对齐（`justify-content: space-between; gap: 10px; margin-bottom: 12px`）。
  - 左侧：`h3`（「运行状态」）。
  - 右侧 `.cert-toolbar`：
    1. 服务开关按钮（运行中为红色次/负向按钮 `停止服务` `cbi-button-negative`，已停用为绿色 `启用服务` `cbi-button-positive`）。
    2. 目标下拉框 `<select>`（`min-width: 170px; max-width: 260px; height: 28px; font-size: 12.5px`）。
    3. 主操作按钮（蓝色主按钮 `cbi-button-action`）与次操作按钮（中性按钮 `cbi-button-neutral`）；当服务停用或无目标时设 `disabled`（`opacity: 0.45`）。
    4. 仅在有后台任务运行时动态显隐的中止按钮（`cbi-button-negative`）。

### 2. 四列摘要卡片（`.cert-summary-grid`）

- **网格规则**：
  - 桌面端（`> 860px`）：`grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;`
  - 中等屏（`<= 860px`）：`repeat(2, minmax(0, 1fr)); gap: 10px;`
  - 小屏（`<= 520px`）：`1fr;`
- **卡片内部结构**：
  - `min-height: 90px; padding: 14px 16px; border-radius: 8px; display: flex; flex-direction: column; justify-content: space-between;`
  - 卡片底色按语义带极浅着色：`ok`（5% 绿）、`info`（5% 蓝）、`warn`（7% 黄）、`err`（5.5% 红）。
  - `.cert-card-head`：左 `.cert-card-title`（`12px` 灰字），右 `.cert-dot` 状态圆点胶囊（带 `6px` 实心小圆点 `::before`）。
  - `.cert-card-body`：上 `.cert-card-main`（`18px` 粗体核心指标），下 `.cert-card-sub`（`12px` 辅助说明，可含单行截断/跳转链接如 `配置 →`）。

### 3. 独立胶囊表头 + 表格容器（Detached Tab-Header Table）

这是本套设计最显著的视觉特征——**表格标题独立于表格主体之上，呈左对齐圆角小胶囊块，所有同类表格等高对齐**：

- **独立标题块**（同时应用于自定义表格 `.cert-panel-head` 与 CBI `GridSection` 的 `#cbi-<pkg>-<sec> > h3`）：
  ```css
  display: inline-flex; min-width: 176px; height: 36px; box-sizing: border-box;
  align-items: center; justify-content: space-between; gap: 10px;
  margin: 0 0 8px 0 !important; padding: 0 14px;
  border: 1px solid color-mix(in srgb, var(--primary-color-high) 24%, var(--border-color-medium));
  border-radius: 8px;
  background: color-mix(in srgb, var(--primary-color-high) 7%, var(--background-color-high));
  font-size: 13.5px; font-weight: 600; color: var(--primary-color-low);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  ```
  - 左侧为表格标题文字，右侧可挂 `.cert-count-pill` 数量徽章（白底圆角 `999px`，`11px`）。
- **表格主体容器 `.cert-panel-body`**：
  - 注意：`GridSection` 在 JS 中需覆写 `s.render()`，将其原生 `.table` 与 `.cbi-section-create` 包入一个 `E('div', { 'class': 'cert-panel-body' })` 中，才能使 CBI 表格与自定义表格视觉 100% 一致。
  - `border-radius: 8px; border: 1px solid var(--border-color-medium); background: var(--background-color-high); overflow-x: auto; overflow-y: hidden; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);`
- **表格行与列**：
  - 去掉原生外边框与隔行斑马纹（`.cbi-rowstyle-2 { background: transparent }`），改用 `1px solid var(--border-color-low)` 细横线 + `hover` 淡蓝高亮（`3%` `--primary-color-high`）。
  - **桌面端防折行**：关键窄列（状态、时间、路径、命令）使用 `white-space: nowrap`；颁布者/长文本用 `.cert-issuer-text`（`max-width: 220px; text-overflow: ellipsis; overflow: hidden` 并配 `title` 全文悬浮提示）。
  - **操作列 `.td.cbi-section-actions`**：`width: 1%; white-space: nowrap;`，内部包 `display: inline-flex; flex-wrap: nowrap; gap: 6px; justify-content: flex-end;` 确保按钮永不换行错位。
  - **空表占位 `.tr.placeholder`**：固定 `height: 52px; line-height: 52px; padding: 0 16px; color: var(--text-color-medium); font-size: 12.5px;`。
  - **底部新增栏 `.cbi-section-create`**：`display: flex; align-items: center; padding: 10px 16px; gap: 8px; border-top: 1px solid var(--border-color-low);` 浅底条带。

### 4. 提示条（`.cert-note`）与状态徽章（`.cert-tag`）

- **状态胶囊 `.cert-tag`**：用于表内状态（`有效` / `即将过期` / `测试环境` / `运行中` / `失败` / `已禁用` / `复制` / `软链接`），固定 `padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600; white-space: nowrap`。多胶囊组必须包裹在 `display: flex; flex-wrap: wrap; gap: 6px;` 容器中，防止行内无空白字符时溢出被右侧裁切。
- **提示条 `.cert-note`**：统一采用**暖琥珀黄浅底 + 四周 `1px` 细边框**（`10%` `--warn-color-high` 底色 + `28%` 边框、`padding: 10px 14px; border-radius: 6px; font-size: 12.5px; line-height: 1.45; transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;`），不加左侧粗竖线（圆角处易显突兀）；成功/错误变体对应绿/红浅底（`.<pkg>-note-err` 需同时设 `color: var(--error-color-high);`、`10%` `--error-color-high` 底色、`34%` 边框）。若放在 `form.DummyValue` 内，需用 `:has(.cert-note)` 隐藏空 `.cbi-value-title`、取消底线并设 `width: auto; margin: 2px 20px 6px 20px;`。
- **提示条错误变红抖动（`.<pkg>-note-shake`）**：当用户触发前置条件不满足的操作（如未配置凭证时点击“启动服务”）或操作失败时，除将提示条切换为 `.<pkg>-note-err` 红底红字外，叠加水平微抖动动画 `@keyframes pb-shake`（`0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-5px); } 40%, 80% { transform: translateX(5px); }`，时长 `0.42s ease-in-out`），重复点击时通过 `classList.remove` + `void el.offsetWidth` 重排 + `classList.add` 确保每次都能重新触发抖动。

### 5. 弹窗与分段表单（`#modal_overlay > .modal.cbi-modal`）

- **弹窗外框**：`border-radius: 10px; padding: 18px 22px 14px 22px; overflow: visible;`（`overflow: visible` 是为了让内部下拉浮层 `.cert-combo-menu` 不被裁剪）。
- **弹窗顶栏 `> h4`**：负边距贴边 `margin: -18px -22px 16px -22px; padding: 14px 22px; border-radius: 10px 10px 0 0; background: var(--background-color-medium); border-bottom: 1px solid var(--border-color-low);`。
- **弹窗底栏 `> .button-row`**：负边距贴边 `margin: 14px -22px -14px -22px; padding: 12px 22px; border-radius: 0 0 10px 10px; background: var(--background-color-medium); border-top: 1px solid var(--border-color-low);`。
- **弹窗内分段 Tab（`.cbi-tabmenu`）**：与顶部页面导航条完全同款的 Segmented Control 风格（`padding: 4px; border-radius: 8px` + 白底浮块选中态）。
- **弹窗内自定义布局**：
  - 使用 `.cert-deploy-card` 分组（白底圆角 `8px` 卡片），内部行 `.cert-deploy-row` 左右对齐（左标签+`<code>`路径，右操作按钮组）。
  - 多目标表单 `.cert-deploy-grid` 采用 2 列 Grid（`repeat(2, minmax(0, 1fr)); gap: 10px 12px`），跨整行字段加 `.full`（`grid-column: 1 / -1`）。
  - **按钮主次降级原则**：未安装/失败的目标操作用主色按钮 `cbi-button-action`（如「立即安装」）；已同步成功的目标按钮降级为中性按钮 `cbi-button-neutral`（如「重新安装」），避免多个蓝按钮同时抢视觉焦点。

### 6. 高级表单控件（搜索下拉 Combobox & 结构化密钥框）

- **统一对齐宽度**：表单内所有复杂控件容器（`.cert-combo`、`.cert-creds-wrap`）桌面端统一 `width: 100%; max-width: 460px;`。
- **单输入框动态搜索下拉（`.cert-combo`）**：
  - 外观为单个输入框（右侧内置清除 `×` 与展开 `▾` 按钮，输入右侧留 `padding-right: 54px`），隐藏原生 `<select>`（`display: none`）但保留其 DOM 与值绑定。
  - 下拉面板 `.cert-combo-menu` 绝对定位在下方 `top: calc(100% + 4px); z-index: 1200; max-height: 240px`，顶部显示匹配计数 `.cert-combo-meta`，选项高亮显示名称+右对齐等宽 ID（`.cert-combo-id`），支持键盘上下选择、回车确认、`Esc` 关闭。
- **内嵌显隐开关的密钥框（`.cert-cred-box`）**：
  - `Show / Hide` 按钮绝对定位在输入框右侧内部（`right: 6px; padding: 3px 7px`），输入框留 `padding-right: 58px`，不额外占横向空间。
- **行内格式校验警告与一键修复（`.cert-cred-warn` + `.cert-cred-fix`）**：
  - 检测到多余引号/`KEY=`/`export ` 前缀时，在输入框正下方显示浅红圆角条，右侧附带小巧轮廓按钮「自动修复」，点击即时清理并同步回底层配置。
- **折叠附属项无接缝拼接**：
  - 通过 `.cert-row-join-bottom`（去掉下边框、缩减下内边距）与 `.cert-row-joined`（去掉上边框、缩减上内边距），把展开的 fallback 原始列表无缝接在上方凭证区正下方，避免出现多余的中间分割线。

---

## 五、响应式与移动端适配规范

必须同时包含两层核心断点（与桌面 860px 断点配合）：

1. **平板断点 (`@media screen and (max-width: 860px)`)**：
   - 4 列摘要卡片切换为 2×2（`grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px`）。
2. **手机横竖屏通用断点 (`@media screen and (max-width: 768px), screen and (max-device-width: 600px)`)**：
   - **防 iOS 输入框自动放大**：所有可见 `<input>` 与 `<select>` 强制 `font-size: 16px !important; min-height: 36px~38px; box-sizing: border-box;`。
   - **触控友好按钮**：按钮最小高度 `34px~36px`。
   - **顶部导航条**：`#maincontent ul.tabs > li { flex: 1 1 auto; }` 等分撑满整行。
   - **状态工具栏 `.cert-toolbar`**：转为 2 列网格，`<select>` 与运行中全宽按钮 `grid-column: 1 / -1`。
   - **表格卡片化**：隐藏表头 `.table-titles`（`display: none !important`），每行 `.tr` 改为带 `flex-wrap: wrap` 的圆角块，`.td` 占 `calc(50% - 10px)` 并通过 `.td[data-title]::before { content: attr(data-title); display: block; font-size: 11px; }` 自动生成字段小标题；操作列 `.td.cbi-section-actions` 占满 `100%` 顶部加虚线分隔；文本恢复 `white-space: normal; word-break: break-word;`。
   - **弹窗全宽化**：`#modal_overlay > .modal.cbi-modal { width: calc(100vw - 20px) !important; margin: 10px auto; padding: 14px 14px 12px 14px; }`；所有 `.cbi-value` 改为上下堆叠（`flex-direction: column`，标签左对齐全宽，输入框全宽）。
3. **极窄手机断点 (`@media screen and (max-width: 520px)`)**：
   - 摘要卡片降级为 1 列（`1fr`）；卡片式表格字段改为单列（`flex: 1 1 100%`）；部署双列表单 `.cert-deploy-grid` 改为单列（`1fr`）；弹窗底栏按钮 `flex: 1 1 auto` 等分铺满。

---

## 六、前端交互与反馈规范

1. **即时反馈与异步锁**：
   - 所有执行后台指令的按钮在请求期间立即置 `btn.disabled = true` 并切换过渡文案（如 `启动中...` / `停止中...` / `重启中...` / `安装中...`），`finally` 中恢复或随面板重绘刷新；避免重复触发。
   - **禁止使用 `ui.addNotification` 顶部全宽大蓝条与屏幕悬浮 Toast**：页面级操作（启停服务、重启、发送测试、刷新等）的反馈统一内联渲染在当前所属面板底部的语义提示条（`.<pkg>-note-info` 蓝底 / `.<pkg>-note` 琥珀黄 / `.<pkg>-note-err` 红底，约 `4.5s` 后自动收起并恢复常驻提示），不跳出屏幕、不遮挡视野。
   - **一键启停与前置拦截 + 稳定态复核**：
     - **前置拦截与原地变红抖动**：点击“启动服务”时，先校验必要前置条件（如推送通道凭证是否完整）；若不满足，**禁止直接拉起后台进程**，而是原地将底部常驻提示条切换为 `.<pkg>-note-err` + `.<pkg>-note-shake`（变红并水平抖动提示），保持状态卡片为未激活态。
     - **稳定态二次复核**：若后台脚本依赖 UCI 开关（如 `enable='1'`），仅当当前值与目标值不同时才执行 `uci.set()` + `uci.save()` + `uci.apply()`（并兼容 `ubus code 5 / No data received` 无变更返回）；调用 `/etc/init.d/<pkg>` 启动期间置 `actionInProgress` 锁暂停 `poll` 轮询抢跑，并分阶段二次复核（如 `900ms` + `700ms`）确认进程稳定存活后，再将状态卡片变为绿色“运行中”，杜绝“先变绿再失败”的闪烁；同时清洗 RPC 异常文本，去掉 `handleCallReply@` 等调用堆栈。
   - 弹窗内局部操作反馈用弹窗顶部可关闭的嵌入式 `.alert-message` Banner（`setBanner`），不打断弹窗上下文。
2. **无闪烁静默轮询**：
   - Overview 页与 Log 页统一使用 `poll.add(..., 5)`（5 秒周期）。
   - Overview 轮询仅刷新 `#cert_status_panel` 与只读结果表；**严禁在轮询中重建正在编辑的表单或弹窗 DOM**；若发现有进行中任务消失并转为完成态，仅在后台自动 `uci.load()` 并重绘状态视图。
   - Log 页自动滚动遵循“仅在用户当前已在底部（距底 `< 24px`）时跟随滚动”，防止用户向上翻看历史日志时被拉回底部。
3. **输入防抖**：
   - 频繁键盘输入的动态联动（如多字段凭证拼装回写隐藏表单域）使用 `220ms` 防抖定时器（`_scheduleCredSync`），并在表单提交/保存前同步调用 `_flushCredSync()` 保证数据不丢失。
4. **原生国际化**：
   - 全部可见文本（含按钮、占位符、JS 校验报错、状态标签）均包裹 `_('...')`，变量插值使用 LuCI 标准 `.format(...)`，确保可被 `po2lmo` 完整提取翻译。

---

## 七、新插件直接复用清单（Prompt 使用模板）

今后开发新的 OpenWrt LuCI 插件时，只需在对话中附上本文档并补充一句：
> **“请严格按照上述设计规范实现前端：保持相同的 Segmented Tabs、多区块独立灰底大框、独立 `176px × 36px` 胶囊表头、克制 `2.5%` 冰蓝表头与卡片语义浅底、暖琥珀提示条、表单控件现代化、单页整合日志、以及 Light/Dark 双模式 CSS Token 与 860/768/520 三级断点。”**

---

## 八、OpenWrt 25 实机打磨与避坑清单（`luci-app-secbox` 实战沉淀）

1. **视觉层次与防“色彩过载”**
   - **独立胶囊表头已带浅蓝时，表格 `.th` 勿再用重灰或 `6%` 蓝**：改用 `2.5%` 极浅冰蓝灰，避免“双蓝叠加”或灰上叠灰。
   - **内层 `ul.cbi-tabmenu` 不叠灰**：当外层大面板已经是浅灰底时，内层分段 Tab 改用纯白底（`var(--background-color-high)`）+ `10%` 主色浅蓝高亮选中胶囊。
   - **消除 `cbi-section-node` 与 `cbi-tabcontainer` 双重白框**：用 `.cbi-section-node:has(.cbi-tabcontainer)` 清除外层节点边框与背景，仅保留 `.cbi-tabcontainer` 一层白底卡片；底部 `.cbi-page-actions`（含 `.secbox-view ~ .cbi-page-actions`）单独做成白底圆角卡片，避免底部与灰底连成一片。
   - **配置页去除多余无意义 `<h3>`**：如 `NamedSection` 的 `'Settings'` 标题可省略，让分段 Tab 紧接页面描述下方。

2. **多区块拆分、表格对齐与防裁切**
   - **按逻辑拆成多个 `.secbox-panel` 灰底大框**：不要把所有卡片堆进同一个外框，拆成“状态与核心指标 / 网络与规则配置 / 系统信息 / 运行标志”等独立板块，间距 `16px`。
   - **跨卡片垂直列宽对齐**：同页多张表格应共享网格基准线（如 `50% / 50%`、`25% × 4`、`50% / 25% / 25%`；或半宽 `32% / 68%` 对应全宽 `16% / 84%`），且所有 `table.table td` 必须显式声明 `box-sizing: border-box;` 防止 `table-layout: fixed` 下 `padding` 撑出右侧边界被裁切。

3. **表单控件现代化（清除 Bootstrap 2010 残留）**
   - 为 `div[data-tab] > .cbi-value` 添加 `1px solid var(--border-color-low)` 分割线与轻量 `hover` 反馈。
   - 对 `.cbi-dropdown` 强制 `background-image: none !important;` 清除灰色渐变，与 `input` / `select` 统一为 `6px` 圆角、`34px` 最小高度与 `3px` 主色半透明焦点环（`:focus` / `:focus-within`）。
   - 复选框统一 `17px × 17px` + `accent-color: var(--primary-color-high)`；`DynamicList` 条目使用圆角浅底卡片。

4. **空状态、断网等待与友好文案**
   - **禁用裸 `-`、空白与生硬“错误”**：空值统一使用柔和灰字占位（`.td.secbox-muted` 优先级需高于 `.td`，统一 `var(--text-color-medium)`、`12.5px`、`font-weight: 400`），如 `尚未运行`、`等待首次运行`、`未检测到`、`未配置`、`尚未生成`。
   - **WAN 未拨号 / 服务未启用状态区分**：服务禁用时即使运行时残留 `error` 也应显示 `已禁用`；已启用但无上行时显示琥珀黄 `等待 WAN 拨号连接...` 且按钮切换为 `禁用服务`；点击启动若无 WAN 不弹红错，改用内联 `.secbox-note` 提示“将在 WAN 连接后自动启动”。
   - **空表保留表头**：空数据表格勿传第 3 参数给 `cbi_update_table()`（会替换整表渲染原生灰底占位），改为直接 `appendChild` 一行合并列的 `.secbox-muted` 提示；`E()` 文本中避免直接写 `&#160;` 实体。

5. **单页日志、时间戳与 OpenWrt 25 多语言（i18n）**
   - **合并冗余日志 Tab**：勿拆多个日志一级菜单，统一为单个 `Logs` 页，在右上工具栏提供类型下拉（全部 / 防火墙 `banIP/` / 处理 `banIP-`）+ 关键词过滤 + 计数徽章 + 距底 `< 24px` 自动滚动。
   - **Unix 秒级时间戳**：OpenWrt `ubus log.read` 返回的 `entry.time` 为秒级整数，渲染前需判断 `< 1e12` 时乘以 `1000`。
   - **OpenWrt 25 i18n 与部署防坑**：全站文案统一用英文原串包裹 `_('...')` 并在 `po/zh_Hans/<pkg>.po` 去重维护；热更新时同步编译并更新 `/usr/lib/lua/luci/i18n/<pkg>.zh-cn.lmo`；严禁将 macOS `._*` AppleDouble 隐藏文件传入路由器 `/www/luci-static/resources/view/`（会触发 LuCI 重建索引时 404 全站报错），`scp` 统一使用 `-O` 并通过 `.gitignore` 排除 `._*`、`.DS_Store`、`*.lmo` 等临时文件。
