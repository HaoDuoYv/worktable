# Worktable 可视化代码规范（VIS_SPEC）

> 版本：v1.5 · 对齐 `src/core/av/` 命令回放引擎 + 官方 algorithm-visualizer 能力面  
> AI 生成 / 人工编写可视化代码，**必须**满足本规范；转换后由 `validateVizCode` 静态校验。
>
> **配套文档**：`docs/VIS_ANIMATION_SPEC.md`（动效语义）。本文件规定「命令协议与代码写法」，动效层规定「这些命令在画布上如何被动画呈现」。

---

## 1. 目标与范围

| 语言 | 运行环境 | 命令来源 |
|------|----------|----------|
| JavaScript | 浏览器 Worker | `algorithm-visualizer`（tracers.js） |
| Python | Pyodide | 工作台注入的同名 API（无 import） |
| C++ | 本地 `server-cpp` | `#include "av.h"`，`av::` 命名空间 |

可视化代码 = **业务逻辑 + tracer 调用 + delay 节拍**，运行后产出命令数组，由前端回放。

### 1.1 生成侧契约（AI 必须同时满足）

代码不仅要「能跑」，还要「跑出来好看、信息完整」。生成时必须同时满足 4 条渲染契约：

| # | 契约 | 为什么 | 详见 |
|---|------|--------|------|
| C1 | 数值数组用 `Array1DTracer.set(纯数字数组)` | 界面自动渲染为**柱状图**，柱高 ∝ 元素大小；含 `null`/字符串会退化为等大单元格，排序类动画直接失效 | §3.3 · §3.6 |
| C2 | 数据操作的关键分支建议用 `println` 输出中文操作词 | 便于阅读日志；统计浮窗已下线，不参与计数 | §3.5 |
| C3 | 关键变量用 `println('name=value')` | 日志会被解析成画布上方「变量条」chips，便于观察 | §3.5 |
| C4 | 每个语义步进处 `delay()`，且 delay 落在对应源码行 | 回放分步 + 源码行高亮；缺 delay 无法回放 | §2 · §3.2 |

---

## 2. 命令协议（内部）

每条命令：

```json
{ "key": "string|null", "method": "string", "args": [] }
```

引擎关心的类别：

| method | 含义 |
|--------|------|
| `*Tracer` | 创建 Tracer（如 `Array1DTracer`） |
| `VerticalLayout` / `HorizontalLayout` | 布局容器 |
| `setRoot` | 设置根视图（key 可为 tracer 或 layout） |
| `set` / `patch` / `depatch` | 数据 |
| `init` | 初始化容量（环形队列） |
| `push` / `pop` / `enqueue` / `dequeue` / `unshift` / `shift` | 栈/队列/链表 |
| `pushFront` / `popFront` / `pushBack` / `popBack` | 双端队列 |
| `setData` / `setNext` | 静态链表 |
| `select` / `deselect` / `selectRow`… | 高亮 |
| `print` / `println` | 日志 |
| `visit` / `leave` | 图/树遍历 |
| `rotateLeft` / `rotateRight` / `split` / `setPointer` / `setColor` / `setLabel` | 红黑树 / B+ 树 |
| `delay` | **必须**：步进点；**N=源码 0-based 行号**（用于回放高亮源码） |

**没有 `delay` 则无法分步回放。**

### 2.1 TracerKind 与渲染器映射

引擎按 tracer 的 `kind` 分派渲染器（`src/core/av/renderers.tsx`）。**`kind` 与 Tracer 类名完全同名**（定义见 `src/core/av/types.ts` 的 `TracerKind`）。生成代码时按目标结构选对 Tracer 类即可，无需关心渲染实现：

