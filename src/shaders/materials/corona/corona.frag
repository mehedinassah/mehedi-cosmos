uniform float uTime;
uniform vec3 uCameraPos;
uniform float uIgnite;
uniform vec3 uCol1;      // wisp color (dim end)
uniform vec3 uCol2;      // wisp color (bright end)
uniform float uAlpha;    // overall strength
uniform float uFreq;     // streamer angular frequency
uniform float uSpeed;    // evolution speed
uniform float uRimPow;   // rim falloff exponent
uniform float uBase;     // base glow under the wisps (0 = pure streamers)
uniform float uBreathe;  // slow volumetric density breathing (~1 +- a few %)
uniform float uMuHi;     // 1 = paint all the way over the disc (thin shells);
                         // <1 = wisps live in an annulus and VANISH in front
                         // of the disc (large shells read as a dome otherwise)

varying vec3 vNormalW;
varying vec3 vPosL;

#include "chunks/noise3d.glsl"

// Parametric plasma shell. One program, three roles:
//   chromosphere — thin reddish-pink rim hugging the photosphere
//   inner corona — bright gold streamers just off the limb
//   outer corona — huge, faint, IRREGULAR wisps reaching several radii out;
//                  noise-modulated so its silhouette is never a circle
void main() {
  vec3 n = normalize(vNormalW);
  vec3 sp = normalize(vPosL);

  // 3D noise on the sphere DIRECTION: seamless everywhere, no pole pinch
  // (angular (cos,sin,y) coordinates spin infinitely fast at the poles and
  // rendered as streak fountains at the top and bottom of the star).
  float t = uTime * uSpeed;
  float streamers = fbm(sp * uFreq + vec3(t * 0.4, t * 0.3, t * 0.7));
  // Second octave of structure so wisps split and branch instead of banding
  streamers += 0.5 * fbm(sp * uFreq * 2.7 + vec3(11.0 + t, 3.0, t * 1.4));
  streamers = pow(smoothstep(0.45, 1.25, streamers), 1.6);

  // Large-scale LOBES: whole sectors of the corona are brighter and reach
  // farther while others are dim and short — real coronas are lopsided, not
  // a Gaussian ring. Very low frequency so it reads as structure, not noise.
  float lobe = 0.55 + 0.9 * fbm(sp * 0.8 + vec3(4.0, 0.0, t * 0.5));
  streamers *= lobe;

  vec3 V = normalize(uCameraPos - vPosL);
  // BackSide shell seen from outside: mu ~ 0 at the shell's own silhouette,
  // rising toward 1 at its center (in front of the star). Feather in from
  // the silhouette; for LARGE shells also feather OUT before the disc so
  // the shell never paints a dome over the photosphere and the scene.
  float mu = abs(dot(n, V));
  float rim;
  if (uMuHi >= 0.999) {
    // Thin shell hugging the photosphere: band between its own silhouette
    // and the disc edge, painted all the way in.
    rim = pow(smoothstep(0.02, 0.5, mu), uRimPow);
  } else {
    // Large shell: the corona PEAKS right at the disc edge (mu ~ uMuHi, the
    // photosphere's edge as seen through this shell) and decays continuously
    // outward toward the shell silhouette (mu -> 0) — light leaving the
    // star, never a detached ring and never a dome over the disc.
    // The REACH varies with the wisps themselves: bright streamers push far
    // out, gaps collapse toward the limb — the silhouette is turbulent,
    // never a Gaussian halo.
    float reach = uRimPow * mix(1.9, 0.62, streamers);
    rim = (1.0 - smoothstep(uMuHi * 0.985, uMuHi, mu)) *
          pow(smoothstep(0.0, uMuHi * 0.92, mu), reach);
  }

  vec3 col = mix(uCol1, uCol2, streamers);
  float alpha = (uBase + 1.1 * streamers) * rim * uAlpha * uIgnite * uBreathe;
  gl_FragColor = vec4(col, alpha);
}
