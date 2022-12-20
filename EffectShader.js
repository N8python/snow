import * as THREE from 'https://cdn.skypack.dev/three@0.142.0';
const EffectShader = {

    uniforms: {

        'sceneDiffuse': { value: null },
        'sceneDepth': { value: null },
        'projectionMatrixInv': { value: new THREE.Matrix4() },
        'viewMatrixInv': { value: new THREE.Matrix4() },
        'cameraPos': { value: new THREE.Vector3() },
        'time': { value: 0 },
        'resolution': { value: new THREE.Vector2() }
    },

    vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,

    fragmentShader: /* glsl */ `
		uniform sampler2D sceneDiffuse;
        uniform sampler2D sceneDepth;
        uniform mat4 projectionMatrixInv;
        uniform mat4 viewMatrixInv;
        uniform vec3 cameraPos;
        uniform float time;
        uniform vec2 resolution;
        varying vec2 vUv;
        vec3 getWorldPos(float depth, vec2 coord) {
            float z = depth * 2.0 - 1.0;
            vec4 clipSpacePosition = vec4(coord * 2.0 - 1.0, z, 1.0);
            vec4 viewSpacePosition = projectionMatrixInv * clipSpacePosition;
            // Perspective division
            viewSpacePosition /= viewSpacePosition.w;
            vec4 worldSpacePosition = viewMatrixInv * viewSpacePosition;
            return worldSpacePosition.xyz;
        }
        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v){ 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //  x0 = x0 - 0. + 0.0 * C 
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

// Permutations
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients
// ( N*N points uniformly over a square, mapped onto an octahedron.)
  float n_ = 1.0/7.0; // N=7
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}
        #define NUM_OCTAVES 6
        float fbm(vec3 x) {
            float v = 0.0;
            float a = 0.5;
            vec3 shift = vec3(100);
            for (int i = 0; i < NUM_OCTAVES; ++i) {
                v += a * snoise(x);
                x = x * 2.0 + shift;
                a *= 0.5;
            }
            return v;
        }
		void main() {
            vec4 diffuse = texture2D(sceneDiffuse, vUv);
            float depth = texture2D(sceneDepth, vUv).x;
            vec3 worldPos = getWorldPos(depth, vUv);
            float fogDensity = 0.01;
            vec3 fogOrigin = cameraPos;//vec3(0.0, 0.0, 0.0);
            vec3 fogDirection = normalize(worldPos - fogOrigin);
            float fogDepth = distance(worldPos, fogOrigin);
            vec3 noiseSampleCoord = 0.0025 * (worldPos + 10.0 * time);// * 0.00025 + vec3(0.0, 0.0, time);
            float noiseSample = fbm(noiseSampleCoord + fbm(noiseSampleCoord)) * 0.5 + 0.5;
            //gl_FragColor = vec4(vec3(noiseSample), 1.0);
          //d  return;
          /*  fogDepth *= mix(noiseSample, 1.0, clamp((fogDepth - 5000.0) / 5000.0, 0.0, 1.0));
            fogDepth *= fogDepth;
            fogDepth *= noiseSample;
            float heightFactor = 0.05;
            float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) * (1.0 - exp(-fogDepth * fogDirection.y * fogDensity)) / fogDirection.y;
            fogFactor = clamp(fogFactor, 0.0, 1.0);*/
           // return;
            fogDepth *= mix(noiseSample, 1.0, clamp((fogDepth - 250.0) / 250.0, 0.0, 1.0));
            float fogFactor = 1.0 - (exp(-fogDepth * fogDensity));
            gl_FragColor = vec4(mix(diffuse.rgb, vec3(0.7, 0.8, 1.0), fogFactor), 1.0);
		}`

};

export { EffectShader };