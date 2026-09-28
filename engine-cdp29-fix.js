(()=>{
  const norm=window.MontiEngine.norm;
  const n=v=>Number(v||0)||0;
  const day=d=>d.getDay();
  const iso=d=>{const x=new Date(d);x.setHours(12,0,0,0);return x.toISOString().slice(0,10)};
  const safety=.20;
  const HISTORY_FROM=new Date(2026,6,1,0,0,0,0); // 01/07/2026

  const sauceSku={
    tuco:{name:'BOLSA TUCO X 4 kl',grams:4000},
    bolognesa:{name:'BOLSA Bolo x4 kg',grams:4000},
    bolo:{name:'BOLSA Bolo x4 kg',grams:4000},
    pesto:{name:'Bolsa Pesto x 1kg',grams:1000},
    blanca:{name:'Bolsa blanca x 2 kilos',grams:2000},
    'salsa blanca':{name:'Bolsa blanca x 2 kilos',grams:2000},
    cheddar:{name:'Bolsa de cheddar x 4kg',grams:4000},
    'mix quesos':{name:'Bolsa Mix de Queso x 2kl',grams:2000},
    'mix de quesos':{name:'Bolsa Mix de Queso x 2kl',grams:2000}
  };

  function sauceComponents(name){
    const k=norm(name);
    if(k.includes('rosa'))return [['tuco',110],['blanca',110]];
    if(k.includes('bolog'))return [['bolognesa',250]];
    if(k.includes('tuco'))return [['tuco',220]];
    if(k.includes('blanca')||k.includes('crema'))return [['blanca',220]];
    if(k.includes('mix')&&k.includes('ques'))return [['mix quesos',220]];
    if(k.includes('pesto'))return [['pesto',150]];
    if(k.includes('cheddar'))return [['cheddar',150]];
    return [];
  }

  function isGnocchi29Product(name){
    const k=norm(name);
    return k.includes('noqui')||k.includes('gnoc')||k.includes('volcan');
  }
  function isFocacciaPlate(name){
    const k=norm(name);
    return !k.includes('volcan')&&!k.includes('focacci')&&(/noqui|gnoc|raviol|sorrent|tallarin|spaghetti|fusil|macarr|pasta|lasagna|mila/.test(k));
  }

  // Promedios normales: desde julio 2026 y excluyendo SIEMPRE los días 29.
  function historicalWeekdayForecastNormal(sales,coverage,filter=()=>true){
    const byKey={};
    (sales||[]).filter(s=>filter(s)&&s.date&&!s.cancelled&&s.date>=HISTORY_FROM&&s.date.getDate()!==29).forEach(s=>{
      const k=norm(s.product);byKey[k]??={};byKey[k][day(s.date)]??={sum:0,dates:new Set()};
      byKey[k][day(s.date)].sum+=n(s.qty);byKey[k][day(s.date)].dates.add(iso(s.date));
    });
    const out={};
    for(const [k,wd] of Object.entries(byKey)){
      let total=0;coverage.forEach(d=>{const x=wd[day(d)];if(x)total+=x.sum/Math.max(1,x.dates.size)});out[k]=total;
    }
    return out;
  }

  function day29HistoricalDates(sales,target){
    return [...new Set((sales||[])
      .filter(s=>s&&s.date&&!s.cancelled&&s.date>=HISTORY_FROM&&s.date<target&&s.date.getDate()===29)
      .map(s=>iso(s.date)))].sort();
  }
  function rowsForDate(sales,dateIso){
    return (sales||[]).filter(s=>s&&!s.cancelled&&s.date&&iso(s.date)===dateIso);
  }

  // Construye el mix del 29 y FUERZA consistencia: el mix debe cubrir el 100% de
  // las porciones históricas de ñoquis/Volcán que requieren salsa. Si Fudo tiene
  // adiciones faltantes, conserva la distribución observada y la escala hasta la
  // cantidad total de porciones de ñoquis de ese 29.
  function buildDay29Mix(sales,target){
    const dates=day29HistoricalDates(sales,target);
    if(!dates.length)return {dates:[],avgSauceGrams:{},avgFocacciaPlates:0,avgGnocchiPortions:0,coverageRatio:0,details:[]};

    const perDate=dates.map(ds=>{
      const rows=rowsForDate(sales,ds);
      const gnocchiRows=rows.filter(r=>!r.modifier&&isGnocchi29Product(r.product));
      const gnocchiAdditions=gnocchiRows.filter(r=>norm(r.source)==='adiciones');
      const gnocchiBase=gnocchiAdditions.length?gnocchiAdditions:gnocchiRows.filter(r=>norm(r.source)!=='adiciones');
      const gnocchiPortions=gnocchiBase.reduce((a,r)=>a+n(r.qty),0);
      const gnocchiOrderIds=new Set(gnocchiRows.map(r=>String(r.orderId||'')).filter(Boolean));

      let sauceRows=rows.filter(r=>!r.modifier&&norm(r.source)==='adiciones'&&sauceComponents(r.product).length>0&&gnocchiOrderIds.has(String(r.orderId||'')));
      // Si no hay IDs utilizables, usamos las adiciones de salsa del día como fallback.
      if(!sauceRows.length)sauceRows=rows.filter(r=>!r.modifier&&norm(r.source)==='adiciones'&&sauceComponents(r.product).length>0);

      const observedSaucePortions=sauceRows.reduce((a,r)=>a+n(r.qty),0);
      const rawSauceGrams={};
      sauceRows.forEach(r=>sauceComponents(r.product).forEach(([key,g])=>{rawSauceGrams[key]=(rawSauceGrams[key]||0)+g*n(r.qty)}));

      // Si faltan adiciones, escalamos proporcionalmente el mix observado.
      const scale=observedSaucePortions>0&&gnocchiPortions>observedSaucePortions?gnocchiPortions/observedSaucePortions:1;
      const sauceGrams={};Object.entries(rawSauceGrams).forEach(([k,g])=>sauceGrams[k]=g*scale);

      const focacciaPlates=gnocchiBase.filter(r=>!norm(r.product).includes('volcan')).reduce((a,r)=>a+n(r.qty),0);
      return {date:ds,gnocchiPortions,observedSaucePortions,scale,sauceGrams,focacciaPlates};
    });

    const keys=[...new Set(perDate.flatMap(x=>Object.keys(x.sauceGrams)))];
    const avgSauceGrams={};keys.forEach(k=>avgSauceGrams[k]=perDate.reduce((a,x)=>a+(x.sauceGrams[k]||0),0)/perDate.length);
    const avgFocacciaPlates=perDate.reduce((a,x)=>a+x.focacciaPlates,0)/perDate.length;
    const avgGnocchiPortions=perDate.reduce((a,x)=>a+x.gnocchiPortions,0)/perDate.length;
    const avgObserved=perDate.reduce((a,x)=>a+x.observedSaucePortions,0)/perDate.length;
    const coverageRatio=avgGnocchiPortions>0?avgObserved/avgGnocchiPortions:0;
    return {dates,avgSauceGrams,avgFocacciaPlates,avgGnocchiPortions,coverageRatio,details:perDate};
  }

  function forecastMilaNormal(data,coverage,type){
    const valid=(data.modifiers||[]).filter(m=>!m.cancelled&&m.date&&m.date>=HISTORY_FROM&&m.date.getDate()!==29&&norm(m.group)==='tipo de milanesa'&&norm(m.modifier).includes(type));
    const pseudo=valid.map(m=>({product:type,date:m.date,qty:m.qty,cancelled:false}));
    return historicalWeekdayForecastNormal(pseudo,coverage)[type]||0;
  }

  const oldCdp=window.MontiEngine.cdpOrder;
  window.MontiEngine.cdpOrder=function(data,stock,now=new Date(),special29=false){
    if(special29){
      const p=window.MontiEngine.plans(now).day29;
      return {provider:'CDP · Día 29',plan:p,lines:[],warning:'Día 29 integrado automáticamente dentro del pedido principal de CDP.'};
    }

    const p=window.MontiEngine.plans(now).cdp;
    const base=(data.sales||[]).filter(s=>!s.modifier&&!s.cancelled);
    const forecast=historicalWeekdayForecastNormal(base,p.coverage);
    const addForecast=historicalWeekdayForecastNormal(data.sales||[],p.coverage,s=>norm(s.source)==='adiciones'&&sauceComponents(s.product).length>0);

    const normalNeeds={},specialNeeds={},directNormal={},directSpecial={};
    const addGram=(bucket,key,g)=>bucket[key]=(bucket[key]||0)+g;
    const addDirect=(bucket,name,q,note)=>{bucket[name]??={q:0,note};bucket[name].q+=q};

    Object.entries(addForecast).forEach(([name,q])=>sauceComponents(name).forEach(([k,g])=>addGram(normalNeeds,k,g*q)));
    Object.entries(forecast).forEach(([name,q])=>{
      const k=norm(name);
      if(k.includes('mac')&&k.includes('mila'))addGram(normalNeeds,'cheddar',75*q);
      else if(k.includes('mac')&&k.includes('cheese'))addGram(normalNeeds,'cheddar',150*q);
      else if(k.includes('papas')&&k.includes('cheddar'))addGram(normalNeeds,'cheddar',50*q);
      else if(k.includes('lasagna')&&k.includes('bolog')){addGram(normalNeeds,'blanca',100*q);addDirect(directNormal,'LASAGNA BOLOGNESA',q,'1 por plato')}
      else if(k.includes('lasagna')&&(k.includes('verde')||k.includes('espinaca'))){addGram(normalNeeds,'tuco',100*q);addDirect(directNormal,'LASAGANA VERDE',q,'1 por plato')}
      else if(k.includes('pastamila')||k.includes('mila napo'))addGram(normalNeeds,'tuco',150*q);
      if(k.includes('brasato'))addDirect(directNormal,'GRAND BRASATO X 2',q/2,'2 porciones por unidad');
      if(k.includes('empanad'))addDirect(directNormal,'Empanadas x 6',(k.includes('x6')||k.includes('x 6'))?q:q/6,'pack x6');
      if(k.includes('meatball')||k.includes('meat ball')||k.includes('albondig'))addDirect(directNormal,'Meat Ball x 5 porciones',q/5,'5 porciones por unidad');
    });

    const beef=forecastMilaNormal(data,p.coverage,'carne');if(beef>0)addDirect(directNormal,'Milanesa vacuna x 3kg',beef/12,'12 milanesas x paquete');
    const normalFocacciaPlates=Object.entries(forecast).filter(([k])=>isFocacciaPlate(k)).reduce((a,[,q])=>a+q,0);
    const focacciSand=Object.entries(forecast).filter(([k])=>/focacci/.test(norm(k))).reduce((a,[,q])=>a+q,0);
    addDirect(directNormal,'FOCACCIA X UNID',normalFocacciaPlates/28+focacciSand/8,'28 panes acompañamiento / 8 focacci sandwich');

    const day29=window.MontiEngine.plans(now).day29.delivery;
    const horizon=[p.delivery,...(p.coverage||[])].sort((a,b)=>a-b).at(-1)||p.delivery;
    const today=new Date(now);today.setHours(0,0,0,0);
    const d29=new Date(day29);d29.setHours(0,0,0,0);
    const last=new Date(horizon);last.setHours(23,59,59,999);
    const apply29=d29>=today&&d29<=last;
    const mix=apply29?buildDay29Mix(data.sales||[],day29):{dates:[],avgSauceGrams:{},avgFocacciaPlates:0,avgGnocchiPortions:0,coverageRatio:0,details:[]};

    if(apply29&&mix.dates.length){
      Object.entries(mix.avgSauceGrams).forEach(([k,g])=>addGram(specialNeeds,k,g));
      addDirect(directSpecial,'FOCACCIA X UNID',mix.avgFocacciaPlates/28,`Día 29: ${mix.avgFocacciaPlates.toFixed(0)} platos con focaccia / 28`);
    }

    const lines=[];
    const sauceKeys=[...new Set([...Object.keys(normalNeeds),...Object.keys(specialNeeds)])];
    sauceKeys.forEach(k=>{
      const sku=sauceSku[k];if(!sku)return;
      const normalG=normalNeeds[k]||0,specialG=specialNeeds[k]||0;
      // Normal +20%; especial 29 SIN margen extra.
      const targetG=normalG*(1+safety)+specialG;
      const st=n(stock[sku.name]);
      const qty=Math.max(0,Math.ceil(targetG/sku.grams-st));
      if(qty)lines.push({
        name:sku.name,qty,unit:'bolsas',forecast:targetG/sku.grams,stock:st,
        note:`${k} · normal ${(normalG/1000).toFixed(1)} kg +20%${specialG?` · Día 29 ${(specialG/1000).toFixed(1)} kg sin margen extra (${mix.dates.length} históricos, ${mix.avgGnocchiPortions.toFixed(0)} porciones cubiertas)`:''}`
      });
    });

    const directNames=[...new Set([...Object.keys(directNormal),...Object.keys(directSpecial)])];
    directNames.forEach(name=>{
      const vn=directNormal[name]?.q||0,vs=directSpecial[name]?.q||0;
      const target=vn*(1+safety)+vs;
      const st=n(stock[name]);const qty=Math.max(0,Math.ceil(target-st));
      if(qty)lines.push({name,qty,unit:'unidades',forecast:target,stock:st,note:`${directNormal[name]?.note||directSpecial[name]?.note||''}${vn?' · normal +20%':''}${vs?' · Día 29 sin margen extra':''}`});
    });

    const warning=apply29?(mix.dates.length?
      `Día 29 integrado con ${mix.dates.length} histórico(s) desde julio 2026. Mix de salsas normalizado para cubrir el 100% de ${mix.avgGnocchiPortions.toFixed(0)} porciones promedio. Cobertura explícita observada en Fudo: ${(mix.coverageRatio*100).toFixed(0)}%; faltantes completados respetando el mix histórico. El especial no lleva +20%; los días normales sí.`:
      'Día 29 corresponde a este ciclo, pero no encontré días 29 históricos utilizables desde julio 2026 en el Excel.'):
      'Los días 29 están excluidos de los promedios normales. Histórico normal desde julio 2026.';

    return {provider:'Centro de Producción',plan:p,lines,warning,day29Stats:{applied:apply29,dates:mix.dates,avgSauceGrams:mix.avgSauceGrams,avgFocacciaPlates:mix.avgFocacciaPlates,avgGnocchiPortions:mix.avgGnocchiPortions,coverageRatio:mix.coverageRatio,details:mix.details}};
  };

  if(typeof window.generateOrders==='function')window.generateOrders();
})();