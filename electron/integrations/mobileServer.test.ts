import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { MobileServer } from './mobileServer'
import { PairingStore } from './pairing'
import { MobileBridge } from './mobileBridge'

const cleanup: (()=>void)[]=[]
afterEach(()=>{cleanup.splice(0).forEach(fn=>fn());vi.useRealTimers()})
async function setup() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'trilorah-mobile-'))
  const pairing=new PairingStore(dir)
  const execute=vi.fn(async(command:string)=>({command}))
  const server=new MobileServer(pairing,'<h1>Remote</h1>',execute)
  await server.start(0)
  cleanup.push(()=>{server.stop();fs.rmSync(dir,{recursive:true,force:true})})
  const base=`http://127.0.0.1:${server.status().port}`
  const post=async(route:string,body:unknown,token='',headers:Record<string,string>={})=>{
    const res=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...headers},body:JSON.stringify(body)})
    return {status:res.status,body:await res.json() as Record<string, any>}
  }
  return {server,pairing,execute,post,base}
}
describe('private mobile controls',()=>{
  it('requires desktop approval, then revocation immediately blocks commands',async()=>{
    const {server,pairing,execute,post}=await setup()
    expect((await post('/api/command',{command:'live'})).status).toBe(401)
    const request=await post('/api/pair',{code:pairing.generateCode(),name:'Church phone'})
    const id=request.body.id
    expect((await post('/api/pair-status',{id})).body).toEqual({waiting:true})
    expect(pairing.listDevices()).toHaveLength(0)
    expect(server.status().pending[0].name).toBe('Church phone')
    server.approve(id,true)
    const auth=(await post('/api/pair-status',{id})).body
    expect((await post('/api/command',{command:'live'},auth.token)).status).toBe(200)
    expect(execute).toHaveBeenCalledOnce()
    pairing.revoke(auth.deviceId)
    expect((await post('/api/command',{command:'live'},auth.token)).status).toBe(401)
    expect(execute).toHaveBeenCalledOnce()
    expect((await post('/api/pair-status',{id})).status).toBe(403)
  })
  it('rejects hostile origins and DNS rebinding hosts',async()=>{
    const {post,base}=await setup()
    expect((await post('/api/pair',{},'',{Origin:'https://attacker.example'})).status).toBe(403)
    const status=await new Promise<number|undefined>((resolve,reject)=>{
      http.get(base+'/remote',{headers:{Host:'attacker.example'}},res=>{res.resume();resolve(res.statusCode)}).on('error',reject)
    })
    expect(status).toBe(403)
  })
  it('rejects declined and expired pairing without issuing a token',async()=>{
    const {post,pairing,server}=await setup()
    const req=await post('/api/pair',{code:pairing.generateCode()})
    server.approve(req.body.id,false)
    expect((await post('/api/pair-status',{id:req.body.id})).status).toBe(403)
    const req2=await post('/api/pair',{code:pairing.generateCode(15)})
    await new Promise(r=>setTimeout(r,25))
    expect((await post('/api/pair-status',{id:req2.body.id})).status).toBe(403)
    expect(pairing.listDevices()).toEqual([])
  })
  it('rate limits guesses, limits payloads, and exposes only its page',async()=>{
    const {post,base}=await setup()
    for(let i=0;i<8;i++) await post('/api/pair',{code:'bad'})
    expect((await post('/api/pair',{code:'bad'})).status).toBe(429)
    expect((await post('/api/command',{command:'x'.repeat(17000)})).status).toBe(413)
    const page=await fetch(base+'/remote')
    expect(page.status).toBe(200)
    expect(page.headers.get('cache-control')).toBe('no-store')
    expect(await page.text()).toContain('Remote')
    expect((await fetch(base+'/remote-pairing.json')).status).toBe(401)
  })
})
describe('desktop command bridge',()=>{
  it('returns only the matching reply and propagates desktop errors',async()=>{
    let id=''
    const bridge=new MobileBridge(r=>{id=r.id})
    const result=bridge.request('state',{})
    bridge.reply('wrong',42)
    bridge.reply(id,{screen:'black'})
    await expect(result).resolves.toEqual({screen:'black'})
    const failure=bridge.request('live',{})
    bridge.reply(id,null,'Missing verse')
    await expect(failure).rejects.toThrow('Missing verse')
  })
  it('expires requests instead of replaying them after reconnect',async()=>{
    vi.useFakeTimers()
    const send=vi.fn()
    const bridge=new MobileBridge(send)
    const result=bridge.request('live',{})
    const assertion=expect(result).rejects.toThrow('did not respond')
    await vi.advanceTimersByTimeAsync(5001)
    await assertion
    bridge.reply(send.mock.calls[0][0].id,true)
    expect(send).toHaveBeenCalledOnce()
  })
})
