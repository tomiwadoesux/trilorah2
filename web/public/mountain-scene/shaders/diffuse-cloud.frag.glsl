precision highp float;

uniform float uTime, uTransition;
uniform vec3 uDarkColor, uLightColor;
uniform vec2 uResolution;
uniform sampler2D tPerlin, tNoise, tMouse;
varying float vSeed;
varying vec2 vUv;
varying vec3 vNormal;

void main() {

	vec2 sUv = gl_FragCoord.xy / uResolution;
	float mouse = clamp(texture2D(tMouse, sUv + .1 * (texture2D(tNoise, 0.4 * vUv).g - .5)).r, 0., 1.);
	
	float time = uTime * .5;
	float strength = 1.;
	vec2 dUv = vUv;
	dUv += .01 * mouse;

	dUv += .2 * (texture2D(tNoise, vUv * .2 + .02 * uTime).r - .5);
	dUv += .1 * (texture2D(tNoise, vUv - .01 * uTime).r - .5);
	float cloud = smoothstep(.5, .1, length(dUv - .5));

	vec3 color = uLightColor * (.9 + .3 * cloud);

	float alpha = 1.;
	alpha *= smoothstep(1., 0.3, uTransition);
	alpha *= min(1., smoothstep(.88, .96, vNormal.b) + smoothstep(0.05, 0.0, uTransition)); 
	
	alpha = cloud;
	
	alpha *= smoothstep(0.2, 0., uTransition);

	gl_FragColor = vec4(color, alpha);
	
	
}