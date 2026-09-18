import type {
  AvChunk,
  AvCommand,
  CellState,
  GraphEdgeState,
  GraphNodeState,
  TracerKind,
  TracerViewState,
} from './types'
import { buildChunks } from './types'

function makeCell(value: unknown): CellState {
  return { value, patched: false, selected: false }
}

class TracerModel {
  key: string
  kind: TracerKind
  title: string
  isArray1D = false
  array: CellState[][] = []
  log = ''
  nodes: GraphNodeState[] = []
  edges: GraphEdgeState[] = []
  isDirected = true
  capacity = 0
  head = 0
  tail = 0
  isStaticList = false

  constructor(key: string, kind: TracerKind, title: string) {
    this.key = key
    this.kind = kind
    this.title = title
  }

  snapshot(): TracerViewState {
    return {
      key: this.key,
      kind: this.kind,
      title: this.title,
      isArray1D: this.isArray1D,
      array: this.array.map((row) => row.map((c) => ({ ...c }))),
      log: this.log,
      nodes: this.nodes.map((n) => ({ ...n })),
      edges: this.edges.map((e) => ({ ...e })),
      isDirected: this.isDirected,
      capacity: this.capacity || undefined,
      head: this.kind === 'CircularQueueTracer' ? this.head : undefined,
      tail: this.kind === 'CircularQueueTracer' ? this.tail : undefined,
      isStaticList: this.isStaticList || undefined,
    }
  }
}

class LayoutModel {
  key: string
  method: string
  children: string[]

  constructor(key: string, method: string, children: string[]) {
    this.key = key
    this.method = method
    this.children = children
  }
}

function circleLayout(nodes: GraphNodeState[]) {
  const r = 120
  const n = Math.max(nodes.length, 1)
  nodes.forEach((node, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / n
    node.x = Math.cos(angle) * r
    node.y = Math.sin(angle) * r
  })
}

/** Top-down hierarchical layout for trees (BFS levels). */
function treeLayout(nodes: GraphNodeState[], edges: GraphEdgeState[]) {
  if (nodes.length === 0) return
  const children = new Map<number, number[]>()
  const hasParent = new Set<number>()
  for (const e of edges) {
    if (!children.has(e.source)) children.set(e.source, [])
    children.get(e.source)!.push(e.target)
    hasParent.add(e.target)
  }
  const roots = nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id)
  const rootIds = roots.length > 0 ? roots : [nodes[0]!.id]
  const level = new Map<number, number>()
  const order: number[] = []
  const queue = [...rootIds]
  for (const r of rootIds) level.set(r, 0)
  while (queue.length) {
    const id = queue.shift()!
    order.push(id)
    for (const c of children.get(id) ?? []) {
      if (!level.has(c)) {
        level.set(c, (level.get(id) ?? 0) + 1)
        queue.push(c)
      }
    }
  }
  for (const n of nodes) {
    if (!level.has(n.id)) level.set(n.id, 0)
  }
  const byLevel = new Map<number, number[]>()
  for (const n of nodes) {
    const lv = level.get(n.id) ?? 0
    if (!byLevel.has(lv)) byLevel.set(lv, [])
    byLevel.get(lv)!.push(n.id)
  }
  const maxLevel = Math.max(...byLevel.keys())
  const width = 220
  const height = 40 + maxLevel * 70
  for (const [lv, ids] of byLevel) {
    ids.forEach((id, i) => {
      const node = nodes.find((n) => n.id === id)
      if (!node) return
      const span = ids.length
      node.x = ((i + 1) / (span + 1) - 0.5) * width
      node.y = (lv / Math.max(maxLevel, 1) - 0.5) * height
    })
  }
}

