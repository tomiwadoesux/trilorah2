precision highp float;

uniform float uChapter;

varying vec2 vUv;
varying float vSeed, vRatio;
varying vec3 vNormal;

#define PI 3.141592653589793

mat4 rotationY( in float angle ) {
	return mat4(	cos(angle),		0,		sin(angle),	0,
			 				0,		1.0,			 0,	0,
					-sin(angle),	0,		cos(angle),	0,
							0, 		0,				0,	1);
}

void main() {
    vUv = uv;

	vec3 transformed = position;
	transformed.y += uChapter * .01;
	
	
	vec4 mvPosition =  vec4(transformed, 1.0);

	vNormal = normalize(normalMatrix * normal);

	mvPosition = instanceMatrix * mvPosition;
	
	vSeed = (instanceMatrix[3][0] + instanceMatrix[3][1]+ instanceMatrix[3][2]);
	vRatio = instanceMatrix[1][1] / instanceMatrix[0][0];
	gl_Position = projectionMatrix * modelViewMatrix * mvPosition;

}