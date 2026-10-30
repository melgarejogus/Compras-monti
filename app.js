const $=id=>document.getElementById(id);
const STOCK_KEY='monti.web.stock.v3';
const DB_NAME='monti-compras-web';
const DB_VERSION=1;
let parsedData=null;
let currentFileMeta=null;
let currentOrderFilter='all';
let cloudSalesStatus='Esperando datos de Firebase…';
let cloudSalesLoaded=false;
let currentAdmin=false;
window.MontiRole=admin=>{currentAdmin=admin;document.querySelectorAll('[data-admin-only]').forEach(el=>el.style.display=admin?'':'none');if(!admin&&document.querySelector('.view.active')?.dataset.viewPanel==='fudo')navigate('dashboard')};
window.MontiSalesLoaded=(data,meta)=>{parsedData=reviveParsed(data);currentFileMeta={...meta,sheets:(meta.sheets||[]).map(entry=>Array.isArray(entry)?entry:[entry.name,entry.rows])};cloudSalesLoaded=true;cloudSalesStatus='Ventas sincronizadas desde Firebase ✓';updateFudoUi();renderDashboard();generateOrders()};
window.MontiSalesMissing=()=>{cloudSalesStatus='Todavía no hay ventas publicadas en Firebase';if(!currentAdmin){parsedData=null;currentFileMeta=null;updateFudoUi();renderDashboard();generateOrders()}};
window.MontiSalesError=()=>{cloudSalesStatus='ERROR: no se pudieron recuperar ventas de Firebase';if(!currentAdmin){parsedData=null;currentFileMeta=null;updateFudoUi();renderDashboard();generateOrders()}};

const stockItems=[
 ['Rigatoni','kg','CDP'],['Ñoquis','kg','La Artesanal'],['Fusiles','kg','La Artesanal'],['Macarrones','kg','La Artesanal'],['Spaghetti','kg','La Artesanal'],['Ravioles pollo y verdura','cajas','La Artesanal'],['Ravioles de ricota','cajas','La Artesanal'],['Raviolones de batata','cajas','La Artesanal'],['Pan de volcán','unidades','La Artesanal'],
 ['BOLSA TUCO X 4 kl','bolsas','Centro de Producción'],['BOLSA Bolo x4 kg','bolsas','Centro de Producción'],['Bolsa Pesto x 1kg','bolsas','Centro de Producción'],['Bolsa blanca x 2 kilos','bolsas','Centro de Producción'],['Bolsa de cheddar x 4kg','bolsas','Centro de Producción'],['Bolsa Mix de Queso x 2kl','bolsas','Centro de Producción'],['FOCACCIA X UNID','unidades','Centro de Producción'],['LASAGNA BOLOGNESA','unidades','Centro de Producción'],['LASAGANA VERDE','unidades','Centro de Producción'],['Milanesa vacuna x 3kg','paquetes','Centro de Producción'],['Empanadas x 6','packs','Centro de Producción'],['Meat Ball x 5 porciones','packs','Centro de Producción'],['GRAND BRASATO X 2','cajas','Centro de Producción'],['Tomates confitados x 500 g','bolsas','Centro de Producción'],['Manteca de salvia (kg)','kg','Centro de Producción'],['Mayonesa ahumada (kg)','kg','Centro de Producción'],
 ['Milanesa pollo x 5kg','cajas','Breaders'],
 ['BOLSON DE PLATOS X300U','packs','Packaging'],['BOLSAS PASTA X500','packs','Packaging'],['PLATOS MACANDCHESS X200','packs','Packaging'],['MANTELES MONTI X1000','packs','Packaging'],['PARAFINADO MONTI X2000','packs','Packaging'],['Cinta MONTI x unid','unidades','Packaging'],['CAJAS MILANESA X100','packs','Packaging'],['CAJAS DE SANDWICH X 100','packs','Packaging'],['Cinta FOCACCI x 10 unids','packs','Packaging'],['CAJA VOLCAN X100','packs','Packaging'],['POTES SALSA X100','packs','Packaging'],['BANDEJAS POSTRES X100U','packs','Packaging'],['BOLSAS GRANDES X1200','packs','Packaging'],['juego de cucharon x 12','packs','Packaging']
];

const norm=v=>MontiEngine.norm(v);
const rows=sheet=>XLSX.utils.sheet_to_json(sheet,{defval:''});
function col(row,...names){for(const name of names){const found=Object.keys(row).find(k=>norm(k)===norm(name));if(found!==undefined)return row[found]}return ''}
function asDate(v){if(v instanceof Date&&!isNaN(v))return v;if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);return d?new Date(d.y,d.m-1,d.d,12):null}const s=String(v||'').trim();if(!s)return null;const m=s.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);if(m){let y=+m[3];if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1],12)}const d=new Date(s);return isNaN(d)?null:d}
const fmtDate=d=>d?new Date(d).toLocaleDateString('es-AR'):'—';
const isCancelled=v=>['si','sí','true','1','yes'].includes(norm(v));
const getStock=()=>JSON.parse(localStorage.getItem(STOCK_KEY)||'{}');