const KNOWN: Record<string, TracerKind> = {
  Array1DTracer: 'Array1DTracer',
  Array2DTracer: 'Array2DTracer',
  LogTracer: 'LogTracer',
  GraphTracer: 'GraphTracer',
  TreeTracer: 'TreeTracer',
  StackTracer: 'StackTracer',
  QueueTracer: 'QueueTracer',
  LinkedListTracer: 'LinkedListTracer',
  CircularQueueTracer: 'CircularQueueTracer',
  DequeTracer: 'DequeTracer',
  RedBlackTreeTracer: 'RedBlackTreeTracer',
  BPlusTreeTracer: 'BPlusTreeTracer',
  StaticLinkedListTracer: 'StaticLinkedListTracer',
  ChartTracer: 'unknown',
  MarkdownTracer: 'unknown',
  ScatterTracer: 'unknown',
}

function isSequenceKind(kind: TracerKind): boolean {
  return (
    kind === 'Array1DTracer' ||
    kind === 'StackTracer' ||
    kind === 'QueueTracer' ||
    kind === 'LinkedListTracer' ||
    kind === 'CircularQueueTracer' ||
    kind === 'DequeTracer' ||
    kind === 'StaticLinkedListTracer'
  )
}

function isTreeishKind(kind: TracerKind): boolean {
  return kind === 'GraphTracer' || kind === 'TreeTracer' || kind === 'RedBlackTreeTracer' || kind === 'BPlusTreeTracer'
}

/** Bundlers may emit `Array1DTracer2` as constructor.name — normalize. */
function normalizeMethod(method: string): string {
  return method.replace(/\d+$/, '')
}

function isLayoutMethod(method: string): boolean {
  const m = normalizeMethod(method)
  return m === 'VerticalLayout' || m === 'HorizontalLayout' || m === 'Layout'
}

/** Pure command replay engine for AV visualization (frontend port). */
export class AvEngine {
  private objects = new Map<string, TracerModel>()
  private layouts = new Map<string, LayoutModel>()
  private rootKey: string | null = null
  private cursor = 0
  private chunks: AvChunk[] = [{ commands: [] }]

  setCommands(commands: AvCommand[]): void {
    this.objects.clear()
    this.layouts.clear()
    this.rootKey = null
    this.cursor = 0
    this.chunks = buildChunks(commands)
    this.replayTo(0)
  }

  private createTracer(key: string, method: string, title?: string): void {
    const kind = KNOWN[method] ?? 'unknown'
    const model = new TracerModel(key, kind, title || method.replace(/Tracer$/, ''))
    if (isSequenceKind(kind)) model.isArray1D = true
    if (kind === 'StaticLinkedListTracer') model.isStaticList = true
    this.objects.set(key, model)
  }

  private findEdge(
    model: TracerModel,
    source: number | null,
    target: number,
  ): GraphEdgeState | undefined {
    if (source === null || source === undefined) return undefined
    return (
      model.edges.find((e) => e.source === source && e.target === target) ??
      (!model.isDirected
        ? model.edges.find((e) => e.source === target && e.target === source)
        : undefined)
    )
  }

  private rebuildTreeEdges(model: TracerModel): void {
    const edges: GraphEdgeState[] = []
    for (const n of model.nodes) {
      if (n.left != null) {
        edges.push({
          source: n.id,
          target: n.left,
          weight: null,
          visitedCount: 0,
          selectedCount: 0,
        })
      }
      if (n.right != null) {
        edges.push({
          source: n.id,
          target: n.right,
          weight: null,
          visitedCount: 0,
          selectedCount: 0,
        })
      }
    }
    model.edges = edges
  }

