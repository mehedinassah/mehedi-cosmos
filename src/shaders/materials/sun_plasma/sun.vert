varying vec3 vNormal;
varying vec3 vPos;
varying vec3 vView;
varying vec2 vUv;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  vPos = position;
  vUv = uv;
  gl_Position = projectionMatrix * mv;
}
