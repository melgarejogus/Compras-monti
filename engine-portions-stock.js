(()=>{
  const E=window.MontiEngine;
  if(!E)return;
  const n=v=>Number(v||0)||0;
  const norm=E.norm;
  const STOCK_KEY='monti.web.stock.v3';

  // Stock porcionado de La Artesanal. Estos campos son parte del stock real y se
  // convierten automáticamente a kg/cajas antes de calcular el pedido.
  const prepared=[
    {base:'Rigatoni',key:'Rigatoni porciones',label:'porciones x200 g',eq:.20},
    {base:'Ñoquis',key:'Ñoquis porciones',label:'porciones x250 g',eq:.25},
    {base:'Fusiles',key:'Fusiles porciones',label:'porciones x200 g',eq:.20},
    {base:'Macarrones',key:'Macarrones porciones',label:'porciones x200 g',eq:.20},
    {base:'Spaghetti',key:'Spaghetti porciones 200g',label:'porciones x200 g',eq:.20},
    {base:'Spaghetti',key:'Spaghetti porciones 150g',label:'porciones x150 g',eq:.15},
    {base:'Ravioles pollo y verdura',key:'Ravioles pollo y verdura porciones',label:'porciones',eq:.375},
    {base:'Ravioles de ricota',key:'Ravioles de ricota porciones',label:'porciones',eq:.375},
    {base:'Raviolones de batata',key:'Raviolones de batata porciones',label:'porciones',eq:2/3}
  ];

  const readStock=()=>{try{return JSON.parse(localStorage.getItem(STOCK_KEY)||'{}')}catch{return {}}};

  // No dependemos de poder mutar `stockItems` de app.js. Insertamos los campos
  // directamente en la grilla para que funcionen incluso si el navegador mantiene
  // una versión cacheada de app.js o cambia el alcance de variables entre scripts.
  // Mostrar porciones junto al stock a granel, sin filas separadas.
  function addPreparedRows(){
    const grid=document.getElementById('stockGrid');
    if(!grid)return;
    const saved=readStock();
    const search=norm(document.getElementById('stockSearch')?.value||'');
    const rows=[...grid.querySelectorAll('.stock-row')];
    for(const row of rows){
      const title=row.querySelector('strong')?.textContent||'';
      const parts=prepared.filter(p=>norm(p.base)===norm(title));
      if(!parts.length)continue;
      if(search&&!norm(title).includes(search)&&!parts.some(p=>norm(p.key).includes(search)||norm(p.label).includes(search)))continue;
      row.classList.add('stock-combined-row');
      let wrap=row.querySelector('.stock-combined-inputs');
      if(!wrap){
        wrap=document.createElement('div');
        wrap.className='stock-combined-inputs';
        const baseInput=row.querySelector('input[data-stock]');
        if(baseInput){
          const baseField=document.createElement('label');
          baseField.className='stock-combined-field';
          const baseLabel=document.createElement('span');
          baseLabel.textContent='Kg';
          if(!['kg'].includes(norm(row.querySelector('.unit-cell')?.textContent||'')))baseLabel.textContent='Cajas';
          baseField.append(baseLabel,baseInput);
          wrap.appendChild(baseField);
        }
        row.appendChild(wrap);
      }
      for(const p of parts){
        if([...wrap.querySelectorAll('[data-prepared-key]')].some(input=>input.dataset.preparedKey===p.key))continue;
        const field=document.createElement('label');
        field.className='stock-combined-field';
        const label=document.createElement('span');
        label.textContent=p.label;
        const input=document.createElement('input');
        input.dataset.preparedKey=p.key;
        input.type='number';input.min='0';input.step='1';input.inputMode='numeric';
        input.value=saved[p.key]??'';input.placeholder='0';
        field.append(label,input);
        wrap.appendChild(field);
      }
    }
  }

  let scheduled=false;
  function scheduleRows(){
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;addPreparedRows()});
  }

  const grid=document.getElementById('stockGrid');
  if(grid)new MutationObserver(scheduleRows).observe(grid,{childList:true});
  document.getElementById('stockProvider')?.addEventListener('change',scheduleRows);
  document.getElementById('stockSearch')?.addEventListener('input',scheduleRows);
  scheduleRows();

  // Guardamos los campos porcionados antes del handler principal de app.js. El
  // handler normal luego conserva estas claves al guardar kg/cajas.
  const save=document.getElementById('saveStock');
  if(save)save.addEventListener('click',()=>{
    const obj=readStock();
    document.querySelectorAll('[data-prepared-key]').forEach(input=>{
      obj[input.dataset.preparedKey]=Math.max(0,Number(input.value||0));
    });
    localStorage.setItem(STOCK_KEY,JSON.stringify(obj));
  },true);

  function effectiveStock(stock){
    const out={...(stock||{})};
    const details={};
    prepared.forEach(p=>{
      const qty=n(stock?.[p.key]);
      if(!qty)return;
      const equiv=qty*p.eq;
      out[p.base]=n(out[p.base])+equiv;
      details[p.base]??=[];
      const unit=['Ñoquis','Fusiles','Macarrones','Spaghetti','Rigatoni'].includes(p.base)?'kg':'cajas';
      details[p.base].push(`${qty} ${p.label} = ${equiv.toFixed(2)} ${unit}`);
    });
    return {stock:out,details};
  }

  function appendDetail(order,details){
    (order?.lines||[]).forEach(l=>{
      const d=details[l.name];
      if(d?.length)l.note=`${l.note||''} · stock porcionado: ${d.join(' + ')}`;
    });
    return order;
  }

  const oldArt=E.artOrder?.bind(E);
  if(oldArt)E.artOrder=function(stock,now=new Date()){
    const eff=effectiveStock(stock);
    return appendDetail(oldArt(eff.stock,now),eff.details);
  };

  const old29=E.day29Order?.bind(E);
  if(old29)E.day29Order=function(stock,normal,sales,now=new Date()){
    const eff=effectiveStock(stock);
    const result=old29(eff.stock,normal,sales,now);
    appendDetail(normal,eff.details);
    return result;
  };

  window.MontiPreparedStock={prepared,effectiveStock,addPreparedRows};
  if(typeof window.generateOrders==='function')window.generateOrders();
})();