  /** AVL/RB-style rotate; direction 'left' means left-rotate at x. */
  private rotateTree(model: TracerModel, x: number, dir: 'left' | 'right'): void {
    const node = (id: number) => model.nodes.find((n) => n.id === id)
    const X = node(x)
    if (!X) return
    // infer left/right from current edges if missing
    if (X.left == null || X.right == null) {
      const kids = model.edges.filter((e) => e.source === x).map((e) => e.target)
      if (X.left == null && X.right == null && kids.length) {
        X.left = kids[0]
        if (kids.length > 1) X.right = kids[1]
      }
    }
    const yId = dir === 'left' ? X.right : X.left
    if (yId == null) return
    const Y = node(yId)
    if (!Y) return
    const parentId = X.parent ?? null
    if (dir === 'left') {
      const t = Y.left
      Y.left = X.id
      X.parent = Y.id
      X.right = t
      if (t != null) {
        const T = node(t)
        if (T) T.parent = X.id
      }
    } else {
      const t = Y.right
      Y.right = X.id
      X.parent = Y.id
      X.left = t
      if (t != null) {
        const T = node(t)
        if (T) T.parent = X.id
      }
    }
    Y.parent = parentId
    if (parentId != null) {
      const P = node(parentId)
      if (P) {
        if (P.left === X.id) P.left = Y.id
        else if (P.right === X.id) P.right = Y.id
        else P.right = Y.id
      }
    }
    // clear dangling child refs on Y that pointed incorrectly
    this.rebuildTreeEdges(model)
  }

  applyCommand(command: AvCommand): void {
    const { key, method: rawMethod, args } = command
    const method = normalizeMethod(rawMethod)

    if (key === null && method === 'setRoot') {
      this.rootKey = String(args[0])
      return
    }
    if (key === null) return

    if (method.endsWith('Tracer')) {
      this.createTracer(key, method, args[0] as string | undefined)
      return
    }

    if (isLayoutMethod(rawMethod) || isLayoutMethod(method)) {
      const children = (args[0] as string[]) ?? []
      // Layout children may be tracer keys; JSON may stringify tracer objects as keys
      const childKeys = children.map((c) => String(c))
      this.layouts.set(key, new LayoutModel(key, method, childKeys))
      return
    }

    const model = this.objects.get(key)
    if (!model) return

    if (isTreeishKind(model.kind)) {
      this.applyGraph(model, method, args)
      return
    }

    if (model.kind === 'LogTracer') {
      if (method === 'set') model.log = String(args[0] ?? '')
      else if (method === 'print') model.log += String(args[0] ?? '')
      else if (method === 'println') model.log += `${String(args[0] ?? '')}\n`
      return
    }

    if (model.kind === 'CircularQueueTracer') {
      this.applyCircularQueue(model, method, args)
      return
    }

    if (model.kind === 'StaticLinkedListTracer') {
      this.applyStaticList(model, method, args)
      return
    }

    // Array1D / Array2D / deque / stack / queue / linked-list / unknown arrays
    switch (method) {
      case 'set': {
        const payload = args[0]
        if (model.isArray1D || model.kind === 'Array1DTracer') {
          model.isArray1D = true
          model.array = [((payload as unknown[]) ?? []).map(makeCell)]
        } else {
          const grid = (payload as unknown[][]) ?? []
          model.array = grid.map((row) => [...(Array.isArray(row) ? row : [row])].map(makeCell))
        }
        break
      }
      case 'patch': {
        if (model.isArray1D) {
          const [x, v] = args as [number, unknown]
          const cell = model.array[0]?.[x]
          if (cell) {
            if (v !== undefined) cell.value = v
            cell.patched = true
          }
        } else {
          const [x, y, v] = args as [number, number, unknown]
          const cell = model.array[x]?.[y]
          if (cell) {
            if (v !== undefined) cell.value = v
            cell.patched = true
          }
        }
        break
      }
      case 'depatch': {
        if (model.isArray1D) {
          const [x] = args as [number]
          const cell = model.array[0]?.[x]
          if (cell) cell.patched = false
        } else {
          const [x, y] = args as [number, number]
          const cell = model.array[x]?.[y]
          if (cell) cell.patched = false
        }
        break
      }
      case 'select':
      case 'deselect': {
        const selected = method === 'select'
        if (model.isArray1D) {
          const [sx, ex = sx] = args as [number, number?]
          const row = model.array[0] ?? []
          for (let i = sx; i <= ex; i++) if (row[i]) row[i].selected = selected
        } else {
          const [sx, sy, ex = sx, ey = sy] = args as [number, number, number?, number?]
          for (let x = sx; x <= ex; x++) {
            for (let y = sy; y <= ey; y++) {
              const cell = model.array[x]?.[y]
              if (cell) cell.selected = selected
            }
          }
        }
        break
      }
      case 'selectRow':
      case 'deselectRow': {
        const selected = method === 'selectRow'
        const [x, sy, ey = sy] = args as [number, number, number?]
        const row = model.array[x]
        if (row) {
          for (let y = sy; y <= ey; y++) if (row[y]) row[y].selected = selected
        }
        break
      }
      case 'selectCol':
      case 'deselectCol': {
        const selected = method === 'selectCol'
        const [y, sx, ex = sx] = args as [number, number, number?]
        for (let x = sx; x <= ex; x++) {
          const cell = model.array[x]?.[y]
          if (cell) cell.selected = selected
        }
        break
      }
      case 'push':
      case 'enqueue': {
        if (!model.isArray1D) break
        if (!model.array[0]) model.array = [[]]
        const cell = makeCell(args[0])
        cell.selected = true
        model.array[0].push(cell)
        break
      }
      case 'pop':
      case 'dequeue': {
        if (!model.isArray1D) break
        model.array[0]?.pop()
        break
      }
      case 'unshift':
      case 'pushFront':
      case 'push_front': {
        if (!model.isArray1D) break
        if (!model.array[0]) model.array = [[]]
        const head = makeCell(args[0])
        head.selected = true
        model.array[0].unshift(head)
        break
      }
      case 'shift':
      case 'popFront':
      case 'pop_front': {
        if (!model.isArray1D) break
        model.array[0]?.shift()
        break
      }
      case 'pushBack':
      case 'push_back': {
        if (!model.isArray1D) break
        if (!model.array[0]) model.array = [[]]
        const back = makeCell(args[0])
        back.selected = true
        model.array[0].push(back)
        break
      }
      case 'popBack':
      case 'pop_back': {
        if (!model.isArray1D) break
        model.array[0]?.pop()
        break
      }
      default:
        break
    }
  }