| Tracer 类 = kind | 画布形态 | 动画语义（详见 VIS_ANIMATION_SPEC §3） |
|------------------|----------|------------------------------------------|
| `Array1DTracer` | **数值数组 → 柱状图**；否则等大单元格 | 写入弹入 / 比较扫描 / 交换 |
| `Array2DTracer` | 二维表格 | 单元格 patch |
| `LogTracer` | 日志流（不占画布主区） | 逐行追加；支持 `printf` |
| `GraphTracer` | SVG 节点 + 边（可 weighted / pan-zoom） | 遍历涟漪 / 访问变色 / 布局切换 |
| `TreeTracer` | SVG 节点 + 有向边（层级树布局） | 插入弹入 / 遍历涟漪 |
| `StackTracer` | 纵向单元格（top/bottom） | push 顶部弹入 / pop 收缩 |
| `QueueTracer` | 横向单元格（front/back） | enqueue 右弹入 / dequeue 左收缩 |
| `LinkedListTracer` | 节点 + `→` 箭头 | 断链重连 / 逐个涟漪 |
| `CircularQueueTracer` | 环形槽位（H/T 标签） | 槽位弹入 / 标签旋转 |
| `DequeTracer` | 双端可插入单元格 | 两端弹入 / 收缩 |
| `RedBlackTreeTracer` | 红/黑着色树 | 旋转位移 / 颜色过渡 |
| `BPlusTreeTracer` | 内部节点 + 叶层链表 | split 分裂 / 键上浮 |
| `StaticLinkedListTracer` | `data`/`next` 双行表 | 指针跳转 / 写入闪光 |
| `ChartTracer` | **柱状图**（与数值 Array1D 同语义） | 同 Array1D 柱状图；可由 `array1d.chart(chart)` 同步 |
| `ScatterTracer` | 二维散点（每行 `[x,y]`） | 点选中/写入变色 |
| `MarkdownTracer` | 说明文本面板 | 无结构动画 |
| `unknown`（未注册类名） | 通用兜底视图 | 无 |

> ⚠️ **引擎没有 `BTreeTracer`**——传入未注册类名会落到 `unknown` 兜底视图。B 树请用 `TreeTracer`（或 `GraphTracer`）呈现，节点 label 形如 `"10|20"`。详见 §3.3。

---

## 3. JavaScript 规范

### 3.1 引入

```js
const {
  Array1DTracer, Array2DTracer, LogTracer, GraphTracer, TreeTracer,
  StackTracer, QueueTracer, LinkedListTracer,
  CircularQueueTracer, DequeTracer,
  RedBlackTreeTracer, BPlusTreeTracer, StaticLinkedListTracer,
  Tracer, Layout, VerticalLayout, HorizontalLayout,
} = require('algorithm-visualizer')
```

禁止：`import` 其它包、访问网络、`eval` 用户输入。

### 3.2 必选结构

1. 至少 **1 个** `new XxxTracer(...)`  
2. `Layout.setRoot(tracer 或 Layout)`（**推荐必须**；引擎无 root 时回退取第一个 tracer）  
3. 至少 **1 处** `Tracer.delay()`  
4. 模块顶层立即执行（或 IIFE），Worker 中 `eval` 整段源码

### 3.3 API 摘要

**Array1DTracer**

- `set(array1d)`  
- `select(sx, ex?)` / `deselect(sx, ex?)`  
- `patch(x, v?)` / `depatch(x)`  

> **渲染契约（重要）**：`Array1DTracer` 会**自动检测**数组是否为「纯数值数组」——
> - **是**（每项都是有限 `number`）→ 渲染为**柱状图**，柱高 = `|值| / max(|值|) × 200px`，柱下为索引、柱顶为数值。**排序类算法必须走这条路径**，否则「元素大小」这一核心信息不可见。
> - **否**（含 `null`、`undefined`、字符串、对象）→ 回退为等大单元格网格。
>
> 因此排序 / 查找 / 前缀和 / 堆 等**数值型算法**：
> - ✅ `arr.set([5, 2, 8, 1])`、`arr.set([3, 1, 2])`
> - ❌ `arr.set([5, 2, null, 1])`、`arr.set(['a', 'b'])`、`arr.set([{v: 5}])`
>
> 若算法需要「空槽」语义（如线性探测哈希），请改用 `Array2DTracer` 或把空槽写作固定哨兵数值（如 `-1`），**不要用 `null`**，否则柱状图不生效。
>
> 柱状图下 `select(i)` / `patch(i, v)` 的语义与单元格一致：`select` 使柱体上浮并高亮（蓝 `--accent`），`patch` 使柱体变青（`--signal`）并按新值平滑改变高度（`height` 过渡即排序动画本体）。

