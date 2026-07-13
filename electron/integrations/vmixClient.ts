export interface VMixConfig {
  host: string
  port: number
}

export interface VMixInput {
  key: string
  number: number
  type: string
  title: string
}

export interface VMixStatus {
  reachable: boolean
  streaming: boolean
  recording: boolean
  active: number
  preview: number
  inputs: VMixInput[]
}

export class VMixClient {
  private config: VMixConfig

  constructor(config: VMixConfig) {
    this.config = config
  }

  updateConfig(config: VMixConfig) {
    this.config = config
  }

  baseUrl() {
    return `http://${this.config.host}:${this.config.port}`
  }

  async call(params: Record<string, string | number>) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) qs.set(k, String(v))
    const url = `${this.baseUrl()}/api?${qs.toString()}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`vMix API ${res.status}: ${res.statusText}`)
    return await res.text()
  }

  async ping() {
    try {
      const res = await fetch(`${this.baseUrl()}/api`)
      return res.ok
    } catch {
      return false
    }
  }

  async getStatus(): Promise<VMixStatus> {
    let xml: string
    try {
      const res = await fetch(`${this.baseUrl()}/api`)
      if (!res.ok) throw new Error(`vMix unreachable (${res.status})`)
      xml = await res.text()
    } catch {
      return {
        reachable: false,
        streaming: false,
        recording: false,
        active: 0,
        preview: 0,
        inputs: []
      }
    }
    const streaming = /<streaming>True<\/streaming>/i.test(xml)
    const recording = /<recording>True<\/recording>/i.test(xml)
    const active = parseInt(xml.match(/<active>(\d+)<\/active>/i)?.[1] ?? '0', 10)
    const preview = parseInt(xml.match(/<preview>(\d+)<\/preview>/i)?.[1] ?? '0', 10)
    const inputs: VMixInput[] = []
    const inputRegex = /<input\s+key="([^"]+)"\s+number="(\d+)"\s+type="([^"]+)"[^>]*>([^<]+)<\/input>/gi
    let match: RegExpExecArray | null
    while ((match = inputRegex.exec(xml)) !== null) {
      inputs.push({
        key: match[1],
        number: parseInt(match[2], 10),
        type: match[3],
        title: match[4].trim()
      })
    }
    return { reachable: true, streaming, recording, active, preview, inputs }
  }

  async setActiveInput(input: number | string) {
    await this.call({ Function: 'ActiveInput', Input: input })
  }

  async setPreviewInput(input: number | string) {
    await this.call({ Function: 'PreviewInput', Input: input })
  }

  async cut() {
    await this.call({ Function: 'Cut' })
  }

  async fade(durationMs = 500) {
    await this.call({ Function: 'Fade', Duration: durationMs })
  }

  async overlayInputIn(channel: number, input: number | string) {
    await this.call({ Function: `OverlayInput${channel}In`, Input: input })
  }

  async overlayInputOut(channel: number) {
    await this.call({ Function: `OverlayInput${channel}Out` })
  }

  async startStreaming() {
    await this.call({ Function: 'StartStreaming' })
  }

  async stopStreaming() {
    await this.call({ Function: 'StopStreaming' })
  }

  async startRecording() {
    await this.call({ Function: 'StartRecording' })
  }

  async stopRecording() {
    await this.call({ Function: 'StopRecording' })
  }

  /**
   * Send text to a GT (graphics) title input — used to push a verse into
   * an existing vMix title template. The title input must be configured
   * in vMix beforehand with a text field named `selectedName`.
   */
  async setTitleText(input: number | string, selectedName: string, value: string) {
    await this.call({
      Function: 'SetText',
      Input: input,
      SelectedName: selectedName,
      Value: value
    })
  }
}

let singleton: VMixClient | null = null

export function getVMixClient(config: VMixConfig) {
  if (!singleton) {
    singleton = new VMixClient(config)
  } else {
    singleton.updateConfig(config)
  }
  return singleton
}
