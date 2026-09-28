(()=>{
  if(!window.MontiEngine) return;
  const norm=MontiEngine.norm;
  const safety=0.20;
  const addDays=(d,k)=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()+k);return x};
  const day=d=>d.getDay();
  const iso=d=>d.toISOString().slice(0,10);
  const datesBetween=(a,b)=>{const out=[];let d=addDays(a,1);while(d<b){out.push(new Date(d));d=addDays(d,1)}return out};
  const n=v=>Number(v||0)||0;

  // Claves NORMALIZADAS. En v0.3 estaban guardadas con tildes y luego se buscaban
  // con norm(), por eso Ñoquis y Pan de volcán daban proyección 0.
  const artProjection={
    'noquis':[7.33,4.38,3.35,3.42,8.94,4.33,7.66],
    'fusiles':[2.84,3.75,1.70,2.18,2.15,1.73,2.29],
    'macarrones':[1.55,1.05,2.07,1.03,1.17,1.13,1.20],
    'spaghetti':[1.88,1.03,.95,3.73,1.10,1.13,1.38],
    'ravioles pollo y verdura':[2.97,1.84,1.25,1.31,1.19,1.53,2.69],
    'ravioles de ricota':[1.84,.97,.81,.84,1.03,.59,1.19],
    'raviolones de batata':[3.33,2.06,1.11,1.61,1.83,2.22,3.70],
    'pan de volcan':[15,7,4,7,13,7,17]
  };
  const artItems=[
    {name:'Ñoquis',unit:'kg',stock:'Ñoquis',round:5},
    {name:'Fusiles',unit:'kg',stock:'Fusiles',round:5},
    {name:'Macarrones',unit:'kg',stock:'Macarrones',round:5},
    {name:'Spaghetti',unit:'kg',stock:'Spaghetti',round:5},
    {name:'Ravioles pollo y verdura',unit:'cajas',stock:'Ravioles pollo y verdura',round:1},
    {name:'Ravioles de ricota',unit:'cajas',stock:'Ravioles de ricota',round:1},
    {name:'Raviolones de batata',unit:'cajas',stock:'Raviolones de batata',round:1},
    {name:'Pan de volcán',unit:'cajas x12',stock:'Pan de volcán',round:12}
  ];

  MontiEngine.artOrder=(stock,now=new Date())=>{
    const p=MontiEngine.plans(now).art;
    const before=datesBetween(p.stockDate,p.delivery);
    const lines=[];
    artItems.forEach(it=>{
      const proj=artProjection[norm(it.name)]||[];
      const pre=before.reduce((a,d)=>a+(proj[day(d)]||0),0);
      const cycle=p.coverage.reduce((a,d)=>a+(proj[day(d)]||0),0);
      const st=n(stock[it.stock]);
      const need=Math.max(0,cycle*(1+safety)-(st-pre));
      if(need<=0)return;
      let suggested;
      if(it.name==='Pan de volcán') suggested=Math.ceil(need/12);
      else if(it.round===5) suggested=Math.ceil(need/5)*5;
      else suggested=Math.ceil(need);
      lines.push({name:it.name,qty:suggested,unit:it.unit,forecast:cycle,stock:st,note:`consume antes ${pre.toFixed(1)} · cobertura +20%`});
    });
    return {provider:'La Artesanal',plan:p,lines};
  };

  MontiEngine.day29Order=(stock,normal,sales,now=new Date())=>{
    const p=MontiEngine.plans(now).day29;
    const histDates=[...new Set((sales||[]).filter(s=>s.date&&s.date.getDate()===29&&s.date<p.delivery&&/noqui/.test(norm(s.product))).map(s=>iso(s.date)))];
    if(!histDates.length) return {provider:'La Artesanal · Día 29',plan:p,lines:[],warning:'Sin días 29 históricos en el Excel'};
    const histKg=histDates.map(ds=>(sales||[]).filter(s=>s.date&&iso(s.date)===ds&&/noqui/.test(norm(s.product))&&!/volcan/.test(norm(s.product))).reduce((a,s)=>a+n(s.qty)*.25,0));
    const special=histKg.reduce((a,b)=>a+b,0)/histKg.length;
    const after=p.coverage.slice(1).reduce((a,d)=>a+(artProjection['noquis'][day(d)]||0),0);
    const normalIncoming=normal.lines.find(x=>norm(x.name)==='noquis')?.qty||0;
    const st=n(stock['Ñoquis'])+normalIncoming;
    const need=Math.max(0,(special+after)*(1+safety)-st);
    return {provider:'La Artesanal · Día 29',plan:p,lines:need?[{name:'Ñoquis',qty:Math.ceil(need/5)*5,unit:'kg',forecast:special+after,stock:st,note:`refuerzo día 29 · promedio ${histDates.length} históricos · +20%`}]:[]};
  };
})();
