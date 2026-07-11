varying vec3 vPosW;
varying vec2 vUv;
varying vec3 vPosL;

void main() {
  vUv = uv;
  vPosL = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
