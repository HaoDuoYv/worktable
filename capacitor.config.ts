import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.worktable.app',
  appName: 'Worktable',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    // 覆盖默认 WebView 混入内容策略，允许加载本地资源与外部媒体
    allowMixedContent: false,
  },
}

export default config
