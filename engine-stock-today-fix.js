(()=>{
  const E=window.MontiEngine;
  if(!E) return;
  const safety=0.20;
  const projections={
    'noquis':[7.33,4.38,3.35,3.42,8.94,4.33,7.66],
    'fusiles':[2.84,3.75,1.70,2.18,2.15,1.73,2.29],
    'macarrones':[1.55,1.05,2.07,1.03,1.17,1.13,1.20],
    'spaghetti':[1.88,1.03,.95,3.73,1.10,1.13,1.38],
    'ravioles pollo y verdura':[2.97,1.84,1.25,1.31,1.19,1.53,2.69],
    'ravioles de ricota':[1.84,.97,.81,.84,1.03,.59,1.19],
    'raviolones de batata':[3.33,2.06,1.11,1.61,1.83,2.22,3.70],
    'pan de volcan':[15,7,4,7,13,7,17]
  };
  const items=[
    {name:'Ñoquis',unit:'kg',stock:'Ñoquis',round:5},
    {name:'Fusiles',unit:'kg',stock:'Fusiles',round:5},
    {name:'Macarrones',unit:'kg',stock:'Macarrones',round:5},
    {name:'Spaghetti',unit:'kg',stock:'Spaghetti',round:5},
    {name:'Ravioles pollo y verdura',unit:'cajas',stock:'Ravioles pollo y verdura',round:1},
    {name:'Ravioles de ricota',unit:'cajas',stock:'Ravioles de ricota',round:1},
    {name:'Raviolones de batata',unit:'cajas',stock:'Raviolones de batata',round:1},
    {name:'Pan de volcán',unit:'cajas x12',stock:'Pan de volcán',round:12}
  ];
  const addDays=(d,k)=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()+k);return x};
  const n=v=>Number(v||0)||0;
  function daysAfterTodayUntilDelivery(now,delivery){
    const out=[];
    let d=addDays(now,1);
    const end=new Date(delivery);end.setHours(12,0,0,0);
    while(d<end){out.push(new Date(d));d=addDays(d,1)}
    return out;
  }
  E.artOrder=(stock,now=new Date())=>{
    const p=E.plans(now).art;
    const before=daysAfterTodayUntilDelivery(now,p.delivery);
    const lines=[];
    items.forEach(it=>{
      const proj=projections[E.norm(it.name)]||[];
      const pre=before.reduce((a,d)=>a+(proj[d.getDay()]||0),0);
      const cycle=(p.coverage||[]).reduce((a,d)=>a+(proj[new Date(d).getDay()]||0),0);
      const st=n(stock?.[it.stock]);
      const need=Math.max(0,cycle*(1+safety)-(st-pre));
      if(need<=0)return;
      let suggested;
      if(it.name==='Pan de volcán')suggested=Math.ceil(need/12);
      else if(it.round===5)suggested=Math.ceil(need/5)*5;
      else suggested=Math.ceil(need);
      lines.push({
        name:it.name,qty:suggested,unit:it.unit,forecast:cycle,stock:st,
        note:`stock tomado hoy · consume antes ${pre.toFixed(1)} · cobertura +20%`
      });
    });
    return {provider:'La Artesanal',plan:p,lines,stockSnapshotDate:new Date(now)};
  };
})();