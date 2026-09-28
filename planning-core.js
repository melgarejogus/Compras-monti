window.MontiPlanningCore=(()=>{
  const STOCK_META_KEY='monti.web.stock.v3.savedAt';
  const addDays=(d,k)=>{const x=new Date(d);x.setDate(x.getDate()+k);return x};
  const sameDate=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  const dayStart=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0,0);
  const serviceOpen=11, serviceClose=26;
  const providers={};

  function registerProvider(id,config){
    if(!id)throw new Error('provider id requerido');
    providers[id]={id,...config};
    return providers[id];
  }
  function provider(id){return providers[id]||null}
  function requireSchedule(id){
    const p=provider(id);
    if(!p||p.scheduleKnown===false||typeof p.nextDelivery!=='function'){
      return {ok:false,reason:`Falta configurar calendario de pedido/entrega para ${p?.label||id}.`};
    }
    return {ok:true,provider:p};
  }
  function snapshotAt(now=new Date()){
    const raw=localStorage.getItem(STOCK_META_KEY);
    const d=raw?new Date(raw):new Date(now);
    return isNaN(d)?new Date(now):d;
  }
  function saveSnapshotNow(){localStorage.setItem(STOCK_META_KEY,new Date().toISOString())}
  function nextWeekday(from,target){
    let d=dayStart(new Date(from));
    while(d.getDay()!==target)d=addDays(d,1);
    return d;
  }
  function operationalMinute(date){
    const mins=date.getHours()*60+date.getMinutes();
    return mins<120?mins+1440:mins;
  }
  function serviceFractionRemaining(ts){
    const m=operationalMinute(new Date(ts)),open=serviceOpen*60,close=serviceClose*60;
    if(m<open)return 1;
    if(m>=close)return 0;
    return (close-m)/(close-open);
  }
  function deliveryDayFraction(delivery,deliveryHour=11){
    const open=serviceOpen*60, close=serviceClose*60;
    let dm=deliveryHour*60;if(dm<120)dm+=1440;
    if(dm<=open)return 0;
    if(dm>=close)return 1;
    return (dm-open)/(close-open);
  }
  function consumptionWeights(snapshot,delivery,{consumeDeliveryDay=false,deliveryHour=11}={}){
    const snap=new Date(snapshot),del=new Date(delivery),out=[];
    let d=dayStart(snap),end=dayStart(del);
    if(d>end)return out;
    while(d<=end){
      let weight=1;
      if(sameDate(d,snap))weight=serviceFractionRemaining(snap);
      if(sameDate(d,del)){
        if(!consumeDeliveryDay)weight=0;
        else if(sameDate(d,snap)){
          const from=operationalMinute(snap),open=serviceOpen*60;
          let to=deliveryHour*60;if(to<120)to+=1440;
          weight=Math.max(0,Math.min(1,(to-Math.max(from,open))/((serviceClose-serviceOpen)*60)));
        }else weight=deliveryDayFraction(del,deliveryHour);
      }
      if(weight>0)out.push({date:new Date(d),weight});
      d=addDays(d,1);
    }
    return out;
  }
  function projectedStock({currentStock=0,snapshot,delivery,dailyDemand,schedule={}}){
    const weights=consumptionWeights(snapshot,delivery,schedule);
    const preConsumption=weights.reduce((sum,x)=>sum+(Number(dailyDemand(x.date))||0)*x.weight,0);
    return {projected:Number(currentStock||0)-preConsumption,preConsumption,weights};
  }
  function purchaseRequirement({projectedStock=0,coverageDemand=0,safety=.20,packSize=1,tolerance=0}){
    const target=Number(coverageDemand||0)*(1+safety);
    const raw=Math.max(0,target-Number(projectedStock||0));
    if(packSize<=1)return {target,raw,qty:Math.ceil(raw)};
    const packs=raw/packSize;
    const whole=Math.floor(packs),fraction=packs-whole;
    const qty=fraction>0&&fraction<=tolerance?whole:Math.ceil(packs);
    return {target,raw,qty:Math.max(0,qty)};
  }
  function weekdayAverages(rows,valueFn){
    const buckets=Array.from({length:7},()=>new Map());
    (rows||[]).forEach(r=>{
      if(!r?.date||r.cancelled||r.date.getDate()===29)return;
      const key=`${r.date.getFullYear()}-${r.date.getMonth()+1}-${r.date.getDate()}`;
      const wd=r.date.getDay();
      buckets[wd].set(key,(buckets[wd].get(key)||0)+(Number(valueFn(r))||0));
    });
    return buckets.map(m=>m.size?[...m.values()].reduce((a,b)=>a+b,0)/m.size:0);
  }

  registerProvider('artesanal',{label:'La Artesanal',scheduleKnown:true,nextDelivery(now){const t=nextWeekday(now,2),s=nextWeekday(now,6);return t<s?t:s},consumeDeliveryDay:false,deliveryHour:11});
  registerProvider('cdp',{label:'Centro de Producción',scheduleKnown:true,nextDelivery(now){let d=dayStart(new Date(now));while(![1,3,5].includes(d.getDay()))d=addDays(d,1);return d},consumeDeliveryDay:true,deliveryHour:23});
  registerProvider('breaders',{label:'Breaders',scheduleKnown:true,nextDelivery(now){return nextWeekday(now,2)},consumeDeliveryDay:false,deliveryHour:11});
  registerProvider('packaging',{label:'Packaging',scheduleKnown:false});

  return {registerProvider,provider,requireSchedule,snapshotAt,saveSnapshotNow,nextWeekday,serviceFractionRemaining,consumptionWeights,projectedStock,purchaseRequirement,weekdayAverages};
})();