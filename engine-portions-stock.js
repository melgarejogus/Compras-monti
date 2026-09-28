(()=>{
  const E=window.MontiEngine;
  if(!E)return;
  const n=v=>Number(v||0)||0;
  const norm=E.norm;

  // Mismas equivalencias operativas de la app Android.
  const prepared=[
    {base:'Ñoquis',key:'Ñoquis porciones',label:'porciones x250 g',eq:.25},
    {base:'Fusiles',key:'Fusiles porciones',label:'porciones x200 g',eq:.20},
    {base:'Macarrones',key:'Macarrones porciones',label:'porciones x200 g',eq:.20},
    {base:'Spaghetti',key:'Spaghetti porciones 200g',label:'porciones x200 g',eq:.20},
    {base:'Spaghetti',key:'Spaghetti porciones 150g',label:'porciones x150 g',eq:.15},
    {base:'Ravioles pollo y verdura',key:'Ravioles pollo y verdura porciones',label:'porciones',eq:.375},
    {base:'Ravioles de ricota',key:'Ravioles de ricota porciones',label:'porciones',eq:.375},
    {base:'Raviolones de batata',key:'Raviolones de batata porciones',label:'porciones',eq:2/3}
  ];

  // Agrega campos visibles en Stock sin romper stocks ya guardados.
  try{
    if(typeof stockItems!=='undefined'){
      const existing=new Set(stockItems.map(x=>norm(x[0])));
      prepared.forEach(p=>{if(!existing.has(norm(p.key)))stockItems.push([p.key,p.label,'La Artesanal'])});
      if(typeof renderStock==='function')renderStock();
    }
  }catch(err){console.warn('No pude ampliar la pantalla de stock',err)}

  function effectiveStock(stock){
    const out={...(stock||{})};
    const details={};
    prepared.forEach(p=>{
      const qty=n(stock?.[p.key]);
      if(!qty)return;
      const equiv=qty*p.eq;
      out[p.base]=n(out[p.base])+equiv;
      details[p.base]??=[];
      details[p.base].push(`${qty} ${p.label} = ${equiv.toFixed(2)} ${['Ñoquis','Fusiles','Macarrones','Spaghetti'].includes(p.base)?'kg':'cajas'}`);
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

  window.MontiPreparedStock={prepared,effectiveStock};
  if(typeof window.generateOrders==='function')window.generateOrders();
})();