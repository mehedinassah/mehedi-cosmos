attribute float aSize;
attribute float aTwinkleSeed;
attribute float aIgniteOrder; // 0–1, stars ignite progressively during formation
uniform float uTime;
uniform float uFormation; // 0 → 1 intro progress
varying float vAlpha;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float twinkle = 0.75 + 0.25 * sin(uTime * (0.6 + aTwinkleSeed * 1.8) + aTwinkleSeed * 40.0);
  float ignited = smoothstep(aIgniteOrder, aIgniteOrder + 0.12, uFormation);
  vAlpha = twinkle * ignited;
  gl_PointSize = aSize * (300.0 / -mv.z) * mix(0.2, 1.0, ignited);
  gl_Position = projectionMatrix * mv;
}
