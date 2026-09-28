(()=>{
  const norm=window.MontiEngine.norm;
  const n=v=>Number(v||0)||0;
  const addDays=(d,k)=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()+k);return x};
  const day=d=>d.getDay();
  const iso=d=>{const x=new Date(d);x.setHours(12,0,0,0);return x.toISOString().slice(0,10)};
  const safety=.20;

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

  // LINEA 1: proyecciones normales. Los días 29 se excluyen SIEMPRE.
  function historicalWeekdayForecastNormal(sales,coverage,filter=()=>true){
    const byKey={};
    (sales||[]).filter(s=>filter(s)&&s.date&&!s.cancelled&&s.date.getDate()!==29).forEach(s=>{
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
    return [...new Set((sales||[]).filter(s=>s&&s.date&&!s.cancelled&&s.date<target&&s.date.getDate()===29).map(s=>iso(s.date)))].sort();
  }

  function rowsForDate(sales,dateIso){
    return (sales||[]).filter(s=>s&&!s.modifier&&!s.cancelled&&s.date&&iso(s.date)===dateIso);
  }

  // LINEA 2: pedido especial. Acá se toman SOLO los 29 históricos.
  // El mix se arma dinámicamente. Con 1 día 29 usa ese; con N días usa el promedio de N.
  function buildDay29Mix(sales,target){
    const dates=day29HistoricalDates(sales,target);
    if(!dates.length)return {dates:[],avgSauceGrams:{},avgFocacciaPlates:0,details:[]};
    const perDate=dates.map(ds=>{
      const rows=rowsForDate(sales,ds);
      const gnocchiOrderIds=new Set(rows.filter(r=>isGnocchi29Product(r.product)).map(r=>String(r.orderId||'')).filter(Boolean));
      let sauceRows=rows.filter(r=>norm(r.source)==='adiciones'&&sauceComponents(r.product).length>0&&(!gnocchiOrderIds.size||gnocchiOrderIds.has(String(r.orderId||''))));
      if(!sauceRows.length)sauceRows=rows.filter(r=>norm(r.source)==='adiciones'&&sauceComponents(r.product).length>0);
      const sauceGrams={};
      sauceRows.forEach(r=>sauceComponents(r.product).forEach(([key,g])=>{sauceGrams[key]=(sauceGrams[key]||0)+g*n(r.qty)}));
      const gnocchiRows=rows.filter(r=>isGnocchi29Product(r.product));
      const additions=gnocchiRows.filter(r=>norm(r.source)==='adiciones');
      const base=additions.length?additions:gnocchiRows;
      const focacciaPlates=base.filter(r=>!norm(r.product).includes('volcan')).reduce((a,r)=>a+n(r.qty),0);
      return {date:ds,sauceGrams,focacciaPlates};
    });
    const keys=[...new Set(perDate.flatMap(x=>Object.keys(x.sauceGrams)))];
    const avgSauceGrams={};keys.forEach(k=>avgSauceGrams[k]=perDate.reduce((a,x)=>a+(x.sauceGrams[k]||0),0)/perDate.length);
    const avgFocacciaPlates=perDate.reduce((a,x)=>a+x.focacciaPlates,0)/perDate.length;
    return {dates,avgSauceGrams,avgFocacciaPlates,details:perDate};
  }

  function forecastMilaNormal(data,coverage,type){
    const valid=(data.modifiers||[]).filter(m=>!m.cancelled&&m.date&&m.date.getDate()!==29&&norm(m.group)==='tipo de milanesa'&&norm(m.modifier).includes(type));
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
    const needs={};const direct={};
    const addGram=(key,g)=>needs[key]=(needs[key]||0)+g;
    const addDirect=(name,q,note)=>{direct[name]??={q:0,note};direct[name].q+=q};

    Object.entries(addForecast).forEach(([name,q])=>sauceComponents(name).forEach(([k,g])=>addGram(k,g*q)));
    Object.entries(forecast).forEach(([name,q])=>{
      const k=norm(name);
      if(k.includes('mac')&&k.includes('mila'))addGram('cheddar',75*q);
      else if(k.includes('mac')&&k.includes('cheese'))addGram('cheddar',150*q);
      else if(k.includes('papas')&&k.includes('cheddar'))addGram('cheddar',50*q);
      else if(k.includes('lasagna')&&k.includes('bolog')){addGram('blanca',100*q);addDirect('LASAGNA BOLOGNESA',q,'1 por plato')}
      else if(k.includes('lasagna')&&(k.includes('verde')||k.includes('espinaca'))){addGram('tuco',100*q);addDirect('LASAGANA VERDE',q,'1 por plato')}
      else if(k.includes('pastamila')||k.includes('mila napo'))addGram('tuco',150*q);
      if(k.includes('brasato'))addDirect('GRAND BRASATO X 2',q/2,'2 porciones por unidad');
      if(k.includes('empanad'))addDirect('Empanadas x 6',(k.includes('x6')||k.includes('x 6'))?q:q/6,'pack x6');
      if(k.includes('meatball')||k.includes('meat ball')||k.includes('albondig'))addDirect('Meat Ball x 5 porciones',q/5,'5 porciones por unidad');
    });

    const beef=forecastMilaNormal(data,p.coverage,'carne');if(beef>0)addDirect('Milanesa vacuna x 3kg',beef/12,'12 milanesas x paquete');
    const normalFocacciaPlates=Object.entries(forecast).filter(([k])=>isFocacciaPlate(k)).reduce((a,[,q])=>a+q,0);
    const focacciSand=Object.entries(forecast).filter(([k])=>/focacci/.test(norm(k))).reduce((a,[,q])=>a+q,0);
    addDirect('FOCACCIA X UNID',normalFocacciaPlates/28+focacciSand/8,'28 panes acompañamiento / 8 focacci sandwich');

    const day29=window.MontiEngine.plans(now).day29.delivery;
    const horizon=[p.delivery,...(p.coverage||[])].sort((a,b)=>a-b).at(-1)||p.delivery;
    const today=new Date(now);today.setHours(0,0,0,0);
    const d29=new Date(day29);d29.setHours(0,0,0,0);
    const last=new Date(horizon);last.setHours(23,59,59,999);
    const apply29=d29>=today&&d29<=last;
    const mix=apply29?buildDay29Mix(data.sales||[],day29):{dates:[],avgSauceGrams:{},avgFocacciaPlates:0,details:[]};

    if(apply29&&mix.dates.length){
      Object.entries(mix.avgSauceGrams).forEach(([k,g])=>addGram(k,g));
      addDirect('FOCACCIA X UNID',mix.avgFocacciaPlates/28,`incluye Día 29: promedio ${mix.avgFocacciaPlates.toFixed(0)} platos de ñoquis con focaccia / 28`);
    }

    const lines=[];
    Object.entries(needs).forEach(([k,g])=>{
      const sku=sauceSku[k];if(!sku)return;
      const st=n(stock[sku.name]);const target=g*(1+safety)/sku.grams;const qty=Math.max(0,Math.ceil(target-st));
      if(qty)lines.push({name:sku.name,qty,unit:'bolsas',forecast:g/sku.grams,stock:st,note:`${k} · +20%${apply29&&mix.dates.length?` · Día 29 integrado (${mix.dates.length} histórico${mix.dates.length>1?'s':''})`:''}`});
    });
    Object.entries(direct).forEach(([name,v])=>{
      const st=n(stock[name]);const qty=Math.max(0,Math.ceil(v.q*(1+safety)-st));
      if(qty)lines.push({name,qty,unit:'unidades',forecast:v.q,stock:st,note:`${v.note} · +20%${name==='FOCACCIA X UNID'&&apply29&&mix.dates.length?` · Día 29 integrado (${mix.dates.length} histórico${mix.dates.length>1?'s':''})`:''}`});
    });

    const warning=apply29?(mix.dates.length?`Día 29 integrado: mix automático calculado con ${mix.dates.length} día(s) 29 histórico(s). Los 29 están excluidos de los promedios normales y usados sólo para este refuerzo.`:'Día 29 corresponde a este ciclo, pero no encontré días 29 históricos utilizables en el Excel.'):'Los días 29 están excluidos de los promedios normales.';
    return {provider:'Centro de Producción',plan:p,lines,warning,day29Stats:{applied:apply29,dates:mix.dates,avgSauceGrams:mix.avgSauceGrams,avgFocacciaPlates:mix.avgFocacciaPlates}};
  };

  if(typeof window.generateOrders==='function')window.generateOrders();
})();