  private applyCircularQueue(model: TracerModel, method: string, args: unknown[]): void {
    const row = () => {
      if (!model.array[0]) model.array = [[]]
      return model.array[0]
    }
    const clearSelection = () => {
      for (const c of row()) c.selected = false
    }
    switch (method) {
      case 'init':
      case 'setCapacity': {
        const n = Number(args[0] ?? 0)
        model.capacity = Math.max(0, n)
        model.head = 0
        model.tail = 0
        model.array = [Array.from({ length: model.capacity }, () => makeCell(null))]
        break
      }
      case 'set': {
        const arr = (args[0] as unknown[]) ?? []
        model.capacity = model.capacity || arr.length
        model.array = [
          Array.from({ length: model.capacity }, (_, i) => makeCell(arr[i] ?? null)),
        ]
        model.head = Number(args[1] ?? 0)
        model.tail = Number(args[2] ?? Math.min(arr.length, model.capacity))
        break
      }
      case 'enqueue':
      case 'push': {
        const cells = row()
        if (model.capacity <= 0) {
          model.capacity = Math.max(cells.length, 8)
          while (cells.length < model.capacity) cells.push(makeCell(null))
        }
        const idx = model.tail % (model.capacity || cells.length || 1)
        if (cells[idx]) {
          clearSelection()
          cells[idx].value = args[0]
          cells[idx].selected = true
        }
        model.tail = (idx + 1) % (model.capacity || cells.length || 1)
        break
      }
      case 'dequeue':
      case 'pop': {
        const cells = row()
        const idx = model.head % (model.capacity || cells.length || 1)
        if (cells[idx]) {
          cells[idx].value = null
          cells[idx].selected = true
        }
        model.head = (idx + 1) % (model.capacity || cells.length || 1)
        break
      }
      case 'select':
      case 'deselect': {
        const selected = method === 'select'
        const [i] = args as [number]
        const cell = row()[i]
        if (cell) cell.selected = selected
        break
      }
      default:
        break
    }
  }

