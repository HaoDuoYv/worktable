/**
 * AI 新闻关键词策略（三层检索思路，参考 ai-daily-briefing skill）。
 *
 * 项目是 RSS/JSON 聚合器而非搜索引擎，所以 skill 里的「三层检索」在这里落成
 * 一套**关键词分类引擎**：抓回标题后，用三层词表给每条 AI 新闻打标签——
 *
 *   第一层  领域主题（topics）   —— 对标「侧重 AI coding 与具身智能」的选题方向
 *   第二层  反面词（negative）   —— 对标「反面词是最重要的一条规则」，命中即高亮
 *   第三层  信号词（signal）     —— 对标「定点深挖」，命中即标记「值得关注」的高信号条目
 *
 * 全部是纯数据 + 纯函数，无副作用，改词表即改策略，无需动抓取逻辑。
 */

export interface TopicRule {
  /** 稳定 id，用于徽标样式与去重 */
  id: string
  /** 展示标签 */
  label: string
  /** 命中任一关键词即归属该主题（中英混排，大小写不敏感） */
  keywords: string[]
}

/** 第一层：领域主题 */
export const NEWS_TOPICS: TopicRule[] = [
  {
    id: 'ai-coding',
    label: 'AI 编程',
    keywords: [
      'AI编程', 'AI 编程', '代码生成', '编程助手', '编码助手', 'Copilot', 'Claude Code',
      'Cursor', 'SWE-bench', 'vibe coding', 'Vibe Coding', 'IDE', 'agent 编程', '代码补全',
      'autonomous coding', 'code generation', 'coding agent',
    ],
  },
  {
    id: 'embodied',
    label: '具身智能',
    keywords: [
      '具身智能', '人形机器人', '机器人', '机械臂', '灵巧手', 'VLA', '世界模型',
      'Figure', '波士顿动力', '宇树', '优必选', '特斯拉机器人', 'Optimus', '自动驾驶',
      'robotics', 'humanoid', 'embodied', 'robot',
    ],
  },
  {
    id: 'foundation',
    label: '大模型',
    keywords: [
      '大模型', '新模型', 'GPT', 'Gemini', 'Claude', 'Llama', 'Qwen', '通义', '文心', 'DeepSeek',
      'MoE', '多模态', '开源模型', '推理模型', 'reasoning', 'benchmark', 'token', '权重',
      '上下文窗口', '参数', '模型发布', 'foundation model', 'multimodal', 'open model',
    ],
  },
  {
    id: 'safety',
    label: '安全与治理',
    keywords: [
      '对齐', 'AI 安全', '安全', '监管', '合规', '越权', '幻觉', '数据泄露', '版权',
      '隐私', 'AI 法案', '治理', 'alignment', 'safety', 'governance', 'AI Act',
      'red team', '红队', 'prompt injection',
    ],
  },
]

/** 第二层：反面词 —— 命中即标记「负面/转折」，在列表里高亮提醒 */
export const NEGATIVE_KEYWORDS: string[] = [
  '砍掉', '搁置', '暂停', '撤回', '下架', '失控', '漏洞', '越权', '欺骗', '造假',
  '翻车', '缺陷', '召回', '诉讼', '裁员', '暴跌', '崩盘', '推迟', '放弃', '停更',
  '质疑', '争议', '罚款', '封禁',
  'deception', 'shelved', 'vulnerability', 'incident', 'recall', 'lawsuit', 'layoff',
  'shutdown', 'discontinued', 'backlash', 'delay', 'scrap', 'halt', 'suspend', 'controversy',
]

/** 第三层：信号词 —— 命中即标「值得关注」（线索实体：模型名 / 公司 / benchmark） */
export const SIGNAL_KEYWORDS: string[] = [
  'OpenAI', 'Anthropic', 'Google', 'DeepMind', 'Meta', '微软', '英伟达', 'NVIDIA',
  '特斯拉', '字节', '阿里', '百度', '华为', '腾讯', 'xAI', 'Mistral', 'Perplexity',
  'SWE-bench', 'MMLU', 'GPQA', 'AIME', 'ARC-AGI', '突破', '首发', '首次', '首次公开',
  '刷新', '超越', '里程碑', 'first', 'state-of-the-art', 'breakthrough', 'SOTA',
]

export interface NewsClassification {
  /** 命中的领域主题 id 列表（可能为空） */
  topics: string[]
  /** 是否命中反面词 */
  isNegative: boolean
  /** 是否命中信号词 */
  isSignal: boolean
}

function anyHit(text: string, keywords: string[]): boolean {
  const t = text.toLowerCase()
  return keywords.some((k) => t.includes(k.toLowerCase()))
}

/** 对一条标题做三层分类（纯函数，可单测） */
export function classifyNews(title: string): NewsClassification {
  const text = title.trim()
  const topics = NEWS_TOPICS.filter((t) => anyHit(text, t.keywords)).map((t) => t.id)
  return {
    topics,
    isNegative: anyHit(text, NEGATIVE_KEYWORDS),
    isSignal: anyHit(text, SIGNAL_KEYWORDS),
  }
}

/** 主题 id → 展示标签 */
export function topicLabel(id: string): string {
  return NEWS_TOPICS.find((t) => t.id === id)?.label ?? id
}
