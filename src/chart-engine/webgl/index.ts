// WebGL2 tier (opt-in: "@layr0/chart-engine/webgl").
// Registers the GPU series backend under 'webgl2' so `renderer: 'auto'` picks it
// up wherever WebGL2 is available and `renderer: 'webgl2'` stops throwing.

// The registry MUST come from the base entry, not a deep path: each tier is its
// own rollup bundle, so importing '../render/backend' here would inline a second
// registry Map that `createChart` never reads. `@layr0/chart-engine` is external for
// tier builds. The helpers this file inlines from ../render (candles, bars, line)
// are pure and stateless, so that duplication is only bytes.
import { registerRenderBackend } from '@layr0/chart-engine';
import { createWebGL2Backend } from '../render/webgl';

export { WebGL2Backend, GlDevice, sharedGlDevice, isWebGL2Supported, createWebGL2Backend } from '../render/webgl';
// Type-only: the batch and colour cache a backend and its device expose as
// public members, named here so the API reference has a page to link them to.
export type { GlSurface, VertexBatch, ColorCache, PremultipliedRgba } from '../render/webgl';

export const WEBGL_TIER = 'webgl' as const;

let _registered = false;

/**
 * Register the WebGL2 backend. Called as a side effect when this tier is
 * imported, and exported so a consumer whose bundler tree-shakes a bare
 * `import '@layr0/chart-engine/webgl'` can call it explicitly. Idempotent.
 */
export function registerWebGL2Renderer(): void {
  if (_registered) return;
  _registered = true;
  registerRenderBackend('webgl2', () => createWebGL2Backend());
}

registerWebGL2Renderer();
