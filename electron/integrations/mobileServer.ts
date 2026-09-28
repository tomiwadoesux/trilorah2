import http from 'node:http'
import crypto from 'node:crypto'
import { networkInterfaces } from 'node:os'
import type { PairingStore } from './pairing'

/** Private LAN endpoint. Public congregation links never pass through here. */
export class MobileServer {
  private server: http.Server | null = null
  private pending = new Map<string, { name: string; code: string; expires: number; approved?: boolean }>()
  private attempts = new Map<string, { count: number; until: number }>()
  private port = 0
  private error: string | null = null
  private changing = false
  constructor(private pairing: PairingStore, private html: string | (() => string),
    private execute: (command: string, args: Record<string, unknown>) => Promise<unknown>) {}

  status() {
    this.expire()
    const addresses = Object.values(networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a!.address)
    return { running: !!this.server?.listening, error: this.error, port: this.port,
      urls: addresses.map(a => `http://${a}:${this.port}/remote`),
      pending: [...this.pending].filter(([,p]) => p.approved === undefined).map(([id,p]) => ({ id, name: p.name, expiresAt: p.expires })),
      devices: this.pairing.listDevices() }
  }
  approve(id: string, allow: boolean) {
    this.expire()
    const p = this.pending.get(id)
    if (p) p.approved = allow
    return !!p
  }
  private expire() {
    for (const [id,p] of this.pending) if (p.expires < Date.now()) this.pending.delete(id)
    for (const [ip,a] of this.attempts) if (a.until < Date.now()) this.attempts.delete(ip)
  }
  async start(port = 8082) {
    if (this.server) return
    this.server = http.createServer((req,res) => { void this.handle(req,res) })
    this.server.requestTimeout = 10_000
    this.server.headersTimeout = 10_000
    await new Promise<void>((resolve,reject) => {
      this.server!.once('error', reject)
      this.server!.listen(port, '0.0.0.0', () => resolve())
    }).catch(e => { this.error = String(e); this.server?.close(); this.server = null; throw e })
    const address = this.server!.address()
    this.port = typeof address === 'object' && address ? address.port : port
    this.error = null
  }
  stop() { this.server?.closeAllConnections(); this.server?.close(); this.server = null; this.pending.clear() }
  private async handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const reply = (status: number, data: unknown) => { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(data)) }
    res.setHeader('Cache-Control','no-store')
    res.setHeader('X-Content-Type-Options','nosniff')
    res.setHeader('X-Frame-Options','DENY')
    res.setHeader('Referrer-Policy','no-referrer')
    try {
      this.expire()
      const host = req.headers.host || ''
      const allowed = new Set(['127.0.0.1', 'localhost', ...Object.values(networkInterfaces()).flat().filter(Boolean).map(a => a!.address)])
      if (!allowed.has(host.split(':')[0]) || (req.headers.origin && req.headers.origin !== `http://${host}`)) return reply(403,{error:'Use the connection address shown on the desktop.'})
      const url = new URL(req.url || '/', `http://${host}`)
      if (req.method === 'GET' && ['/','/remote'].includes(url.pathname)) {
        res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
        const html=typeof this.html==='function' ? this.html() : this.html
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}); res.end(html); return
      }
      let body: Record<string, unknown> = {}
      if (req.method === 'POST') {
        let raw = ''
        for await (const chunk of req) { raw += chunk.toString(); if (Buffer.byteLength(raw) > 16384) { reply(413,{error:'Request too large'}); return } }
        body = JSON.parse(raw || '{}')
        if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400,{error:'Invalid request'})
      }
      if (url.pathname === '/api/pair' && req.method === 'POST') {
        const ip = req.socket.remoteAddress || ''
        const rate = this.attempts.get(ip) || {count:0,until:Date.now()+60_000}
        this.attempts.set(ip,rate)
        if (++rate.count > 8) return reply(429,{error:'Wait one minute before trying again.'})
        const active = this.pairing.currentCode()
        if (!active || body.code !== active.code) return reply(401,{error:'Code expired or incorrect. Generate a new code on the desktop.'})
        if (this.pending.size >= 8) return reply(429,{error:'Too many pending requests.'})
        const id = crypto.randomBytes(32).toString('hex')
        this.pending.set(id,{name:String(body.name || 'Phone').slice(0,80), code:active.code,expires:active.expiresAt})
        return reply(200,{id})
      }
      if (url.pathname === '/api/pair-status' && req.method === 'POST') {
        const id = String(body.id || '')
        const p = this.pending.get(id)
        if (!p || p.approved === false) return reply(403,{error:'Pairing declined or expired.'})
        if (!p.approved) return reply(200,{waiting:true})
        const paired = this.pairing.redeem(p.code,p.name)
        this.pending.delete(id)
        if (!paired) return reply(403,{error:'Code expired. Please pair again.'})
        return reply(200,paired)
      }
      const token = req.headers.authorization?.replace(/^Bearer /,'') || ''
      if (!this.pairing.verify(token)) return reply(401,{error:'Pair this phone with the desktop.'})
      if (url.pathname === '/api/command' && req.method === 'POST') {
        const command=String(body.command || '')
        const mutation=!['state','library','search','suggest','thumbnail'].includes(command)
        if (mutation && this.changing) return reply(409,{error:'Another control is being applied. Try again in a moment.'})
        if (mutation) this.changing=true
        try {
          const result = await this.execute(command, (body.args && typeof body.args === 'object' && !Array.isArray(body.args) ? body.args : {}) as Record<string,unknown>)
          return reply(200,{result})
        } finally { if(mutation) this.changing=false }
      }
      return reply(404,{error:'Not found'})
    } catch(e) { if (!res.headersSent) reply(400,{error:e instanceof Error ? e.message : 'Request failed'}) }
  }
}
