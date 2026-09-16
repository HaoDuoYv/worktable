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
]
