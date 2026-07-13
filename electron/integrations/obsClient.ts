import OBSWebSocket from 'obs-websocket-js'

export interface OBSConfig {
  host: string
  port: number
  password?: string
}

export class OBSClient {
  private obs: OBSWebSocket
  private connected: boolean
  private config: OBSConfig

  constructor(config: OBSConfig) {
    this.obs = new OBSWebSocket()
    this.connected = false
    this.config = config
    this.obs.on('ConnectionClosed', () => {
      this.connected = false
    })
  }

  updateConfig(config: OBSConfig) {
    const changed = config.host !== this.config.host || config.port !== this.config.port || config.password !== this.config.password
    this.config = config
    if (changed && this.connected) {
      void this.disconnect()
    }
  }

  async connect() {
    const url = `ws://${this.config.host}:${this.config.port}`
    await this.obs.connect(url, this.config.password || undefined)
    this.connected = true
    console.log(`📡 OBS connected: ${url}`)
  }

  async disconnect() {
    if (!this.connected) return
    await this.obs.disconnect()
    this.connected = false
  }

  isConnected() {
    return this.connected
  }

  async ensureConnected() {
    if (!this.connected) await this.connect()
  }

  // ── Practical operations the church actually uses ─────────────────────

  async setSceneByName(sceneName: string) {
    await this.ensureConnected()
    await this.obs.call('SetCurrentProgramScene', { sceneName })
  }

  async getSceneList() {
    await this.ensureConnected()
    const res = await this.obs.call('GetSceneList')
    return res.scenes.map((s) => s.sceneName as string)
  }

  async setSourceVisibility(sceneName: string, sourceName: string, visible: boolean) {
    await this.ensureConnected()
    const items = await this.obs.call('GetSceneItemList', { sceneName })
    const item = items.sceneItems.find(
      (i) => i.sourceName === sourceName
    )
    if (!item) throw new Error(`Source not found in scene: ${sourceName}`)
    await this.obs.call('SetSceneItemEnabled', {
      sceneName,
      sceneItemId: item.sceneItemId as number,
      sceneItemEnabled: visible
    })
  }

  /**
   * Push a URL into a Browser Source — used to drive a verse-overlay browser
   * source from the verse pipeline (tell OBS to load the renderer's overlay URL
   * with the current verse, then take it off air when dismissed).
   */
  async setBrowserSourceUrl(sourceName: string, url: string) {
    await this.ensureConnected()
    await this.obs.call('SetInputSettings', {
      inputName: sourceName,
      inputSettings: { url },
      overlay: true
    })
  }

  async startStreaming() {
    await this.ensureConnected()
    await this.obs.call('StartStream')
  }

  async stopStreaming() {
    await this.ensureConnected()
    await this.obs.call('StopStream')
  }

  async startRecording() {
    await this.ensureConnected()
    await this.obs.call('StartRecord')
  }

  async stopRecording() {
    await this.ensureConnected()
    const res = await this.obs.call('StopRecord')
    return res.outputPath || ''
  }

  async getStatus() {
    await this.ensureConnected()
    const [streamStatus, recordStatus, scene] = await Promise.all([
      this.obs.call('GetStreamStatus'),
      this.obs.call('GetRecordStatus'),
      this.obs.call('GetCurrentProgramScene')
    ])
    return {
      streaming: streamStatus.outputActive || false,
      recording: recordStatus.outputActive || false,
      currentScene: scene.currentProgramSceneName || ''
    }
  }
}

let singleton: OBSClient | null = null

export function getOBSClient(config: OBSConfig) {
  if (!singleton) {
    singleton = new OBSClient(config)
  } else {
    singleton.updateConfig(config)
  }
  return singleton
}

export async function disposeOBSClient() {
  if (singleton) {
    await singleton.disconnect()
    singleton = null
  }
}
