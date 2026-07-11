'use client';

import type { GpuTier } from '@/state/qualityStore';

/** Static boot probe — blueprint §9.2.1. Cheap heuristics; dynamic loop refines later. */
export function probeCapabilities(): { tier: GpuTier; webgl2: boolean } {
  if (typeof window === 'undefined') return { tier: 2, webgl2: true };

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) return { tier: 0, webgl2: false };

  let renderer = '';
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  if (dbg) renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)).toLowerCase();

  const mem = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const isMobile = /android|iphone|ipad|mobile/i.test(navigator.userAgent);
  const dGpu = /(nvidia|radeon|geforce|rtx|gtx|rx\s?\d{3,4})/.test(renderer);
  const weakGpu = /(mali|adreno\s[1-5]|powervr|swiftshader|llvmpipe)/.test(renderer);

  let tier: GpuTier;
  if (weakGpu || mem <= 2) tier = 1;
  else if (isMobile) tier = 1;
  else if (dGpu && mem >= 8) tier = 3;
  else tier = 2;

  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return { tier, webgl2: true };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
