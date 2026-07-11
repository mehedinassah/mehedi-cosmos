uniform vec3 uAtmo;
uniform vec3 uSunPos;
uniform vec3 uCameraPos;

varying vec3 vNormalW;
varying vec3 vPosW;

// Rendered on a BackSide shell ~6% larger than the body.
void main() {
  vec3 n = normalize(vNormalW);
  vec3 V = normalize(uCameraPos - vPosW);
  vec3 L = normalize(uSunPos - vPosW);

  // Limb glow: strongest at grazing angles, gone face-on
  float rim = pow(clamp(dot(n, V) + 1.0, 0.0, 1.0), 5.0);
  float day = smoothstep(-0.35, 0.45, dot(n, L));

  vec3 col = uAtmo * rim * (0.15 + 1.1 * day);
  // Sunrise warmth right at the terminator limb
  float terminator = smoothstep(0.0, 0.25, day) * (1.0 - smoothstep(0.25, 0.7, day));
  col += vec3(1.0, 0.55, 0.35) * terminator * rim * 0.6;

  gl_FragColor = vec4(col, clamp(rim * (0.2 + day), 0.0, 1.0));
}