  private applyStaticList(model: TracerModel, method: string, args: unknown[]): void {
    const ensure = () => {
      if (model.array.length < 2) {
        const n = model.array[0]?.length ?? 0
        model.array = [
          model.array[0] ?? [],
          Array.from({ length: n }, () => makeCell(null)),
        ]
      }
      return model.array
    }
    switch (method) {
      case 'init':
      case 'setCapacity': {
        const n = Number(args[0] ?? 0)
        model.array = [
          Array.from({ length: n }, () => makeCell(null)),
          Array.from({ length: n }, () => makeCell(null)),
        ]
        break
      }
      case 'set': {
        const data = (args[0] as unknown[]) ?? []
        const next = (args[1] as unknown[]) ?? []
        const n = Math.max(data.length, next.length)
        model.array = [
          Array.from({ length: n }, (_, i) => makeCell(data[i] ?? null)),
          Array.from({ length: n }, (_, i) => makeCell(next[i] ?? null)),
        ]
        break
      }
      case 'setData':
      case 'set_data': {
        const [i, v] = args as [number, unknown]
        const arr = ensure()
        if (arr[0]?.[i]) arr[0][i].value = v
        break
      }
      case 'setNext':
      case 'set_next': {
        const [i, v] = args as [number, unknown]
        const arr = ensure()
        if (arr[1]?.[i]) arr[1][i].value = v
        break
      }
      case 'select':
      case 'deselect': {
        const selected = method === 'select'
        const [rowIdx, col] = args as [number, number?]
        const arr = ensure()
        if (col === undefined) {
          const r = arr[rowIdx]
          if (r) for (const c of r) c.selected = selected
        } else if (arr[rowIdx]?.[col]) {
          arr[rowIdx][col].selected = selected
        }
        break
      }
      default:
        break
    }
  }

