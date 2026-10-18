// Destination-based behaviour. No periodic paths or repeated activity schedule.
export const activityLabels={browse:'Browsing the shop window',shop:'Looking through the collection',serve:'Tidying the counter',phone:'Checking a message',photo:'Taking a photo',coffee:'Enjoying a coffee',sit:'Resting on the bench',queue:'Waiting at the food truck',eat:'Enjoying a snack',chat:'Chatting with a neighbour',look:'Watching the neighbourhood'};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const rect=(x,z,a,b,c,d)=>x>a&&x<b&&z>c&&z<d;
export function free(x,z,indoor=false){
 if(indoor)return x>=-2.34&&x<=2.34&&z>=-1.24&&z<=1.75&&!rect(x,z,-1.03,1.94,.05,1.15);
 if(x< -5.55||x>5.55||z< -5.05||z>5.05)return false;
 const blocks=[[-2.98,2.98,-2.57,2.58],[3.02,5,-1.8,1.95],[-4.68,-2.92,1.84,2.97],[-.48,1.28,3.76,4.63],[-2.34,-1.06,2.43,3.23],[.55,1.85,2.43,3.23],[2.65,3.55,2.05,3.02]];
 if(blocks.some(b=>rect(x,z,...b)))return false;
 return ![[-4.7,3.8,.4],[2.2,4,.4],[4.7,-1.8,.4],[-3.2,3.4,.45],[3.3,3.4,.45],[-3.2,-1,.48],[-3,2.7,.5],[2.9,-2.5,.5]].some(([a,b,r])=>Math.hypot(x-a,z-b)<r);
}
function clear(a,b,indoor){let n=Math.ceil(dist(a,b)/.08);for(let i=1;i<=n;i++)if(!free(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n,indoor))return false;return true;}
export function pathfind(a,b,indoor=false){
 if(!free(a.x,a.z,indoor)||!free(b.x,b.z,indoor))return null;
 if(clear(a,b,indoor))return [{...b}];
 const step=indoor?.14:.22,minX=indoor?-2.34:-5.55,minZ=indoor?-1.24:-5.05,maxX=indoor?2.34:5.55,maxZ=indoor?1.75:5.05;
 const w=Math.floor((maxX-minX)/step)+1,h=Math.floor((maxZ-minZ)/step)+1;
 const point=id=>({x:minX+(id%w)*step,z:minZ+Math.floor(id/w)*step});
 const nearest=p=>{let best=-1,score=Infinity;for(let iz=Math.max(0,Math.round((p.z-minZ)/step)-2);iz<=Math.min(h-1,Math.round((p.z-minZ)/step)+2);iz++)for(let ix=Math.max(0,Math.round((p.x-minX)/step)-2);ix<=Math.min(w-1,Math.round((p.x-minX)/step)+2);ix++){let id=iz*w+ix,q=point(id),d=dist(p,q);if(d<score&&free(q.x,q.z,indoor)&&clear(p,q,indoor)){best=id;score=d;}}return best;};
 const start=nearest(a),end=nearest(b);if(start<0||end<0)return null;
 let open=[start],closed=new Set(),cost=new Map([[start,0]]),prev=new Map();
 while(open.length){open.sort((u,v)=>(cost.get(v)+dist(point(v),b))-(cost.get(u)+dist(point(u),b)));let id=open.pop();if(id===end){let chain=[b];while(id!==start){chain.push(point(id));id=prev.get(id);}chain.push(a);chain.reverse();let smooth=[],i=0;while(i<chain.length-1){let j=chain.length-1;while(j>i+1&&!clear(chain[i],chain[j],indoor))j--;smooth.push(chain[j]);i=j;}return smooth;}
 closed.add(id);let x=id%w,z=Math.floor(id/w);for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){if(!dx&&!dz)continue;let nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=w||nz>=h)continue;let next=nz*w+nx,p=point(next);if(closed.has(next)||!free(p.x,p.z,indoor)||!clear(point(id),p,indoor))continue;let score=cost.get(id)+Math.hypot(dx,dz)*step;if(score<(cost.get(next)??Infinity)){cost.set(next,score);prev.set(next,id);if(!open.includes(next))open.push(next);}}}
 return null;
}
const streetSpots=[
 {x:-.18,z:4.88,kind:'sit',angle:0,weight:1.1},
 {x:.85,z:4.88,kind:'sit',angle:0,weight:1.1},
 {x:-2.1,z:3.6,kind:'phone',angle:1.8},
 {x:1.1,z:3.5,kind:'browse',angle:Math.PI},
 {x:-1.1,z:3.65,kind:'photo',angle:Math.PI},
 {x:5.28,z:-.4,kind:'queue',angle:-Math.PI/2,weight:1.2},
 {x:4.5,z:2.4,kind:'eat',angle:-.6},
 {x:-4.2,z:-2.3,kind:'coffee',angle:.7},
 {x:1.1,z:-3.45,kind:'phone',angle:2.7},
 {x:-4.1,z:4.65,kind:'look',angle:1},
 {x:3.7,z:4.7,kind:'photo',angle:-2.5},
 {x:-3.55,z:.6,kind:'chat',angle:-Math.PI/2,pair:12},
 {x:-4.35,z:.6,kind:'chat',angle:Math.PI/2,pair:11},
 {x:-5.1,z:-2.4,kind:'look',angle:.8},
 {x:3.6,z:-3.5,kind:'coffee',angle:-2.2}
];
const indoorSpots=[{x:-1.55,z:1.45,kind:'shop',angle:Math.PI},{x:.4,z:1.5,kind:'browse',angle:Math.PI},{x:1.6,z:-.8,kind:'serve',angle:0},{x:-1.4,z:-.9,kind:'shop',angle:Math.PI},{x:2.16,z:1.5,kind:'phone',angle:-1.1}];
export function createLife(random=Math.random){
 let now=0;const reservations=new Map(),events=[];
 const people=Array.from({length:12},(_,id)=>({id,zone:id===0?'ground':id<3?'upper':'street',indoor:id<3,x:0,z:0,angle:0,speed:.42+random()*.18,stride:random()*6.28,state:'act',activity:'look',actionAge:0,remaining:3+random()*7,last:-1,spot:-1,route:[],vx:0,vz:0,walkBlend:0,blocked:0,visits:0,personality:random()}));
 const spots=p=>p.indoor?indoorSpots:streetSpots,key=(p,i)=>p.zone+':'+i;
 function duration(kind){return (kind==='sit'?18:kind==='chat'?12:kind==='queue'?5:kind==='serve'?9:5)+random()*(kind==='sit'?18:kind==='phone'?11:9);}
 function arrive(p){p.state='act';p.activity=spots(p)[p.spot].kind;p.actionAge=0;p.remaining=duration(p.activity);p.angleGoal=spots(p)[p.spot].angle;p.visits++;events.push({id:p.id,activity:p.activity,time:now});if(events.length>500)events.shift();}
 function choose(p){
 const options=spots(p).map((s,i)=>({s,i})).filter(({i})=>i!==p.spot&&!reservations.has(key(p,i)));
 // Encourage a conversation partner when someone is already waiting.
 options.forEach(o=>{let partner=o.s.pair;const social=partner!==undefined&&reservations.has(key(p,partner));o.score=random()*(o.s.weight??1)*(social?3:1);if(o.s.kind==='phone'&&p.personality>.6)o.score*=1.5;if(p.activity==='queue'&&o.s.kind==='eat')o.score+=3;});options.sort((a,b)=>b.score-a.score);
 for(const {s,i} of options){const route=pathfind(p,s,p.indoor);if(!route)continue;if(p.spot>=0)reservations.delete(key(p,p.spot));p.last=p.spot;p.spot=i;reservations.set(key(p,i),p.id);p.route=route;p.state='depart';p.actionAge=0;p.blocked=0;return true;}p.remaining=2;return false;
 }
 // Open on a mix of activity, instead of a synchronized start.
 const initial=[0,2,3,0,2,5,7,11,12,10,8,6];
 people.forEach((p,i)=>{p.spot=initial[i];let s=spots(p)[p.spot];p.x=s.x;p.z=s.z;p.angle=s.angle;p.angleGoal=s.angle;reservations.set(key(p,p.spot),i);arrive(p);p.actionAge=random()*2;p.remaining=4+random()*13;});
 function update(dt){now+=dt;
 for(const p of people){p.actionAge+=dt;let moving=false;
 if(p.state==='depart'){if(p.actionAge>.85){p.state='walk';p.activity='walk';p.actionAge=0;}}else if(p.state==='act'){
 let partner=spots(p)[p.spot].pair;
 p.talking=p.activity==='chat'&&partner!==undefined&&people.some(o=>o.id!==p.id&&o.zone===p.zone&&o.spot===partner&&o.state==='act'&&o.activity==='chat');
 if(p.activity==='chat'&&!p.talking)p.remaining-=dt*.6;else p.remaining-=dt;
 if(p.remaining<=0)choose(p);
 }else if(p.state==='walk'){
 const target=p.route[0];if(!target){arrive(p);continue;}const d=dist(p,target);
 if(d<.045){p.route.shift();if(!p.route.length){arrive(p);continue;}}
 const goal=p.route[0];if(!goal)continue;
 let dx=goal.x-p.x,dz=goal.z-p.z,len=Math.hypot(dx,dz),ux=dx/Math.max(len,.001),uz=dz/Math.max(len,.001);
 let desired=p.speed*Math.min(1,len/.23+.2),avoidX=0,avoidZ=0;
 for(const o of people){if(o===p||o.zone!==p.zone)continue;let separation=dist(p,o),ahead=(o.x-p.x)*ux+(o.z-p.z)*uz;if(separation<.8&&ahead>0){desired*=Math.max(.08,Math.min(1,(separation-.35)/.4));const side=(p.id<o.id?1:-1);avoidX+=-uz*side*(.8-separation)*.7;avoidZ+=ux*side*(.8-separation)*.7;}}
 const smooth=1-Math.exp(-dt*6);p.vx+=(ux*desired+avoidX-p.vx)*smooth;p.vz+=(uz*desired+avoidZ-p.vz)*smooth;
 let nx=p.x+p.vx*dt,nz=p.z+p.vz*dt;
 if(!free(nx,nz,p.indoor)){nx=p.x+ux*desired*dt;nz=p.z+uz*desired*dt;}
 const collides=people.some(o=>o!==p&&o.zone===p.zone&&Math.hypot(nx-o.x,nz-o.z)<.38);
 if(free(nx,nz,p.indoor)&&!collides){let step=Math.hypot(nx-p.x,nz-p.z);p.x=nx;p.z=nz;p.stride+=step*15;moving=step>.0002;p.blocked=moving?0:p.blocked+dt;p.angleGoal=Math.atan2(p.vx||ux*.001,p.vz||uz*.001);}else{p.blocked+=dt;p.vx*=.8;p.vz*=.8;}
 if(p.blocked>3){p.state='act';p.activity='phone';p.remaining=2+random()*2;p.actionAge=0;p.blocked=0;}
 }
 p.walkBlend+=((moving?1:0)-p.walkBlend)*(1-Math.exp(-dt*8));
 let delta=((p.angleGoal-p.angle+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;p.angle+=delta*(1-Math.exp(-dt*5));
 }
 }
 return {people,update,events,reservations,get time(){return now;}};
}