**Array2DTracer**

- `set(array2d)`  
- `select(sx, sy, ex?, ey?)` / `deselect(...)`  
- `selectRow(x, sy, ey?)`  
- `patch(x, y, v?)` / `depatch(x, y)`  

**LogTracer**

- `set(log?)` / `print(msg)` / `println(msg)`
- **变量观察**：界面上方「变量条」会从日志中解析 `name = value`（如 `i=3`、`A[0]=5`）。
  生成/编写可视化代码时，关键变量请用 `println` 输出 `标识符=值` 形式，便于步骤回放时观察。

**GraphTracer / TreeTracer**

- `set(adjacencyMatrix)`（Tree 用父→子边；无父节点为根）
- `directed(bool)` / **`weighted(bool)`**（边权/点权显示，对齐官方 AV）
- **布局**：`layoutCircle()` / `layoutTree(root?, sorted?)` / `layoutRandom()`  
  - `layoutTree` 为叶节点水平打包的层级布局（移植自 AV GraphTracer），树/层次图优先调用
- 增量结构：`addNode(id, weight?, x?, y?)` / `updateNode` / `removeNode`；`addEdge(s,t,w?)` / `updateEdge` / `removeEdge`
- `visit(target, source?, weight?)` / `leave(...)`
- `select(target, source?)` / `deselect(...)`
- **`log(logTracer)`**：visit/select 自动向 LogTracer 写 `a -> b` / `a => b`（AV 同款）
- 画布支持滚轮缩放 + 拖拽平移

> **B 树的表达方式**：引擎**没有** `BTreeTracer`，B 树以 `TreeTracer`（或 `GraphTracer`）呈现即可。约定：
> - 一个「多键节点」= 一个树节点，`label` 用 `|` 分隔键，如 `"10|20|30"`；
> - 节点分裂时，新建节点 + 覆写新旧 label，中间键「上浮」在视觉上表现为 label 变化与边重连（详见 `VIS_ANIMATION_SPEC.md` §3.8）；
> - 父子边由 `set()` 的邻接矩阵给出，重连后需重新 `set()` 或 `visit` 相关节点以刷新。
>
> 若需真正的分裂/上浮动画，请改用 `BPlusTreeTracer`（它自带 `split()`）。

**LogTracer**

- `set(log?)` / `print(msg)` / `println(msg)` / **`printf(format, ...args)`**（`%s` `%d` `%f`）
- **变量观察**：界面上方「变量条」会从日志中解析 `name = value`（如 `i=3`、`A[0]=5`）。
  生成/编写可视化代码时，关键变量请用 `println` 输出 `标识符=值` 形式，便于步骤回放时观察。
- 日志操作词可选，仅便于阅读。

**ChartTracer / Array1DTracer.chart**

- `chart.set(纯数字数组)` 直接画柱状图
- 或 `array1d.set(nums); array1d.chart(chartTracer)` — Array1D 数据同步到 ChartTracer（AV 协议）
- 排序/统计类推荐：主视图 Array1D（单元格或柱）+ 可选 Chart 对照

**ScatterTracer**

- `set([[x,y], ...])` 每行两点；`select`/`patch` 对应单元格状态

**MarkdownTracer**

- `set(markdownString)` / `println(line)` — 算法说明、步骤摘要

**StackTracer（栈，LIFO）**

- `set(array1d)` / `push(v)` / `pop()`
- `select(i)` / `deselect(i)`

**QueueTracer（队列，FIFO）**

- `set(array1d)` / `enqueue(v)` / `dequeue()`
- `select(i)` / `deselect(i)`

**LinkedListTracer（链表）**

- `set(array1d)` / `push(v)` 尾插 / `unshift(v)` 头插
- `pop()` / `shift()`
- `select(i)` / `deselect(i)`

**CircularQueueTracer（环形队列）**

- `init(capacity)` / `enqueue(v)` / `dequeue()`
- 可选 `set(arr, head, tail)`

**DequeTracer（双端队列）**

- `pushFront(v)` / `popFront()` / `pushBack(v)` / `popBack()`

