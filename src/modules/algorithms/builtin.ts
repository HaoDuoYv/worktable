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
    description: '相邻比较交换，适合理解排序过程。',
    language: 'javascript',
    category: '排序',
    tags: ['array', 'sort'],
    code: `// import visualization libraries {
const { Array1DTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');
// }

const array1dTracer = new Array1DTracer('数组');
const logTracer = new LogTracer('日志');

const A = [5, 2, 9, 1, 5, 6];

(function main() {
  Layout.setRoot(new VerticalLayout([array1dTracer, logTracer]));
  array1dTracer.set(A);
  Tracer.delay();

  for (let i = 0; i < A.length - 1; i++) {
    for (let j = 0; j < A.length - 1 - i; j++) {
      array1dTracer.select(j, j + 1);
      logTracer.println(\`比较 A[\${j}]=\${A[j]} 与 A[\${j + 1}]=\${A[j + 1]}\`);
      Tracer.delay();
      if (A[j] > A[j + 1]) {
        array1dTracer.patch(j, A[j + 1]);
        array1dTracer.patch(j + 1, A[j]);
        const t = A[j];
        A[j] = A[j + 1];
        A[j + 1] = t;
        logTracer.println('交换');
        Tracer.delay();
        array1dTracer.depatch(j);
        array1dTracer.depatch(j + 1);
      }
      array1dTracer.deselect(j, j + 1);
    }
  }
  logTracer.println('完成: ' + A.join(', '));
  Tracer.delay();
})();
`,
  },
  {
    id: 'binary-search',
    title: '二分查找',
    description: '在有序数组中折半定位目标值。',
    language: 'javascript',
    category: '搜索',
    tags: ['array', 'search'],
    code: `const { Array1DTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');

const array1dTracer = new Array1DTracer('有序数组');
const logTracer = new LogTracer('日志');
const A = [1, 3, 4, 7, 9, 11, 15, 20];
const target = 9;

(function main() {
  Layout.setRoot(new VerticalLayout([array1dTracer, logTracer]));
  array1dTracer.set(A);
  Tracer.delay();

  let lo = 0;
  let hi = A.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    array1dTracer.select(lo, hi);
    logTracer.println(\`范围 [\${lo}, \${hi}], mid=\${mid}, A[mid]=\${A[mid]}\`);
    Tracer.delay();
    array1dTracer.patch(mid);
    Tracer.delay();
    array1dTracer.depatch(mid);
    if (A[mid] === target) {
      logTracer.println(\`找到 \${target} @ \${mid}\`);
      Tracer.delay();
      return;
    }
    if (A[mid] < target) lo = mid + 1;
    else hi = mid - 1;
    array1dTracer.deselect(lo === 0 ? 0 : lo - 1, hi);
  }
  logTracer.println('未找到');
  Tracer.delay();
})();
`,
  },
  {
    id: 'quick-sort',
    title: '快速排序（可视化划分）',
    description: '以末尾为 pivot 做 Lomuto 划分。',
    language: 'javascript',
    category: '排序',
    tags: ['array', 'sort', 'divide-conquer'],
    code: `const { Array1DTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');

const array1dTracer = new Array1DTracer('数组');
const logTracer = new LogTracer('日志');
const A = [8, 3, 1, 7, 0, 10, 2];

function swap(i, j) {
  array1dTracer.patch(i, A[j]);
  array1dTracer.patch(j, A[i]);
  const t = A[i];
  A[i] = A[j];
  A[j] = t;
  Tracer.delay();
  array1dTracer.depatch(i);
  array1dTracer.depatch(j);
}

function partition(lo, hi) {
  const pivot = A[hi];
  array1dTracer.select(hi);
  logTracer.println(\`pivot=\${pivot} 区间 [\${lo},\${hi}]\`);
  Tracer.delay();
  let i = lo;
  for (let j = lo; j < hi; j++) {
    array1dTracer.select(j);
    Tracer.delay();
    if (A[j] < pivot) {
      if (i !== j) swap(i, j);
      i++;
    }
    array1dTracer.deselect(j);
  }
  swap(i, hi);
  array1dTracer.deselect(hi);
  return i;
}

function qs(lo, hi) {
  if (lo >= hi) return;
  const p = partition(lo, hi);
  qs(lo, p - 1);
  qs(p + 1, hi);
}

(function main() {
  Layout.setRoot(new VerticalLayout([array1dTracer, logTracer]));
  array1dTracer.set(A);
  Tracer.delay();
  qs(0, A.length - 1);
  logTracer.println('完成: ' + A.join(', '));
  Tracer.delay();
})();
`,
  },
  {
    id: 'bfs-graph',
    title: '图的 BFS',
    description: '邻接矩阵上的广度优先遍历。',
    language: 'javascript',
    category: '图论',
    tags: ['graph', 'bfs'],
    code: `const { GraphTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');

const graphTracer = new GraphTracer('图');
const logTracer = new LogTracer('日志');

// adjacency matrix
const G = [
  [0, 1, 1, 0, 0],
  [1, 0, 0, 1, 0],
  [1, 0, 0, 1, 1],
  [0, 1, 1, 0, 1],
  [0, 0, 1, 1, 0],
];

(function main() {
  Layout.setRoot(new VerticalLayout([graphTracer, logTracer]));
  graphTracer.set(G);
  Tracer.delay();

  const n = G.length;
  const visited = Array(n).fill(false);
  const q = [0];
  visited[0] = true;
  graphTracer.visit(0);
  logTracer.println('从 0 开始 BFS');
  Tracer.delay();

  while (q.length) {
    const u = q.shift();
    for (let v = 0; v < n; v++) {
      if (G[u][v] && !visited[v]) {
        visited[v] = true;
        q.push(v);
        graphTracer.visit(v, u);
        logTracer.println(\`\${u} -> \${v}\`);
        Tracer.delay();
      }
    }
  }
  logTracer.println('遍历完成');
  Tracer.delay();
})();
`,
  },
  {
    id: 'bst-insert',
    title: '二叉搜索树插入',
    description: 'TreeTracer 展示 BST 结构与访问路径。',
    language: 'javascript',
    category: '树',
    tags: ['tree', 'bst'],
    code: `const { TreeTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');

const tree = new TreeTracer('BST');
const log = new LogTracer('日志');

const N = 8;
const adj = Array.from({ length: N }, () => Array(N).fill(0));

function link(p, c) {
  adj[p][c] = 1;
}

// shape: root 4; left 2; right 6; 2->1,3; 6->5,7
link(4, 2);
link(4, 6);
link(2, 1);
link(2, 3);
link(6, 5);
link(6, 7);

(function main() {
  Layout.setRoot(new VerticalLayout([tree, log]));
  tree.directed(true);
  tree.set(adj);
  Tracer.delay();

  const order = [4, 2, 6, 1, 3, 5, 7];
  for (const id of order) {
    tree.visit(id);
    log.println('访问节点 ' + id);
    Tracer.delay();
  }
  log.println('BST 结构展示完成');
  Tracer.delay();
})();
`,
  },
  {
    id: 'stack-ops',
    title: '栈：入栈与出栈',
    description: 'StackTracer 展示 LIFO 入栈/出栈。',
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

  for (const v of [1, 2, 3, 4]) {
    stack.push(v);
    log.println('push ' + v);
    Tracer.delay();
  }
  for (let i = 0; i < 2; i++) {
    stack.pop();
    log.println('pop');
    Tracer.delay();
  }
  log.println('栈演示完成');
  Tracer.delay();
})();
`,
  },
  {
    id: 'queue-ops',
    title: '队列：入队与出队',
    description: 'QueueTracer 展示 FIFO 入队/出队。',
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
    log.println('enqueue ' + v);
    Tracer.delay();
  }
  queue.dequeue();
  log.println('dequeue');
  Tracer.delay();
  queue.enqueue(40);
  log.println('enqueue 40');
  Tracer.delay();
  log.println('队列演示完成');
  Tracer.delay();
})();
`,
  },
  {
    id: 'linked-list-ops',
    title: '链表：头尾插入与遍历',
    description: 'LinkedListTracer 展示节点链与遍历。',
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

  list.push(2);
  list.push(3);
  list.unshift(1);
  log.println('list: 1 -> 2 -> 3');
  Tracer.delay();

  for (let i = 0; i < 3; i++) {
    list.select(i);
    log.println('visit index ' + i);
    Tracer.delay();
    list.deselect(i);
  }
  list.shift();
  log.println('shift head');
  Tracer.delay();
  log.println('链表演示完成');
  Tracer.delay();
})();
`,
  },
  {
    id: 'circular-queue',
    title: '环形队列',
    description: 'CircularQueueTracer：定容环形缓冲与 head/tail。',
    language: 'javascript',
    category: '队列',
    tags: ['queue', 'circular'],
    code: `const { CircularQueueTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');

const cq = new CircularQueueTracer('环形队列');
const log = new LogTracer('日志');

(function main() {
  Layout.setRoot(new VerticalLayout([cq, log]));
  cq.init(5);
  Tracer.delay();
  for (const v of [1, 2, 3, 4]) {
    cq.enqueue(v);
    log.println('enqueue ' + v);
    Tracer.delay();
  }
  cq.dequeue();
  cq.dequeue();
  log.println('dequeue x2');
  Tracer.delay();
  cq.enqueue(5);
  cq.enqueue(6);
  log.println('enqueue 5,6（环绕）');
  Tracer.delay();
})();
`,
  },
  {
    id: 'deque-ops',
    title: '双端队列',
    description: 'DequeTracer：两端插入与删除。',
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
  dq.pushBack(2);
  dq.pushBack(3);
  dq.pushFront(1);
  log.println('1 <- 2 -> 3');
  Tracer.delay();
  dq.popFront();
  log.println('popFront');
  Tracer.delay();
  dq.popBack();
  log.println('popBack');
  Tracer.delay();
})();
`,
  },
  {
    id: 'rb-tree-demo',
    title: '红黑树旋转与着色',
    description: 'RedBlackTreeTracer：左右旋转 + 红黑着色动画。',
    language: 'javascript',
    category: '树',
    tags: ['tree', 'rbtree'],
    code: `const { RedBlackTreeTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');

const rb = new RedBlackTreeTracer('红黑树');
const log = new LogTracer('日志');

// 初始：右倾链 10-20-30，将演示左旋
const nodes = [
  { id: 0, parent: -1, left: null, right: 1, color: 'black', label: '10' },
  { id: 1, parent: 0, left: null, right: 2, color: 'red', label: '20' },
  { id: 2, parent: 1, left: null, right: null, color: 'red', label: '30' },
];

(function main() {
  Layout.setRoot(new VerticalLayout([rb, log]));
  rb.set(nodes);
  Tracer.delay();
  log.println('初始右倾 10→20→30');
  Tracer.delay();

  rb.select(2);
  log.println('插入后 violation：30 红，父 20 红');
  Tracer.delay();
  rb.deselect(2);

  // left-rotate at 10 (id 0)
  log.println('rotateLeft(10)');
  rb.rotateLeft(0);
  Tracer.delay();
  // 修复指针可视化：20 为根，10 左，30 右
  nodes[1].parent = -1;
  nodes[1].left = 0;
  nodes[1].right = 2;
  nodes[0].parent = 1;
  nodes[0].right = null;
  nodes[2].parent = 1;
  rb.set(nodes);
  Tracer.delay();

  rb.setColor(0, 'black');
  rb.setColor(1, 'black');
  rb.setColor(2, 'black');
  log.println('rebalance：根黑，子黑');
  Tracer.delay();

  // 演示右旋：改造成左倾再 rotateRight
  log.println('构造左倾后 rotateRight(30)');
  rb.set([
    { id: 0, parent: 2, left: null, right: null, color: 'black', label: '10' },
    { id: 1, parent: 2, left: 0, right: null, color: 'red', label: '20' },
    { id: 2, parent: -1, left: 1, right: null, color: 'black', label: '30' },
  ]);
  Tracer.delay();
  rb.rotateRight(2);
  Tracer.delay();
  rb.set([
    { id: 0, parent: 1, left: null, right: null, color: 'black', label: '10' },
    { id: 1, parent: -1, left: 0, right: 2, color: 'black', label: '20' },
    { id: 2, parent: 1, left: null, right: null, color: 'black', label: '30' },
  ]);
  Tracer.delay();
  log.println('旋转完成');
  Tracer.delay();
})();
`,
  },
  {
    id: 'bplus-tree-demo',
    title: 'B+ 树节点分裂',
    description: 'BPlusTreeTracer：叶节点满页 split 动画。',
    language: 'javascript',
    category: '树',
    tags: ['tree', 'bplus'],
    code: `const { BPlusTreeTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');

const bp = new BPlusTreeTracer('B+ 树');
const log = new LogTracer('日志');

(function main() {
  Layout.setRoot(new VerticalLayout([bp, log]));
  // 内部 0，叶 1 已满 [1|3|5]
  bp.set([
    { id: 0, parent: -1, left: 1, right: null, label: '5' },
    { id: 1, parent: 0, label: '1|3|5' },
  ]);
  Tracer.delay();
  log.println('叶节点 1 已满，准备 split');
  bp.visit(1);
  Tracer.delay();
  bp.leave(1);

  // split leaf: promote 3，左 1|? 右 5
  log.println('split：promote 3');
  bp.split(1, 2, 3, '1', '5');
  Tracer.delay();

  // 更新内部节点与父子边（教学用完整结构）
  bp.set([
    { id: 0, parent: -1, left: 1, right: 2, label: '3' },
    { id: 1, parent: 0, label: '1' },
    { id: 2, parent: 0, label: '5' },
  ]);
  Tracer.delay();
  log.println('分裂后：root=3，叶 1 / 5');
  Tracer.delay();

  // 右叶再满并分裂
  bp.setLabel(2, '5|7|9');
  log.println('右叶写满 5|7|9');
  Tracer.delay();
  bp.split(2, 3, 7, '5', '9');
  Tracer.delay();
  bp.set([
    { id: 0, parent: -1, left: 1, right: 4, label: '3' },
    { id: 1, parent: 0, label: '1' },
    { id: 4, parent: 0, label: '7', left: 2, right: 3 },
    { id: 2, parent: 4, label: '5' },
    { id: 3, parent: 4, label: '9' },
  ]);
  Tracer.delay();
  log.println('二次分裂完成（示意两层）');
  Tracer.delay();
})();
`,
  },
  {
    id: 'static-list-demo',
    title: '静态链表',
    description: 'StaticLinkedListTracer：data/next 双行对照。',
    language: 'javascript',
    category: '链表',
    tags: ['linked-list', 'static'],
    code: `const { StaticLinkedListTracer, LogTracer, Tracer, Layout, VerticalLayout } = require('algorithm-visualizer');

const sl = new StaticLinkedListTracer('静态链表');
const log = new LogTracer('日志');

(function main() {
  Layout.setRoot(new VerticalLayout([sl, log]));
  sl.init(6);
  Tracer.delay();
  // head=1 -> 3 -> 4 ; free: 0->2->5
  sl.setData(1, 'A');
  sl.setNext(1, 3);
  sl.setData(3, 'B');
  sl.setNext(3, 4);
  sl.setData(4, 'C');
  sl.setNext(4, -1);
  sl.setNext(0, 2);
  sl.setNext(2, 5);
  sl.setNext(5, -1);
  log.println('head=1 A→B→C');
  Tracer.delay();
  sl.select(0, 1);
  sl.select(0, 3);
  log.println('遍历 data 链');
  Tracer.delay();
})();
`,
  },
]
