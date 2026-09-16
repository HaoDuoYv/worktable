export interface AvCommand {
  key: string | null
  method: string
  args: unknown[]
}

export interface AvChunk {
  commands: AvCommand[]
  lineNumber?: number
}

export type TracerKind = 'Array1DTracer' | 'Array2DTracer' | 'LogTracer' | 'GraphTracer' | 'unknown'

export interface CellState {
  value: unknown
  patched: boolean
  selected: boolean
}

export interface GraphNodeState {
  id: number
  weight: number | null
  x: number
  y: number
  visitedCount: number
  selectedCount: number
}

export interface GraphEdgeState {
  source: number
  target: number
  weight: number | null
  visitedCount: number
  selectedCount: number
}

export interface TracerViewState {
  key: string
  kind: TracerKind
  title: string
  /** Array2D data; Array1D is stored as one row */
  array?: CellState[][]
  isArray1D?: boolean
  log?: string
  nodes?: GraphNodeState[]
  edges?: GraphEdgeState[]
  isDirected?: boolean
}

export function buildChunks(commands: AvCommand[]): AvChunk[] {
  const chunks: AvChunk[] = [{ commands: [], lineNumber: undefined }]
  for (const command of commands) {
    if (command.key === null && command.method === 'delay') {
      const [lineNumber] = command.args as [number | undefined]
      chunks[chunks.length - 1].lineNumber = lineNumber
      chunks.push({ commands: [], lineNumber: undefined })
    } else {
      chunks[chunks.length - 1].commands.push(command)
    }
  }
  // drop trailing empty chunk from final delay
  while (chunks.length > 1 && chunks[chunks.length - 1].commands.length === 0) {
    chunks.pop()
  }
  return chunks
}
