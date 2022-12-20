import * as THREE from 'https://cdn.skypack.dev/three@0.142.0';
import { EffectComposer } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'https://unpkg.com/three@0.142.0/examples/jsm/postprocessing/SMAAPass.js';
import { GammaCorrectionShader } from 'https://unpkg.com/three@0.142.0/examples/jsm/shaders/GammaCorrectionShader.js';
import { EffectShader } from "./EffectShader.js";
import { OrbitControls } from 'https://unpkg.com/three@0.142.0/examples/jsm/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'https://unpkg.com/three@0.142.0/examples/jsm/utils/BufferGeometryUtils.js';

import { AssetManager } from './AssetManager.js';
import { Stats } from "./stats.js";
async function main() {
    // Setup basic renderer, controls, and profiler
    const clientWidth = window.innerWidth * 0.99;
    const clientHeight = window.innerHeight * 0.98;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, clientWidth / clientHeight, 0.1, 1000);
    camera.position.set(50, 75, 50);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(clientWidth, clientHeight);
    document.body.appendChild(renderer.domElement);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 25, 0);
    const stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
    // Setup scene
    // Skybox
    const environment = new THREE.CubeTextureLoader().load([
        "skybox/Box_Right.bmp",
        "skybox/Box_Left.bmp",
        "skybox/Box_Top.bmp",
        "skybox/Box_Bottom.bmp",
        "skybox/Box_Front.bmp",
        "skybox/Box_Back.bmp"
    ]);
    environment.encoding = THREE.sRGBEncoding;
    scene.background = environment;
    // Lighting
    const ambientLight = new THREE.AmbientLight(new THREE.Color(1.0, 1.0, 1.0), 0.25);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.35);
    directionalLight.position.set(150, 200, 50);
    // Shadows
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.left = -500;
    directionalLight.shadow.camera.right = 500;
    directionalLight.shadow.camera.top = 500;
    directionalLight.shadow.camera.bottom = -500;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 750;
    directionalLight.shadow.bias = -0.001;
    directionalLight.shadow.blurSamples = 8;
    directionalLight.shadow.radius = 4;
    scene.add(directionalLight);
    // scene.add(new THREE.CameraHelper(directionalLight.shadow.camera))
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.15);
    directionalLight2.color.setRGB(1.0, 1.0, 1.0);
    directionalLight2.position.set(-50, 200, -150);
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(512, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    cubeRenderTarget.texture.encoding = THREE.sRGBEncoding;
    const cubeCamera = new THREE.CubeCamera(1, 100000, cubeRenderTarget);
    scene.add(cubeCamera);

    //scene.add(directionalLight2);
    // Objects
    const snowNorm = await new THREE.TextureLoader().loadAsync("snownorm.jpeg");
    snowNorm.wrapS = THREE.RepeatWrapping;
    snowNorm.wrapT = THREE.RepeatWrapping;
    const snowRough = await new THREE.TextureLoader().loadAsync("snowrough.jpeg");
    snowRough.wrapS = THREE.RepeatWrapping;
    snowRough.wrapT = THREE.RepeatWrapping;
    const snowMaterial = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, color: new THREE.Color(0.810, 0.810, 0.810), ior: 1.3098, metalness: 0, roughness: 0.25, envMap: environment, normalMap: snowNorm, roughnessMap: snowRough, sheen: true, sheenColor: new THREE.Color(0.5, 0.5, 1.0) });
    snowMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace("#ifdef USE_TRANSMISSION", "").replace("#ifdef USE_TRANSMISSION", "");
        shader.vertexShader = shader.vertexShader.replace("#endif", "").replace("#endif", "");
        shader.vertexShader = shader.vertexShader.replace("#include <worldpos_vertex>", `
        vec4 worldPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
            worldPosition = instanceMatrix * worldPosition;
        #endif
        worldPosition = modelMatrix * worldPosition;    
        `);
        shader.uniforms.lightDir = { value: directionalLight.position };
        shader.fragmentShader = "varying vec3 vWorldPosition;\nuniform vec3 lightDir;\n" + shader.fragmentShader.replace("#include <map_fragment>", `
        mat4 viewMatrixInv = inverse(viewMatrix);
        vec3 worldNormal = (viewMatrixInv * vec4(vNormal, 0.0)).xyz;
        vec2 yUv = vWorldPosition.xz * 0.1;
        vec2 xUv = vWorldPosition.zy * 0.1;
        vec2 zUv = vWorldPosition.xy * 0.1;
        vec3 blendWeights = abs(worldNormal);
        blendWeights = blendWeights / (blendWeights.x + blendWeights.y + blendWeights.z);
       // diffuseColor *= vec4((xDiff * blendWeights.x + yDiff * blendWeights.y + zDiff * blendWeights.z), 1.0);
        `).replace("#include <normal_fragment_maps>", `
        vec3 yNormal =  texture2D(normalMap, yUv).xyz;
        vec3 xNormal =  texture2D(normalMap, xUv).xyz;
        vec3 zNormal =  texture2D(normalMap, zUv).xyz;
        vec3 mapN = (xNormal * blendWeights.x + yNormal * blendWeights.y + zNormal * blendWeights.z) * 2.0 - 1.0;
        mapN.xy *= normalScale;
        #ifdef USE_TANGENT
            normal = normalize( vTBN * mapN );
        #else
            normal = perturbNormal2Arb( - vViewPosition, normal, mapN, faceDirection );
        #endif
        vec3 scatteringHalf = normalize(normalize(lightDir) + 10.0 * worldNormal);
        float scatteringDot = pow(clamp(dot(normalize(cameraPosition - vWorldPosition), -scatteringHalf), 0.0, 1.0), 8.0);
        totalEmissiveRadiance += scatteringDot * vec3(0.4, 0.4, 0.5);
        `).replace("#include <roughnessmap_fragment>", `
        float roughnessFactor = roughness;
        #ifdef USE_ROUGHNESSMAP
        float yrDiff = texture2D(roughnessMap, yUv).g;
        float xrDiff = texture2D(roughnessMap, xUv).g;
        float zrDiff = texture2D(roughnessMap, zUv).g;
        roughnessFactor *= (xrDiff * blendWeights.x + yrDiff * blendWeights.y + zrDiff * blendWeights.z);
        #endif
        `);
    }
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1024, 1024, 1024, 1024).applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2)), snowMaterial);
    const heightFalloff = (x) => (x + 1) * Math.log(x + 1);
    const terrainGeo = ground.geometry;

    function smax(d1, d2, k) {
        const h = Math.min(Math.max(0.5 - 0.5 * (d2 - d1) / k, 0.0), 1.0);
        return (d2 + (d1 - d2) * h) + k * h * (1.0 - h);
    }
    for (let x = 0; x < 1025; x += 1) {
        for (let z = 0; z < 1025; z += 1) {
            let amt = 0.0;
            let frequency = 0.0025;
            let amplitude = 0.5;
            for (let i = 0; i < 12; i++) {
                amt += amplitude * (0.5 + 0.5 * noise.simplex2(x * frequency + 128, z * frequency + 128));
                amplitude /= 2;
                frequency *= 2;
            }
            let currHeight = (amt) * 100.0 - 0.0625 * heightFalloff(Math.max(Math.hypot(x - 512, z - 512) - (200 + 50 * (amt)), 0));
            currHeight = smax(currHeight, -25.0 - amt * 15.0, 10.0);
            terrainGeo.attributes.position.setY(1025 * (z) + (x), currHeight);
        }
    }
    terrainGeo.computeVertexNormals()
    ground.castShadow = true;
    ground.receiveShadow = true;
    scene.add(ground);
    /* const box = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, color: new THREE.Color(1.0, 0.0, 0.0) }));
     box.castShadow = true;
     box.receiveShadow = true;
     box.position.y = 5.01;
     box.position.x = 25;
     box.position.z = 25;
     scene.add(box);
     const sphere = new THREE.Mesh(new THREE.IcosahedronGeometry(6.25, 40), snowMaterial);
     sphere.geometry.deleteAttribute('normal');
     sphere.geometry = BufferGeometryUtils.mergeVertices(sphere.geometry);
     const posAttr = sphere.geometry.attributes.position;
     for (let j = 0; j < posAttr.count; j++) {
         const position = new THREE.Vector3(posAttr.getX(j), posAttr.getY(j), posAttr.getZ(j));
         let amt = 1.0;
         let mag = 0.075;
         let freq = 0.1;
         let shift = 0.0;
         for (let k = 0; k < 12; k++) {
             amt += mag * noise.simplex3(freq * position.x + 512 + shift, freq * position.y + 1024 + shift, freq * position.z + 2048 + shift);
             mag /= 2;
             freq *= 2;
             shift += 128.0;
         }
         const magnitude = amt;
         position.multiplyScalar(magnitude);
         posAttr.setXYZ(j, position.x, position.y, position.z);
     }
     sphere.geometry.computeVertexNormals();
     sphere.position.y = 7.5;
     sphere.castShadow = true;
     sphere.receiveShadow = true;
     scene.add(sphere);
     const torusKnot = new THREE.Mesh(new THREE.TorusKnotGeometry(5, 1.5, 200, 32), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, envMap: environment, metalness: 0.5, roughness: 0.5, color: new THREE.Color(0.0, 1.0, 0.0) }));
     torusKnot.position.y = 10;
     torusKnot.position.x = -25;
     torusKnot.position.z = -25;
     torusKnot.castShadow = true;
     torusKnot.receiveShadow = true;
     scene.add(torusKnot);
     // Build postprocessing stack
     // Render Targets
     sphere.visible = false;
     cubeCamera.position.copy(sphere.position);
     cubeCamera.update(renderer, scene);
     sphere.visible = true;*/
    const defaultTexture = new THREE.WebGLRenderTarget(clientWidth, clientHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter
    });
    defaultTexture.depthTexture = new THREE.DepthTexture(clientWidth, clientHeight, THREE.FloatType);
    // Post Effects
    const composer = new EffectComposer(renderer);
    const smaaPass = new SMAAPass(clientWidth, clientHeight);
    const effectPass = new ShaderPass(EffectShader);
    composer.addPass(effectPass);
    composer.addPass(new ShaderPass(GammaCorrectionShader));
    composer.addPass(smaaPass);

    function animate() {
        renderer.setRenderTarget(defaultTexture);
        renderer.clear();
        renderer.render(scene, camera);
        effectPass.uniforms["sceneDiffuse"].value = defaultTexture.texture;
        effectPass.uniforms["sceneDepth"].value = defaultTexture.depthTexture;
        effectPass.uniforms["projectionMatrixInv"].value = camera.projectionMatrixInverse;
        effectPass.uniforms["viewMatrixInv"].value = camera.matrixWorld;
        effectPass.uniforms["cameraPos"].value = camera.position;
        effectPass.uniforms["time"].value = performance.now() / 1000;
        composer.render();
        controls.update();
        stats.update();
        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}
main();