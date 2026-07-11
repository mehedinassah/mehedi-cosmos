uniform vec3 uAtmo;
uniform vec3 uSunPos;
uniform vec3 uCameraPos;

varying vec3 vNormalW;
varying vec3 vPosW;

// BackSide shell, ~6% above surface. Two-band scattering approximation:
// short wavelengths (uAtmo, blue-ish) dominate the lit limb; long
// wavelengths (warm) survive at the terminator — the sunrise ring.
void main() {
  vec3 n = normalize(vNormalW);
  vec3 V = normalize(uCameraPos - vPosW);
  vec3 L = normalize(uSunPos - vPosW);

  // Optical depth proxy: grazing view = long path through the shell
  float grazing = clamp(dot(n, V) + 1.0, 0.0, 1.0);
  float density = pow(grazing, 4.0);
  float thin = pow(grazing, 9.0); // innermost bright line at the limb

  float day = smoothstep(-0.35, 0.45, dot(n, L));
  float term = smoothstep(0.0, 0.28, day) * (1.0 - smoothstep(0.28, 0.75, day));

  // Blue scattering on the day limb, warm band hugging the terminator
  vec3 col = uAtmo * density * (0.10 + 1.25 * day);
  col += vec3(1.0, 0.98, 0.95) * thin * day * 0.9;          // bright inner limb line
  col += vec3(1.0, 0.42, 0.28) * term * density * 1.1;      // sunrise ring
  col += vec3(0.85, 0.35, 0.45) * term * thin * 0.8;        // pink edge at terminator

  gl_FragColor = vec4(col, clamp(density * (0.15 + 0.95 * day) + thin * 0.4 * day, 0.0, 1.0));
}
