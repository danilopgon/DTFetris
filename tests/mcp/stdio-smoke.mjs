// Starts the real MCP executable with pipes. No imported images, user jobs,
// model provider, network calls or desktop automation are involved.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const binary =
  process.argv[2] ??
  path.join(
    repository,
    'src-tauri/target/release',
    process.platform === 'win32' ? 'dtfetris-mcp.exe' : 'dtfetris-mcp',
  )
assert.ok(existsSync(binary), 'Compila primero el servidor con npm run build:mcp.')
const base = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'Temp/opencode')
  : tmpdir()
mkdirSync(base, { recursive: true })
const fixture = mkdtempSync(path.join(base, 'dtfetris-mcp-stdio-'))
try {
  const ingest = path.join(fixture, 'ingesta')
  const workspace = path.join(fixture, 'trabajo')
  mkdirSync(ingest)
  mkdirSync(workspace)
  const request = (id, method, params = {}) => ({ jsonrpc: '2.0', id, method, params })
  const messages = [
    request(1, 'initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'dtfetris-stdio-smoke', version: '1.0' },
    }),
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    request(2, 'tools/list'),
    request(3, 'tools/call', { name: 'get_job', arguments: {} }),
    request(4, 'tools/call', { name: 'list_ingest', arguments: {} }),
    request(5, 'ping'),
  ]
  const output = execFileSync(binary, ['--ingest-dir', ingest, '--workspace', workspace], {
    input: messages.map((message) => JSON.stringify(message)).join('\n') + '\n',
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  })
  // Parsing every stdout line also rejects banners, logs and Content-Length framing.
  const replies = output
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  assert.equal(replies.length, 5, 'Las notificaciones no deben producir una respuesta.')
  const byId = new Map(replies.map((reply) => [reply.id, reply]))
  assert.ok(byId.get(1)?.result?.capabilities?.tools)
  assert.equal(byId.get(1)?.result?.protocolVersion, '2025-11-25')
  const tools = byId.get(2)?.result?.tools
  assert.ok(Array.isArray(tools))
  for (const name of [
    'list_ingest',
    'get_job',
    'import_design',
    'update_design',
    'run_packing',
    'save_job',
    'load_job',
    'export_png',
  ]) {
    assert.ok(
      tools.some((tool) => tool.name === name),
      `Falta la herramienta ${name}.`,
    )
  }
  for (const id of [3, 4]) {
    assert.ok(byId.get(id)?.result, JSON.stringify(byId.get(id)))
    assert.notEqual(byId.get(id).result.isError, true, JSON.stringify(byId.get(id)))
  }
  assert.deepEqual(byId.get(5)?.result, {})
  console.log(
    `MCP stdio real verificado: initialize, tools/list (${tools.length}), get_job, list_ingest y ping; salida JSON-RPC limpia y cierre por EOF.`,
  )
} finally {
  // Only the unique test-owned directory is removed.
  rmSync(fixture, { recursive: true, force: true })
}