**RedBlackTreeTracer（红黑树）**

- `set([{ id, parent, left?, right?, color: 'red'|'black', label? }])`
- `setColor(id, 'red'|'black')` / `visit(id)` / `setLabel(id, text)`
- `setPointer(id, 'left'|'right'|'parent', childId|null)`
- `rotateLeft(x)` / `rotateRight(x)`（结构旋转，引擎维护边）

**BPlusTreeTracer（B+ 树）**

- `set([{ id, parent, left?, right?, label }])`（label 可为 `"10|20"`）
- `visit(id)` / `setLabel(id, text)`
- `split(oldId, newId, promote, leftLabel?, rightLabel?)`（分裂动画）

**静态链表（StaticLinkedListTracer）**

- `init(n)` / `setData(i, v)` / `setNext(i, v)`
- 或 `set(dataArray, nextArray)`
- `select(row, col?)` row=0 data，row=1 next

**Layout**

- `Layout.setRoot(view)`  
- `new VerticalLayout([tracerA, tracerB])`  
- `new HorizontalLayout([...])`  

> **布局建议**：`VerticalLayout` 顺序 = 画布自上而下。常用组合：
> - `[主结构Tracer, LogTracer]` —— 单画布 + 日志（最常见）；
> - `[Array1DTracer, Array1DTracer, LogTracer]` —— 双数组对比（如归并、双指针）；
> - 只放 1 个 Tracer 时日志区退化为画布下方的独立日志面板（引擎自动分流），不会丢失。

---

### 3.4 操作动画语义（生成时必须遵守的映射）

引擎不解析「你做了什么」，只按命令驱动动画。生成代码时，**用哪条命令决定了画布上出现哪种动画**——这是让回放「看得懂」的关键：

| 你的意图 | 应发出的命令序列 | 画布上的动画 |
|----------|------------------|--------------|
| 正在比较 / 考察某个元素 | `select(i)` → `delay()` → `deselect(i)` | 该单元/柱体**上浮 + 蓝色扫描高亮**（`viz-op-search`） |
| 写入 / 交换 / 更新某元素 | `patch(i, v)` → `delay()` | 该单元**青色闪光弹入**（`viz-op-insert` + `viz-flash-patch`）；柱状图下**高度平滑变化**（排序动画本体） |
| 插入新元素 | `push` / `enqueue` / `unshift` / `set` 后 `delay()` | 新单元**弹入**（`viz-op-insert`，scale 0.5→1.06→1） |
| 删除元素 | `pop` / `dequeue` / `shift` 后 `delay()` | 被删单元**收缩淡出**（`viz-op-delete`，scale→0.3） |
| 遍历 / 访问节点 | `visit(id)` → `delay()` → `leave(id)` | 节点**涟漪**（`viz-op-traverse`，scale 1→1.18→1），边标记已访问 |
| 结构旋转（红黑树） | `rotateLeft(x)` / `rotateRight(x)` → `delay()` | 节点位置 `transform` 平滑过渡 + 边重连淡入 |
| B+ 分裂 | `split(oldId, newId, promote, …)` → `delay()` | 新叶弹入 + 键上浮到父节点 |

**两条硬约束**：

1. **`delay()` 必须紧跟在语义动作之后**（而不是循环末尾一次性补）。一次 `delay` = 一帧回放，多步动作必须拆成多帧，否则只会看到起点和终点。
2. **比较 ≠ 写入**。比较用 `select`，写入用 `patch`。若比较时也用 `patch`，画布会把「看一眼」渲染成「改了值」，语义错误。

> 完整的 9 类数据结构逐操作动画规格（含 head/tail 标签移动、指针重连、键上浮等细节）见 **`docs/VIS_ANIMATION_SPEC.md` §3**。

---

### 3.5 日志与统计计数约定（重要）

统计浮动窗口已下线。生成代码时不必为计数而写操作词日志；若写日志，建议用中文操作词便于阅读。

### 3.5.3 变量条

日志中形如 `name=value` 或 `name = value` 的片段会被抽成画布上方**变量 chips**（如 `i=3`、`A[0]=5`、`max=9`）。

