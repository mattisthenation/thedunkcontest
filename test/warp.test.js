// warp.test.js — the rimverse hand-off URL builder (pure; warp.js stays
// DOM-free at import time so node --test can load it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { rimverseUrl } from '../public/js/warp.js';

test('rimverseUrl: dev points at the vite client with warp identity', () => {
  const u = new URL(rimverseUrl('tok-1', 'MATT', {
    hostname: 'localhost', host: 'localhost:3000', protocol: 'http:', href: 'http://localhost:3000/',
  }));
  assert.equal(u.origin, 'http://localhost:5173');
  assert.equal(u.searchParams.get('from'), 'warp');
  assert.equal(u.searchParams.get('token'), 'tok-1');
  assert.equal(u.searchParams.get('name'), 'MATT');
  assert.equal(u.searchParams.get('server'), null); // dev default ws://localhost:8081 already works
});

test('rimverseUrl: prod is same-origin /rimverse/ with a same-host wss server override', () => {
  const u = new URL(rimverseUrl('tok-2', 'MATT', {
    hostname: 'thedunkcontest.com', host: 'thedunkcontest.com', protocol: 'https:', href: 'https://thedunkcontest.com/',
  }));
  assert.equal(u.origin, 'https://thedunkcontest.com');
  assert.equal(u.pathname, '/rimverse/');
  assert.equal(u.searchParams.get('server'), 'wss://thedunkcontest.com/rimverse/ws');
  assert.equal(u.searchParams.get('token'), 'tok-2');
});
