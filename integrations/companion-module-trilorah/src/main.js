/**
 * Trilorah × Bitfocus Companion (BUILD-MAP 2.13).
 *
 * Speaks the app's own paired WebSocket protocol (ws://<laptop>:8081,
 * electron/integrations/websocketServer.ts). First run: enter the 6-digit
 * code from Settings → Remote; the module redeems it once and keeps the
 * issued token in its config, so nothing in the church's booth ever has
 * an open, unauthenticated control port.
 */
const { InstanceBase, InstanceStatus, Regex, runEntrypoint, combineRgb } = require('@companion-module/base')
const WebSocket = require('ws')

const COMMANDS = [
  ['startListening', 'Start listening'],
  ['stopListening', 'Stop listening'],
  ['approvePending', 'Approve pending verse'],
  ['dismissPending', 'Dismiss pending verse'],
  ['nextVerse', 'Next verse'],
  ['previousVerse', 'Previous verse'],
  ['clearScreen', 'Clear screen'],
  ['blackScreen', 'Black (toggle)'],
  ['showLogo', 'Logo (toggle)'],
  ['dismissAlert', 'Dismiss alert'],
]

class TrilorahInstance extends InstanceBase {
  constructor(internal) {
    super(internal)
    this.ws = null
    this.state = { listening: false, pendingRef: null, liveRef: null, autoMode: false, screen: 'live', alert: null }
    this.reconnectTimer = null
  }

  getConfigFields() {
    return [
      { type: 'textinput', id: 'host', label: 'Trilorah laptop IP', width: 8, regex: Regex.HOSTNAME, default: '127.0.0.1' },
      { type: 'number', id: 'port', label: 'Port', width: 4, min: 1, max: 65535, default: 8081 },
      { type: 'textinput', id: 'pairCode', label: 'Pairing code (Settings → Remote, first run only)', width: 6 },
      { type: 'textinput', id: 'token', label: 'Token (filled automatically after pairing)', width: 6 },
    ]
  }

  async init(config) {
    this.config = config
    this.initActions()
    this.initFeedbacks()
    this.initVariables()
    this.connect()
  }

  async configUpdated(config) {
    this.config = config
    this.connect()
  }

  async destroy() {
    this.disconnect()
  }

  /* ---------------- socket ---------------- */

