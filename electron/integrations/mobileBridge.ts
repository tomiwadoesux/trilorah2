import crypto from 'node:crypto'

/** Never queue a disconnected phone's commands to be replayed later. */
export class MobileBridge {
  private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>()
  constructor(private send: (request: { id: string; command: string; args: Record<string, unknown>; deadline: number }) => void) {}
  request(command: string, args: Record<string, unknown>) {
    if (this.pending.size >= 12) return Promise.reject(new Error('Desktop is busy. Try again.'))
    return new Promise<unknown>((resolve,reject) => {
      const id = crypto.randomUUID()
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('Desktop did not respond. Check its connection before retrying.')) },5000)
      this.pending.set(id,{resolve,reject,timer})
      try { this.send({id,command,args,deadline:Date.now()+4500}) }
      catch(e) { clearTimeout(timer); this.pending.delete(id); reject(e) }
    })
  }
  reply(id: string, result: unknown, error?: string) {
    const p = this.pending.get(id)
    if (!p) return
    clearTimeout(p.timer); this.pending.delete(id)
    if (error) p.reject(new Error(error)); else p.resolve(result)
  }
}
