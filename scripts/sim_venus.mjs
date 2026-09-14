// 비너스 추첨 시스템(AKANIS TECHNOLOGIES) 사양 기반 시뮬레이터
//  · 혼합 챔버: 지름 50cm 구형(플렉시유리)          → Rs = 0.25 m
//  · 추첨볼: 폴리우레탄, 4g ±5%, 지름 44.5mm ±2.5%  → r = 0.02225 m, m = 0.004 kg
//  · 혼합: 터빈 송풍(공기혼합방식)                   → 중앙 상승 / 벽면 하강 + 난류 (추상 모델)
//  · 추출: 드럼 상단 회전링의 4개 추출구(Drum Catch)
export const CFG = {
  Rs: 0.25, r: 0.02225, m0: 0.004,
  g: -9.81, dt: 1/400, rest: 0.55, wallRest: 0.5, damp: 0.9992,
  A: 60.0,          // 중앙 상승 가속도 스케일 (m/s^2)
  T: 45.0,          // 난류 가속도 스케일 (m/s^2)
  swirl: 6.0,       // 접선 선회 (m/s^2)
  ringPhi: 0.95,    // 회전링의 천정각(rad) — 꼭대기에서 벗어난 각
  ringW: 5.2,       // 회전링 각속도 (rad/s)
  catchR: 0.040,    // 추출구 포획 반경 (m)
  nPorts: 4,
  mixSteps: 260, maxSteps: 2600,
};
export function rng(seed){ let a=seed>>>0||1,b=362436069,c=521288629,d=88675123;
  return function(){ const t=a^(a<<11); a=b;b=c;c=d;
    d=(d^(d>>>19))^(t^(t>>>8)); return (d>>>0)/4294967296; }; }

