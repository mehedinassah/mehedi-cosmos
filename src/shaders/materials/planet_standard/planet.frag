uniform float uTime;
uniform float uSeed;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uHigh;
uniform vec3 uAtmo;
uniform vec3 uSunPos;
uniform vec3 uCameraPos;
uniform float uNight;
uniform float uCloudCover; // 0 = airless, 1 = heavy cloud deck

varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vPosL;

#include "chunks/noise3d.glsl"

void main() {
  vec3 sp = normalize(vPosL);

  // Geologic normal from displaced surface derivatives, blended with the
  // smooth sphere normal — terrain relief without a normal map download.
  vec3 geoN = normalize(cross(dFdx(vPosW), dFdy(vPosW)));
  vec3 n = normalize(mix(normalize(vNormalW), geoN, 0.55));

  float h = fbm(sp * 3.2 + uSeed * 13.7);
  float detail = fbm(sp * 14.0 + uSeed * 7.1);
  float micro = vnoise(sp * 42.0 + uSeed);

  // Ocean depth gradient: shallows brighten toward coasts
  vec3 ocean3 = mix(uDeep * 0.45, uDeep * 1.15, smoothstep(0.12, 0.34, h));
  vec3 surf = mix(ocean3, uMid, smoothstep(0.34, 0.55, h));
  surf = mix(surf, uHigh, smoothstep(0.62, 0.84, h));
  // Climate zones: polar ice caps with noisy, terrain-following edges
  float lat = abs(sp.y);
  float ice = smoothstep(0.72, 0.88, lat + (h - 0.5) * 0.25 + (detail - 0.5) * 0.1);
  surf = mix(surf, vec3(0.93, 0.95, 0.98), ice);
  // Equatorial warming: subtle saturation lift near the equator
  surf *= 1.0 + (1.0 - lat) * 0.06;
  surf *= 0.78 + 0.32 * detail + 0.12 * micro; // macro + micro relief

  vec3 L = normalize(uSunPos - vPosW);
  vec3 V = normalize(uCameraPos - vPosW);
  float ndl = dot(n, L);
  float day = smoothstep(-0.12, 0.28, ndl);

  // Ocean specular only in lowlands; rock stays rough
  float ocean = 1.0 - smoothstep(0.30, 0.38, h);
  float spec = pow(max(dot(reflect(-L, normalize(vNormalW)), V), 0.0), 48.0) * ocean;

  // Earthshine: the atmosphere faintly lights the night side — never dead black
  vec3 nightAmbient = surf * uAtmo * 0.10 * (1.0 - day);
  vec3 col = surf * (0.016 + day * 1.1) + nightAmbient + vec3(1.0, 0.94, 0.82) * spec * 0.35 * day;

  // Cloud shadows: same field as the cloud shell, projected onto the surface
  if (uCloudCover > 0.0) {
    float cloudField = fbm(sp * 4.0 + vec3(uTime * 0.004, 0.0, uTime * 0.0025) + uSeed * 2.0);
    float shadow = smoothstep(0.52, 0.78, cloudField) * uCloudCover;
    col *= 1.0 - shadow * 0.4 * day;
  }

  if (uNight > 0.0) {
    float cities = smoothstep(0.55, 0.9, fbm(sp * 16.0 + uSeed * 3.3)) * smoothstep(0.4, 0.6, h);
    col += vec3(1.0, 0.82, 0.55) * cities * (1.0 - day) * uNight * 1.4; // bloom-gated glow
  }

  // Horizon haze: air whitens the surface itself near the limb
  float ndv = max(dot(normalize(vNormalW), V), 0.0);
  float fres = pow(1.0 - ndv, 3.2);
  float haze = pow(1.0 - ndv, 6.0);
  col += uAtmo * fres * (0.12 + 0.85 * day);
  col = mix(col, uAtmo * (0.2 + 0.9 * day), haze * 0.35 * uCloudCover);

  gl_FragColor = vec4(col, 1.0);
}
