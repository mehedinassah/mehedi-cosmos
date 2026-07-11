// Simplex-style value noise + fbm — shared chunk (blueprint §8.1)
vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = dot(hash33(i + vec3(0,0,0)), f - vec3(0,0,0));
  float n100 = dot(hash33(i + vec3(1,0,0)), f - vec3(1,0,0));
  float n010 = dot(hash33(i + vec3(0,1,0)), f - vec3(0,1,0));
  float n110 = dot(hash33(i + vec3(1,1,0)), f - vec3(1,1,0));
  float n001 = dot(hash33(i + vec3(0,0,1)), f - vec3(0,0,1));
  float n101 = dot(hash33(i + vec3(1,0,1)), f - vec3(1,0,1));
  float n011 = dot(hash33(i + vec3(0,1,1)), f - vec3(0,1,1));
  float n111 = dot(hash33(i + vec3(1,1,1)), f - vec3(1,1,1));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  ) * 0.5 + 0.5;
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < OCTAVES; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec3(17.1);
    a *= 0.5;
  }
  return v;
}