- 用 `标识符=值`，**不要**加在句子中间（`当前是 i=3 了` 会被整段吞掉，虽仍可解析但不稳）；
- 一次步进输出的变量不宜超过 6 个，否则变量条会折行挤压画布；
- 变量名建议与源码变量名一致，便于对照源码高亮行。

---

### 3.6 示例（合法）

```js
const { Array1DTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer')

const arr = new Array1DTracer('数组')
const log = new LogTracer('日志')
const A = [3, 1, 2]                       // 纯数值数组 → 渲染为柱状图

Layout.setRoot(new VerticalLayout([arr, log]))
arr.set(A)
log.println(`max=${Math.max(...A)}`)      // 变量条
Tracer.delay()

for (let i = 0; i < A.length; i++) {
  arr.select(i)
  log.println(`查找 i=${i} A[i]=${A[i]}`)  // 查找 +1，变量条 i / A[i]
  Tracer.delay()
  arr.deselect(i)
}
```

### 3.7 非法

| 写法 | 原因 |
|------|------|
| 无 `delay` | 无法分步 |
| 无任何 `new *Tracer` | 无可视化 |
| `require('fs')` 等 | Worker 沙箱不允许 |
| 仅业务代码无 tracer | 视为源码，不是 viz |
| `arr.set([3, 1, null])` | 数值数组被 `null` 污染，柱状图失效 + 元素计数偏低 |
| 全篇仅 1 处 `delay` | 只能回放首尾两帧，等于无动画 |

---

## 4. Python 规范（Pyodide 注入）

### 4.1 引入

**不要** `import algorithm_visualizer`。  
工作台在执行前已注入：

`Array1DTracer, Array2DTracer, LogTracer, GraphTracer, TreeTracer, StackTracer, QueueTracer, LinkedListTracer, CircularQueueTracer, DequeTracer, RedBlackTreeTracer, BPlusTreeTracer, StaticLinkedListTracer, Tracer, Layout, VerticalLayout, HorizontalLayout, visualize`

### 4.2 必选

1. 至少 1 个 `XxxTracer(...)`  
2. `Layout.set_root(...)` 或 `Layout.setRoot(...)`（二者等价）  
3. 至少 1 处 `Tracer.delay()`（可带行号：`Tracer.delay(12)`；空括号会被注入行号）

> §1.1 生成侧契约 C1–C4 对 Python 同样适用。注意 Python 的 `None` 与 `numpy` 数值须转成原生 `int`/`float` 再 `set()`，否则柱状图检测失败：
> ```python
> array1d.set([int(x) for x in A])   # ✅ 纯数值 → 柱状图
> array1d.set(A_with_none)           # ❌ 含 None → 退化为单元格
> ```
> 操作词日志同样用中文或英文关键词（如 `log.println(f"比较 A[{j}] 与 A[{j+1}]")`）。

### 4.3 示例

```python
array1d = Array1DTracer("数组")
log = LogTracer("日志")
A = [3, 1, 2]

Layout.set_root(VerticalLayout([array1d, log]))
array1d.set(A)
Tracer.delay()

for i in range(len(A)):
    array1d.select(i)
    log.println(f"i={i}")
    Tracer.delay()
    array1d.deselect(i)
```

### 4.4 方法名

Python 侧提供 **snake_case 别名** 与部分 JS 风格名，推荐：

| 推荐 | 等价 |
|------|------|
| `set` | `set` |
| `select` / `deselect` | 同左 |
| `select_row` / `deselect_row` | `selectRow` / `deselectRow` |
| `Layout.set_root` | `Layout.setRoot` |

---

## 5. C++ 规范（server-cpp / av.h）

### 5.1 头文件

```cpp
#include "av.h"
#include <vector>
using namespace av;
```

`av.h` 提供：`LogTracer`、`Array1DTracer`、`GraphTracer`、`TreeTracer`、`StackTracer`、`QueueTracer`、`LinkedListTracer`、`VerticalLayout`、`Layout`、`Tracer`。

### 5.2 必选

1. 至少 1 个 `Array1DTracer` / `LogTracer` / …  
2. `Layout::setRoot(...)`（C++ 用 `::`，不可写 `Layout.setRoot`）  
3. 至少 1 次 `Tracer::delay(...)`（参数为 0-based 行号，可选）

