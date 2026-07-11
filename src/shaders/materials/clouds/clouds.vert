varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vPosL;

void main() {
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  vPosL = position;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
