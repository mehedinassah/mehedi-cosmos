varying float vAlpha;

void main() {
  // Soft circular sprite, slight warm-cool variation by alpha
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float glow = smoothstep(0.5, 0.0, d);
  glow *= glow;
  vec3 col = mix(vec3(0.78, 0.84, 1.0), vec3(1.0, 0.96, 0.88), vAlpha);
  gl_FragColor = vec4(col, glow * vAlpha);
  if (gl_FragColor.a < 0.01) discard;
}
