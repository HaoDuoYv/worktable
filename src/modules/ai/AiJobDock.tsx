import { useEffect, useState } from 'react'
import { dismissAiJob, getAiJobs, subscribeAiJobs, type AiJob } from './aiJobs'
import { Icon } from '@/components/Icon'
import { IconButton } from '@/components/IconButton'

function labelOf(job: AiJob) {
  if (job.kind === 'viz') return '生成可视化'
  if (job.kind === 'chat') return 'AI 对话'
  if (job.kind === 'news') return '每日新闻'
  return 'AI'
}

/** Floating job dock — shows background AI work even after switching pages. */
export function AiJobDock() {
  const [jobs, setJobs] = useState<AiJob[]>(() => getAiJobs())

  useEffect(() => subscribeAiJobs(() => setJobs(getAiJobs())), [])

  if (jobs.length === 0) return null

  return (
    <div className="ai-job-dock" aria-live="polite" aria-label="后台任务">
      {jobs.map((job) => (
        <div key={job.id} className={`ai-job-dock__item is-${job.status}`}>
          <span className="ai-job-dock__icon" aria-hidden="true">
            {job.status === 'running' ? (
              <span className="ai-job-dock__spin" />
            ) : job.status === 'done' ? (
              <Icon name="check" size={14} />
            ) : (
              <span className="ai-job-dock__err">!</span>
            )}
          </span>
          <div className="ai-job-dock__text">
            <div className="ai-job-dock__title">
              {labelOf(job)} · {job.title}
            </div>
            <div className="ai-job-dock__detail">{job.detail}</div>
          </div>
          {job.status !== 'running' ? (
            <IconButton label="关闭" onClick={() => dismissAiJob(job.id)}>
              <Icon name="chevron-down" size={14} className="ai-job-dock__x" />
            </IconButton>
          ) : null}
        </div>
      ))}
    </div>
  )
}
