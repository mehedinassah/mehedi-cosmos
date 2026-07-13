uniform float uTime;
uniform float uIgnite;
uniform sampler2D uMap;
varying vec3 vNormal;
varying vec3 vPos;
varying vec3 vView;
varying vec2 vUv;

#include "chunks/noise3d.glsl"

// The photosphere — boiling plasma, never a still image.
//
//  * Differential rotation: the equator turns faster than the poles, so the
//    whole surface slowly shears — the single strongest "it's alive" cue.
//  * Domain-warped FBM granulation, evolved through TIME as a noise
//    dimension: the pattern never translates, it BOILS, and never repeats.
//  * Sunspot groups in the real activity belts (+-10..35 deg latitude),
//    umbra + penumbra, slowly forming and dissolving.
//  * Blackbody-ish ramp: the hottest cells are nearly WHITE, cooling through
//    yellow and gold to deep orange-red in the dark convection lanes.
//  * HDR output: the brightest cells exceed 1.0 so ONLY they catch bloom.

// Rotate around Y by a latitude-dependent angle (differential rotation).
vec3 diffRotate(vec3 p, float t) {
  float lat = p.y; // p is normalized: y = sin(latitude)
  float w = 0.014 - 0.008 * lat * lat; // equator fast, poles slow
  float a = t * w;
  float c = cos(a), s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

void main() {
  vec3 p0 = normalize(vPos);
  vec3 p = diffRotate(p0, uTime);

  // ---- granulation: boiling convection cells ----
  // Time lives INSIDE the noise domain, so cells brighten, split and
  // dissolve in place (boiling soup) instead of sliding sideways (lava).
  float tSlow = uTime * 0.045;
  vec3 warp = vec3(
    fbm(p * 3.0 + vec3(0.0, 0.0, tSlow * 0.7)),
    fbm(p * 3.0 + vec3(5.2, 1.3, tSlow * 0.7)),
    fbm(p * 3.0 + vec3(2.8, 7.1, tSlow * 0.7))
  ) - 0.5;
  vec3 pw = p + warp * 0.35;

  float gran = fbm(pw * 26.0 + vec3(0.0, 0.0, tSlow * 2.2));       // fine cells
  float meso = fbm(pw * 9.0 + vec3(3.7, 0.0, tSlow * 1.2));        // mesogranules
  float supr = fbm(p * 2.6 + vec3(0.0, 1.9, tSlow * 0.45));        // supergranulation
  // Sharpen the fine cells: bright centers, thin dark intergranular lanes
  float cells = smoothstep(0.32, 0.78, gran);
  float lanes = 1.0 - smoothstep(0.42, 0.30, gran) * 0.55;

  // Emissive field: constantly varying brightness across the disc
  float emiss = 0.42 + 0.62 * cells;
  emiss *= mix(0.82, 1.18, meso);
  emiss *= mix(0.88, 1.12, supr);
  emiss *= lanes;

  // ---- active regions: bright faculae knots ----
  float activity = smoothstep(0.68, 0.94, fbm(p * 5.5 + vec3(0.0, 0.0, tSlow * 0.5)));
  emiss += activity * 0.5;

  // ---- sunspots: dark groups in the activity belts, slowly evolving ----
  float lat = p0.y;
  float belt = smoothstep(0.10, 0.22, abs(lat)) * (1.0 - smoothstep(0.42, 0.62, abs(lat)));
  float spotField = fbm(p * 3.4 + vec3(9.3, 4.1, uTime * 0.006));
  float umbra = smoothstep(0.70, 0.80, spotField) * belt;
  float penumbra = smoothstep(0.62, 0.72, spotField) * belt;
  emiss *= 1.0 - penumbra * 0.45;
  emiss *= 1.0 - umbra * 0.85;

  // ---- the real photograph, demoted to a faint identity base ----
  vec3 tex = texture2D(uMap, vUv + vec2(uTime * 0.0012, 0.0)).rgb;
  emiss *= 0.82 + 0.36 * dot(tex, vec3(0.333));

  // ---- blackbody-ish color ramp: white -> yellow -> gold -> orange -> red ----
  float e = clamp(emiss, 0.0, 1.6);
  vec3 col =
    mix(
      mix(
        mix(vec3(0.55, 0.12, 0.03),            // coolest: deep red lanes
            vec3(1.0, 0.42, 0.10), smoothstep(0.0, 0.45, e)),   // orange
        vec3(1.0, 0.78, 0.35), smoothstep(0.45, 0.85, e)),      // gold
      vec3(1.0, 0.98, 0.90), smoothstep(0.85, 1.45, e));        // near-white
  col *= 0.5 + 0.9 * e;

  // ---- limb darkening + limb reddening ----
  // Optically thinner at grazing angles: darker AND cooler (redder) at the
  // limb, whiter at disc center — the classic photograph look.
  float mu = clamp(dot(vNormal, vView), 0.0, 1.0);
  float limbDark = mix(0.30, 1.0, pow(mu, 0.45));
  col *= limbDark;
  col = mix(col * vec3(1.0, 0.72, 0.5), col, smoothstep(0.0, 0.45, mu));

  // Corona bleed right at the true limb (anchored to the silhouette)
  float coronaEdge = smoothstep(0.14, 0.02, mu);
  col += vec3(1.0, 0.82, 0.55) * coronaEdge * 0.9;

  // HDR push: only the hottest cells cross the bloom threshold
  col *= 1.0 + 0.55 * smoothstep(1.05, 1.5, e) ;

  col *= uIgnite;
  gl_FragColor = vec4(col, 1.0);
}
