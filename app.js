const $=id=>document.getElementById(id);
const STOCK_KEY='monti.web.stock.v1';

const stockItems=[
  ['Ñoquis','kg'],['Tallarines','kg'],['Fusiles','kg'],['Macarrones','kg'],
  ['Ravioles pollo','porciones'],['Ravioles ricota','porciones'],['Ravioles batata','porciones'],
  ['Focaccia','unidades'],['Volcán','unidades'],['Milanesa pollo','unidades'],['Milanesa carne','unidades'],
  ['BOLSON DE PLATOS X300U','bolsones'],['BOLSAS PASTA X500','packs'],['PLATOS MACANDCHESS X200','packs'],
  ['CAJAS MILANESA X100','packs'],['CAJA VOLCAN X100','packs'],['POTES SALSA X100','packs'],['BOLSAS GRANDES X1200','packs']
];

function norm(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()}
function rows(sheet){return XLSX.utils.sheet_to_json(sheet,{defval:''})}
function col(row,...names){for(const n of names){const found=Object.keys(row).find(k=>norm(k)===norm(n));if(found!==undefined)return row[found]}return ''}
function asDate(v){
  if(v instanceof Date&&!isNaN(v)) return v;
  if(typeof v==='number'){const d=XLSX.SSF.parse_date_code(v);return d?new Date(d.y,d.m-1,d.d):null}
  const s=String(v||'').trim(); if(!s)return null;
  const m=s.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/); if(m){let y=+m[3];if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1])}
  const d=new Date(s);return isNaN(d)?null:d;
}
function fmtDate(d){return d?d.toLocaleDateString('es-AR'):'—'}
function isCancelled(v){const n=norm(v);return ['si','sí','true','1','yes'].includes(n)}

function renderStock(){
  const saved=JSON.parse(localStorage.getItem(STOCK_KEY)||'{}');
  $('stockGrid').innerHTML=stockItems.map(([name,unit],i)=>`<div class="stock-item"><label>${name}<small>Cargar en ${unit}</small></label><input data-stock="${i}" type="number" step="0.01" inputmode="decimal" value="${saved[name]??''}" placeholder="0"></div>`).join('');
}

$('saveStock').addEventListener('click',()=>{
  const obj={};
  document.querySelectorAll('[data-stock]').forEach((input,i)=>{const [name]=stockItems[i];obj[name]=Number(input.value||0)});
  localStorage.setItem(STOCK_KEY,JSON.stringify(obj));
  $('saveStock').textContent='Guardado ✓';setTimeout(()=>$('saveStock').textContent='Guardar stock',1300);
});

$('fileInput').addEventListener('change',async e=>{
  const file=e.target.files?.[0]; if(!file)return;
  try{
    const data=await file.arrayBuffer();
    const wb=XLSX.read(data,{type:'array',cellDates:true});
    processWorkbook(wb,file.name);
  }catch(err){console.error(err);alert('No pude leer el archivo. Verificá que sea un Excel de Fudo válido.');}
});

function processWorkbook(wb,fileName){
  const sheetInfo=[];let sales=0,mods=0;const dates=[];let chicken=0,beef=0,cancelledMods=0;
  const salesSheetNames=['ventas','adiciones'];
  const modifierName='adiciones de modificadores';

  wb.SheetNames.forEach(name=>{
    const r=rows(wb.Sheets[name]);const n=norm(name);
    sheetInfo.push([name,r.length]);
    if(salesSheetNames.includes(n)){
      r.forEach(x=>{if(!isCancelled(col(x,'Cancelada','Cancelado'))){sales+=Number(col(x,'Cantidad')||1);const d=asDate(col(x,'Creación','Creacion','Fecha'));if(d)dates.push(d)}});
    }
    if(n===modifierName){
      r.forEach(x=>{
        mods++;
        const cancelled=isCancelled(col(x,'Cancelada','Cancelado')); if(cancelled){cancelledMods++;return}
        const group=norm(col(x,'Grupo modificador','Grupo'));const mod=norm(col(x,'Modificador'));
        const qty=Number(col(x,'Cantidad')||1);
        if(group==='tipo de milanesa'){
          if(['milanesa de pollo','milanesa pollo','pollo'].includes(mod))chicken+=qty;
          if(['milanesa de carne','milanesa carne','carne'].includes(mod))beef+=qty;
        }
        const d=asDate(col(x,'Creación','Creacion','Fecha'));if(d)dates.push(d);
      });
    }
  });

  dates.sort((a,b)=>a-b);
  $('salesCount').textContent=Math.round(sales).toLocaleString('es-AR');
  $('modsCount').textContent=mods.toLocaleString('es-AR');
  $('dateFrom').textContent=fmtDate(dates[0]);$('dateTo').textContent=fmtDate(dates.at(-1));
  $('chickenCount').textContent=chicken.toLocaleString('es-AR');$('beefCount').textContent=beef.toLocaleString('es-AR');
  $('fileMeta').textContent=`${fileName} · ${wb.SheetNames.length} hojas detectadas`;
  $('statusChip').textContent='Excel cargado';$('statusChip').style.color='#ff6f61';
  $('breadersHint').textContent=`Histórico detectado: ${chicken} pollo / ${beef} carne`;
  $('sheetAudit').innerHTML=sheetInfo.map(([n,c])=>`<div class="audit-row"><span>${n}</span><strong>${c.toLocaleString('es-AR')} filas</strong></div>`).join('')+`<div class="audit-row"><span>Modificadores cancelados excluidos</span><strong>${cancelledMods}</strong></div>`;
  localStorage.setItem('monti.web.lastImportMeta',JSON.stringify({fileName,at:new Date().toISOString(),sheets:sheetInfo.length,dateFrom:dates[0]?.toISOString(),dateTo:dates.at(-1)?.toISOString()}));
}

renderStock();
const last=JSON.parse(localStorage.getItem('monti.web.lastImportMeta')||'null');
if(last){$('fileMeta').textContent=`Última importación: ${last.fileName} · ${new Date(last.at).toLocaleString('es-AR')}`;}