> §1.1 生成侧契约 C1–C4 对 C++ 同样适用：用 `std::vector<int>` / `std::vector<double>` 传给 `array1d.set()` 才能触发柱状图（不要传 `std::vector<std::string>` 或含 `-1` 哨兵的混合语义数组）；每个语义动作后补 `Tracer::delay(行号)`；关键分支 `log.println("比较 ...")` 输出中文操作词。

### 5.3 示例

```cpp
#include "av.h"
#include <vector>
using namespace av;

int main() {
  Array1DTracer array1d("数组");
  LogTracer log("日志");
  std::vector<int> A = {3, 1, 2};

  VerticalLayout layout({&array1d, &log});
  Layout::setRoot(layout);
  array1d.set(A);
  Tracer::delay(12);

  for (int i = 0; i < (int)A.size(); ++i) {
    array1d.select(i);
    Tracer::delay(16);
    array1d.deselect(i);
  }
  return 0;
}
```

---

## 6. 源码 vs 可视化代码

| 字段 | 含义 | 运行 |
|------|------|------|
| `sourceCode` | 用户业务逻辑，可无 tracer | **不**直接运行 |
| `vizCode` | 含 tracers 的完整可执行文件 | **始终**用于运行 |
| `files[0].content` | 与 `vizCode` 同步 | 导出/兼容 |

「AI 可视化」只写 `vizCode`；校验失败时 **不覆盖** 既有 `vizCode`。

---

## 7. 静态校验规则（validateVizCode）

转换结果必须全部通过，否则拒绝应用。

### 7.1 通用

| 规则 ID | 检查 | 失败级别 |
|---------|------|----------|
| `non-empty` | 代码非空 | error |
| `has-tracer-ctor` | 存在 Tracer 构造 | error |
| `has-delay` | 存在 delay 调用 | error |
| `has-set-root` | 存在 setRoot/set_root | error* |
| `no-empty-code` | 非仅空白/注释 | error |
| `delay-density` | delay 数量 ≥ 3（避免「仅首尾两帧」） | warning |
| `no-null-in-array-set` | `Array1DTracer.set()` 参数中不含 `null` / `None` / `nullptr` | warning |
| `has-op-log` | 日志中存在操作关键词（插入/删除/查找/比较/交换/遍历 或对应英文） | warning |

\* 若引擎允许无 root 回退，可降为 warning；**当前校验按 error**，保证可预期。

> 后三条为 **v1.4 新增的体验级校验**（warning）：不阻断应用，但在 UI 提示「柱状图可能不生效 / 统计计数可能为 0」，引导用户让 AI 重新生成。落地位置：`src/modules/algorithms/validateViz.ts`。

### 7.2 语言专有

**JavaScript**

| 规则 | 说明 |
|------|------|
| `js-require-av` | 含 `require('algorithm-visualizer')` 或 `require("algorithm-visualizer")` |
| `js-forbid-require` | 不得 require 其它模块名 |
| `js-syntax` | `new Function(code)` 可编译（不执行） |
| `has-set-root` | `Layout.setRoot` / `set_root` / `Layout::setRoot` |

**Python**

| 规则 | 说明 |
|------|------|
| `py-no-av-import` | 不得 `import algorithm_visualizer` |
| `py-forbid-import` | 不得 import 其它危险模块（os/sys/subprocess…） |
| `py-has-tracer-name` | 使用已注入的 Tracer 类名 |

**C++**

| 规则 | 说明 |
|------|------|
| `cpp-include-av` | 含 `#include "av.h"` |
| `cpp-using-or-ns` | `using namespace av` 或 `av::` |
| `cpp-delay` | `Tracer::delay` |
| `cpp-setroot-syntax` | 不得 `Layout.setRoot`，应为 `Layout::setRoot` |

### 7.3 产出

```ts
interface VizValidateResult {
  ok: boolean
  errors: string[]   // 阻断应用
  warnings: string[] // 可应用但提示
}
```

失败时 UI：`保留原可视化代码；校验失败：…`

---

