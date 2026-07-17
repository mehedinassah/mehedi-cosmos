uniform float uTime;
uniform float uSeed;
uniform float uLife;
varying vec2 vUv;
varying float vAlong;

#include "chunks/noise3d.glsl"

// The rope's substance: plasma streaming along the field line, breaking into
// strands, fading at the footpoints. Never a solid noodle.
void main() {
  // Plasma flows ALONG the loop: animated banding in the u direction
  float flow = fbm(vec3(vAlong * 9.0 - uTime * 0.5, vUv.y * 3.0, uSeed * 7.0));
  float strands = smoothstep(0.28, 0.75, flow);

  // Lifecycle brightness: ignite, burn, die
  float grow = smoothstep(0.0, 0.25, uLife) * (1.0 - smoothstep(0.72, 1.0, uLife));

  // Footpoints glow hotter where the rope meets the photosphere.
  // Bright orange core fading to a softer, slightly reddish outer glow — a
  // limb prominence lifted above the gold photosphere.
  float apex = sin(vAlong * 3.14159);
  vec3 col = mix(vec3(1.0, 0.46, 0.2), vec3(1.0, 0.7, 0.46), strands);
  col *= mix(1.5, 0.9, apex); // brighter at the feet

  // Semi-transparent: a soft glowing arc, not an opaque rope.
  float alpha = (0.1 + 0.72 * strands) * grow;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(col, alpha * 0.95);
}
