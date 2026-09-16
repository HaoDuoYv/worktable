declare module 'algorithm-visualizer' {
  export const Commander: {
    commands: Array<{ key: string | null; method: string; args: unknown[] }>
    init(): void
  }
  export class Tracer {
    static delay(lineNumber?: number): void
    constructor(title?: string)
    destroy(): void
  }
  export class Array1DTracer extends Tracer {
    set(array1d?: unknown[]): void
    patch(x: number, v?: unknown): void
    depatch(x: number): void
    select(sx: number, ex?: number): void
    deselect(sx: number, ex?: number): void
  }
  export class Array2DTracer extends Tracer {
    set(array2d?: unknown[][]): void
    patch(x: number, y: number, v?: unknown): void
    depatch(x: number, y: number): void
    select(sx: number, sy: number, ex?: number, ey?: number): void
    deselect(sx: number, sy: number, ex?: number, ey?: number): void
    selectRow(x: number, sy: number, ey?: number): void
    deselectRow(x: number, sy: number, ey?: number): void
  }
  export class LogTracer extends Tracer {
    set(log?: string): void
    print(message: unknown): void
    println(message: unknown): void
  }
  export class GraphTracer extends Tracer {
    set(array2d?: number[][]): void
    directed(isDirected?: boolean): void
    visit(target: number, source?: number | null, weight?: number): void
    leave(target: number, source?: number | null, weight?: number): void
    select(target: number, source?: number | null): void
    deselect(target: number, source?: number | null): void
  }
  export class Layout {
    static setRoot(tracer: unknown): void
  }
  export class VerticalLayout {
    constructor(children: unknown[])
  }
  export class HorizontalLayout {
    constructor(children: unknown[])
  }
}
