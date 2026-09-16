export type DiffLineType = 'a' | 'r' | 'c'

export interface DiffLine {
  t: DiffLineType
  c: string
}

export interface TutorialStep {
  title: string
  message: string
  changed: string[]
  diffs: Record<string, DiffLine[]>
  files: Record<string, string>
}

export interface TutorialProgress {
  lastStep: number
  completedSteps: number[]
}

export interface TutorialMeta {
  id: string
  title: string
  description?: string
  author?: string
  tags: string[]
  source?: string
  stepCount: number
  createdAt: number
  updatedAt: number
  progress?: TutorialProgress
}

export interface Tutorial extends TutorialMeta {
  steps: TutorialStep[]
}

export interface TutorialNote {
  id: string
  tutorialId: string
  stepIndex: number
  content: string
  updatedAt: number
}

export function noteId(tutorialId: string, stepIndex: number): string {
  return `${tutorialId}:${stepIndex}`
}
