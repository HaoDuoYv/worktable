/**
 * 当日天气 —— 数据模型与设置。
 * 数据源：Open-Meteo（免费、无需密钥、支持 CORS）。
 */

export interface WeatherSettings {
  /** 手动指定城市（定位关闭或失败时使用），默认「北京市」 */
  city: string
  /** 是否优先使用浏览器自动定位 */
  autoLocation: boolean
}

export type WeatherIcon = 'sun' | 'cloud' | 'fog' | 'rain' | 'snow' | 'thunder'

export interface WeatherNow {
  city: string
  /** 是否来自浏览器自动定位 */
  located: boolean
  tempC: number
  feelsLikeC: number
  text: string
  code: number
  icon: WeatherIcon
  /** 相对湿度 % */
  humidity: number
  /** 如「东南风 3 级」 */
  windText: string
  aqi?: number
  aqiText?: string
  updatedAt: number
}

export type WeatherStatus = 'idle' | 'loading' | 'done' | 'error'

export interface WeatherState {
  status: WeatherStatus
  data?: WeatherNow
  error?: string
}

const SETTINGS_KEY = 'worktable.weather'
const CACHE_KEY = 'worktable.weather.cache'
const CACHE_TTL = 30 * 60 * 1000

export const DEFAULT_WEATHER_SETTINGS: WeatherSettings = {
  city: '北京市',
  autoLocation: true,
}

export function loadWeatherSettings(): WeatherSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_WEATHER_SETTINGS }
    return { ...DEFAULT_WEATHER_SETTINGS, ...(JSON.parse(raw) as Partial<WeatherSettings>) }
  } catch {
    return { ...DEFAULT_WEATHER_SETTINGS }
  }
}

export function saveWeatherSettings(s: WeatherSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

/* —— WMO 天气码映射 —— */

function mapWeatherCode(code: number): { text: string; icon: WeatherIcon } {
  if (code === 0) return { text: '晴', icon: 'sun' }
  if (code === 1) return { text: '大部晴朗', icon: 'sun' }
  if (code === 2) return { text: '局部多云', icon: 'cloud' }
  if (code === 3) return { text: '阴', icon: 'cloud' }
  if (code === 45 || code === 48) return { text: '雾', icon: 'fog' }
  if (code >= 51 && code <= 57) return { text: '毛毛雨', icon: 'rain' }
  if (code >= 61 && code <= 65) return { text: code === 61 ? '小雨' : code === 63 ? '中雨' : '大雨', icon: 'rain' }
  if (code === 66 || code === 67) return { text: '冻雨', icon: 'rain' }
  if (code >= 71 && code <= 77) return { text: code === 71 ? '小雪' : code === 73 ? '中雪' : '雪', icon: 'snow' }
  if (code >= 80 && code <= 82) return { text: '阵雨', icon: 'rain' }
  if (code === 85 || code === 86) return { text: '阵雪', icon: 'snow' }
  if (code >= 95) return { text: code > 95 ? '雷暴伴冰雹' : '雷暴', icon: 'thunder' }
  return { text: '未知', icon: 'cloud' }
}

/* —— 风向 / 风力 —— */

function windDirectionText(deg: number): string {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  return dirs[Math.round(deg / 45) % 8]
}

function windLevel(kmh: number): number {
  const levels = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118]
  for (let i = 0; i < levels.length; i++) if (kmh < levels[i]) return i
  return 12
}

function aqiText(aqi: number): string {
  if (aqi <= 50) return '优'
  if (aqi <= 100) return '良'
  if (aqi <= 150) return '轻度污染'
  if (aqi <= 200) return '中度污染'
  if (aqi <= 300) return '重度污染'
  return '严重污染'
}

/* —— 请求工具 —— */

import { fetchRaw } from '@/modules/news/newsFetcher'

/**
 * 统一走 /news/proxy 抓取（Node 侧网络路径稳定），无代理环境降级直连。
 * Open-Meteo / BigDataCloud 均无需自定义请求头。
 */
async function fetchJson<T>(url: string): Promise<T> {
  const text = await fetchRaw(url)
  return JSON.parse(text) as T
}

interface GeoResult {
  results?: { latitude: number; longitude: number; name: string; admin1?: string }[]
}

