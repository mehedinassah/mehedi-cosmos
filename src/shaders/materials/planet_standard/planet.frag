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

  vec3 surf = mix(uDeep, uMid, smoothstep(0.34, 0.55, h));
  surf = mix(surf, uHigh, smoothstep(0.62, 0.84, h));
  surf *= 0.78 + 0.32 * detail + 0.12 * micro; // macro + micro relief

  vec3 L = normalize(uSunPos - vPosW);
  vec3 V = normalize(uCameraPos - vPosW);
  float ndl = dot(n, L);
  float day = smoothstep(-0.12, 0.28, ndl);

  // Ocean specular only in lowlands; rock stays rough
  float ocean = 1.0 - smoothstep(0.30, 0.38, h);
  float spec = pow(max(dot(reflect(-L, normalize(vNormalW)), V), 0.0), 48.0) * ocean;

  vec3 col = surf * (0.016 + day * 1.1) + vec3(1.0, 0.94, 0.82) * spec * 0.35 * day;

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

  float fres = pow(1.0 - max(dot(normalize(vNormalW), V), 0.0), 3.2);
  col += uAtmo * fres * (0.12 + 0.85 * day);

  gl_FragColor = vec4(col, 1.0);
}
