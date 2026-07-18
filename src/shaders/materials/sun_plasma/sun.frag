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
  float w = 0.008 - 0.005 * lat * lat; // almost imperceptible; the plasma makes the motion
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

  // MULTI-SCALE convection. The real photosphere is a fine rice-grain
  // granulation (the actual surface texture) riding on coarser mesogranule
  // and supergranule brightness — not a single marble-smooth scale. Two
  // crisp cellular octaves give the "millions of tiny cells" read; the
  // coarser octaves only modulate their brightness.
  float fine = fbm(pw * 30.0 + vec3(0.0, 0.0, tSlow * 2.8));       // rice grains
  float gran = fbm(pw * 13.0 + vec3(3.1, 0.0, tSlow * 1.9));       // granules
  float meso = fbm(p * 4.6 + vec3(3.7, 0.0, tSlow * 1.0));         // mesogranules
  float supr = fbm(p * 1.9 + vec3(0.0, 1.9, tSlow * 0.42));        // supergranulation
  // Crisp cells: bright cores, thin dark intergranular lanes. Contrast is
  // what reads as granulation instead of cloud.
  float cells = smoothstep(0.36, 0.72, fine) * 0.55 + smoothstep(0.34, 0.74, gran) * 0.45;
  float lanes = 1.0 - smoothstep(0.46, 0.30, min(fine, gran)) * 0.72; // deeper dark network

  // Emissive field: constantly varying brightness across the disc
  float emiss = 0.34 + 0.72 * cells;
  emiss *= mix(0.86, 1.16, meso);
  emiss *= mix(0.9, 1.1, supr);
  emiss *= lanes;

  // LARGE-SCALE brightness structure — a real star is NOT uniform: like Earth's
  // clouds, it has broad bright zones and broad dark zones unevenly scattered.
  // Two scales of strong variation: continent-sized patches + medium blotches.
  float patchBig = fbm(p * 0.7 + vec3(2.0, 0.0, uTime * 0.012));
  emiss *= mix(0.68, 1.34, smoothstep(0.30, 0.72, patchBig));
  float blotch = fbm(p * 1.3 + vec3(6.1, 0.0, uTime * 0.02)); // 'patch' is reserved in GLSL
  emiss *= mix(0.66, 1.32, smoothstep(0.26, 0.78, blotch));
  float hotspot = smoothstep(0.74, 0.92, fbm(p * 2.4 + vec3(0.0, 8.4, uTime * 0.03)));
  emiss += hotspot * 0.6; // bright active regions punch out

  // Heartbeat: a near-imperceptible whole-star breath every ~10 s, riding a
  // slower envelope so the pulse itself drifts
  emiss *= 1.0 + 0.045 * sin(uTime * 0.6283) * (0.7 + 0.3 * sin(uTime * 0.11));

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
  // The white threshold sits LOW so the disc center and hot regions clip
  // toward white — most renders are too orange.
  float e = clamp(emiss, 0.0, 1.7);
  // Realistic G-star gradient, NOT saturated orange: dark amber network ->
  // golden-yellow photosphere -> near-white (#FFF8E7) hottest cells.
  vec3 col =
    mix(
      mix(
        mix(vec3(0.70, 0.34, 0.13),            // coolest: dark amber lanes (not red)
            vec3(1.0, 0.64, 0.26), smoothstep(0.0, 0.42, e)),   // amber-orange
        vec3(1.0, 0.85, 0.48), smoothstep(0.42, 0.72, e)),      // golden yellow
      vec3(1.0, 0.973, 0.906), smoothstep(0.72, 1.2, e));       // #FFF8E7 near-white
  col *= 0.5 + 0.95 * e;

  // ---- limb darkening + limb reddening ----
  // Optically thinner at grazing angles: darker AND cooler (redder) at the
  // limb, whiter at disc center — the classic photograph look.
  float mu = clamp(dot(vNormal, vView), 0.0, 1.0);
  float limbDark = mix(0.30, 1.0, pow(mu, 0.45));
  col *= limbDark;
  col = mix(col * vec3(1.0, 0.72, 0.5), col, smoothstep(0.0, 0.45, mu));

  // Corona bleed right at the true limb (anchored to the silhouette).
  // Noise-modulated: a UNIFORM band here reads as a clean drawn outline —
  // the edge must dissolve raggedly into plasma instead.
  float edgeNoise = 0.45 + 0.8 * fbm(p * 7.0 + vec3(0.0, 0.0, uTime * 0.1));
  float coronaEdge = smoothstep(0.16, 0.02, mu) * edgeNoise;
  col += vec3(1.0, 0.84, 0.58) * coronaEdge * 0.65;

  // HDR push: with bloom reduced, the glow comes from raw intensity — the
  // hottest cells punch well above 1.0 so they read as blindingly bright.
  col *= 1.0 + 1.0 * smoothstep(1.0, 1.5, e);

  col *= uIgnite;
  gl_FragColor = vec4(col, 1.0);
}
