(()=>{
  const STOCK_META_KEY='monti.web.stock.v3.savedAt';
  const norm=window.MontiEngine.norm;
  const n=v=>Number(v||0)||0;
  const addDays=(d,k)=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()+k);return x};
  const day=d=>d.getDay();
  const iso=d=>{const x=new Date(d);x.setHours(12,0,0,0);return x.toISOString().slice(0,10)};
  const safety=.20;

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

  function snapshotTimestamp(now){
    const raw=localStorage.getItem(STOCK_META_KEY);
    const d=raw?new Date(raw):new Date(now);
    return isNaN(d)?new Date(now):d;
  }
  function serviceRemainingFraction(ts){
    // Jornada operativa estimada 11:00 -> 02:00 del día siguiente.
    // El stock cargado representa el stock REAL al momento de guardarlo, por eso
    // sólo proyectamos la parte de la jornada que todavía falta consumir.
    const d=new Date(ts);
    const mins=d.getHours()*60+d.getMinutes();
    const open=11*60, close=26*60;
    let operationalMinute=mins;
    if(mins<2*60) operationalMinute=24*60+mins;
    if(operationalMinute<open) return 1;
    if(operationalMinute>=close) return 0;
    return Math.max(0,Math.min(1,(close-operationalMinute)/(close-open)));
  }
  function preDeliveryDemand(proj,snapshot,delivery){
    const end=new Date(delivery);end.setHours(12,0,0,0);
    const snapDay=new Date(snapshot);snapDay.setHours(12,0,0,0);
    if(snapDay>=end)return {qty:0,todayFraction:0,days:[]};
    const todayFraction=serviceRemainingFraction(snapshot);
    let qty=(proj[day(snapDay)]||0)*todayFraction;
    const days=[];
    let d=addDays(snapDay,1);
    while(d<end){qty+=proj[day(d)]||0;days.push(new Date(d));d=addDays(d,1)}
    return {qty,todayFraction,days};
  }
  function fmtDate(d){return new Date(d).toLocaleDateString('es-AR')}
  function fmtTime(d){return new Date(d).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}

  window.MontiEngine.artOrder=function(stock,now=new Date()){
    const p=window.MontiEngine.plans(now).art;
    const snap=snapshotTimestamp(now);
    const lines=[];
    artItems.forEach(it=>{
      const proj=artProjection[norm(it.name)]||[];
      const preInfo=preDeliveryDemand(proj,snap,p.delivery);
      const pre=preInfo.qty;
      const cycle=p.coverage.reduce((a,d)=>a+(proj[day(d)]||0),0);
      const st=n(stock[it.stock]);
      const need=Math.max(0,cycle*(1+safety)-(st-pre));
      if(need<=0)return;
      let suggested;
      if(it.name==='Pan de volcán')suggested=Math.ceil(need/12);
      else if(it.round===5)suggested=Math.ceil(need/5)*5;
      else suggested=Math.ceil(need);
      lines.push({name:it.name,qty:suggested,unit:it.unit,forecast:cycle,stock:st,note:`stock ${fmtDate(snap)} ${fmtTime(snap)} · consumo hasta entrega ${pre.toFixed(1)} (hoy ${(preInfo.todayFraction*100).toFixed(0)}%) · cobertura +20%`});
    });
    return {provider:'La Artesanal',plan:p,lines,stockSnapshotDate:snap};
  };

  function isGnocchi29Product(name){
    const k=norm(name);
    return k.includes('noqui') || k.includes('gnoc') || k.includes('volcan');
  }
  function historicalRowsForDate(sales,dateIso){
    const matches=(sales||[]).filter(s=>s && !s.modifier && !s.cancelled && s.date && iso(s.date)===dateIso && isGnocchi29Product(s.product));
    const additions=matches.filter(s=>norm(s.source)==='adiciones');
    return additions.length?additions:matches;
  }

  window.MontiEngine.day29Order=function(stock,normal,sales,now=new Date()){
    const p=window.MontiEngine.plans(now).day29;
    const target=p.delivery;
    const coverage=normal?.plan?.coverage||[];
    const day29InsideCycle=coverage.some(d=>iso(d)===iso(target));
    if(!day29InsideCycle)return {provider:'La Artesanal · Día 29',plan:p,lines:[],warning:'El próximo día 29 no corresponde a esta entrega de La Artesanal.'};

    const historicalDates=[...new Set((sales||[])
      .filter(s=>s && !s.modifier && !s.cancelled && s.date && s.date<target && s.date.getDate()===29 && isGnocchi29Product(s.product))
      .map(s=>iso(s.date)))].sort();
    if(!historicalDates.length)return {provider:'La Artesanal · Día 29',plan:p,lines:[],warning:'No encontré ventas históricas de ñoquis/Volcán de días 29 en el Excel.'};

    const historicalPortions=historicalDates.map(ds=>historicalRowsForDate(sales,ds).reduce((a,s)=>a+n(s.qty),0));
    const avgPortions=historicalPortions.reduce((a,b)=>a+b,0)/historicalPortions.length;
    const specialKg=avgPortions*0.25;
    const after29=coverage.filter(d=>d>target).reduce((a,d)=>a+(artProjection.noquis[day(d)]||0),0);
    const targetKg=(specialKg+after29)*(1+safety);
    const currentStock=n(stock['Ñoquis']);
    const finalKg=Math.max(0,Math.ceil(Math.max(0,targetKg-currentStock)/5)*5);

    let gnocchiLine=normal?.lines?.find(x=>norm(x.name)==='noquis');
    const previousKg=gnocchiLine?.qty||0;
    if(finalKg>0){
      if(!gnocchiLine){gnocchiLine={name:'Ñoquis',qty:finalKg,unit:'kg',forecast:specialKg+after29,stock:currentStock,note:''};normal.lines.unshift(gnocchiLine)}
      else gnocchiLine.qty=Math.max(previousKg,finalKg);
      gnocchiLine.note=`Día 29 integrado · promedio ${avgPortions.toFixed(0)} porciones (${specialKg.toFixed(1)} kg) · ${historicalDates.length} fecha(s) · días posteriores ${after29.toFixed(1)} kg · +20% · stock ${currentStock}`;
    }

    const historicalVolcan=historicalDates.map(ds=>historicalRowsForDate(sales,ds).filter(s=>norm(s.product).includes('volcan')).reduce((a,s)=>a+n(s.qty),0));
    const avgVolcan=historicalVolcan.reduce((a,b)=>a+b,0)/historicalVolcan.length;
    const after29Panes=coverage.filter(d=>d>target).reduce((a,d)=>a+(artProjection['pan de volcan'][day(d)]||0),0);
    const targetPanUnits=(avgVolcan+after29Panes)*(1+safety);
    const currentPan=n(stock['Pan de volcán']);
    const finalPanBoxes=Math.max(0,Math.ceil(Math.max(0,targetPanUnits-currentPan)/12));
    let panLine=normal?.lines?.find(x=>norm(x.name)==='pan de volcan');
    const previousPanBoxes=panLine?.qty||0;
    if(finalPanBoxes>0){
      if(!panLine){panLine={name:'Pan de volcán',qty:finalPanBoxes,unit:'cajas x12',forecast:avgVolcan+after29Panes,stock:currentPan,note:''};normal.lines.push(panLine)}
      else panLine.qty=Math.max(previousPanBoxes,finalPanBoxes);
      panLine.note=`Día 29 integrado · promedio ${avgVolcan.toFixed(0)} Volcanes · días posteriores ${after29Panes.toFixed(0)} panes · +20% · stock ${currentPan}`;
    }

    const refuerzoKg=Math.max(0,finalKg-previousKg);
    const refuerzoPan=Math.max(0,finalPanBoxes-previousPanBoxes);
    const lines=[];
    if(refuerzoKg>0)lines.push({name:'Ñoquis (refuerzo incluido arriba)',qty:refuerzoKg,unit:'kg',note:`Total final de Ñoquis: ${finalKg} kg`});
    if(refuerzoPan>0)lines.push({name:'Pan volcán (refuerzo incluido arriba)',qty:refuerzoPan,unit:'cajas x12',note:`Total final de Pan de volcán: ${finalPanBoxes} cajas x12`});
    return {provider:'La Artesanal · Día 29',plan:p,lines,day29Stats:{historicalDates,historicalPortions,avgPortions,specialKg,avgVolcan,targetKg,finalKg,finalPanBoxes}};
  };

  function markStockNow(){localStorage.setItem(STOCK_META_KEY,new Date().toISOString())}
  const save=document.getElementById('saveStock');
  if(save)save.addEventListener('click',markStockNow,true);
  if(!localStorage.getItem(STOCK_META_KEY))markStockNow();
  if(typeof window.generateOrders==='function')window.generateOrders();
})();