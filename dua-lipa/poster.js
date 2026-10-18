import * as T from 'three';
export function makePoster(group,chrome){
 const sculpture=new T.Group();group.add(sculpture);sculpture.position.y=.05;
 const wingMat=new T.MeshPhysicalMaterial({color:'#b6c9e6',metalness:.95,roughness:.17,clearcoat:1,clearcoatRoughness:.12,iridescence:.8,iridescenceIOR:1.35,iridescenceThicknessRange:[180,370],side:T.DoubleSide});
 const edgeMat=new T.MeshPhysicalMaterial({color:'#e4ecfa',metalness:1,roughness:.15});
 const hinges=[];
 function upper(){const s=new T.Shape();s.moveTo(.07,.12);s.bezierCurveTo(.30,.87,1.02,1.35,1.48,1.14);s.bezierCurveTo(1.64,.82,1.12,.15,.25,-.05);s.bezierCurveTo(.15,-.06,.1,.02,.07,.12);const hole=new T.Path();hole.moveTo(.42,.25);hole.bezierCurveTo(.62,.67,1.04,.95,1.22,.91);hole.bezierCurveTo(1.1,.65,.8,.35,.42,.25);s.holes.push(hole);return s;}
 function lower(){const s=new T.Shape();s.moveTo(.10,.05);s.bezierCurveTo(.42,-.02,1.09,-.1,1.15,-.47);s.bezierCurveTo(1.12,-1.05,.48,-1.10,.21,-.4);s.bezierCurveTo(.10,-.2,.08,-.03,.10,.05);return s;}
 for(const side of [-1,1]){const pivot=new T.Group();pivot.scale.x=side;sculpture.add(pivot);hinges.push(pivot);for(const shape of [upper(),lower()]){const geo=new T.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:true,bevelSegments:5,steps:1,bevelSize:.065,bevelThickness:.045,curveSegments:50});geo.computeVertexNormals();pivot.add(new T.Mesh(geo,wingMat));}
 for(let i=0;i<4;i++){const points=[new T.Vector3(.13,.08,.135),new T.Vector3(.49,.22+i*.1,.155),new T.Vector3(.88,.35+i*.14,.12),new T.Vector3(1.3-i*.1,.68+i*.11,.1)];pivot.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),40,.012,8,false),edgeMat));}
 const path=new T.CatmullRomCurve3([new T.Vector3(.12,-.05,.13),new T.Vector3(.45,-.23,.16),new T.Vector3(.73,-.61,.13),new T.Vector3(.69,-.78,.1)]);pivot.add(new T.Mesh(new T.TubeGeometry(path,40,.016,8,false),edgeMat));}
 const body=new T.Mesh(new T.CapsuleGeometry(.055,.85,8,24),chrome);body.position.set(0,-.03,.16);sculpture.add(body);const head=new T.Mesh(new T.SphereGeometry(.08,24,16),edgeMat);head.position.set(0,.49,.16);sculpture.add(head);
 for(const side of [-1,1]){const p=new T.CatmullRomCurve3([new T.Vector3(side*.03,.5,.15),new T.Vector3(side*.12,.7,.15),new T.Vector3(side*.26,.77,.12),new T.Vector3(side*.31,.7,.1)]);sculpture.add(new T.Mesh(new T.TubeGeometry(p,35,.012,8,false),edgeMat));}
 const dropletMat=new T.MeshPhysicalMaterial({color:'#98bbfa',metalness:.3,roughness:.1,clearcoat:1,transmission:.4,thickness:.4,ior:1.45});const droplets=[];for(let i=0;i<13;i++){const a=i*2.39996,r=1.6+(i%3)*.12;const m=new T.Mesh(new T.SphereGeometry(.035+(i%4)*.035,32,24),i%3?chrome:dropletMat);m.position.set(Math.cos(a)*r,Math.sin(a)*1.45,-.2+(i%4)*.12);m.userData.baseY=m.position.y;group.add(m);droplets.push(m);}
 return{update(t,intensity){sculpture.rotation.set(-.18+Math.sin(t*.25)*.06,Math.sin(t*.18)*.23,-.13+Math.sin(t*.15)*.06);sculpture.position.y=.12+Math.sin(t*.4)*.05;hinges.forEach((h,i)=>h.rotation.y=(i?1:-1)*(.12+Math.sin(t*.7)*.12*intensity));droplets.forEach((d,i)=>d.position.y=d.userData.baseY+Math.sin(t*.5+i)*.035);}};
}
