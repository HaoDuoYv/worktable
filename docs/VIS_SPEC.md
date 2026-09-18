# Worktable 可视化代码规范（VIS_SPEC）

> 版本：v1.3 · 对齐 `src/core/av/` 命令回放引擎  
> AI 生成 / 人工编写可视化代码，**必须**满足本规范；转换后由 `validateVizCode` 静态校验。

---

## 1. 目标与范围

| 语言 | 运行环境 | 命令来源 |
|------|----------|----------|
| JavaScript | 浏览器 Worker | `algorithm-visualizer`（tracers.js） |
| Python | Pyodide | 工作台注入的同名 API（无 import） |
| C++ | 本地 `server-cpp` | `#include "av.h"`，`av::` 命名空间 |

可视化代码 = **业务逻辑 + tracer 调用 + delay 节拍**，运行后产出命令数组，由前端回放。

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
| `push` / `pop` / `enqueue` / `dequeue` / `unshift` / `shift` | 栈/队列/链表 |
| `select` / `deselect` / `selectRow`… | 高亮 |
| `print` / `println` | 日志 |
| `visit` / `leave` | 图/树遍历 |
| `rotateLeft` / `rotateRight` / `split` / `setPointer` | 红黑树 / B+ 树 |
| `delay` | **必须**：步进点；**N=源码 0-based 行号**（用于回放高亮源码） |

**没有 `delay` 则无法分步回放。**

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

**Array2DTracer**

- `set(array2d)`  
- `select(sx, sy, ex?, ey?)` / `deselect(...)`  
- `selectRow(x, sy, ey?)`  
- `patch(x, y, v?)` / `depatch(x, y)`  

**LogTracer**

- `set(log?)` / `print(msg)` / `println(msg)`  

**GraphTracer / TreeTracer**

- `set(adjacencyMatrix)`（Tree 用父→子边；无父节点为根）
- `directed(bool)`
- `visit(target, source?, weight?)` / `leave(...)`
- `select(target, source?)` / `deselect(...)`

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

### 3.4 示例（合法）

```js
const { Array1DTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer')

const arr = new Array1DTracer('数组')
const log = new LogTracer('日志')
const A = [3, 1, 2]

Layout.setRoot(new VerticalLayout([arr, log]))
arr.set(A)
Tracer.delay()

for (let i = 0; i < A.length; i++) {
  arr.select(i)
  log.println(`i=${i} A[i]=${A[i]}`)
  Tracer.delay()
  arr.deselect(i)
}
```

### 3.5 非法

| 写法 | 原因 |
|------|------|
| 无 `delay` | 无法分步 |
| 无任何 `new *Tracer` | 无可视化 |
| `require('fs')` 等 | Worker 沙箱不允许 |
| 仅业务代码无 tracer | 视为源码，不是 viz |

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

\* 若引擎允许无 root 回退，可降为 warning；**当前校验按 error**，保证可预期。

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

模型输出必须：

1. **仅一个** fenced code block  
2. 语言标签匹配（javascript / python / cpp）  
3. 满足 §3–§7 必选结构  
4. 不写说明性正文（或正文在 block 外且可忽略）

前端：`extractCodeBlock` → `validateVizCode` → 成功才 `saveAlgorithm`。

---

## 9. 版本与变更

| 版本 | 变更 |
|------|------|
| v1.0 | 首版：三语言必选结构 + 校验规则表 |
| v1.1 | 增加 Tree/Stack/Queue/LinkedList Tracer；C++ `Layout::setRoot`；校验 `cpp-setroot-syntax` |
| v1.2 | 增加 CircularQueue/Deque/RedBlackTree/BPlusTree/StaticLinkedList Tracer 与 JS 示例 |
| v1.3 | 红黑树 rotate、B+ split；回放 delay 对齐源码行并高亮 |

修改规范时请同步：`src/modules/algorithms/validateViz.ts` 与本文件。
