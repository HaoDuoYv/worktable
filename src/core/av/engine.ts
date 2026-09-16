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

const KNOWN: Record<string, TracerKind> = {
  Array1DTracer: 'Array1DTracer',
  Array2DTracer: 'Array2DTracer',
  LogTracer: 'LogTracer',
  GraphTracer: 'GraphTracer',
  ChartTracer: 'unknown',
  MarkdownTracer: 'unknown',
  ScatterTracer: 'unknown',
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
    if (method === 'Array1DTracer') model.isArray1D = true
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

    if (model.kind === 'GraphTracer') {
      this.applyGraph(model, method, args)
      return
    }

    if (model.kind === 'LogTracer') {
      if (method === 'set') model.log = String(args[0] ?? '')
      else if (method === 'print') model.log += String(args[0] ?? '')
      else if (method === 'println') model.log += `${String(args[0] ?? '')}\n`
      return
    }

    // Array1D / Array2D / unknown arrays
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
      default:
        break
    }
  }

  private applyGraph(model: TracerModel, method: string, args: unknown[]): void {
    switch (method) {
      case 'directed':
        model.isDirected = Boolean(args[0] ?? true)
        break
      case 'weighted':
        break
      case 'set': {
        const grid = (args[0] as number[][]) ?? []
        model.nodes = []
        model.edges = []
        for (let i = 0; i < grid.length; i++) {
          model.nodes.push({
            id: i,
            weight: null,
            x: 0,
            y: 0,
            visitedCount: 0,
            selectedCount: 0,
          })
          for (let j = 0; j < grid.length; j++) {
            if (grid[i]?.[j]) {
              model.edges.push({
                source: i,
                target: j,
                weight: grid[i][j],
                visitedCount: 0,
                selectedCount: 0,
              })
            }
          }
        }
        circleLayout(model.nodes)
        break
      }
      case 'addNode': {
        const [id, weight = null] = args as [number, number | null]
        if (!model.nodes.find((n) => n.id === id)) {
          model.nodes.push({
            id,
            weight,
            x: 0,
            y: 0,
            visitedCount: 0,
            selectedCount: 0,
          })
          circleLayout(model.nodes)
        }
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