function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('cache'))db.createObjectStore('cache')};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function dbSet(key,value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction('cache','readwrite');tx.objectStore('cache').put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function dbGet(key){const db=await openDb();return new Promise((resolve,reject)=>{const req=db.transaction('cache','readonly').objectStore('cache').get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function dbDelete(key){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction('cache','readwrite');tx.objectStore('cache').delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}

function serializeParsed(data){return {sales:data.sales.map(x=>({...x,date:x.date?.toISOString()||null})),modifiers:data.modifiers.map(x=>({...x,date:x.date?.toISOString()||null}))}}
function reviveParsed(data){if(!data)return null;return {sales:(data.sales||[]).map(x=>({...x,date:x.date?new Date(x.date):null})),modifiers:(data.modifiers||[]).map(x=>({...x,date:x.date?new Date(x.date):null}))}}

function navigate(view){if(view==='orders'&&parsedData)generateOrders();document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.dataset.viewPanel===view));document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===view));const btn=document.querySelector(`.nav-item[data-view="${view}"]`);$('pageTitle').textContent=btn?.textContent||'Monti Compras';$('sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>navigate(btn.dataset.view)));
$('menuToggle').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
$('viewOrdersBtn').addEventListener('click',()=>navigate('orders'));
$('quickUpload').addEventListener('click',()=>{if(!currentAdmin)return;navigate('fudo');$('fileInput').click()});

function updateStockTimestamp(){const el=$('stockSavedAt');if(!el)return;const raw=localStorage.getItem('monti.web.stock.v3.savedAt'),date=raw?new Date(raw):null;el.textContent=date&&!Number.isNaN(date.getTime())?'Última carga de stock: '+date.toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'}):'Última carga de stock: sin registro';}

const packagingCapacity=Object.fromEntries(stockItems.filter(x=>x[2]==='Packaging').map(([name])=>{const m=name.match(/x\\s*(\\d+)/i);return [name,m?Number(m[1]):null]}));
function packagingFields(name,value=0){
 const capacity=packagingCapacity[name];
 if(!capacity)return '<input data-pack-total type="number" min="0" step="0.01" value="'+value+'">';
 const boxes=Math.floor((Number(value)||0)/capacity),units=Math.round(((Number(value)||0)-boxes*capacity)*100)/100;
 return '<div class="pack-fields" data-pack-capacity="'+capacity+'" style="display:flex;gap:6px;flex-wrap:wrap"><label>Cajas <input data-pack-boxes type="number" min="0" step="1" value="'+boxes+'" style="width:75px"></label><label>Unidades <input data-pack-units type="number" min="0" step="1" value="'+units+'" style="width:90px"></label><small>×'+capacity+' por caja</small></div>';
}
function packagingQuantity(row){
 const pack=row.querySelector('[data-pack-capacity]');
 if(!pack)return Number(row.querySelector('[data-pack-total]')?.value||0);
 return Number(pack.querySelector('[data-pack-boxes]').value||0)*Number(pack.dataset.packCapacity)+Number(pack.querySelector('[data-pack-units]').value||0);
}

function renderStock(){updateStockTimestamp();const saved=getStock(),q=norm($('stockSearch')?.value||''),provider=$('stockProvider')?.value||'all';const filtered=stockItems.filter(([name,,p])=>(!q||norm(name).includes(q))&&(provider==='all'||p===provider));$('stockGrid').innerHTML=`<div class="stock-head"><span>Insumo</span><span>Proveedor</span><span>Unidad de carga</span><span>Stock</span></div>`+filtered.map(([name,unit,p])=>{const idx=stockItems.findIndex(x=>x[0]===name);return `<div class="stock-row"><strong>${name}</strong><span class="provider-cell">${p}</span><span class="unit-cell">${unit}</span><span data-stock="${idx}">${provider==='Packaging'||p==='Packaging'?packagingFields(name,saved[name]??0):'<input data-pack-total type="number" step="0.01" inputmode="decimal" value="'+(saved[name]??'')+'" placeholder="0">'}</span></div>`}).join('')}
$('stockSearch').addEventListener('input',renderStock);$('stockProvider').addEventListener('change',renderStock);

const stockProviders=[...new Set(stockItems.map(x=>x[2]))];
const stockTurnKey=()=>{const d=new Date(),date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');return date+'-'+(d.getHours()<17?'manana':'noche')};
async function refreshStockTurn(){
 const target=$('turnProgress');if(!target)return;
 try{
  const key=stockTurnKey(),control=await window.MontiCloud.getTurnStatus(),current=control?.key===key?control:null;
  const done=stockProviders.filter(p=>current?.providers?.[p]).length;
  target.innerHTML='<p><strong>'+key.replace('-',' · ')+'</strong> · '+done+' de '+stockProviders.length+' proveedores controlados'+(current?.closed?' · CERRADO ✓':'')+'</p>'+stockProviders.map(p=>'<div style="padding:7px 0;border-bottom:1px solid #555">'+(current?.providers?.[p]?'✅ ':'○ ')+p+(current?.providers?.[p]?' · '+new Date(current.providers[p].at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):' · Pendiente')+'</div>').join('');
  const cards=$('stockProviderCards');if(cards){cards.innerHTML='';stockProviders.forEach(p=>{const button=document.createElement('button');button.type='button';button.className='ghost-btn';button.style.cssText='min-height:88px;text-align:left;padding:14px;border:1px solid '+(current?.providers?.[p]?'#30855a':'#666')+';border-radius:12px';button.textContent=(current?.providers?.[p]?'✅ ':'○ ')+p+' · '+(current?.providers?.[p]?'Completo':'Pendiente');button.onclick=()=>{$('stockProvider').value=p;$('stockSearch').value='';renderStock();$('stockGrid').scrollIntoView({behavior:'smooth',block:'start'})};cards.append(button)})}
  $('closeStockTurn').disabled=!!current?.closed||done!==stockProviders.length;
  $('forceCloseStockTurn').disabled=!!current?.closed||done===0;
 }catch(e){target.textContent='No se pudo leer el control del turno: '+e.message;$('closeStockTurn').disabled=true;$('forceCloseStockTurn').disabled=true}
}
$('saveStock').addEventListener('click',async()=>{
 const provider=$('stockProvider').value,changes={};
 document.querySelectorAll('[data-stock]').forEach(row=>{const item=stockItems[Number(row.dataset.stock)];if(item?.[2]===provider)changes[item[0]]=packagingQuantity(row)});
 if(!Object.keys(changes).length){alert('No hay productos visibles. Quitá el filtro de búsqueda antes de guardar.');return}
 if(stockItems.filter(x=>x[2]===provider).length!==Object.keys(changes).length){alert('Para guardar este proveedor, quitá la búsqueda y completá todos sus productos.');return}
 if(Object.values(changes).some(v=>!Number.isFinite(v)||v<0)){alert('Revisá las cantidades ingresadas.');return}
 const button=$('saveStock');button.disabled=true;
 try{
  const result=await window.MontiCloud.saveProviderStock(provider,changes,stockTurnKey());
  MontiPlanningCore.saveSnapshotNow();updateStockTimestamp();generateOrders();renderDashboard();
  $('cloudSaveStatus').textContent='Stock de '+provider+' guardado ✓. El informe se genera al cerrar el turno.';
  await refreshStockTurn();
 }catch(e){alert('No se guardó: '+e.message)}finally{button.disabled=false}
});
async function finishStockTurn(force){
 const button=force?$('forceCloseStockTurn'):$('closeStockTurn');button.disabled=true;
 try{
  const result=await window.MontiCloud.closeTurn(stockTurnKey(),stockProviders,force);
  await refreshStockTurn();
  await showStockWhatsAppReport(result.items);
  if(result.control.pending.length)alert('Cierre excepcional: faltan '+result.control.pending.join(', ')+'. Se indicará en el informe.');
 }catch(e){alert('No se cerró el turno: '+e.message);await refreshStockTurn()}
}
$('closeStockTurn').onclick=()=>finishStockTurn(false);
$('forceCloseStockTurn').onclick=()=>{if(!currentAdmin)return;if(confirm('¿Cerrar el turno con proveedores pendientes? Quedarán marcados como no verificados.'))finishStockTurn(true)};
setTimeout(refreshStockTurn,2000);


$('fileInput').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;if(!currentAdmin){alert('Solo el administrador puede actualizar Fudo.');return}try{const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array',cellDates:true});await processWorkbook(wb,file.name,{buffer:buf,size:file.size,type:file.type,lastModified:file.lastModified})}catch(err){console.error(err);alert('Error al cargar ventas: '+String(err?.message||err?.code||err))}});

async function processWorkbook(wb,fileName,filePayload=null){
 const sheetInfo=[],sales=[],modifiers=[],dates=[];let cancelledMods=0,totalSales=0;
 wb.SheetNames.forEach(name=>{const r=rows(wb.Sheets[name]),sn=norm(name);sheetInfo.push([name,r.length]);
  if(['ventas','adiciones'].includes(sn))r.forEach(x=>{const cancelled=isCancelled(col(x,'Cancelada','Cancelado')),qty=Number(col(x,'Cantidad')||1),date=asDate(col(x,'Creación','Creacion','Fecha')),product=String(col(x,'Producto')||'').trim();if(date)dates.push(date);if(!cancelled)totalSales+=qty;sales.push({orderId:String(col(x,'Id. Venta','Id Venta','Id. venta')||''),additionId:String(col(x,'Id. Adición','Id. Adicion','Id Adición')||''),product,category:String(col(x,'Categoría','Categoria')||''),qty,date,cancelled,source:name,modifier:false})});
  if(sn==='adiciones de modificadores')r.forEach(x=>{const cancelled=isCancelled(col(x,'Cancelada','Cancelado'));if(cancelled)cancelledMods++;const date=asDate(col(x,'Creación','Creacion','Fecha'));if(date)dates.push(date);const m={orderId:String(col(x,'Id. Venta','Id Venta')||''),additionId:String(col(x,'Id. Adición','Id. Adicion','Id Adición')||''),product:String(col(x,'Producto')||''),group:String(col(x,'Grupo modificador','Grupo')||''),modifier:String(col(x,'Modificador')||''),qty:Number(col(x,'Cantidad')||1),date,cancelled,source:name};modifiers.push(m);sales.push({...m,product:m.modifier,category:m.group,modifier:true})})
 });
 parsedData={sales,modifiers};dates.sort((a,b)=>a-b);const chicken=modifiers.filter(m=>!m.cancelled&&norm(m.group)==='tipo de milanesa'&&norm(m.modifier).includes('pollo')).reduce((a,m)=>a+m.qty,0),beef=modifiers.filter(m=>!m.cancelled&&norm(m.group)==='tipo de milanesa'&&norm(m.modifier).includes('carne')).reduce((a,m)=>a+m.qty,0);
 currentFileMeta={fileName,at:new Date().toISOString(),sheets:sheetInfo,dateFrom:dates[0]?.toISOString()||null,dateTo:dates.at(-1)?.toISOString()||null,totalSales,mods:modifiers.length,chicken,beef,cancelledMods};
 if(filePayload){if(!window.MontiCloud?.isAdmin)throw Error('Solo el administrador puede publicar ventas');await window.MontiCloud.saveSales(serializeParsed(parsedData),currentFileMeta);cloudSalesLoaded=true;cloudSalesStatus='Ventas publicadas en Firebase ✓';try{await dbSet('originalExcel',{name:fileName,buffer:filePayload.buffer,size:filePayload.size,type:filePayload.type,lastModified:filePayload.lastModified,savedAt:currentFileMeta.at});await dbSet('parsedData',serializeParsed(parsedData));await dbSet('fileMeta',currentFileMeta)}catch(localErr){console.warn('Copia local opcional no disponible',localErr);cloudSalesStatus='Ventas publicadas en Firebase ✓ (sin copia local)'}}
 updateFudoUi();generateOrders();renderDashboard();
}

function updateFudoUi(){const salesCloud=$('salesCloudStatus');if(salesCloud)salesCloud.textContent=cloudSalesStatus;if(!currentFileMeta){$('statusChip').textContent='Sin datos';$('sideStatusText').textContent='Sin Excel cargado';$('sideStatusDot').classList.remove('ok');$('fudoFileName').textContent='Todavía no se cargó un Excel';$('fileMeta').textContent='Elegí el Excel completo exportado desde Fudo.';$('storageStatus').textContent='Sin archivo guardado.';return}const m=currentFileMeta;$('salesCount').textContent=Math.round(m.totalSales||0).toLocaleString('es-AR');$('modsCount').textContent=(m.mods||0).toLocaleString('es-AR');$('dateFrom').textContent=fmtDate(m.dateFrom);$('dateTo').textContent=fmtDate(m.dateTo);$('chickenCount').textContent=(m.chicken||0).toLocaleString('es-AR');$('beefCount').textContent=(m.beef||0).toLocaleString('es-AR');$('fudoFileName').textContent=m.fileName;$('fileMeta').textContent=`Actualizado ${new Date(m.at).toLocaleString('es-AR')} · ${m.sheets?.length||0} hojas detectadas`;$('statusChip').textContent='Excel guardado';$('sideStatusText').textContent='Excel disponible';$('sideStatusDot').classList.add('ok');$('storageStatus').innerHTML=`<strong>${m.fileName}</strong><br>Guardado localmente el ${new Date(m.at).toLocaleString('es-AR')}. Las ventas procesadas están compartidas mediante Firebase.`;$('sheetAudit').innerHTML=(m.sheets||[]).map(([n,c])=>`<div class="audit-row"><span>${n}</span><strong>${Number(c).toLocaleString('es-AR')} filas</strong></div>`).join('')+`<div class="audit-row"><span>Modificadores cancelados excluidos</span><strong>${m.cancelledMods||0}</strong></div>`}

$('clearExcel').addEventListener('click',async()=>{if(!currentAdmin)return;if(!confirm('¿Quitar solamente la copia local del Excel? Las ventas publicadas en Firebase permanecerán disponibles.'))return;await dbDelete('originalExcel');await dbDelete('parsedData');await dbDelete('fileMeta');parsedData=null;currentFileMeta=null;updateFudoUi();generateOrders();renderDashboard()});

function orderRows(order){if(!order.lines?.length)return '<div class="empty">Sin pedido sugerido con el stock actual.</div>';return `<div class="order-table">${order.lines.map(l=>`<div class="order-row"><span><b>${l.name}</b><small>${l.note||''}</small></span><strong>${Number(l.qty).toLocaleString('es-AR',{maximumFractionDigits:2})} ${l.unit||''}</strong></div>`).join('')}</div>`}
function standardOrderCard(order,key){const cov=order.plan?.coverage||[];return `<article class="card order-card" data-order-kind="${key}"><div class="order-head"><div><p class="eyebrow">${order.provider}</p><h3>${order.provider}</h3><div class="order-meta">Entrega ${fmtDate(order.plan?.delivery)} · cubre ${cov.map(fmtDate).join(', ')}</div></div><span class="badge ${order.lines?.length?'warn':'ok'}">${order.lines?.length||0} ítems</span></div>${orderRows(order)}${order.warning?`<p class="muted">${order.warning}</p>`:''}</article>`}
function artesanalCard(normal,special){const normalCov=normal.plan?.coverage||[],specialHas=special?.lines?.length>0;return `<article class="card order-card" data-order-kind="artesanal"><div class="order-head"><div><p class="eyebrow">LA ARTESANAL</p><h3>La Artesanal</h3><div class="order-meta">Entrega ${fmtDate(normal.plan?.delivery)} · cubre ${normalCov.map(fmtDate).join(', ')}</div></div><span class="badge ${normal.lines?.length||specialHas?'warn':'ok'}">${(normal.lines?.length||0)+(special?.lines?.length||0)} ítems</span></div>${orderRows(normal)}<div class="special-note"><strong>🗓 Día 29 integrado automáticamente</strong><div class="muted">${specialHas?`Refuerzo detectado para el ${fmtDate(special.plan?.delivery)}. El cálculo usa el histórico de días 29 y lo muestra dentro de La Artesanal.`:`No hace falta un refuerzo adicional con los datos y stock actuales para el ${fmtDate(special?.plan?.delivery)}.`}</div>${specialHas?orderRows(special):''}</div></article>`}

function generateOrders(){if(!parsedData){$('ordersGrid').innerHTML='<div class="empty card">Importá un Excel para calcular pedidos.</div>';renderNextOrders([]);return}const stock=getStock(),now=new Date(),art=MontiEngine.artOrder(stock,now,parsedData.sales,parsedData.modifiers),d29=MontiEngine.day29Order(stock,art,parsedData.sales,now),cdp=MontiEngine.cdpOrder(parsedData,stock,now,false),cdp29=MontiEngine.cdpOrder(parsedData,stock,now,true),breaders=MontiEngine.breadersOrder(parsedData,stock,now),packaging=MontiEngine.packagingOrder(parsedData,stock,now);const cards=[{key:'artesanal',html:artesanalCard(art,d29),order:art,special:d29},{key:'cdp',html:standardOrderCard(cdp,'cdp')+(cdp29.lines?.length?`<article class="card order-card" data-order-kind="cdp"><div class="special-note"><strong>🗓 Refuerzo CDP día 29</strong><div class="muted">Integrado al proveedor CDP para ${fmtDate(cdp29.plan?.delivery)}.</div>${orderRows(cdp29)}</div></article>`:''),order:cdp},{key:'breaders',html:standardOrderCard(breaders,'breaders'),order:breaders},{key:'packaging',html:standardOrderCard(packaging,'packaging'),order:packaging}];$('ordersGrid').innerHTML=cards.filter(c=>currentOrderFilter==='all'||c.key===currentOrderFilter).map(c=>c.html).join('');const p=MontiEngine.plans(now);$('planMeta').textContent=`La Artesanal ${fmtDate(p.art.delivery)} · CDP ${fmtDate(p.cdp.delivery)} · Breaders ${fmtDate(p.breaders.delivery)} · margen 20%.`;renderNextOrders(cards);renderAlerts({art,d29,cdp,cdp29,breaders,packaging})}

function renderNextOrders(cards){if(!parsedData){$('nextOrdersTable').innerHTML='<div class="empty">Cargá un Excel para ver próximos pedidos.</div>';return}const map=cards.map(c=>({name:c.key==='artesanal'?'La Artesanal':c.key==='cdp'?'Centro de Producción':c.key==='breaders'?'Breaders':'Packaging',order:c.order}));$('nextOrdersTable').innerHTML=`<table><thead><tr><th>Proveedor</th><th>Entrega</th><th>Cobertura</th><th>Estado</th></tr></thead><tbody>${map.map(x=>`<tr><td><strong>${x.name}</strong></td><td>${fmtDate(x.order.plan?.delivery)}</td><td>${x.order.plan?.coverage?.length||'—'} días</td><td><span class="badge ${x.order.lines?.length?'warn':'ok'}">${x.order.lines?.length?`${x.order.lines.length} ítems`:'Sin pedido'}</span></td></tr>`).join('')}</tbody></table>`}
function renderAlerts(o){const alerts=[];if(o.d29?.lines?.length)alerts.push({text:`Día 29: La Artesanal requiere refuerzo especial para ${fmtDate(o.d29.plan?.delivery)}.`,kind:'warn'});if(o.cdp29?.lines?.length)alerts.push({text:`Día 29: CDP también tiene refuerzo calculado para ${fmtDate(o.cdp29.plan?.delivery)}.`,kind:'warn'});if(!Object.keys(getStock()).length)alerts.push({text:'Todavía no hay stock guardado; los pedidos pueden quedar sobredimensionados.',kind:'danger'});const total=[o.art,o.cdp,o.breaders,o.packaging].reduce((a,x)=>a+(x.lines?.length||0),0);if(total===0)alerts.push({text:'No hay compras sugeridas con el stock actual.',kind:'ok'});$('alertsList').innerHTML=alerts.map(a=>`<div class="alert-item"><span>${a.text}</span><span class="badge ${a.kind}">${a.kind==='ok'?'OK':'Revisar'}</span></div>`).join('')||'<div class="empty">Sin alertas.</div>';$('alertCount').textContent=alerts.filter(a=>a.kind!=='ok').length;$('alertCaption').textContent=alerts.length?'Revisión automática':'Sin alertas'}
function renderDashboard(){if(!currentFileMeta){$('dashExcelStatus').textContent='Sin cargar';$('dashExcelMeta').textContent='—';$('dashPeriod').textContent='—';return}$('dashExcelStatus').textContent='Guardado';$('dashExcelMeta').textContent=new Date(currentFileMeta.at).toLocaleString('es-AR');$('dashPeriod').textContent=`${fmtDate(currentFileMeta.dateFrom)} → ${fmtDate(currentFileMeta.dateTo)}`}

$('generateOrders').addEventListener('click',generateOrders);
document.querySelectorAll('[data-order-filter]').forEach(btn=>btn.addEventListener('click',()=>{currentOrderFilter=btn.dataset.orderFilter;document.querySelectorAll('[data-order-filter]').forEach(x=>x.classList.toggle('active',x===btn));generateOrders()}));

async function restoreCachedExcel(){try{const meta=await dbGet('fileMeta');const data=await dbGet('parsedData');if(cloudSalesLoaded)return;if(meta&&data){currentFileMeta=meta;parsedData=reviveParsed(data);updateFudoUi();renderDashboard();generateOrders()}}catch(err){console.warn('No se pudo restaurar cache local',err)}}

renderStock();updateFudoUi();renderDashboard(); // Las ventas se recuperan desde Firebase al iniciar sesión.
// Al regresar a la aplicación, recalcular con el reloj actual del dispositivo.
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&parsedData)generateOrders()});
window.addEventListener('focus',()=>{if(parsedData)generateOrders()});


/* Informe de stock: se genera exclusivamente tras confirmación de Firebase. */
async async function showStockWhatsAppReport(stock){
 let previous=null,receipts=[];
 try{
  const counts=await window.MontiCloud.listCounts();
  previous=counts.length>1?counts[counts.length-2]:null;
  if(previous)receipts=(await window.MontiCloud.listReceipts()).filter(x=>x.at>previous.at&&x.at<=counts[counts.length-1].at);
 }catch(e){console.warn('Historial no disponible',e);}
 const received={};
 receipts.forEach(r=>r.items.forEach(x=>{received[x.name]=(received[x.name]||0)+Number(x.qty)}));

 const now=new Date(),stamp=now.toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'});
 const shift=now.getHours()<17?'Mañana':'Noche';
 const fmt=v=>Number(v).toLocaleString('es-AR',{maximumFractionDigits:2});
 const display=(name,v)=>packagingCapacity[name]?fmt(v)+' unidades ('+fmt(v/packagingCapacity[name])+' cajas) ':fmt(v);
 const groups=new Map();
 for(const [name,unit,provider] of stockItems){
  if(!groups.has(provider))groups.set(provider,[]);
  const value=Number(stock[name]??0);
  const before=previous?Number(previous.items?.[name]??0):null,entry=received[name]||0;const consumption=before===null?null:before+entry-value;
  groups.get(provider).push(name+': '+(before===null?'Actual '+display(name,value):'Anterior '+display(name,before)+' | Ingresos +'+display(name,entry)+' | Actual '+display(name,value)+' | Consumo '+display(name,consumption))+' '+unit+(value===0?' ⚠️':''));
 }
 // Incluir stock porcionado y otros campos persistidos que no figuran en la tabla principal.
 const known=new Set(stockItems.map(x=>x[0]));
 const extra=Object.keys(stock).filter(k=>!known.has(k)).sort();
 if(extra.length)groups.set('PORCIONES Y OTROS REGISTROS',extra.map(k=>k+': '+fmt(stock[k]??0)));
 const turnCounts=await window.MontiCloud.listCounts().catch(()=>[]);const lastCount=turnCounts[turnCounts.length-1];const pending=lastCount?.pending||[];
 const lines=['📋 MONTI | CONTROL DE STOCK','📅 '+stamp,'🕘 Turno: '+shift,'','Turno cerrado en Firebase ✓',...(pending.length?['⚠️ SIN VERIFICAR: '+pending.join(', ')]:[])];
 for(const [provider,items] of groups){lines.push('','━━━━━━━━━━━━━━━━','📦 '+provider.toUpperCase(),'━━━━━━━━━━━━━━━━',...items);}
 const report=lines.join('\n');
 let panel=document.getElementById('stockWhatsAppReport');
 if(!panel){
  panel=document.createElement('section');panel.id='stockWhatsAppReport';panel.className='card';
  const grid=document.getElementById('stockGrid');
  grid?.closest('section')?.insertAdjacentElement('beforebegin',panel);
 }
 panel.innerHTML='<h3>📋 Informe de stock listo para compartir</h3><p class="muted">Se generó después de guardar correctamente en Firebase.</p><textarea id="stockWhatsAppText" readonly rows="16" style="width:100%;white-space:pre-wrap"></textarea><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"><button id="stockReportCopy" class="primary-btn">Copiar informe</button><button id="stockReportShare" class="ghost-btn">Compartir por WhatsApp</button></div>';
 panel.querySelector('textarea').value=report;
 panel.querySelector('#stockReportCopy').onclick=async()=>{try{await navigator.clipboard.writeText(report);panel.querySelector('#stockReportCopy').textContent='Copiado ✓'}catch{panel.querySelector('textarea').select();document.execCommand('copy')}};
 panel.querySelector('#stockReportShare').onclick=()=>window.open('https://wa.me/?text='+encodeURIComponent(report),'_blank','noopener');
 panel.scrollIntoView({behavior:'smooth',block:'start'});
}

/* Recepciones: nunca se suma al stock operativo, solo queda registro histórico. */
(()=>{
 const providerEl=document.getElementById('receiptProvider');if(!providerEl)return;
 const products=document.getElementById('receiptProducts'),status=document.getElementById('receiptStatus');
 const providers=[...new Set(stockItems.map(x=>x[2]))];
 providerEl.innerHTML=providers.map(p=>'<option value="'+p+'">'+p+'</option>').join('');
 function addRow(){
  const row=document.createElement('div');row.style.cssText='display:flex;gap:8px;margin:12px 0;flex-wrap:wrap';
  const sel=document.createElement('select');sel.className='search-input';sel.style.flex='2';
  const qty=document.createElement('input');qty.type='number';qty.min='0.01';qty.step='0.01';qty.placeholder='Cantidad recibida';qty.className='search-input';qty.style.flex='1';
  const del=document.createElement('button');del.type='button';del.className='ghost-btn';del.textContent='Quitar';del.onclick=()=>row.remove();
  row.append(sel,qty,del);products.append(row);fillSelect(sel);sel.addEventListener('change',()=>fillQty());function fillQty(){const name=sel.value;if(packagingCapacity[name]){qty.replaceWith(document.createElement('span'));const span=row.children[1];span.innerHTML=packagingFields(name,0)}else{const field=row.children[1];field.outerHTML='<input data-pack-total type="number" min="0" step="0.01" placeholder="Cantidad recibida" class="search-input" style="flex:1">'}}fillQty();
 }
 function fillSelect(sel){const options=stockItems.filter(x=>x[2]===providerEl.value);sel.innerHTML=options.map(x=>'<option value="'+x[0]+'">'+x[0]+' ('+x[1]+')</option>').join('');}
 providerEl.onchange=()=>{products.innerHTML='';addRow()};
 document.getElementById('receiptAdd').onclick=addRow;
 async function history(){
  const el=document.getElementById('receiptHistory');
  try{const rows=(await window.MontiCloud.listReceipts()).slice(-20).reverse();el.textContent='';
   if(!rows.length){el.textContent='Todavía no hay ingresos registrados';return}
   rows.forEach(r=>{const div=document.createElement('div');div.style.cssText='padding:12px 0;border-bottom:1px solid #555';div.textContent=new Date(r.at).toLocaleString('es-AR')+' · '+r.provider+' · '+r.items.map(x=>x.name+': '+x.qty).join(' | ')+(r.notes?' · '+r.notes:'');el.append(div)});
  }catch(e){el.textContent='No se pudo consultar el historial: '+e.message}
 }
 document.getElementById('receiptSave').onclick=async()=>{
  const btn=document.getElementById('receiptSave'),items=[...products.children].map(row=>({name:row.querySelector('select').value,qty:Number(packagingQuantity(row))}));
  if(!items.length||items.some(x=>!Number.isFinite(x.qty)||x.qty<=0)){status.textContent='Completá todas las cantidades con valores mayores a cero.';return}
  if(new Set(items.map(x=>x.name)).size!==items.length){status.textContent='No repitas un producto en la misma recepción.';return}
  btn.disabled=true;status.textContent='Guardando en Firebase…';
  try{await window.MontiCloud.saveReceipt(providerEl.value,items,document.getElementById('receiptNotes').value.trim());status.textContent='Ingreso guardado ✓. No se modificó el stock.';products.innerHTML='';addRow();document.getElementById('receiptNotes').value='';await history()}
  catch(e){status.textContent='Error: no se guardó el ingreso. '+e.message}finally{btn.disabled=false}
 };
 addRow();setTimeout(history,1500);
})();

/* Simulaciones solo para el administrador: lectura local, sin escrituras a Firebase. */
(()=>{
 function panel(id,title,report,anchor){
  let el=document.getElementById(id);
  if(!el){el=document.createElement('section');el.id=id;el.className='card';anchor?.insertAdjacentElement('afterend',el)}
  el.innerHTML='<h3>🧪 SIMULACIÓN · NO GUARDADO</h3><p class="muted">'+title+' · No se modifica el stock ni el historial.</p><textarea readonly rows="15" style="width:100%;white-space:pre-wrap"></textarea><p><button type="button" class="ghost-btn">Copiar simulación</button></p>';
  el.querySelector('textarea').value=report;
  el.querySelector('button').onclick=async()=>{try{await navigator.clipboard.writeText(report);el.querySelector('button').textContent='Copiado ✓'}catch{el.querySelector('textarea').select();document.execCommand('copy')}};
  el.scrollIntoView({behavior:'smooth',block:'start'});
 }
 const fmt=x=>Number(x).toLocaleString('es-AR',{maximumFractionDigits:2});

 const btnStock=document.getElementById('previewStock');
 const simulation={counts:{},receipts:{},completed:new Set(),provider:stockProviders[0]};
 function startSimulation(){
  simulation.counts={...getStock()};simulation.receipts={};simulation.completed=new Set();simulation.provider=stockProviders[0];
  let overlay=document.getElementById('stockSimulator');
  if(!overlay){overlay=document.createElement('div');overlay.id='stockSimulator';overlay.style.cssText='position:fixed;inset:0;z-index:9999;background:#101014;color:#f4f4f4;overflow:auto;padding:16px;box-sizing:border-box';document.body.append(overlay)}
  drawSimulator();
 }
 function drawSimulator(){
  const overlay=document.getElementById('stockSimulator'),provider=simulation.provider;
  overlay.innerHTML='<div style="max-width:780px;margin:auto"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2>🧪 Simulación de turno</h2><button type="button" id="simExit" class="ghost-btn">Salir sin guardar</button></div><p style="color:#ffd48a">MODO SIMULACIÓN · Nada de esta pantalla se guarda en Firebase.</p><p id="simProgress">'+simulation.completed.size+' de '+stockProviders.length+' proveedores simulados</p><label>Proveedor <select id="simProvider" class="search-input">'+stockProviders.map(p=>'<option '+(p===provider?'selected':'')+'>'+p+'</option>').join('')+'</select></label><div id="simRows"></div><button id="simMark" class="primary-btn">Marcar proveedor como simulado</button> <button id="simReport" class="ghost-btn">Generar informe simulado</button><div id="simOutput"></div></div>';
  overlay.querySelector('#simExit').onclick=()=>overlay.remove();
  overlay.querySelector('#simProvider').onchange=e=>{capture();simulation.provider=e.target.value;drawSimulator()};
  const rows=overlay.querySelector('#simRows');
  for(const [name,unit,p] of stockItems.filter(x=>x[2]===provider)){
   const div=document.createElement('div');div.style.cssText='padding:10px 0;border-bottom:1px solid #444';
   const label=document.createElement('strong');label.textContent=name+' ('+unit+')';div.append(label);
   const current=Number(simulation.counts[name]||0);
   if(packagingCapacity[name]){
    const fields=document.createElement('div');fields.innerHTML=packagingFields(name,current);div.append(fields);
   }else{
    const inp=document.createElement('input');inp.type='number';inp.step='0.01';inp.min='0';inp.value=current;inp.dataset.packTotal='';inp.className='search-input';inp.style.cssText='display:block;width:100%;margin-top:6px';div.append(inp);
   }
   const entry=document.createElement('input');entry.type='number';entry.min='0';entry.step='0.01';entry.value=simulation.receipts[name]||0;entry.className='search-input';entry.placeholder='Ingresos simulados';entry.style.cssText='display:block;width:100%;margin-top:6px';entry.dataset.simReceipt='';div.dataset.simName=name;div.append(entry);
   rows.append(div);
  }
  overlay.querySelector('#simMark').onclick=()=>{capture();simulation.completed.add(provider);drawSimulator()};
  overlay.querySelector('#simReport').onclick=()=>{capture();const base=getStock(),lines=['🧪 MONTI | SIMULACIÓN DE CONTROL DE STOCK','NO GUARDADO EN FIREBASE','Fecha: '+new Date().toLocaleString('es-AR'),'Proveedores simulados: '+simulation.completed.size+'/'+stockProviders.length];
   for(const p of stockProviders){lines.push('','📦 '+p.toUpperCase()+(simulation.completed.has(p)?' ✓':' ⚠️ PENDIENTE'));for(const [name,unit,owner] of stockItems.filter(x=>x[2]===p)){const before=Number(base[name]||0),entry=Number(simulation.receipts[name]||0),now=Number(simulation.counts[name]||0);lines.push(name+' | Anterior '+fmt(before)+' | Ingresos +'+fmt(entry)+' | Actual '+fmt(now)+' | Consumo aparente '+fmt(before+entry-now)+' '+unit)}}
   const output=overlay.querySelector('#simOutput');output.innerHTML='<h3>Informe de simulación</h3><textarea readonly rows="18" style="width:100%;white-space:pre-wrap"></textarea><button type="button" class="ghost-btn">Copiar informe</button>';const report=lines.join('\\n');output.querySelector('textarea').value=report;output.querySelector('button').onclick=()=>navigator.clipboard.writeText(report);output.scrollIntoView({behavior:'smooth'});
  };
 }
 function capture(){
  document.querySelectorAll('#simRows [data-sim-name]').forEach(row=>{const name=row.dataset.simName;simulation.counts[name]=packagingQuantity(row);simulation.receipts[name]=Number(row.querySelector('[data-sim-receipt]').value||0)});
 }
 if(btnStock)btnStock.onclick=()=>{if(!window.MontiCloud?.isAdmin)return;startSimulation()};
 const btnReceipt=document.getElementById('previewReceipt');
 if(btnReceipt)btnReceipt.onclick=()=>{
  if(!window.MontiCloud?.isAdmin)return;
  const provider=document.getElementById('receiptProvider').value;
  const items=[...document.getElementById('receiptProducts').children].map(row=>({name:row.querySelector('select')?.value,qty:packagingQuantity(row)}));
  const lines=['🧪 MONTI · SIMULACIÓN DE INGRESO','NO GUARDADO · NO MODIFICA STOCK','Fecha: '+new Date().toLocaleString('es-AR'),'Proveedor: '+provider,'',...items.map(x=>x.name+': '+fmt(x.qty)),'','Observaciones: '+(document.getElementById('receiptNotes').value||'Sin observaciones')];
  panel('receiptPreviewPanel','Vista previa de la recepción',lines.join('\n'),document.getElementById('receiptSave')?.closest('section'));
 };
})();
