(()=>{
  const E=window.MontiEngine;if(!E)return;
  const norm=E.norm,n=v=>Number(v||0)||0;
  const iso=d=>{const x=new Date(d);x.setHours(12,0,0,0);return x.toISOString().slice(0,10)};
  const day=d=>d.getDay();
  const JULY_START=new Date(2026,6,1,0,0,0,0);
  const noquiProj=[7.33,4.38,3.35,3.42,8.94,4.33,7.66];
  const panProj=[15,7,4,7,13,7,17];
  function isGnocchi29Product(name){const k=norm(name);return k.includes('noqui')||k.includes('gnoc')||k.includes('volcan')}
  function rowsForDate(sales,ds){
    const matches=(sales||[]).filter(s=>s&&!s.modifier&&!s.cancelled&&s.date&&iso(s.date)===ds&&isGnocchi29Product(s.product));
    const additions=matches.filter(s=>norm(s.source)==='adiciones');
    return additions.length?additions:matches;
  }
  E.day29Order=function(stock,normal,sales,now=new Date()){
    const p=E.plans(now).day29,target=p.delivery,coverage=normal?.plan?.coverage||[];
    if(!coverage.some(d=>iso(d)===iso(target)))return {provider:'La Artesanal · Día 29',plan:p,lines:[],warning:'El próximo día 29 no corresponde a esta entrega de La Artesanal.'};
    const historicalDates=[...new Set((sales||[]).filter(s=>s&&!s.modifier&&!s.cancelled&&s.date&&s.date>=JULY_START&&s.date<target&&s.date.getDate()===29&&isGnocchi29Product(s.product)).map(s=>iso(s.date)))].sort();
    if(!historicalDates.length)return {provider:'La Artesanal · Día 29',plan:p,lines:[],warning:'No encontré días 29 históricos desde julio 2026 en el Excel.'};
    const historicalPortions=historicalDates.map(ds=>rowsForDate(sales,ds).reduce((a,s)=>a+n(s.qty),0));
    const avgPortions=historicalPortions.reduce((a,b)=>a+b,0)/historicalPortions.length;
    const specialKg=avgPortions*.25;
    const after29=coverage.filter(d=>d>target).reduce((a,d)=>a+(noquiProj[day(d)]||0),0);
    const targetKg=specialKg+after29*1.20;
    const currentStock=n(stock['Ñoquis']);
    const finalKg=Math.max(0,Math.ceil(Math.max(0,targetKg-currentStock)/5)*5);
    let gnocchiLine=normal?.lines?.find(x=>norm(x.name)==='noquis');const previousKg=gnocchiLine?.qty||0;
    if(finalKg>0){
      if(!gnocchiLine){gnocchiLine={name:'Ñoquis',qty:finalKg,unit:'kg',forecast:specialKg+after29,stock:currentStock,note:''};normal.lines.unshift(gnocchiLine)}
      else gnocchiLine.qty=Math.max(previousKg,finalKg);
      gnocchiLine.note=`Día 29 integrado · promedio ${avgPortions.toFixed(0)} porciones (${specialKg.toFixed(1)} kg) · ${historicalDates.length} fecha(s) desde jul/2026 · días posteriores ${after29.toFixed(1)} kg +20% · especial sin margen extra · stock ${currentStock}`;
    }
    const historicalVolcan=historicalDates.map(ds=>rowsForDate(sales,ds).filter(s=>norm(s.product).includes('volcan')).reduce((a,s)=>a+n(s.qty),0));
    const avgVolcan=historicalVolcan.reduce((a,b)=>a+b,0)/historicalVolcan.length;
    const after29Panes=coverage.filter(d=>d>target).reduce((a,d)=>a+(panProj[day(d)]||0),0);
    const targetPanUnits=avgVolcan+after29Panes*1.20;
    const currentPan=n(stock['Pan de volcán']);
    const finalPanBoxes=Math.max(0,Math.ceil(Math.max(0,targetPanUnits-currentPan)/12));
    let panLine=normal?.lines?.find(x=>norm(x.name)==='pan de volcan');const previousPanBoxes=panLine?.qty||0;
    if(finalPanBoxes>0){
      if(!panLine){panLine={name:'Pan de volcán',qty:finalPanBoxes,unit:'cajas x12',forecast:avgVolcan+after29Panes,stock:currentPan,note:''};normal.lines.push(panLine)}
      else panLine.qty=Math.max(previousPanBoxes,finalPanBoxes);
      panLine.note=`Día 29 integrado · promedio ${avgVolcan.toFixed(0)} Volcanes · ${historicalDates.length} fecha(s) desde jul/2026 · días posteriores ${after29Panes.toFixed(0)} panes +20% · especial sin margen extra · stock ${currentPan}`;
    }
    const lines=[];const refuerzoKg=Math.max(0,finalKg-previousKg),refuerzoPan=Math.max(0,finalPanBoxes-previousPanBoxes);
    if(refuerzoKg>0)lines.push({name:'Ñoquis (refuerzo incluido arriba)',qty:refuerzoKg,unit:'kg',note:`Total final de Ñoquis: ${finalKg} kg`});
    if(refuerzoPan>0)lines.push({name:'Pan volcán (refuerzo incluido arriba)',qty:refuerzoPan,unit:'cajas x12',note:`Total final de Pan de volcán: ${finalPanBoxes} cajas x12`});
    return {provider:'La Artesanal · Día 29',plan:p,lines,day29Stats:{historicalDates,historicalPortions,avgPortions,specialKg,avgVolcan,targetKg,finalKg,finalPanBoxes}};
  };

  // CDP: el especial del 29 sólo pertenece a una compra si el 29 está realmente
  // dentro de las fechas que ESA entrega debe cubrir. Si hoy es 29 y la entrega es
  // mañana (30), no se vuelve a comprar el consumo especial de hoy.
  const cdpOrderBeforeCycleGuard=E.cdpOrder;
  E.cdpOrder=function(data,stock,now=new Date(),special29=false){
    if(special29)return cdpOrderBeforeCycleGuard(data,stock,now,true);
    const realPlans=E.plans(now);
    const target29=realPlans?.day29?.delivery;
    const coverage=realPlans?.cdp?.coverage||[];
    const day29BelongsToThisDelivery=!!target29&&coverage.some(d=>iso(d)===iso(target29));
    if(day29BelongsToThisDelivery)return cdpOrderBeforeCycleGuard(data,stock,now,false);

    const originalPlans=E.plans;
    E.plans=function(t){
      const p=originalPlans(t);
      const fake29=new Date(p.day29.delivery);
      fake29.setMonth(fake29.getMonth()+1);
      return {...p,day29:{...p.day29,delivery:fake29}};
    };
    try{
      const result=cdpOrderBeforeCycleGuard(data,stock,now,false);
      if(result?.day29Stats)result.day29Stats={...result.day29Stats,applied:false};
      if(result)result.warning='Día 29 NO integrado en esta entrega de CDP: el 29 no está dentro de su cobertura. Se calculan sólo los días que esta entrega puede abastecer.';
      return result;
    }finally{
      E.plans=originalPlans;
    }
  };

  if(typeof window.generateOrders==='function')window.generateOrders();
})();