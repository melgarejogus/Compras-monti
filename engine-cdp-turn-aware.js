(()=>{
  const E=window.MontiEngine, core=window.MontiPlanningCore;
  if(!E||!core)return;
  const norm=E.norm,n=v=>Number(v||0)||0;
  const HISTORY_FROM=new Date(2026,6,1,0,0,0,0);
  const sauceSku={
    tuco:['BOLSA TUCO X 4 kl',4000],
    bolognesa:['BOLSA Bolo x4 kg',4000],
    pesto:['Bolsa Pesto x 1kg',1000],
    blanca:['Bolsa blanca x 2 kilos',2000],
    cheddar:['Bolsa de cheddar x 4kg',4000],
    'mix quesos':['Bolsa Mix de Queso x 2kl',2000]
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
  function isGnocchi29Product(name){const k=norm(name);return k.includes('noqui')||k.includes('gnoc')||k.includes('volcan')}
  function sameDate(a,b){return a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()}
  function minuteOf(d){return d.getHours()*60+d.getMinutes()}
  function hasRealTime(rows){return rows.some(r=>r?.date&&(r.date.getHours()!==12||r.date.getMinutes()!==0))}

  // Promedio normal por día de semana, excluyendo 29, expresado en unidades de compra.
  function normalDailyBySku(data){
    const perDate=new Map();
    const add=(date,sku,qty)=>{
      if(!date||date<HISTORY_FROM||date.getDate()===29)return;
      const key=`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;
      if(!perDate.has(key))perDate.set(key,{date,m:new Map()});
      const m=perDate.get(key).m;m.set(sku,(m.get(sku)||0)+qty);
    };
    (data.sales||[]).forEach(s=>{
      if(!s?.date||s.cancelled||s.modifier)return;
      const src=norm(s.source),k=norm(s.product),q=n(s.qty);
      if(src==='adiciones'){
        sauceComponents(s.product).forEach(([sk,g])=>{const def=sauceSku[sk];if(def)add(s.date,def[0],q*g/def[1])});
        return;
      }
      const focacciPlate=!k.includes('volcan')&&!k.includes('focacci')&&(/noqui|gnoc|raviol|sorrent|tallarin|spaghetti|fusil|macarr|pasta|lasagna|mila/.test(k));
      if(focacciPlate)add(s.date,'FOCACCIA X UNID',q/28);
      if(k.includes('focacci'))add(s.date,'FOCACCIA X UNID',q/8);
    });
    const out={};
    for(const r of perDate.values())for(const sku of r.m.keys()){
      out[sku]??=Array.from({length:7},()=>new Map());
      const wd=r.date.getDay();out[sku][wd].set(`${r.date.getFullYear()}-${r.date.getMonth()+1}-${r.date.getDate()}`,r.m.get(sku)||0);
    }
    const avg={};
    for(const [sku,buckets] of Object.entries(out))avg[sku]=buckets.map(m=>m.size?[...m.values()].reduce((a,b)=>a+b,0)/m.size:0);
    return avg;
  }

  // Consumo especial restante del 29 a partir de la hora exacta del stock.
  // Usa todos los 29 históricos desde julio. Si el Excel conserva horario, calcula
  // qué proporción del pico ocurrió después de esa hora; si no, usa el porcentaje
  // restante de jornada como fallback.
  function remainingDay29BySku(data,snapshot){
    if(snapshot.getDate()!==29)return {bySku:{},dates:[],remainingRatio:0,mode:'none'};
    const histDates=[...new Set((data.sales||[]).filter(s=>s?.date&&!s.cancelled&&s.date>=HISTORY_FROM&&s.date<snapshot&&s.date.getDate()===29).map(s=>`${s.date.getFullYear()}-${s.date.getMonth()+1}-${s.date.getDate()}`))];
    if(!histDates.length)return {bySku:{},dates:[],remainingRatio:0,mode:'none'};
    const snapMin=minuteOf(snapshot),perDate=[];
    for(const ds of histDates){
      const rows=(data.sales||[]).filter(s=>s?.date&&!s.cancelled&&`${s.date.getFullYear()}-${s.date.getMonth()+1}-${s.date.getDate()}`===ds);
      const gn=rows.filter(r=>!r.modifier&&isGnocchi29Product(r.product));
      const gnAdd=gn.filter(r=>norm(r.source)==='adiciones');
      const gnBase=gnAdd.length?gnAdd:gn.filter(r=>norm(r.source)!=='adiciones');
      const totalGn=gnBase.reduce((a,r)=>a+n(r.qty),0);
      if(totalGn<=0)continue;
      const timed=hasRealTime(gnBase);
      const remainingGn=timed?gnBase.filter(r=>minuteOf(r.date)>=snapMin).reduce((a,r)=>a+n(r.qty),0):totalGn*core.serviceFractionRemaining(snapshot);
      const ratio=Math.max(0,Math.min(1,remainingGn/totalGn));
      const gnIds=new Set(gn.map(r=>String(r.orderId||'')).filter(Boolean));
      let sauceRows=rows.filter(r=>!r.modifier&&norm(r.source)==='adiciones'&&sauceComponents(r.product).length>0&&gnIds.has(String(r.orderId||'')));
      if(!sauceRows.length)sauceRows=rows.filter(r=>!r.modifier&&norm(r.source)==='adiciones'&&sauceComponents(r.product).length>0);
      const observed=sauceRows.reduce((a,r)=>a+n(r.qty),0);
      const scale=observed>0&&totalGn>observed?totalGn/observed:1;
      const usage={};
      sauceRows.forEach(r=>sauceComponents(r.product).forEach(([sk,g])=>{
        const def=sauceSku[sk];if(!def)return;
        usage[def[0]]=(usage[def[0]]||0)+(n(r.qty)*g*scale/def[1]);
      }));
      const focPlates=gnBase.filter(r=>!norm(r.product).includes('volcan')).reduce((a,r)=>a+n(r.qty),0);
      usage['FOCACCIA X UNID']=(usage['FOCACCIA X UNID']||0)+focPlates/28;
      Object.keys(usage).forEach(k=>usage[k]*=ratio);
      perDate.push({usage,ratio,timed});
    }
    const keys=[...new Set(perDate.flatMap(x=>Object.keys(x.usage)))],bySku={};
    keys.forEach(k=>bySku[k]=perDate.reduce((a,x)=>a+(x.usage[k]||0),0)/Math.max(1,perDate.length));
    const remainingRatio=perDate.reduce((a,x)=>a+x.ratio,0)/Math.max(1,perDate.length);
    return {bySku,dates:histDates,remainingRatio,mode:perDate.some(x=>x.timed)?'hora histórica':'fracción de jornada'};
  }

  const baseCdp=E.cdpOrder.bind(E);
  E.cdpOrder=function(data,stock,now=new Date(),special29=false){
    if(special29)return baseCdp(data,stock,now,true);
    const snap=core.snapshotAt(now),p=E.plans(now).cdp;
    const snapDay=new Date(snap.getFullYear(),snap.getMonth(),snap.getDate());
    const delDay=new Date(p.delivery.getFullYear(),p.delivery.getMonth(),p.delivery.getDate());
    if(snap.getDate()!==29||snapDay>=delDay)return baseCdp(data,stock,now,false);

    const special=remainingDay29BySku(data,snap);
    if(!special.dates.length)return baseCdp(data,stock,now,false);
    const normal=normalDailyBySku(data),remainingFrac=core.serviceFractionRemaining(snap),adjusted={...stock},adjustments={};
    for(const [sku,specialRemain] of Object.entries(special.bySku)){
      const normalToday=(normal[sku]?.[snap.getDay()]||0)*remainingFrac;
      const delta=specialRemain-normalToday;
      if(Math.abs(delta)<0.0001)continue;
      adjusted[sku]=n(stock[sku])-delta;
      adjustments[sku]={specialRemain,normalToday,delta};
    }
    const result=baseCdp(data,adjusted,now,false);
    (result.lines||[]).forEach(l=>{
      const a=adjustments[l.name];if(!a)return;
      l.note=`${l.note||''} · hoy 29 restante: ${a.specialRemain.toFixed(2)} ${l.unit||'u'} (reemplaza ${a.normalToday.toFixed(2)} normal) · cálculo según ${special.mode}`;
    });
    const pct=(special.remainingRatio*100).toFixed(0);
    result.warning=`${result.warning||''} Stock tomado el 29 a las ${snap.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}: antes de la entrega se descuenta el consumo especial restante del 29 (${pct}% promedio pendiente según ${special.mode}) y luego el consumo del 30 hasta la llegada del CDP. La entrega del 30 cubre sólo 1/10 y 2/10; el 29 no se vuelve a sumar como cobertura.`.trim();
    result.turnAware29={snapshot:snap,remainingRatio:special.remainingRatio,mode:special.mode,dates:special.dates,adjustments};
    return result;
  };
})();