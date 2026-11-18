// Minimal stdio MCP client for dtfetris-mcp: runs a list of tool calls in ONE server session.
// Usage: node mcp-client.mjs calls.json   (calls.json = [["tool", {args}], ...]); prints results as JSON.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import readline from 'node:readline'

// Paths come from the environment so no workshop path is hard-coded in the repo.
const exe =
  process.env.DTFETRIS_MCP ??
  `${process.env.LOCALAPPDATA}\\DTFetris\\bin\\dtfetris-mcp.exe`
const ingest = process.env.DTFETRIS_INGEST
const workspace = process.env.DTFETRIS_WORKSPACE
if (!ingest || !workspace) {
  console.error('Define DTFETRIS_INGEST y DTFETRIS_WORKSPACE (carpetas de ingesta y trabajo).')
  process.exit(2)
}
const args = ['--ingest-dir', ingest, '--workspace', workspace]
const calls = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const child = spawn(exe, args, { stdio: ['pipe', 'pipe', 'inherit'] })
const lines = readline.createInterface({ input: child.stdout })
const pending = new Map()
lines.on('line', (line) => {
  const msg = JSON.parse(line)
  pending.get(msg.id)?.(msg)
})
let next = 1
const rpc = (method, params) =>
  new Promise((resolve) => {
    const id = next++
    pending.set(id, resolve)
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
  })
await rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'encargo', version: '1' } })
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
const out = []
for (const [name, a] of calls) {
  const r = await rpc('tools/call', { name, arguments: a })
  const res = r.result?.structuredContent ?? r.error
  out.push({ name, isError: r.result?.isError ?? true, result: res })
  if (r.result?.isError) break
}
child.stdin.end()
console.log(JSON.stringify(out, null, 1))
