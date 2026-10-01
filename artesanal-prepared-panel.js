(()=>{
  const STOCK_KEY='monti.web.stock.v3';
  const fields=[
    ['Ñoquis porciones','Ñoquis','porciones x250 g'],
    ['Fusiles porciones','Fusiles','porciones x200 g'],
    ['Macarrones porciones','Macarrones','porciones x200 g'],
    ['Spaghetti porciones 200g','Spaghetti','porciones x200 g'],
    ['Spaghetti porciones 150g','Spaghetti','porciones x150 g'],
    ['Ravioles pollo y verdura porciones','Ravioles pollo y verdura','porciones'],
    ['Ravioles de ricota porciones','Ravioles de ricota','porciones'],
    ['Raviolones de batata porciones','Raviolones de batata','porciones']
  ];
  const read=()=>{try{return JSON.parse(localStorage.getItem(STOCK_KEY)||'{}')}catch{return {}}};
  function ensurePanel(){
    const grid=document.getElementById('stockGrid');
    const provider=document.getElementById('stockProvider')?.value||'all';
    if(!grid)return;
    const old=document.getElementById('artPreparedPanel');
    const show=provider==='all'||provider==='La Artesanal';
    if(!show){old?.remove();return}
    if(old)return;
    const saved=read();
    const panel=document.createElement('div');
    panel.id='artPreparedPanel';
    panel.className='card';
    panel.style.margin='0 0 16px 0';
    panel.innerHTML=`<div class="section-head"><div><p class="eyebrow">LA ARTESANAL</p><h3>Porciones preparadas</h3><p class="muted">Se convierten automáticamente a kg/cajas y se suman al stock.</p></div></div><div class="stock-table">${fields.map(([key,base,label])=>`<div class="stock-row"><strong>${base}</strong><span class="provider-cell">La Artesanal</span><span class="unit-cell">${label}</span><input data-art-prepared="${key}" type="number" min="0" step="1" inputmode="numeric" value="${saved[key]??''}" placeholder="0"></div>`).join('')}</div>`;
    grid.parentElement?.insertBefore(panel,grid);
  }
  document.getElementById('stockProvider')?.addEventListener('change',()=>setTimeout(ensurePanel,0));
  document.querySelector('.nav-item[data-view="stock"]')?.addEventListener('click',()=>setTimeout(ensurePanel,0));
  document.getElementById('saveStock')?.addEventListener('click',()=>{
    const obj=read();
    document.querySelectorAll('[data-art-prepared]').forEach(i=>obj[i.dataset.artPrepared]=Math.max(0,Number(i.value||0)));
    localStorage.setItem(STOCK_KEY,JSON.stringify(obj));
  },true);
  setTimeout(ensurePanel,0);
  window.addEventListener('pageshow',ensurePanel);
})();