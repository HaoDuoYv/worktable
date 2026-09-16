import { useState } from 'react'
import { Button, EmptyState, PageHeader } from '@/components/Page'
import { ChipRow, type ChipOption } from '@/components/Chip'

const LANG_OPTIONS: ChipOption<'javascript' | 'python' | 'cpp'>[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'cpp', label: 'C++', disabled: true, title: 'M6 接入本地编译器后可用' },
]

export function AlgorithmsPage() {
  const [lang, setLang] = useState<'javascript' | 'python' | 'cpp'>('javascript')

  return (
    <div className="page">
      <PageHeader
        title="算法"
        desc="编写、运行并可视化算法。完整移植 Algorithm Visualizer 能力，中文界面。"
        actions={<Button variant="primary">新建算法</Button>}
      />

      <div style={{ marginBottom: 16 }}>
        <ChipRow
          ariaLabel="算法语言"
          options={LANG_OPTIONS}
          value={lang}
          onChange={setLang}
        />
      </div>

      <EmptyState
        title="算法库为空"
        text="M3 起支持编辑器 + 播放条 + 可视化画布；M4 支持分类、收藏与本地保存。"
        actions={
          <Button variant="primary" disabled title="M3 开放">
            新建算法
          </Button>
        }
      />
    </div>
  )
}
