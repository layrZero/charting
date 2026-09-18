#!/usr/bin/env node

import http from 'node:http';
import net from 'node:net';

const host = '127.0.0.1';
const port = Number(process.env.KRONOS_PORT || 8001);
const timeoutMs = 1200;

function probePort() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => finish({ state: 'free' }));
    socket.once('connect', () => finish({ state: 'occupied' }));
    socket.once('error', (error) => finish({ state: error.code === 'ECONNREFUSED' ? 'free' : 'occupied' }));
  });
}

function probeHealth() {
  return new Promise((resolve) => {
    const request = http.get({ host, port, path: '/health', timeout: timeoutMs }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          const payload = JSON.parse(body);
          resolve(response.statusCode >= 200 && response.statusCode < 300 && payload.status === 'ok' && payload.local_only === true);
        } catch {
          resolve(false);
        }
      });
    });
    request.on('timeout', () => { request.destroy(); resolve(false); });
    request.on('error', () => resolve(false));
  });
}

const portState = await probePort();
if (portState.state === 'free') {
  process.stdout.write('START\n');
  process.exit(0);
}

if (await probeHealth()) {
  process.stdout.write('REUSE\n');
  process.exit(0);
}

console.error(`Port ${port} is occupied, but ${host}:${port}/health is not a healthy local Kronos service.`);
console.error('Stop the owning process or choose another Kronos port; no process was terminated automatically.');
process.exit(2);
