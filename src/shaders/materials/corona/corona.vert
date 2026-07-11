varying vec3 vNormalW;
varying vec3 vPosL;
void main() {
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vPosL = position;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