  private applyGraph(model: TracerModel, method: string, args: unknown[]): void {
    const relayout = () => {
      if (model.kind === 'TreeTracer' || model.kind === 'RedBlackTreeTracer') {
        treeLayout(model.nodes, model.edges)
      } else if (model.kind === 'BPlusTreeTracer') {
        treeLayout(model.nodes, model.edges)
      } else {
        circleLayout(model.nodes)
      }
    }
    const ensureNode = (id: number, weight: number | null = null) => {
      let n = model.nodes.find((x) => x.id === id)
      if (!n) {
        n = {
          id,
          weight,
          x: 0,
          y: 0,
          visitedCount: 0,
          selectedCount: 0,
          color: model.kind === 'RedBlackTreeTracer' ? 'black' : null,
          label: null,
        }
        model.nodes.push(n)
      }
      return n
    }
    switch (method) {
      case 'directed':
        model.isDirected = Boolean(args[0] ?? true)
        break
      case 'weighted':
        break
      case 'setColor':
      case 'color': {
        const [id, color] = args as [number, string]
        const n = ensureNode(id)
        n.color = color === 'red' ? 'red' : 'black'
        relayout()
        break
      }
      case 'setLabel':
      case 'label': {
        const [id, text] = args as [number, unknown]
        const n = ensureNode(id)
        n.label = text == null ? null : String(text)
        n.weight = typeof text === 'number' ? text : n.weight
        break
      }
      case 'setPointer':
      case 'setLink': {
        // setPointer(nodeId, field: 'left'|'right'|'parent', childId|null)
        const [id, field, child] = args as [number, 'left' | 'right' | 'parent', number | null]
        const n = ensureNode(id)
        if (field === 'left') n.left = child
        else if (field === 'right') n.right = child
        else n.parent = child
        this.rebuildTreeEdges(model)
        relayout()
        break
      }
      case 'rotateLeft':
      case 'rotate_left': {
        const [x] = args as [number]
        this.rotateTree(model, x, 'left')
        relayout()
        break
      }
      case 'rotateRight':
      case 'rotate_right': {
        const [x] = args as [number]
        this.rotateTree(model, x, 'right')
        relayout()
        break
      }
      case 'split':
      case 'splitNode': {
        // split(oldId, newId, promoteLabel, leftLabel?, rightLabel?)
        const [oldId, newId, promote, leftLabel, rightLabel] = args as [
          number,
          number,
          unknown,
          unknown?,
          unknown?,
        ]
        const old = ensureNode(oldId)
        const kids = model.nodes.filter((n) => n.parent === oldId)
        const oldLabel = String(old.label ?? '')
        const parts = oldLabel.split('|').filter(Boolean)
        const mid = promote != null ? String(promote) : parts[Math.floor(parts.length / 2)] ?? ''
        const leftKeys = leftLabel != null ? String(leftLabel) : parts.slice(0, Math.floor(parts.length / 2)).join('|')
        const rightKeys = rightLabel != null ? String(rightLabel) : parts.slice(Math.floor(parts.length / 2) + 1).join('|')
        old.label = leftKeys || oldLabel
        const neu = ensureNode(newId)
        neu.label = rightKeys
        neu.parent = old.parent
        neu.left = null
        neu.right = null
        // move right-half children to new node
        const half = Math.ceil(kids.length / 2)
        kids.forEach((k, i) => {
          if (i >= half) {
            k.parent = newId
          }
        })
        // parent gets promote as internal key — optional child link via addEdge later
        this.rebuildTreeEdges(model)
        // if old has parent, link new as sibling (B+ internal split demo)
        if (old.parent != null) {
          const p = ensureNode(old.parent)
          if (p.left == null) p.left = newId
          else if (p.right == null) p.right = newId
          else p.right = newId
          this.rebuildTreeEdges(model)
        }
        void mid
        relayout()
        break
      }
      case 'set': {
        const payload = args[0]
        model.nodes = []
        model.edges = []
        // adjacency matrix
        if (Array.isArray(payload) && Array.isArray(payload[0])) {
          const grid = payload as unknown[][]
          for (let i = 0; i < grid.length; i++) {
            ensureNode(i)
            for (let j = 0; j < grid.length; j++) {
              if (grid[i]?.[j]) {
                model.edges.push({
                  source: i,
                  target: j,
                  weight: grid[i][j] as number,
                  visitedCount: 0,
                  selectedCount: 0,
                })
              }
            }
          }
        } else if (Array.isArray(payload)) {
          // list of {id, parent, left, right, color?, label?}
          const items = payload as {
            id?: number
            parent?: number | null
            left?: number | null
            right?: number | null
            color?: string
            label?: unknown
            value?: unknown
          }[]
          items.forEach((it, i) => {
            const id = it.id ?? i
            const n = ensureNode(id)
            if (it.color) n.color = it.color === 'red' ? 'red' : 'black'
            if (it.label != null) n.label = String(it.label)
            else if (it.value != null) n.label = String(it.value)
            if (it.parent != null && it.parent >= 0) n.parent = it.parent
            if (it.left !== undefined) n.left = it.left
            if (it.right !== undefined) n.right = it.right
            if (it.parent != null && it.parent >= 0) {
              model.edges.push({
                source: it.parent,
                target: id,
                weight: null,
                visitedCount: 0,
                selectedCount: 0,
              })
            }
          })
          // if left/right given, also link
          for (const n of model.nodes) {
            if (n.left != null) {
              ensureNode(n.left).parent = n.id
              if (!model.edges.find((e) => e.source === n.id && e.target === n.left)) {
                model.edges.push({
                  source: n.id,
                  target: n.left,
                  weight: null,
                  visitedCount: 0,
                  selectedCount: 0,
                })
              }
            }
            if (n.right != null) {
              ensureNode(n.right).parent = n.id
              if (!model.edges.find((e) => e.source === n.id && e.target === n.right)) {
                model.edges.push({
                  source: n.id,
                  target: n.right,
                  weight: null,
                  visitedCount: 0,
                  selectedCount: 0,
                })
              }
            }
          }
        }
        relayout()
        break
      }
      case 'addNode': {
        const [id, weight = null] = args as [number, number | null]
        ensureNode(id, weight)
        relayout()
        break
      }
      case 'addEdge': {
        const [source, target, weight = null] = args as [number, number, number | null]
        if (!model.edges.find((e) => e.source === source && e.target === target)) {
          model.edges.push({
            source,
            target,
            weight,
            visitedCount: 0,
            selectedCount: 0,
          })
          ensureNode(source)
          ensureNode(target)
          relayout()
        }
        break
      }
      case 'visit':
      case 'leave': {
        // visit(target, source, weight)
        const delta = method === 'visit' ? 1 : -1
        const [target, source = null, weight] = args as [number, number | null, number?]
        const node = model.nodes.find((n) => n.id === target)
        if (node) {
          node.visitedCount = Math.max(0, node.visitedCount + delta)
          if (weight !== undefined) node.weight = weight
        }
        const edge = this.findEdge(model, source, target)
        if (edge) edge.visitedCount = Math.max(0, edge.visitedCount + delta)
        break
      }
      case 'select':
      case 'deselect': {
        // select(target, source)
        const delta = method === 'select' ? 1 : -1
        const [target, source = null] = args as [number, number | null]
        const node = model.nodes.find((n) => n.id === target)
        if (node) node.selectedCount = Math.max(0, node.selectedCount + delta)
        const edge = this.findEdge(model, source, target)
        if (edge) edge.selectedCount = Math.max(0, edge.selectedCount + delta)
        break
      }
      default:
        break
    }
  }

