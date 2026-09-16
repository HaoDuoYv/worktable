/**
 * Worktable Electron main process.
 * Serves dist/ over loopback HTTP (avoids file:// worker/CORS issues)
 * and embeds the local C++ runner so g++/clang++ stay available.
 */
const { app, BrowserWindow, shell, Menu, dialog } = require('electron')
const path = require('node:path')
const http = require('node:http')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const { pathToFileURL } = require('node:url')

const DEV_URL = process.env.WORKTABLE_DEV_URL || 'http://localhost:5173'
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production'

/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {{ close: () => Promise<void> } | null} */
let cppHandle = null
/** @type {http.Server | null} */
let staticServer = null
let appPort = 0
let cppPort = 0

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.py': 'text/plain; charset=utf-8',
  '.cpp': 'text/plain; charset=utf-8',
  '.h': 'text/plain; charset=utf-8',
}

function distDir() {
  return path.join(__dirname, '..', 'dist')
}

function serverCppEntry() {
  return path.join(__dirname, '..', 'server-cpp', 'index.mjs')
}

async function startCppEmbedded() {
  try {
    const entry = serverCppEntry()
    if (!fs.existsSync(entry)) {
      console.warn('[worktable] server-cpp missing:', entry)
      return
    }
    const mod = await import(pathToFileURL(entry).href)
    const preferredCompiler = process.env.WORKTABLE_CXX || 'auto'
    const compilerPath = process.env.WORKTABLE_CXX_PATH || ''
    const port = Number(process.env.WORKTABLE_CPP_PORT || 8787)
    const handle = await mod.startCppServer({
      port,
      host: '127.0.0.1',
      preferredCompiler,
      compilerPath,
    })
    cppHandle = handle
    cppPort = handle.port
    console.log('[worktable] C++ runner on http://127.0.0.1:' + cppPort)
  } catch (e) {
    console.error('[worktable] failed to start C++ runner', e)
  }
}

function startStaticServer() {
  const root = distDir()
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    throw new Error(`未找到构建产物：${path.join(root, 'index.html')}\n请先执行 npm run build`)
  }

  staticServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://127.0.0.1')
      let pathname = decodeURIComponent(url.pathname)
      if (pathname.endsWith('/')) pathname += 'index.html'

      let filePath = path.normalize(path.join(root, pathname))
      if (!filePath.startsWith(root)) {
        res.writeHead(403)
        res.end('Forbidden')
        return
      }

      let stat = await fsp.stat(filePath).catch(() => null)
      if (!stat) {
        // SPA fallback
        filePath = path.join(root, 'index.html')
        stat = await fsp.stat(filePath).catch(() => null)
      }
      if (!stat || !stat.isFile()) {
        res.writeHead(404)
        res.end('Not found')
        return
      }

      const ext = path.extname(filePath).toLowerCase()
      const data = await fsp.readFile(filePath)
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
      })
      res.end(data)
    } catch (e) {
      res.writeHead(500)
      res.end(e instanceof Error ? e.message : 'error')
    }
  })

  return new Promise((resolve, reject) => {
    staticServer.once('error', reject)
    staticServer.listen(0, '127.0.0.1', () => {
      const addr = staticServer.address()
      appPort = typeof addr === 'object' && addr ? addr.port : 0
      resolve(appPort)
    })
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'Worktable · 个人工作台',
    backgroundColor: '#0f1419',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  const target = isDev ? DEV_URL : `http://127.0.0.1:${appPort}/`
  void mainWindow.loadURL(target)

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '退出',
          role: process.platform === 'darwin' ? 'quit' : 'exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
        },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 C++ 编译器',
          click: async () => {
            const url = `http://127.0.0.1:${cppPort}/health`
            try {
              const res = await fetch(url)
              const data = await res.json()
              const lines = (data.details || []).map(
                (d) => `${d.name}: ${d.cmd}\n${d.version}`,
              )
              await dialog.showMessageBox({
                type: 'info',
                title: 'C++ 编译器',
                message: data.ok ? '已检测到编译器' : '未检测到编译器',
                detail: lines.length
                  ? lines.join('\n\n')
                  : '可在「设置 → C++ 运行」中填写完整路径。',
              })
            } catch (e) {
              await dialog.showErrorBox(
                'C++ 服务',
                e instanceof Error ? e.message : '无法连接内置 C++ 服务',
              )
            }
          },
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    await startCppEmbedded()
    if (!isDev) {
      await startStaticServer()
    }
    buildMenu()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', (e) => {
    if (cppHandle || staticServer) {
      e.preventDefault()
      const cleanup = async () => {
        try {
          if (cppHandle) await cppHandle.close()
        } catch {
          /* ignore */
        }
        try {
          if (staticServer) {
            await new Promise((done) => staticServer.close(() => done()))
          }
        } catch {
          /* ignore */
        }
        cppHandle = null
        staticServer = null
        app.exit(0)
      }
      void cleanup()
    }
  })
}
