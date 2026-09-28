window.MontiEngine=(()=>{
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
const n=v=>Number(v||0)||0;
const addDays=(d,k)=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()+k);return x};
const day=d=>d.getDay();
const iso=d=>d.toISOString().slice(0,10);
const sameDay=(a,b)=>iso(a)===iso(b);
const datesBetween=(a,b,includeB=false)=>{const out=[];let d=addDays(a,1);while(includeB?d<=b:d<b){out.push(new Date(d));d=addDays(d,1)}return out};
const safety=0.20;
const artProjection={
 'ñoquis':[7.33,4.38,3.35,3.42,8.94,4.33,7.66],
 'fusiles':[2.84,3.75,1.70,2.18,2.15,1.73,2.29],
 'macarrones':[1.55,1.05,2.07,1.03,1.17,1.13,1.20],
 'spaghetti':[1.88,1.03,.95,3.73,1.10,1.13,1.38],
 'ravioles pollo y verdura':[2.97,1.84,1.25,1.31,1.19,1.53,2.69],
 'ravioles de ricota':[1.84,.97,.81,.84,1.03,.59,1.19],
 'raviolones de batata':[3.33,2.06,1.11,1.61,1.83,2.22,3.70],
 'pan de volcán':[15,7,4,7,13,7,17]
};
const artItems=[
 {name:'Ñoquis',unit:'kg',stock:'Ñoquis',round:5},
 {name:'Fusiles',unit:'kg',stock:'Fusiles',round:5},
 {name:'Macarrones',unit:'kg',stock:'Macarrones',round:5},
 {name:'Spaghetti',unit:'kg',stock:'Spaghetti',round:5},
 {name:'Ravioles pollo y verdura',unit:'cajas',stock:'Ravioles pollo y verdura',round:1},
 {name:'Ravioles de ricota',unit:'cajas',stock:'Ravioles de ricota',round:1},
 {name:'Raviolones de batata',unit:'cajas',stock:'Raviolones de batata',round:1},
 {name:'Pan de volcán',unit:'cajas x12',stock:'Pan de volcán',round:12,outputDiv:12}
];
const sauceSku={
 'tuco':{name:'BOLSA TUCO X 4 kl',grams:4000},'bolognesa':{name:'BOLSA Bolo x4 kg',grams:4000},
 'bolo':{name:'BOLSA Bolo x4 kg',grams:4000},'pesto':{name:'Bolsa Pesto x 1kg',grams:1000},
 'blanca':{name:'Bolsa blanca x 2 kilos',grams:2000},'salsa blanca':{name:'Bolsa blanca x 2 kilos',grams:2000},
 'cheddar':{name:'Bolsa de cheddar x 4kg',grams:4000},'mix quesos':{name:'Bolsa Mix de Queso x 2kl',grams:2000},
 'mix de quesos':{name:'Bolsa Mix de Queso x 2kl',grams:2000}
};
const portions={tuco:220,bolognesa:250,bolo:250,blanca:220,'salsa blanca':220,rosa:220,'mix quesos':220,'mix de quesos':220,pesto:150,cheddar:150};
const packaging=[
 {name:'BOLSON DE PLATOS X300U',pack:300,key:'plate'}, {name:'BOLSAS PASTA X500',pack:500,key:'pastaBag'},
 {name:'PLATOS MACANDCHESS X200',pack:200,key:'macPlate'}, {name:'MANTELES MONTI X1000',pack:1000,key:'mantel'},
 {name:'PARAFINADO MONTI X2000',pack:2000,key:'parafinado'}, {name:'Cinta MONTI x unid',pack:1,key:'tape'},
 {name:'CAJAS MILANESA X100',pack:100,key:'milaBox'}, {name:'CAJAS DE SANDWICH X 100',pack:100,key:'focacciBox'},
 {name:'Cinta FOCACCI x 10 unids',pack:10,key:'focacciTape'}, {name:'CAJA VOLCAN X100',pack:100,key:'volcanBox'},
 {name:'POTES SALSA X100',pack:100,key:'saucePot'}, {name:'BANDEJAS POSTRES X100U',pack:100,key:'dessertTray'},
 {name:'BOLSAS GRANDES X1200',pack:1200,key:'deliveryBag'}
];
function nextDow(today,target){let d=new Date(today);while(day(d)!==target)d=addDays(d,1);return d}
function plans(today=new Date()){
 const tue=nextDow(today,2), sat=nextDow(today,6); const artDelivery=tue<sat?tue:sat;
 const art=day(artDelivery)===6?{order:addDays(artDelivery,-1),stockDate:addDays(artDelivery,-2),delivery:artDelivery,coverage:[0,1,2].map(x=>addDays(artDelivery,x))}:{order:addDays(artDelivery,-3),stockDate:addDays(artDelivery,-4),delivery:artDelivery,coverage:[0,1,2,3].map(x=>addDays(artDelivery,x))};
 let cdpOrder=new Date(today);while(![1,3,5].includes(day(cdpOrder)))cdpOrder=addDays(cdpOrder,1);const cdpCov=(day(cdpOrder)===5?[1,2,3]:[1,2]).map(x=>addDays(cdpOrder,x));
 const brDelivery=nextDow(today,2);const breaders={order:addDays(brDelivery,-1),delivery:brDelivery,coverage:[0,1,2,3,4,5,6].map(x=>addDays(brDelivery,x))};
 let d29=new Date(today.getFullYear(),today.getMonth(),29,12);if(d29<today)d29=new Date(today.getFullYear(),today.getMonth()+1,29,12);let mEnd=new Date(d29.getFullYear(),d29.getMonth()+1,0,12);const cov29=[];for(let d=new Date(d29);d<=mEnd;d=addDays(d,1))cov29.push(new Date(d));
 return {art,cdp:{order:cdpOrder,delivery:cdpOrder,coverage:cdpCov},breaders,day29:{order:addDays(d29,-2),delivery:d29,coverage:cov29}};
}
function historicalWeekdayForecast(sales,coverage,filter=()=>true){
 const byKey={}; sales.filter(s=>filter(s)&&s.date&&!s.cancelled&&s.date.getDate()!==29).forEach(s=>{const k=norm(s.product);byKey[k]??={};byKey[k][day(s.date)]??={sum:0,dates:new Set()};byKey[k][day(s.date)].sum+=s.qty;byKey[k][day(s.date)].dates.add(iso(s.date))});
 const out={};for(const [k,wd] of Object.entries(byKey)){let total=0;coverage.forEach(d=>{const x=wd[day(d)];if(x)total+=x.sum/Math.max(1,x.dates.size)});out[k]=total}return out;
}
function artOrder(stock,now=new Date()){
 const p=plans(now).art;const before=datesBetween(p.stockDate,p.delivery,false);const lines=[];
 artItems.forEach(it=>{const proj=artProjection[norm(it.name)]||[];const pre=before.reduce((a,d)=>a+(proj[day(d)]||0),0);const cycle=p.coverage.reduce((a,d)=>a+(proj[day(d)]||0),0);let st=n(stock[it.stock]);let need=Math.max(0,cycle*(1+safety)-(st-pre));if(need<=0)return;let suggested;
  if(it.name==='Pan de volcán')suggested=Math.ceil(need/12);else if(it.round===5)suggested=Math.ceil(need/5)*5;else suggested=Math.ceil(need);
  lines.push({name:it.name,qty:suggested,unit:it.unit,forecast:cycle,stock:st,note:`consume antes ${pre.toFixed(1)} · cobertura +20%`});
 });return {provider:'La Artesanal',plan:p,lines};
}
function day29Order(stock,normal,sales,now=new Date()){
 const p=plans(now).day29;const histDates=[...new Set(sales.filter(s=>s.date&&s.date.getDate()===29&&s.date<p.delivery&&/ñoqui|noqui/.test(norm(s.product))).map(s=>iso(s.date)))];if(!histDates.length)return {provider:'La Artesanal · Día 29',plan:p,lines:[],warning:'Sin días 29 históricos en el Excel'};
 const histKg=histDates.map(ds=>sales.filter(s=>s.date&&iso(s.date)===ds&&/ñoqui|noqui/.test(norm(s.product))&&!/volcan/.test(norm(s.product))).reduce((a,s)=>a+s.qty*.25,0));const special=histKg.reduce((a,b)=>a+b,0)/histKg.length;const after=p.coverage.slice(1).reduce((a,d)=>a+(artProjection['ñoquis'][day(d)]||0),0);const normalIncoming=normal.lines.find(x=>norm(x.name)==='ñoquis')?.qty||0;const st=n(stock['Ñoquis'])+normalIncoming;const need=Math.max(0,(special+after)*(1+safety)-st);return {provider:'La Artesanal · Día 29',plan:p,lines:need?[{name:'Ñoquis',qty:Math.ceil(need/5)*5,unit:'kg',forecast:special+after,stock:st,note:`promedio ${histDates.length} días 29 · +20%`}]:[]};
}
function sauceComponents(name){const k=norm(name);if(k.includes('rosa'))return [['tuco',110],['blanca',110]];if(k.includes('bolog'))return [['bolognesa',250]];if(k.includes('tuco'))return [['tuco',220]];if(k.includes('blanca')||k.includes('crema'))return [['blanca',220]];if(k.includes('mix')&&k.includes('ques'))return [['mix quesos',220]];if(k.includes('pesto'))return [['pesto',150]];if(k.includes('cheddar'))return [['cheddar',150]];return []}
function cdpOrder(data,stock,now=new Date(),special29=false){
 const p=special29?plans(now).day29:plans(now).cdp;const base=data.sales.filter(s=>!s.modifier&&!s.cancelled);const forecast=historicalWeekdayForecast(base,p.coverage,s=>!special29||/ñoqui|noqui/.test(norm(s.product)));const addForecast=historicalWeekdayForecast(data.sales,p.coverage,s=>s.source==='Adiciones'&&sauceComponents(s.product).length>0);
 const needs={};const direct={};const addGram=(key,g)=>needs[key]=(needs[key]||0)+g;const addDirect=(name,q,note)=>{direct[name]??={q:0,note};direct[name].q+=q};
 Object.entries(addForecast).forEach(([name,q])=>sauceComponents(name).forEach(([k,g])=>addGram(k,g*q)));
 Object.entries(forecast).forEach(([name,q])=>{const k=norm(name);if(k.includes('mac')&&k.includes('mila'))addGram('cheddar',75*q);else if(k.includes('mac')&&k.includes('cheese'))addGram('cheddar',150*q);else if(k.includes('papas')&&k.includes('cheddar'))addGram('cheddar',50*q);else if(k.includes('lasagna')&&k.includes('bolog')){addGram('blanca',100*q);addDirect('LASAGNA BOLOGNESA',q,'1 por plato')}else if(k.includes('lasagna')&&(k.includes('verde')||k.includes('espinaca'))){addGram('tuco',100*q);addDirect('LASAGANA VERDE',q,'1 por plato')}else if(k.includes('pastamila')||k.includes('mila napo'))addGram('tuco',150*q);
  if(k.includes('brasato'))addDirect('GRAND BRASATO X 2',q/2,'2 porciones por unidad');if(k.includes('empanad'))addDirect('Empanadas x 6',(k.includes('x6')||k.includes('x 6'))?q:q/6,'pack x6');if(k.includes('meatball')||k.includes('meat ball')||k.includes('albondig'))addDirect('Meat Ball x 5 porciones',q/5,'5 porciones por unidad');});
 const beef=forecastMila(data,p.coverage,'carne');if(beef>0)addDirect('Milanesa vacuna x 3kg',beef/12,'12 milanesas x paquete');
 const focacciaPlates=Object.entries(forecast).filter(([k])=>isFocacciaPlate(k)).reduce((a,[,q])=>a+q,0);const focacciSand=Object.entries(forecast).filter(([k])=>/focacci/.test(norm(k))).reduce((a,[,q])=>a+q,0);addDirect('FOCACCIA X UNID',focacciaPlates/28+focacciSand/8,'28 panes / 8 focacci sandwich');
 const lines=[];Object.entries(needs).forEach(([k,g])=>{const sku=sauceSku[k];if(!sku)return;const st=n(stock[sku.name]);const target=g*(1+safety)/sku.grams;const qty=Math.max(0,Math.ceil(target-st));if(qty)lines.push({name:sku.name,qty,unit:'bolsas',forecast:g/sku.grams,stock:st,note:`${k} · +20%`})});Object.entries(direct).forEach(([name,v])=>{const st=n(stock[name]);const qty=Math.max(0,Math.ceil(v.q*(1+safety)-st));if(qty)lines.push({name,qty,unit:'unidades',forecast:v.q,stock:st,note:`${v.note} · +20%`})});return {provider:special29?'CDP · Día 29':'Centro de Producción',plan:p,lines};
}
function forecastMila(data,coverage,type){
 const valid=data.modifiers.filter(m=>!m.cancelled&&norm(m.group)==='tipo de milanesa'&&norm(m.modifier).includes(type));const pseudo=valid.map(m=>({product:type,date:m.date,qty:m.qty,cancelled:false}));return historicalWeekdayForecast(pseudo,coverage)[type]||0;
}
function breadersOrder(data,stock,now=new Date()){
 const p=plans(now).breaders;const qty=forecastMila(data,p.coverage,'pollo');const st=n(stock['Milanesa pollo x 5kg']??stock['Milanesa pollo']);const boxes=Math.max(0,Math.ceil(qty*(1+safety)/20-st));return {provider:'Breaders',plan:p,lines:boxes?[{name:'Milanesa pollo x 5kg',qty:boxes,unit:'cajas',forecast:qty/20,stock:st,note:'20 milanesas de 250 g por caja · +20%'}]:[]};
}
function isFocacciaPlate(name){const k=norm(name);return !k.includes('volcan')&&!k.includes('focacci')&&(/ñoqui|noqui|raviol|sorrent|tallarin|spaghetti|fusil|macarr|pasta|lasagna|mila/.test(k))}
function packagingOrder(data,stock,now=new Date()){
 const start=new Date(now);const cov=[...Array(15)].map((_,i)=>addDays(start,i));const f=historicalWeekdayForecast(data.sales.filter(s=>!s.modifier&&!s.cancelled),cov);const need={plate:0,pastaBag:0,macPlate:0,milaBox:0,focacciBox:0,focacciTape:0,volcanBox:0,saucePot:0,dessertTray:0,deliveryBag:0,mantel:0,parafinado:0,tape:0};let takeawayPlates=0;
 Object.entries(f).forEach(([name,q])=>{const k=norm(name);const takeaway=true;if(k.includes('mac')&&k.includes('cheese'))need.macPlate+=q;else if(/mila|pastamila/.test(k)){need.milaBox+=q;need.plate+=q}else if(k.includes('volcan'))need.volcanBox+=q;else if(k.includes('focacci')){need.focacciBox+=q;need.focacciTape+=q}else if(k.includes('postre')||k.includes('tiramisu')||k.includes('flan'))need.dessertTray+=q;else if(/pasta|ñoqui|noqui|raviol|sorrent|tallarin|spaghetti|fusil|macarr|lasagna/.test(k)){need.plate+=q;need.pastaBag+=q} if(takeaway)takeawayPlates+=q});need.deliveryBag=Math.ceil(takeawayPlates/2);
 const lines=[];packaging.forEach(x=>{const units=need[x.key]||0;if(!units)return;const stPacks=n(stock[x.name]);const requiredPacks=units/x.pack;const raw=Math.max(0,requiredPacks-stPacks);const qty=raw<=.05?0:Math.ceil(raw);if(qty)lines.push({name:x.name,qty,unit:'packs',forecast:requiredPacks,stock:stPacks,note:`pack x${x.pack} · tolerancia 5%`})});return {provider:'Packaging',plan:{coverage:cov},lines};
}
return {norm,plans,artOrder,day29Order,cdpOrder,breadersOrder,packagingOrder};
})();