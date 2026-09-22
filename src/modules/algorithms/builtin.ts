export interface BuiltinAlgorithm {
  id: string
  title: string
  description: string
  language: 'javascript'
  category: string
  tags: string[]
  code: string
}

export const BUILTIN_ALGORITHMS: BuiltinAlgorithm[] = [
  {
    id: 'bubble-sort',
    title: '冒泡排序',
    description: '相邻比较交换，柱状图观察排序。',
    language: 'javascript',
    category: '排序',
    tags: ['array', 'sort'],
    code: `const { Array1DTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const arr = new Array1DTracer('数组');
const log = new LogTracer('日志');
const A = [5, 2, 9, 1, 6];
(function main() {
  Layout.setRoot(new VerticalLayout([arr, log]));
  arr.set(A);
  log.println(\`n=\${A.length}\`);
  Tracer.delay();
  for (let i = 0; i < A.length - 1; i++) {
    for (let j = 0; j < A.length - 1 - i; j++) {
      arr.select(j, j + 1);
      log.println(\`比较 A[\${j}]=\${A[j]} 与 A[\${j + 1}]=\${A[j + 1]}\`);
      Tracer.delay();
      if (A[j] > A[j + 1]) {
        const t = A[j]; A[j] = A[j + 1]; A[j + 1] = t;
        arr.patch(j, A[j]); arr.patch(j + 1, A[j + 1]);
        log.println(\`交换 A[\${j}] 与 A[\${j + 1}]\`);
        Tracer.delay();
        arr.depatch(j); arr.depatch(j + 1);
      }
      arr.deselect(j, j + 1);
    }
  }
  log.println('完成 ' + A.join(','));
  Tracer.delay();
})();
`,
  },
  {
    id: 'binary-search',
    title: '二分查找',
    description: '有序数组折半定位。',
    language: 'javascript',
    category: '搜索',
    tags: ['array', 'search'],
    code: `const { Array1DTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const arr = new Array1DTracer('有序数组');
const log = new LogTracer('日志');
const A = [1, 3, 4, 7, 9, 11, 15, 20];
const target = 11;
(function main() {
  Layout.setRoot(new VerticalLayout([arr, log]));
  arr.set(A);
  log.println(\`target=\${target}\`);
  Tracer.delay();
  let lo = 0, hi = A.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    arr.select(lo, hi);
    log.println(\`比较 lo=\${lo} hi=\${hi} mid=\${mid} A[mid]=\${A[mid]}\`);
    Tracer.delay();
    if (A[mid] === target) {
      log.println(\`查找 命中 index=\${mid}\`);
      arr.select(mid);
      Tracer.delay();
      return;
    }
    if (A[mid] < target) lo = mid + 1; else hi = mid - 1;
    arr.deselect(lo, hi);
  }
  log.println('查找 未命中');
  Tracer.delay();
})();
`,
  },
  {
    id: 'quick-sort',
    title: '快速排序',
    description: '分区递归，patch 归位。',
    language: 'javascript',
    category: '排序',
    tags: ['array', 'sort'],
    code: `const { Array1DTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const arr = new Array1DTracer('数组');
const log = new LogTracer('日志');
const A = [8, 3, 5, 1, 9, 2, 7];
function partition(lo, hi) {
  const pivot = A[hi];
  log.println(\`比较 pivot=\${pivot}\`);
  let i = lo - 1;
  for (let j = lo; j < hi; j++) {
    arr.select(j, hi);
    log.println(\`比较 A[\${j}]=\${A[j]} 与 pivot=\${pivot}\`);
    Tracer.delay();
    arr.deselect(j, hi);
    if (A[j] <= pivot) {
      i += 1;
      const t = A[i]; A[i] = A[j]; A[j] = t;
      arr.patch(i, A[i]); arr.patch(j, A[j]);
      log.println(\`交换 A[\${i}] 与 A[\${j}]\`);
      Tracer.delay();
      arr.depatch(i); arr.depatch(j);
    }
  }
  const t = A[i + 1]; A[i + 1] = A[hi]; A[hi] = t;
  arr.patch(i + 1, A[i + 1]); arr.patch(hi, A[hi]);
  log.println(\`交换 pivot 归位=\${i + 1}\`);
  Tracer.delay();
  arr.depatch(i + 1); arr.depatch(hi);
  return i + 1;
}
function sort(lo, hi) {
  if (lo >= hi) return;
  const p = partition(lo, hi);
  sort(lo, p - 1); sort(p + 1, hi);
}
(function main() {
  Layout.setRoot(new VerticalLayout([arr, log]));
  arr.set(A);
  log.println(\`n=\${A.length}\`);
  Tracer.delay();
  sort(0, A.length - 1);
  log.println('完成 ' + A.join(','));
  Tracer.delay();
})();
`,
  },
  {
    id: 'bfs-graph',
    title: '图的 BFS',
    description: '邻接矩阵 BFS，visit 体现顺序。',
    language: 'javascript',
    category: '图论',
    tags: ['graph', 'bfs'],
    code: `const { GraphTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const graph = new GraphTracer('图');
const log = new LogTracer('日志');
const G = [[0,1,1,0,0],[1,0,0,1,1],[1,0,0,0,1],[0,1,0,0,0],[0,1,1,0,0]];
(function main() {
  Layout.setRoot(new VerticalLayout([graph, log]));
  graph.set(G);
  graph.directed(false);
  graph.layoutCircle();
  graph.log(log);
  Tracer.delay();
  const n = G.length;
  const visited = Array(n).fill(false);
  const q = [0];
  visited[0] = true;
  graph.visit(0);
  log.println('遍历 从 0 开始 BFS');
  Tracer.delay();
  while (q.length) {
    const u = q.shift();
    log.println(\`visit u=\${u}\`);
    Tracer.delay();
    for (let v = 0; v < n; v++) {
      if (G[u][v] && !visited[v]) {
        visited[v] = true;
        graph.visit(v, u);
        q.push(v);
        log.println(\`查找 边 \${u}->\${v}\`);
        Tracer.delay();
      }
    }
    graph.leave(u);
  }
  log.println('完成 BFS');
  Tracer.delay();
})();
`,
  },
  {
    id: 'bst-insert',
    title: 'BST 插入',
    description: 'TreeTracer 层级插入。',
    language: 'javascript',
    category: '树',
    tags: ['tree', 'bst'],
    code: `const { TreeTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const tree = new TreeTracer('BST');
const log = new LogTracer('日志');
const keys = [5, 3, 8, 1, 4];
const nodes = [];
function insert(key) {
  if (!nodes.length) { nodes.push({ id: key, label: String(key) }); log.println(\`插入 root=\${key}\`); return; }
  let cur = nodes[0].id;
  for (;;) {
    log.println(\`比较 key=\${key} cur=\${cur}\`);
    tree.visit(cur);
    Tracer.delay();
    const node = nodes.find((n) => n.id === cur);
    const goLeft = key < cur;
    const child = goLeft ? node.left : node.right;
    if (child == null) {
      nodes.push({ id: key, label: String(key), parent: cur });
      if (goLeft) node.left = key; else node.right = key;
      log.println(\`插入 key=\${key}\`);
      tree.leave(cur);
      return;
    }
    tree.leave(cur);
    cur = child;
  }
}
(function main() {
  Layout.setRoot(new VerticalLayout([tree, log]));
  for (const k of keys) insert(k);
  tree.set(nodes.map((n) => ({ id: n.id, parent: n.parent ?? null, left: n.left ?? null, right: n.right ?? null, label: n.label })));
  tree.layoutTree(nodes[0].id);
  log.println('完成 插入');
  Tracer.delay();
})();
`,
  },
  {
    id: 'stack-ops',
    title: '栈：入栈与出栈',
    description: 'StackTracer push/pop。',
    language: 'javascript',
    category: '栈',
    tags: ['stack'],
    code: `const { StackTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const stack = new StackTracer('栈');
const log = new LogTracer('日志');
(function main() {
  Layout.setRoot(new VerticalLayout([stack, log]));
  stack.set([]);
  Tracer.delay();
  for (const v of [1, 2, 3]) {
    stack.push(v);
    log.println(\`插入 push=\${v}\`);
    Tracer.delay();
  }
  stack.pop();
  log.println('删除 pop');
  Tracer.delay();
  log.println('完成');
  Tracer.delay();
})();
`,
  },
  {
    id: 'queue-ops',
    title: '队列：入队与出队',
    description: 'QueueTracer enqueue/dequeue。',
    language: 'javascript',
    category: '队列',
    tags: ['queue'],
    code: `const { QueueTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const queue = new QueueTracer('队列');
const log = new LogTracer('日志');
(function main() {
  Layout.setRoot(new VerticalLayout([queue, log]));
  queue.set([]);
  Tracer.delay();
  for (const v of [10, 20, 30]) {
    queue.enqueue(v);
    log.println(\`插入 enqueue=\${v}\`);
    Tracer.delay();
  }
  queue.select(0);
  log.println('查找 front');
  Tracer.delay();
  queue.deselect(0);
  queue.dequeue();
  log.println('删除 dequeue');
  Tracer.delay();
  log.println('完成');
  Tracer.delay();
})();
`,
  },
  {
    id: 'linked-list-ops',
    title: '链表：头尾插入与遍历',
    description: 'LinkedListTracer 插入与遍历。',
    language: 'javascript',
    category: '链表',
    tags: ['linked-list'],
    code: `const { LinkedListTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const list = new LinkedListTracer('链表');
const log = new LogTracer('日志');
(function main() {
  Layout.setRoot(new VerticalLayout([list, log]));
  list.set([]);
  Tracer.delay();
  list.push(3); log.println('插入 push=3'); Tracer.delay();
  list.unshift(1); log.println('插入 unshift=1'); Tracer.delay();
  list.push(5); log.println('插入 push=5'); Tracer.delay();
  for (let i = 0; i < 3; i++) {
    list.select(i);
    log.println(\`visit i=\${i}\`);
    Tracer.delay();
    list.deselect(i);
  }
  list.shift(); log.println('删除 shift'); Tracer.delay();
  log.println('完成'); Tracer.delay();
})();
`,
  },
  {
    id: 'circular-queue',
    title: '环形队列',
    description: 'CircularQueueTracer H/T 标签。',
    language: 'javascript',
    category: '队列',
    tags: ['queue', 'circular'],
    code: `const { CircularQueueTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const cq = new CircularQueueTracer('环形队列');
const log = new LogTracer('日志');
(function main() {
  Layout.setRoot(new VerticalLayout([cq, log]));
  cq.init(4);
  log.println('visit capacity=4');
  Tracer.delay();
  for (const v of [1, 2, 3]) {
    cq.enqueue(v);
    log.println(\`插入 enqueue=\${v}\`);
    Tracer.delay();
  }
  cq.dequeue();
  log.println('删除 dequeue');
  Tracer.delay();
  cq.enqueue(4);
  log.println(\`插入 enqueue=4\`);
  Tracer.delay();
  log.println('完成');
  Tracer.delay();
})();
`,
  },
  {
    id: 'deque-ops',
    title: '双端队列',
    description: 'DequeTracer 两端操作。',
    language: 'javascript',
    category: '队列',
    tags: ['deque'],
    code: `const { DequeTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const dq = new DequeTracer('双端队列');
const log = new LogTracer('日志');
(function main() {
  Layout.setRoot(new VerticalLayout([dq, log]));
  dq.set([]);
  Tracer.delay();
  dq.pushBack(2); log.println('插入 pushBack=2'); Tracer.delay();
  dq.pushFront(1); log.println('插入 pushFront=1'); Tracer.delay();
  dq.popFront(); log.println('删除 popFront'); Tracer.delay();
  dq.popBack(); log.println('删除 popBack'); Tracer.delay();
  log.println('完成'); Tracer.delay();
})();
`,
  },
  {
    id: 'rb-tree-demo',
    title: '红黑树插入',
    description: 'RedBlackTree 变色与旋转。',
    language: 'javascript',
    category: '树',
    tags: ['tree', 'rbtree'],
    code: `const { RedBlackTreeTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const t = new RedBlackTreeTracer('红黑树');
const log = new LogTracer('日志');
(function main() {
  Layout.setRoot(new VerticalLayout([t, log]));
  t.set([
    { id: 10, parent: null, left: 5, right: 15, color: 'black', label: '10' },
    { id: 5, parent: 10, left: null, right: null, color: 'red', label: '5' },
    { id: 15, parent: 10, left: null, right: null, color: 'red', label: '15' },
  ]);
  log.println('visit 构造完成');
  Tracer.delay();
  t.setColor(15, 'black');
  log.println('插入 变色 15');
  Tracer.delay();
  t.rotateLeft(10);
  log.println('交换 rotateLeft 10');
  Tracer.delay();
  log.println('完成');
  Tracer.delay();
})();
`,
  },
  {
    id: 'bplus-tree-demo',
    title: 'B+ 树分裂演示',
    description: 'BPlusTree split。',
    language: 'javascript',
    category: '树',
    tags: ['tree', 'bplus'],
    code: `const { BPlusTreeTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const t = new BPlusTreeTracer('B+树');
const log = new LogTracer('日志');
(function main() {
  Layout.setRoot(new VerticalLayout([t, log]));
  t.set([
    { id: 1, parent: null, label: '10|20' },
    { id: 2, parent: 1, label: '5|8' },
    { id: 3, parent: 1, label: '12|15' },
  ]);
  log.println('visit 构造完成');
  Tracer.delay();
  t.split(2, 5, 8, '5|7', '8');
  log.println('插入 split');
  Tracer.delay();
  log.println('完成');
  Tracer.delay();
})();
`,
  },
  {
    id: 'static-list-demo',
    title: '静态链表',
    description: 'StaticLinkedList data/next。',
    language: 'javascript',
    category: '链表',
    tags: ['linked-list', 'static'],
    code: `const { StaticLinkedListTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
const sl = new StaticLinkedListTracer('静态链表');
const log = new LogTracer('日志');
(function main() {
  Layout.setRoot(new VerticalLayout([sl, log]));
  sl.set(['A', 'B', 'C'], [1, 2, -1]);
  log.println('visit init');
  Tracer.delay();
  sl.select(0, 0);
  log.println('查找 head=0');
  Tracer.delay();
  sl.setData(1, 'X');
  log.println('插入 data[1]=X');
  Tracer.delay();
  log.println('完成');
  Tracer.delay();
})();
`,
  },
]
