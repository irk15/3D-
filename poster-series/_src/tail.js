/* ---------- post-processing ---------- */
const GR=CFG.grade||{};
const finalShader={
  uniforms:{tDiffuse:{value:null},time:{value:0},res:{value:new THREE.Vector2(1,1)},exposure:{value:CFG.exposure||0.9},
    gS:{value:new THREE.Vector3().fromArray(GR.sh||[0.93,0.95,1.10])},gH:{value:new THREE.Vector3().fromArray(GR.hi||[1.05,1.0,0.93])},vig:{value:GR.vig==null?0.38:GR.vig}},
  vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader:[
    'uniform sampler2D tDiffuse; uniform float time,exposure,vig; uniform vec2 res; uniform vec3 gS,gH; varying vec2 vUv;',
    'float hh(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }',
    'vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }',
    'void main(){',
    ' vec2 c=vUv-0.5; float ca=0.0009*dot(c,c)*4.0;',
    ' vec3 col; col.r=texture2D(tDiffuse,vUv+c*ca).r; col.g=texture2D(tDiffuse,vUv).g; col.b=texture2D(tDiffuse,vUv-c*ca).b;',
    ' col*=exposure; col=aces(col);',
    ' float l=dot(col,vec3(0.2126,0.7152,0.0722));',
    ' col=mix(col*gS, col*gH, smoothstep(0.30,0.85,l));',
    ' col=pow(col,vec3(1.0/2.2));',
    ' col*=1.0-vig*smoothstep(0.35,0.95,length(c)*1.25);',
    ' float n=hh(vUv*res+fract(time)*173.0)-0.5;',
    ' col+=n*0.022+(hh(vUv*res*1.37)-0.5)/255.0;',
    ' gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n')
};
const composer=new THREE.EffectComposer(renderer, makeRT(64,64,true));
composer.addPass(new THREE.RenderPass(scene,camera));
const B=CFG.bloom||[0.5,0.9,0.75];
const bloomPass=new THREE.UnrealBloomPass(new THREE.Vector2(64,64),B[0],B[1],B[2]);
composer.addPass(bloomPass);
const finalPass=new THREE.ShaderPass(finalShader);
composer.addPass(finalPass);
function resize(){
  const w=innerWidth,h=innerHeight, dw=Math.round(w*DPR), dh=Math.round(h*DPR);
  renderer.setSize(w,h); composer.setSize(dw,dh);
  rtR.setSize(Math.round(dw*0.85),Math.round(dh*0.85));
  finalShader.uniforms.res.value.set(dw,dh);
  camera.aspect=w/h; camera.updateProjectionMatrix();
}
addEventListener('resize',resize); resize();

/* ---------- reflection pass ---------- */
const reflPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0.02);
const NRM=new THREE.Vector3(0,1,0), ORG=new THREE.Vector3();
const _cp=new THREE.Vector3(), _v=new THREE.Vector3(), _l=new THREE.Vector3(), _t=new THREE.Vector3(), _rot=new THREE.Matrix4();
function renderReflection(){
  camera.updateMatrixWorld();
  _cp.setFromMatrixPosition(camera.matrixWorld);
  _rot.extractRotation(camera.matrixWorld);
  _v.copy(ORG).sub(_cp).reflect(NRM).negate().add(ORG);
  vcam.position.copy(_v);
  _l.set(0,0,-1).applyMatrix4(_rot).add(_cp);
  _t.copy(ORG).sub(_l).reflect(NRM).negate().add(ORG);
  vcam.up.set(0,1,0).applyMatrix4(_rot).reflect(NRM);
  vcam.lookAt(_t);
  vcam.near=camera.near; vcam.far=camera.far;
  vcam.updateMatrixWorld();
  vcam.projectionMatrix.copy(camera.projectionMatrix);
  textureMatrix.set(0.5,0,0,0.5, 0,0.5,0,0.5, 0,0,0.5,0.5, 0,0,0,1);
  textureMatrix.multiply(vcam.projectionMatrix);
  textureMatrix.multiply(vcam.matrixWorldInverse);
  water.visible=false;
  renderer.clippingPlanes=[reflPlane];
  renderer.setRenderTarget(rtR); renderer.clear();
  renderer.render(scene,vcam);
  renderer.clippingPlanes=[];
  renderer.setRenderTarget(null);
  water.visible=true;
}

/* ---------- loop ---------- */
const clock=new THREE.Clock();
function frame(){
  const t=clock.getElapsedTime();
  az+=(taz-az)*0.08; el+=(tel-el)*0.08; rad+=(trad-rad)*0.08;
  placeCamera(t);
  waterMat.uniforms.time.value=t; skyMat.uniforms.time.value=t; finalPass.uniforms.time.value=t;
  palms.forEach(function(p){ p.g.rotation.z=Math.sin(t*0.7+p.ph)*0.035; p.g.rotation.x=Math.sin(t*0.5+p.ph*1.7)*0.03; p.g.rotation.y=Math.sin(t*0.3+p.ph)*0.06; });
  sky.position.copy(camera.position);
  tickers.forEach(function(f){ f(t); });
  renderReflection();
  if(location.hash.indexOf('nopost')>=0){ renderer.setRenderTarget(null); renderer.render(scene,camera); } else composer.render();
  requestAnimationFrame(frame);
}
window.__ready = true;
frame();
})();
</script>
</body>
</html>
