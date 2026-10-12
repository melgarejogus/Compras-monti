(()=>{
const E=window.MontiEngine,core=window.MontiPlanningCore;
if(!E||!core)return;
const n=x=>Number(x)||0, norm=E.norm;
const defs=[
 {name:'Ñoquis',base:'Ñoquis',kg:true,portions:[['Ñoquis porciones',.25]]},
 {name:'Fusiles',base:'Fusiles',kg:true,portions:[['Fusiles porciones',.2]]},
 {name:'Macarrones',base:'Macarrones',kg:true,portions:[['Macarrones porciones',.2]]},
 {name:'Spaghetti',base:'Spaghetti',kg:true,portions:[['Spaghetti porciones 200g',.2],['Spaghetti porciones 150g',.15]]},
 {name:'Rigatoni',base:'Rigatoni',kg:true,portions:[['Rigatoni porciones',.2]]},
 {name:'Ravioles pollo y verdura',base:'Ravioles pollo y verdura',portions:[['Ravioles pollo y verdura porciones',.375]]},
 {name:'Ravioles de ricota',base:'Ravioles de ricota',portions:[['Ravioles de ricota porciones',.375]]},
 {name:'Raviolones de batata',base:'Raviolones de batata',portions:[['Raviolones de batata porciones',2/3]]},
 {name:'Pan de volcán',base:'Pan de volcán',volcan:true,portions:[]}
];
const synonyms={
 'Ñoquis':/noqui|ñoqui|gnocchi|gnoc/,
 'Fusiles':/fusil|fusill/,
 'Macarrones':/macarr|mac and cheese|mac & cheese/,
 'Spaghetti':/spaghetti|tallarin|tallarín/,
 'Rigatoni':/rigat|rigati/,
 'Ravioles pollo y verdura':/raviol.*(pollo|verdura)/,
 'Ravioles de ricota':/raviol.*ricota/,
 'Raviolones de batata':/raviol.*batata/,
 'Pan de volcán':/volcan|volcán/
};
function classify(product){
 const k=norm(product);
 // Volcanes no consumen además ñoquis en el mismo conteo.
 if(synonyms['Pan de volcán'].test(k))return 'Pan de volcán';
 for(const d of defs.slice(0,-1))if(synonyms[d.name].test(k))return d.name;
 return null;
}
function forecasts(sales,modifiers=[]){
 const days=new Map(),seenDates=new Map();
 const parentOrders=new Map();
 for(const p of sales||[]){if(p?.orderId&&!p.cancelled&&!p.modifier){const id=String(p.orderId);if(!parentOrders.has(id))parentOrders.set(id,[]);parentOrders.get(id).push(p)}}
 const resolved=new Set(),resolvedOrderSku=new Set();
 for(const m of modifiers||[]){
  if(m.cancelled||!m.date||!m.orderId)continue;
  if(norm(m.group)!=='tipo de pastas')continue;
  const sku=classify(m.modifier);if(!sku||sku==='Pan de volcán')continue;
  const parents=parentOrders.get(String(m.orderId))||[];
  const eligible=parents.filter(p=>norm(p.product)===norm(m.product)&&/pastas clasicas|combo|elegi|menu/i.test(norm(p.product)));
  if(!eligible.length)continue;
  const date=new Date(m.date),dateKey=[date.getFullYear(),date.getMonth()+1,date.getDate()].join('-');
  const factor=sku==='Pan de volcán'?1:sku==='Ñoquis'?.25:sku==='Fusiles'||sku==='Macarrones'||sku==='Spaghetti'||sku==='Rigatoni'?.2:sku==='Ravioles pollo y verdura'||sku==='Ravioles de ricota'?.375:2/3;
  const key=sku+'|'+dateKey, unique=String(m.orderId)+'|'+String(m.additionId||m.product)+'|'+sku+'|'+norm(m.modifier);
  if(resolved.has(unique))continue;
  resolved.add(unique);resolvedOrderSku.add(String(m.orderId)+'|'+norm(m.product)+'|'+sku);days.set(key,(days.get(key)||0)+n(m.qty)*factor);seenDates.set(dateKey,date.getDay());
 }
 for(const s of sales||[]){
  if(!s?.date||s.cancelled||s.modifier||s.date.getDate()===29)continue;
  const date=new Date(s.date),dateKey=[date.getFullYear(),date.getMonth()+1,date.getDate()].join('-');
  const source=norm(s.source||'');
  if(source==='adiciones')continue;
  let sku=classify(s.product);
  const label=norm(s.product);
  // Recetas conocidas: un plato de pasta por cada unidad del producto, salvo promos de dos platos.
  if(/pastamila|pasta mila/.test(label))sku='Spaghetti';
  if(/combo ravioles/.test(label))sku='Ravioles de ricota';
  if(/grand brasato|brasato raviolo/.test(label))continue;
  if(/miercoles- mila \+ spag/.test(label))sku='Spaghetti';
  if(/mac & mila|mac and cheese|mac & cheese|mac monti|mac campeones|mac burguer/.test(label))sku='Macarrones';
  if(/combo tallarines/.test(label))sku='Spaghetti';
  if(/2 platos de fusiles|2 fusilis para compartir/.test(label))sku='Fusiles';
  if(!sku)continue;
  if(s.orderId&&resolvedOrderSku.has(String(s.orderId)+'|'+norm(s.product)+'|'+sku))continue;
  // Los platos genéricos requieren leer modificadores; no atribuirlos a un SKU por su nombre comercial.
  if(/pastas clasicas|pastas clasicas|pastas simples|combo/i.test(norm(s.product)))continue;
  const key=sku+'|'+dateKey,qty=n(s.qty)*(/2 platos de fusiles|2 fusilis para compartir/.test(label)?2:1);
  let factor=sku==='Pan de volcán'?1:sku==='Ñoquis'?.25:sku==='Fusiles'||sku==='Macarrones'||sku==='Spaghetti'||sku==='Rigatoni'?.2:sku==='Ravioles pollo y verdura'||sku==='Ravioles de ricota'?.375:2/3;
  if(/pastamila|pasta mila/.test(label))factor=.15;
  if(/1 kg tallarines/.test(label))factor=1;
  if(/1\/2 kl de tallarines/.test(label)||/fusillis 500 gr/.test(label))factor=.5;
  if(/1\/4 kg tallarines|1\/4 kl de fusiles/.test(label))factor=.25;
  days.set(key,(days.get(key)||0)+qty*factor);
  seenDates.set(dateKey,date.getDay());
 }
 const out={};
 for(const d of defs){
  out[d.name]=Array(7).fill(0);
  for(let wd=0;wd<7;wd++){
   const dates=[...seenDates].filter(([key,day])=>day===wd).map(([key])=>key);
   if(dates.length)out[d.name][wd]=dates.reduce((a,key)=>a+(days.get(d.name+'|'+key)||0),0)/dates.length;
  }
 }
 return out;
}
function effectiveStock(stock,d){
 return n(stock[d.base])+(d.portions||[]).reduce((a,[key,eq])=>a+n(stock[key])*eq,0);
}
E.artOrder=function(stock,now=new Date(),sales=[],modifiers=[]){
 const p=E.plans(now).art,snapshot=core.snapshotAt(now),cfg=core.provider('artesanal');
 const avg=forecasts(sales,modifiers),lines=[];
 for(const d of defs){
  const st=effectiveStock(stock,d),daily=date=>avg[d.name][date.getDay()]||0;
  const pre=core.projectedStock({currentStock:st,snapshot,delivery:p.delivery,dailyDemand:daily,schedule:cfg});
  let demand=p.coverage.reduce((a,date)=>a+daily(date),0);
  // Menú ejecutivo: 30 platos de rigatoni de 200 g para el ciclo martes-viernes.
  if(d.name==='Rigatoni'&&p.coverage.length===4)demand=Math.max(demand,6);
  const need=Math.max(0,demand*1.2-pre.projected);
  const pack=d.volcan?12:d.kg?5:1;
  const qty=d.volcan?Math.ceil(need/12):d.kg?Math.ceil(need/5)*5:Math.ceil(need);
  if(qty>0)lines.push({name:d.name,qty,unit:d.volcan?'cajas x12':d.kg?'kg':'cajas',forecast:demand,stock:st,
   note:'stock '+st.toFixed(2)+' · consumo hasta entrega '+pre.preConsumption.toFixed(2)+' · demanda cobertura '+demand.toFixed(2)+' · reserva 20% · pedido '+qty});
 }
 return {provider:'La Artesanal',plan:p,lines,stockSnapshotDate:snapshot,
 warning:(!sales?.length?'Sin ventas importadas para proyección. ':'')+'Pastamila 150 g tallarines; Combo Ravioles ricota; brasato excluido (CDP). Validar otros menús genéricos y porciones por caja.'};
};
})();