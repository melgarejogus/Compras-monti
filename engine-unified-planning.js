(()=>{
  const core=window.MontiPlanningCore, E=window.MontiEngine;
  if(!core||!E)return;
  const norm=E.norm,n=v=>Number(v||0)||0,safety=.20;
  const fmt=d=>new Date(d).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});

  const artProjection={
    noquis:[7.33,4.38,3.35,3.42,8.94,4.33,7.66],fusiles:[2.84,3.75,1.70,2.18,2.15,1.73,2.29],macarrones:[1.55,1.05,2.07,1.03,1.17,1.13,1.20],spaghetti:[1.88,1.03,.95,3.73,1.10,1.13,1.38],
    'ravioles pollo y verdura':[2.97,1.84,1.25,1.31,1.19,1.53,2.69],'ravioles de ricota':[1.84,.97,.81,.84,1.03,.59,1.19],'raviolones de batata':[3.33,2.06,1.11,1.61,1.83,2.22,3.70],'pan de volcan':[15,7,4,7,13,7,17]
  };
  const artItems=[['Ñoquis','kg',5],['Fusiles','kg',5],['Macarrones','kg',5],['Spaghetti','kg',5],['Ravioles pollo y verdura','cajas',1],['Ravioles de ricota','cajas',1],['Raviolones de batata','cajas',1],['Pan de volcán','cajas x12',12]];
  E.artOrder=function(stock,now=new Date()){
    const p=E.plans(now).art,snap=core.snapshotAt(now),cfg=core.provider('artesanal'),lines=[];
    artItems.forEach(([name,unit,round])=>{
      const proj=artProjection[norm(name)]||[],daily=d=>proj[d.getDay()]||0;
      const projected=core.projectedStock({currentStock:n(stock[name]),snapshot:snap,delivery:p.delivery,dailyDemand:daily,schedule:cfg});
      const coverageDemand=(p.coverage||[]).reduce((a,d)=>a+daily(d),0);
      const need=Math.max(0,coverageDemand*(1+safety)-projected.projected);
      if(need<=0)return;
      const qty=name==='Pan de volcán'?Math.ceil(need/12):round===5?Math.ceil(need/5)*5:Math.ceil(need);
      lines.push({name,qty,unit,forecast:coverageDemand,stock:n(stock[name]),note:`motor único · stock ${fmt(snap)} · consumo hasta entrega ${projected.preConsumption.toFixed(1)} · stock proyectado ${projected.projected.toFixed(1)} · cobertura +20%`});
    });
    return {provider:'La Artesanal',plan:p,lines,stockSnapshotDate:snap};
  };

  const sauceSku={tuco:['BOLSA TUCO X 4 kl',4000],bolognesa:['BOLSA Bolo x4 kg',4000],pesto:['Bolsa Pesto x 1kg',1000],blanca:['Bolsa blanca x 2 kilos',2000],cheddar:['Bolsa de cheddar x 4kg',4000],'mix quesos':['Bolsa Mix de Queso x 2kl',2000]};
  function sauceComponents(name){const k=norm(name);if(k.includes('rosa'))return [['tuco',110],['blanca',110]];if(k.includes('bolog'))return [['bolognesa',250]];if(k.includes('tuco'))return [['tuco',220]];if(k.includes('blanca')||k.includes('crema'))return [['blanca',220]];if(k.includes('mix')&&k.includes('ques'))return [['mix quesos',220]];if(k.includes('pesto'))return [['pesto',150]];if(k.includes('cheddar'))return [['cheddar',150]];return []}
  function isPrincipal(s){return !s.modifier&&!s.cancelled&&norm(s.source)!=='adiciones'}
  function cdpUsageRows(data){
    const perDate=new Map();
    const add=(date,sku,qty)=>{if(!date||date.getDate()===29)return;const key=`${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`;if(!perDate.has(key))perDate.set(key,{date,new Map()});const m=perDate.get(key).m;m.set(sku,(m.get(sku)||0)+qty)};
    (data.sales||[]).forEach(s=>{
      if(!s?.date||s.cancelled||s.modifier||s.date.getDate()===29)return;
      const src=norm(s.source),k=norm(s.product),q=n(s.qty);
      if(src==='adiciones'){
        sauceComponents(s.product).forEach(([sk,g])=>{const def=sauceSku[sk];if(def)add(s.date,def[0],q*g/def[1])});
        return;
      }
      if(k.includes('mac')&&k.includes('mila'))add(s.date,sauceSku.cheddar[0],q*75/sauceSku.cheddar[1]);
      else if(k.includes('mac')&&k.includes('cheese'))add(s.date,sauceSku.cheddar[0],q*150/sauceSku.cheddar[1]);
      else if(k.includes('papas')&&k.includes('cheddar'))add(s.date,sauceSku.cheddar[0],q*50/sauceSku.cheddar[1]);
      if(k.includes('lasagna')&&k.includes('bolog')){add(s.date,sauceSku.blanca[0],q*100/sauceSku.blanca[1]);add(s.date,'LASAGNA BOLOGNESA',q)}
      else if(k.includes('lasagna')&&(k.includes('verde')||k.includes('espinaca'))){add(s.date,sauceSku.tuco[0],q*100/sauceSku.tuco[1]);add(s.date,'LASAGANA VERDE',q)}
      else if(k.includes('pastamila')||k.includes('mila napo'))add(s.date,sauceSku.tuco[0],q*150/sauceSku.tuco[1]);
      if(k.includes('brasato'))add(s.date,'GRAND BRASATO X 2',q/2);
      if(k.includes('empanad'))add(s.date,'Empanadas x 6',(k.includes('x6')||k.includes('x 6'))?q:q/6);
      if(k.includes('meatball')||k.includes('meat ball')||k.includes('albondig'))add(s.date,'Meat Ball x 5 porciones',q/5);
      const focacciPlate=!k.includes('volcan')&&!k.includes('focacci')&&(/noqui|raviol|sorrent|tallarin|spaghetti|fusil|macarr|pasta|lasagna|mila/.test(k));
      if(focacciPlate)add(s.date,'FOCACCIA X UNID',q/28);
      if(k.includes('focacci'))add(s.date,'FOCACCIA X UNID',q/8);
    });
    (data.modifiers||[]).forEach(m=>{if(!m?.date||m.cancelled||m.date.getDate()===29)return;if(norm(m.group)==='tipo de milanesa'&&norm(m.modifier).includes('carne'))add(m.date,'Milanesa vacuna x 3kg',n(m.qty)/12)});
    return [...perDate.values()];
  }
  function cdpAverages(data){
    const rows=cdpUsageRows(data),out={};
    rows.forEach(r=>r.m.forEach((_,sku)=>{if(!out[sku])out[sku]=Array(7).fill(0)}));
    Object.keys(out).forEach(sku=>{
      const byWd=Array.from({length:7},()=>[]);
      rows.forEach(r=>byWd[r.date.getDay()].push(r.m.get(sku)||0));
      out[sku]=byWd.map(a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0);
    });
    return out;
  }
  const oldCdp=E.cdpOrder.bind(E);
  E.cdpOrder=function(data,stock,now=new Date(),special29=false){
    if(special29)return oldCdp(data,stock,now,true);
    const scheduleCheck=core.requireSchedule('cdp');if(!scheduleCheck.ok){const o=oldCdp(data,stock,now,false);o.warning=scheduleCheck.reason;return o}
    const p=E.plans(now).cdp,snap=core.snapshotAt(now),avg=cdpAverages(data),projectedStock={...stock},preBySku={};
    Object.keys(stock||{}).forEach(sku=>{const arr=avg[sku]||Array(7).fill(0);const info=core.projectedStock({currentStock:n(stock[sku]),snapshot:snap,delivery:p.delivery,dailyDemand:d=>arr[d.getDay()]||0,schedule:scheduleCheck.provider});projectedStock[sku]=info.projected;preBySku[sku]=info.preConsumption});
    const result=oldCdp(data,projectedStock,now,false);
    (result.lines||[]).forEach(l=>{const pre=preBySku[l.name]||0;l.note=`${l.note||''} · motor único · stock ${fmt(snap)} · consumo hasta entrega ${pre.toFixed(2)} · stock proyectado ${n(projectedStock[l.name]).toFixed(2)}`});
    result.stockSnapshotDate=snap;return result;
  };

  const oldBreaders=E.breadersOrder.bind(E);
  E.breadersOrder=function(data,stock,now=new Date()){
    const scheduleCheck=core.requireSchedule('breaders');if(!scheduleCheck.ok){const o=oldBreaders(data,stock,now);o.warning=scheduleCheck.reason;return o}
    const p=E.plans(now).breaders,snap=core.snapshotAt(now);
    const rows=(data.modifiers||[]).filter(m=>m?.date&&!m.cancelled&&m.date.getDate()!==29&&norm(m.group)==='tipo de milanesa'&&norm(m.modifier).includes('pollo'));
    const avg=core.weekdayAverages(rows,r=>n(r.qty)/20);
    const current=n(stock['Milanesa pollo x 5kg']??stock['Milanesa pollo']);
    const proj=core.projectedStock({currentStock:current,snapshot:snap,delivery:p.delivery,dailyDemand:d=>avg[d.getDay()]||0,schedule:scheduleCheck.provider});
    const adjusted={...stock,'Milanesa pollo x 5kg':proj.projected,'Milanesa pollo':proj.projected};
    const result=oldBreaders(data,adjusted,now);
    (result.lines||[]).forEach(l=>l.note=`${l.note||''} · motor único · stock ${fmt(snap)} · consumo hasta entrega ${proj.preConsumption.toFixed(2)} cajas · stock proyectado ${proj.projected.toFixed(2)}`);
    result.stockSnapshotDate=snap;return result;
  };

  const oldPackaging=E.packagingOrder.bind(E);
  E.packagingOrder=function(data,stock,now=new Date()){
    const result=oldPackaging(data,stock,now);
    const scheduleCheck=core.requireSchedule('packaging');
    if(!scheduleCheck.ok)result.warning=`${scheduleCheck.reason} Hasta definirlo, Packaging mantiene el cálculo de cobertura de 15 días y NO puede proyectar stock a una fecha de entrega.`;
    return result;
  };

  const save=document.getElementById('saveStock');if(save)save.addEventListener('click',()=>core.saveSnapshotNow(),true);
})();