## 8. AI 生成提示词要求（摘要）

**产品侧约束（与提示词/UI 一并遵守）**

| 项 | 行为 |
|----|------|
| AI 问答 | **仅用户主动输入后发送**，打开面板不自动提问 |
| 生成可视化 | **互斥**：进行中不可再次点击；已有 `vizCode` 时需确认覆盖；生成中 busy |
| 新建算法 | **空文件**，不注入示例骨架 |
| 编辑保存 | 改动后**防抖自动保存** |

模型输出必须：

1. **仅一个** fenced code block  
2. 语言标签匹配（javascript / python / cpp）  
3. 满足 §3–§7 必选结构  
4. 不写说明性正文（或正文在 block 外且可忽略）

**另需满足 §1.1 生成侧契约 C1–C4**（否则代码「能跑但不好看」）：

5. **C1 柱状图**：排序 / 查找 / 数值型算法，`Array1DTracer.set()` 必须收到**纯有限数值数组**，不得含 `null` / 字符串 / 对象；
6. **C4 分步**：每个语义动作后立即 `delay()`，禁止只在结尾 delay 一次；
7. **C2 计数**：比较 / 交换 / 插入 / 删除 / 遍历的关键分支，用 `println` 输出含对应**中文操作词**的日志（见 §3.5.2 关键词表）；
8. **C3 变量条**：关键变量用 `println('name=value')` 输出，单步 ≤ 6 个；
9. **命令语义正确**：比较用 `select`、写入用 `patch`、插入用 `push/enqueue/unshift`、删除用 `pop/dequeue/shift`（见 §3.4）——命令选错会导致动画语义错误。

前端：`extractCodeBlock` → `validateVizCode` → 成功才 `saveAlgorithm`。

### 8.1 提示词模板（推荐直接复用）

```
你是数据结构可视化代码生成器。基于下面的源码，生成一份 <语言> 可视化代码。

硬性要求：
1. 只输出一个 ```<lang> 代码块，不要解释。
2. 至少 1 个 Tracer + Layout.setRoot + 多处 Tracer.delay()。
3. 数组元素必须用柱状图呈现：Array1DTracer.set() 传入纯数字数组（不得含 null/字符串）。
4. 每个语义动作后紧跟 Tracer.delay()，不要合并成一个 delay。
5. 比较/交换/插入/删除/遍历的关键分支，用 println 输出含「比较 / 交换 / 插入 / 删除 / 遍历」字样的中文日志。
6. 关键变量用 println("name=value") 输出，每步不超过 6 个。

源码：
<选中函数 / 类 / 完整文件>
```

---

## 9. 版本与变更

| 版本 | 变更 |
|------|------|
| v1.0 | 首版：三语言必选结构 + 校验规则表 |
| v1.1 | 增加 Tree/Stack/Queue/LinkedList Tracer；C++ `Layout::setRoot`；校验 `cpp-setroot-syntax` |
| v1.2 | 增加 CircularQueue/Deque/RedBlackTree/BPlusTree/StaticLinkedList Tracer 与 JS 示例 |
| v1.3 | 红黑树 rotate、B+ split；回放 delay 对齐源码行并高亮 |
| **v1.4** | ①`Array1DTracer` **数值数组自动渲染为柱状图**（柱高 ∝ 值大小），非数值回退单元格——新增 §3.3 渲染契约；②新增 §2.1 `TracerKind` ↔ 渲染器映射表，明确 **引擎无 `BTreeTracer`**，B 树改用 `TreeTracer` + `"10\|20"` label；③新增 §3.4 操作动画语义映射（命令 → `viz-op-*` 动画）与两条硬约束（delay 紧跟语义动作、比较≠写入）；④新增 §3.5 日志与统计计数约定（统计窗口字段来源 + 操作计数关键词表 + 变量条规则）；⑤新增 §1.1 生成侧契约 C1–C4 与 §8.1 提示词模板 |

修改规范时请同步：
- `src/modules/algorithms/validateViz.ts`（校验规则）
- `src/core/av/renderers.tsx`（渲染契约，柱状图检测逻辑）
- `docs/VIS_ANIMATION_SPEC.md`（动效视觉规范）
