import noise3d from './chunks/noise3d.glsl';

/**
 * Minimal build-side #include resolver + quality defines (blueprint §8.1).
 * Chunks registered here; materials reference them via #include "chunks/x.glsl".
 */
const CHUNKS: Record<string, string> = {
  'chunks/noise3d.glsl': noise3d,
};

export function assembleShader(src: string, defines: Record<string, number | string> = {}): string {
  const defineBlock = Object.entries(defines)
    .map(([k, v]) => `#define ${k} ${v}`)
    .join('\n');
  const resolved = src.replace(/#include\s+"([^"]+)"/g, (_, path: string) => {
    const chunk = CHUNKS[path];
    if (!chunk) throw new Error(`[shaders] unknown chunk: ${path}`);
    return chunk;
  });
  return `${defineBlock}\n${resolved}`;
}
