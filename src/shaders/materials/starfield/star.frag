varying float vAlpha;
varying vec3 vColor;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float glow = smoothstep(0.5, 0.0, d);
  glow *= glow;
  gl_FragColor = vec4(vColor, glow * vAlpha);
  if (gl_FragColor.a < 0.008) discard;
}