async function geocodeCity(city: string): Promise<{ lat: number; lon: number; name: string }> {
  // Open-Meteo 地理编码对「北京市」这类带后缀的名称查不到结果，逐候选回退
  const stripped = city.replace(/(省|市|地区|县|区)+$/g, '')
  const candidates = stripped && stripped !== city ? [city, stripped] : [city]
  for (const name of candidates) {
    const data = await fetchJson<GeoResult>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=zh&format=json`,
    )
    const r = data.results?.[0]
    if (r) return { lat: r.latitude, lon: r.longitude, name: r.name }
  }
  throw new Error(`找不到城市「${city}」`)
}

function getBrowserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('当前环境不支持定位'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 5000,
      maximumAge: 30 * 60 * 1000,
    })
  })
}

async function reverseCityName(lat: number, lon: number): Promise<string> {
  try {
    const data = await fetchJson<{ city?: string; locality?: string }>(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`,
    )
    return data.city || data.locality || '当前位置'
  } catch {
    return '当前位置'
  }
}

interface ForecastResp {
  current?: {
    temperature_2m?: number
    relative_humidity_2m?: number
    apparent_temperature?: number
    weather_code?: number
    wind_speed_10m?: number
    wind_direction_10m?: number
  }
}

interface AqiResp {
  current?: { us_aqi?: number }
}

async function fetchWeatherByCoords(lat: number, lon: number, city: string, located: boolean): Promise<WeatherNow> {
  const [forecast, air] = await Promise.allSettled([
    fetchJson<ForecastResp>(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`,
    ),
    fetchJson<AqiResp>(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=auto`,
    ),
  ])

  if (forecast.status === 'rejected' || !forecast.value.current) {
    throw new Error('天气数据获取失败')
  }
  const c = forecast.value.current
  const { text, icon } = mapWeatherCode(c.weather_code ?? -1)
  const aqi = air.status === 'fulfilled' ? air.value.current?.us_aqi : undefined

  return {
    city,
    located,
    tempC: Math.round(c.temperature_2m ?? 0),
    feelsLikeC: Math.round(c.apparent_temperature ?? c.temperature_2m ?? 0),
    text,
    code: c.weather_code ?? -1,
    icon,
    humidity: Math.round(c.relative_humidity_2m ?? 0),
    windText: `${windDirectionText(c.wind_direction_10m ?? 0)}风 ${windLevel(c.wind_speed_10m ?? 0)} 级`,
    aqi,
    aqiText: aqi != null ? aqiText(aqi) : undefined,
    updatedAt: Date.now(),
  }
}

/* —— 单例服务（与 newsService 同构） —— */

let state: WeatherState = { status: 'idle' }
const listeners = new Set<() => void>()
let pending: Promise<WeatherNow> | null = null

function setState(next: Partial<WeatherState>) {
  state = { ...state, ...next }
  for (const l of listeners) l()
}

export function getWeatherState(): WeatherState {
  return state
}

export function subscribeWeather(listener: () => void): () => void {
  listeners.add(listener)
  listener()
  return () => {
    listeners.delete(listener)
  }
}

function loadCache(): WeatherNow | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return undefined
    const rec = JSON.parse(raw) as { at: number; data: WeatherNow }
    if (Date.now() - rec.at > CACHE_TTL) return undefined
    return rec.data
  } catch {
    return undefined
  }
}

function saveCache(data: WeatherNow): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* 存储不可用时忽略 */
  }
}

/** 清除缓存（修改城市/定位设置后调用） */
export function invalidateWeatherCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
}

async function resolveAndFetch(settings: WeatherSettings): Promise<WeatherNow> {
  if (settings.autoLocation) {
    try {
      const pos = await getBrowserPosition()
      const { latitude, longitude } = pos.coords
      const city = await reverseCityName(latitude, longitude)
      return await fetchWeatherByCoords(latitude, longitude, city, true)
    } catch {
      // 定位被拒/超时/失败 → 回退城市设置
    }
  }
  const city = settings.city.trim() || DEFAULT_WEATHER_SETTINGS.city
  const geo = await geocodeCity(city)
  return fetchWeatherByCoords(geo.lat, geo.lon, geo.name, false)
}

/**
 * 打开时检查：30 分钟内有缓存直接用，否则自动获取。
 * 并发调用只触发一次请求（pending 去重）。
 */
export function ensureWeather(force = false): Promise<WeatherNow> {
  if (pending) return pending

  pending = (async () => {
    if (!force) {
      const cached = loadCache()
      if (cached) {
        setState({ status: 'done', data: cached })
        return cached
      }
    }
    setState({ status: 'loading' })
    try {
      const data = await resolveAndFetch(loadWeatherSettings())
      saveCache(data)
      setState({ status: 'done', data })
      return data
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setState({ status: 'error', error: msg })
      throw e
    }
  })().finally(() => {
    pending = null
  })

  return pending
}