  private applyChunk(chunk: AvChunk): void {
    for (const command of chunk.commands) this.applyCommand(command)
  }

  replayTo(cursor: number): void {
    this.objects.clear()
    this.layouts.clear()
    this.rootKey = null
    const target = Math.max(0, Math.min(cursor, this.chunks.length))
    for (let i = 0; i < target; i++) this.applyChunk(this.chunks[i])
    this.cursor = target
  }

  private resolveKeys(key: string, seen = new Set<string>()): string[] {
    if (seen.has(key)) return []
    seen.add(key)
    const layout = this.layouts.get(key)
    if (layout) {
      return layout.children.flatMap((c) => this.resolveKeys(c, seen))
    }
    if (this.objects.has(key)) return [key]
    return []
  }

  getCursor(): number {
    return this.cursor
  }

  getChunkCount(): number {
    return this.chunks.length
  }

  getCurrentLine(): number | undefined {
    return this.chunks[Math.max(0, this.cursor - 1)]?.lineNumber
  }

  /** Visible tracer panels after resolving layout root */
  getVisible(): TracerViewState[] {
    const keys = this.rootKey ? this.resolveKeys(this.rootKey) : [...this.objects.keys()]
    const list = keys
      .map((k) => this.objects.get(k))
      .filter((m): m is TracerModel => Boolean(m))
    if (list.length > 0) return list.map((m) => m.snapshot())
    // fallback: no setRoot yet — show created tracers
    return [...this.objects.values()].map((m) => m.snapshot())
  }

  getRoot(): TracerViewState | null {
    return this.getVisible()[0] ?? null
  }

  getAll(): TracerViewState[] {
    return this.getVisible()
  }
}