export function drawOnce(mass, R, cfg=CFG){
  const N=mass.length;
  const px=new Float64Array(N),py=new Float64Array(N),pz=new Float64Array(N);
  const vx=new Float64Array(N),vy=new Float64Array(N),vz=new Float64Array(N);
  const dvx=new Float64Array(N),dvy=new Float64Array(N),dvz=new Float64Array(N);
  const dpx=new Float64Array(N),dpy=new Float64Array(N),dpz=new Float64Array(N);
  const live=new Uint8Array(N).fill(1);
  let spare=null;
  const gauss=()=>{ if(spare!==null){const s=spare;spare=null;return s;}
    let u=0,v=0; while(!u)u=R(); while(!v)v=R();
    const m=Math.sqrt(-2*Math.log(u)); spare=m*Math.sin(6.283185*v); return m*Math.cos(6.283185*v); };
  const Rin=cfg.Rs-cfg.r, d2=(2*cfg.r)**2;
  // 구 내부 임의 배치 (겹침 완화)
  for(let i=0;i<N;i++){
    for(let t=0;t<80;t++){
      const u=Math.cbrt(R())*Rin*0.92, th=R()*6.283185, ct=2*R()-1, st=Math.sqrt(1-ct*ct);
      const x=u*st*Math.cos(th), y=u*st*Math.sin(th), z=u*ct;
      let ok=true;
      for(let j=0;j<i;j++){ const ddx=x-px[j],ddy=y-py[j],ddz=z-pz[j];
        if(ddx*ddx+ddy*ddy+ddz*ddz<d2){ok=false;break;} }
      if(ok||t===79){ px[i]=x;py[i]=y;pz[i]=z; break; }
    }
    vx[i]=gauss()*.3; vy[i]=gauss()*.3; vz[i]=gauss()*.3;
  }
  // 번호↔자리 무작위 배정 (배치 순서 편향 제거)
  for(let k=N-1;k>0;k--){ const j=Math.floor(R()*(k+1));
    for(const a of [px,py,pz,vx,vy,vz]){ const t=a[k]; a[k]=a[j]; a[j]=t; } }
  const picked=[], cand=[];
  const zRing=cfg.Rs*Math.cos(cfg.ringPhi), rRing=cfg.Rs*Math.sin(cfg.ringPhi);
  let step=0;
  function advance(){
    if(step>=cfg.maxSteps||picked.length>=6) return false;
    const s=step++;
    for(let i=0;i<N;i++){ if(!live[i])continue;
      const inv=cfg.m0/mass[i];                    // a = F/m (무거울수록 덜 반응)
      const rho=Math.hypot(px[i],py[i])+1e-9;
      const rn=Math.min(rho/cfg.Rs,1);
      const aUp=cfg.A*(1-1.15*rn*rn);
      vx[i]+=((gauss()*cfg.T + cfg.swirl*(-py[i]/rho))*inv)*cfg.dt;
      vy[i]+=((gauss()*cfg.T + cfg.swirl*( px[i]/rho))*inv)*cfg.dt;
      vz[i]+=((aUp+gauss()*cfg.T*0.75)*inv + cfg.g)*cfg.dt;
      vx[i]*=cfg.damp; vy[i]*=cfg.damp; vz[i]*=cfg.damp;
    }
    dvx.fill(0);dvy.fill(0);dvz.fill(0);dpx.fill(0);dpy.fill(0);dpz.fill(0);
    for(let i=0;i<N;i++){ if(!live[i])continue;
      for(let j=i+1;j<N;j++){ if(!live[j])continue;
        const dx=px[j]-px[i],dy=py[j]-py[i],dz=pz[j]-pz[i];
        const dd=dx*dx+dy*dy+dz*dz;
        if(dd>=d2||dd<1e-12)continue;
        const dist=Math.sqrt(dd),nx=dx/dist,ny=dy/dist,nz=dz/dist;
        const rel=(vx[j]-vx[i])*nx+(vy[j]-vy[i])*ny+(vz[j]-vz[i])*nz;
        const ov=2*cfg.r-dist, mi=mass[i],mj=mass[j],tot=mi+mj;
        dpx[i]-=nx*ov*(mj/tot);dpy[i]-=ny*ov*(mj/tot);dpz[i]-=nz*ov*(mj/tot);
        dpx[j]+=nx*ov*(mi/tot);dpy[j]+=ny*ov*(mi/tot);dpz[j]+=nz*ov*(mi/tot);
        if(rel>=0)continue;
        const imp=-(1+cfg.rest)*rel/(1/mi+1/mj);
        dvx[i]-=imp*nx/mi;dvy[i]-=imp*ny/mi;dvz[i]-=imp*nz/mi;
        dvx[j]+=imp*nx/mj;dvy[j]+=imp*ny/mj;dvz[j]+=imp*nz/mj;
      } }
    for(let i=0;i<N;i++){ if(!live[i])continue;
      px[i]+=dpx[i];py[i]+=dpy[i];pz[i]+=dpz[i];
      vx[i]+=dvx[i];vy[i]+=dvy[i];vz[i]+=dvz[i]; }
    const ang=s*cfg.dt*cfg.ringW;
    for(let i=0;i<N;i++){ if(!live[i])continue;
      px[i]+=vx[i]*cfg.dt; py[i]+=vy[i]*cfg.dt; pz[i]+=vz[i]*cfg.dt;
      // 구형 벽면
      const rr=Math.hypot(px[i],py[i],pz[i]);
      if(rr>Rin){ const nx=px[i]/rr,ny=py[i]/rr,nz=pz[i]/rr;
        px[i]=nx*Rin;py[i]=ny*Rin;pz[i]=nz*Rin;
        const vn=vx[i]*nx+vy[i]*ny+vz[i]*nz;
        if(vn>0){ vx[i]-=(1+cfg.wallRest)*vn*nx; vy[i]-=(1+cfg.wallRest)*vn*ny; vz[i]-=(1+cfg.wallRest)*vn*nz; } }
      // 드럼 상단 회전링의 4개 추출구
      if(s>=cfg.mixSteps){
        for(let k=0;k<cfg.nPorts;k++){
          const a=ang+k*2*Math.PI/cfg.nPorts;
          const cxp=rRing*Math.cos(a), cyp=rRing*Math.sin(a);
          const dx=px[i]-cxp, dy=py[i]-cyp, dz=pz[i]-zRing;
          if(dx*dx+dy*dy+dz*dz < cfg.catchR*cfg.catchR){ cand.push(i); break; }
        }
      }
    }
    if(cand.length){
      for(let k=cand.length-1;k>0;k--){ const j=Math.floor(R()*(k+1));
        const t=cand[k];cand[k]=cand[j];cand[j]=t; }
      for(const i of cand){ if(picked.length>=6)break; if(!live[i])continue; live[i]=0; picked.push(i+1); }
      cand.length=0;
    }
    return true;
  }
  return { advance, picked, live, px, py, pz,
    run(){ while(advance()); return picked.length===6?picked.slice():null; },
    get step(){return step;} };
}
export const runOnce=(mass,R,cfg)=>drawOnce(mass,R,cfg).run();
