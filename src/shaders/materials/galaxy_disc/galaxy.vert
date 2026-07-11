varying vec3 vPosL;
varying vec3 vNormalW;
void main() {
  vPosL = position;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
