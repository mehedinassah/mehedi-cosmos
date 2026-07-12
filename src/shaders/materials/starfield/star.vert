attribute float aSize;
attribute float aTwinkleSeed;
attribute float aIgniteOrder; // 0–1, progressive ignition during formation
attribute vec3 aColor;
uniform float uTime;
uniform float uFormation; // 0 → 1 intro progress
uniform float uWobble;    // positional drift amplitude (dust > 0, stars = 0)
varying float vAlpha;
varying vec3 vColor;

void main() {
  vec3 p = position;
  if (uWobble > 0.0) {
    p += vec3(
      sin(uTime * 0.05 + aTwinkleSeed * 40.0),
      sin(uTime * 0.04 + aTwinkleSeed * 60.0),
      cos(uTime * 0.045 + aTwinkleSeed * 50.0)
    ) * uWobble;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float twinkle = 0.75 + 0.25 * sin(uTime * (0.6 + aTwinkleSeed * 1.8) + aTwinkleSeed * 40.0);
  float ignited = smoothstep(aIgniteOrder, aIgniteOrder + 0.12, uFormation);
  vAlpha = twinkle * ignited;
  vColor = aColor;
  // Capped so near passes during the descent read as bright orbs, never
  // screen-swallowing blobs (uncapped, a star skimmed at 300u fills 500px+)
  gl_PointSize = min(aSize * (300.0 / -mv.z), 420.0) * mix(0.2, 1.0, ignited);
  gl_Position = projectionMatrix * mv;
}