  connect() {
    this.disconnect()
    const url = `ws://${this.config.host || '127.0.0.1'}:${this.config.port || 8081}`
    this.updateStatus(InstanceStatus.Connecting)
    const ws = new WebSocket(url)
    this.ws = ws
    ws.on('open', () => {
      if (this.config.token) ws.send(JSON.stringify({ type: 'auth', token: this.config.token }))
      else if (this.config.pairCode) ws.send(JSON.stringify({ type: 'pair', code: this.config.pairCode, deviceName: 'Companion' }))
      else this.updateStatus(InstanceStatus.BadConfig, 'Enter the pairing code from Settings → Remote')
    })
    ws.on('message', (raw) => {
      let msg
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }
      if (msg.type === 'authenticated') {
        if (msg.token && msg.token !== this.config.token) {
          // Keep the token, drop the one-shot code.
          this.config = { ...this.config, token: msg.token, pairCode: '' }
          this.saveConfig(this.config)
        }
        this.updateStatus(InstanceStatus.Ok)
        if (msg.state) this.applyState(msg.state)
      } else if (msg.type === 'state' && msg.state) {
        this.applyState(msg.state)
      } else if (msg.type === 'error' && msg.code === 'unauthorized') {
        this.updateStatus(InstanceStatus.AuthenticationFailure, 'Not paired — get a fresh code from Settings → Remote')
      }
    })
    ws.on('close', () => {
      this.updateStatus(InstanceStatus.Disconnected)
      this.reconnectTimer = setTimeout(() => this.connect(), 3000)
    })
    ws.on('error', (e) => this.log('debug', `socket error: ${e.message}`))
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
    if (this.ws) {
      this.ws.removeAllListeners()
      try {
        this.ws.close()
      } catch {
        /* already gone */
      }
      this.ws = null
    }
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload))
  }

  applyState(state) {
    this.state = { ...this.state, ...state }
    this.setVariableValues({
      listening: this.state.listening ? 'on' : 'off',
      pending: this.state.pendingRef || '',
      live: this.state.liveRef || '',
      screen: this.state.screen || 'live',
      alert: this.state.alert ? this.state.alert.text : '',
      auto_mode: this.state.autoMode ? 'on' : 'off',
    })
    this.checkFeedbacks()
  }

  /* ---------------- actions / feedbacks / variables ---------------- */

  initActions() {
    const actions = {}
    for (const [id, name] of COMMANDS) {
      actions[id] = { name, options: [], callback: () => this.send({ type: id }) }
    }
    actions.setAutoMode = {
      name: 'Auto mode',
      options: [{ type: 'checkbox', id: 'enabled', label: 'Enabled', default: true }],
      callback: (a) => this.send({ type: 'setAutoMode', enabled: !!a.options.enabled }),
    }
    actions.typeReference = {
      name: 'Show a reference',
      options: [{ type: 'textinput', id: 'ref', label: 'Reference', default: 'John 3:16', useVariables: true }],
      callback: async (a) => this.send({ type: 'typeReference', ref: await this.parseVariablesInString(a.options.ref) }),
    }
    actions.showAlert = {
      name: 'Message alert',
      options: [
        { type: 'textinput', id: 'text', label: 'Text', default: '', useVariables: true },
        { type: 'number', id: 'seconds', label: 'Seconds (0 = default)', default: 0, min: 0, max: 600 },
        {
          type: 'dropdown',
          id: 'target',
          label: 'Screens',
          default: 'all',
          choices: [
            { id: 'all', label: 'All' },
            { id: 'projector', label: 'Projector' },
            { id: 'stream', label: 'Stream' },
            { id: 'stage', label: 'Stage' },
          ],
        },
      ],
      callback: async (a) =>
        this.send({
          type: 'showAlert',
          text: await this.parseVariablesInString(a.options.text),
          durationSec: a.options.seconds > 0 ? a.options.seconds : undefined,
          target: a.options.target,
        }),
    }
    this.setActionDefinitions(actions)
  }

  initFeedbacks() {
    this.setFeedbackDefinitions({
      listening: {
        type: 'boolean',
        name: 'Listening',
        defaultStyle: { bgcolor: combineRgb(0, 120, 60), color: combineRgb(255, 255, 255) },
        options: [],
        callback: () => !!this.state.listening,
      },
      pending: {
        type: 'boolean',
        name: 'A verse is awaiting approval',
        defaultStyle: { bgcolor: combineRgb(200, 140, 0), color: combineRgb(0, 0, 0) },
        options: [],
        callback: () => !!this.state.pendingRef,
      },
      screen: {
        type: 'boolean',
        name: 'Screen state is…',
        defaultStyle: { bgcolor: combineRgb(180, 0, 0), color: combineRgb(255, 255, 255) },
        options: [
          {
            type: 'dropdown',
            id: 'state',
            label: 'State',
            default: 'black',
            choices: ['live', 'clear', 'black', 'logo'].map((id) => ({ id, label: id })),
          },
        ],
        callback: (fb) => this.state.screen === fb.options.state,
      },
      alert: {
        type: 'boolean',
        name: 'An alert is on screen',
        defaultStyle: { bgcolor: combineRgb(255, 255, 255), color: combineRgb(0, 0, 0) },
        options: [],
        callback: () => !!this.state.alert,
      },
    })
  }

  initVariables() {
    this.setVariableDefinitions([
      { variableId: 'listening', name: 'Listening (on/off)' },
      { variableId: 'pending', name: 'Pending reference' },
      { variableId: 'live', name: 'Live reference' },
      { variableId: 'screen', name: 'Screen state' },
      { variableId: 'alert', name: 'Alert text' },
      { variableId: 'auto_mode', name: 'Auto mode (on/off)' },
    ])
  }
}

runEntrypoint(TrilorahInstance, [])
