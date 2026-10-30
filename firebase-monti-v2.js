import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, writeBatch, runTransaction } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const config={apiKey:'AIzaSyCK5bTZLaKRa27YvRIXc5O3Q6pQHOz7XHo',authDomain:'monti-compras.firebaseapp.com',projectId:'monti-compras',storageBucket:'monti-compras.firebasestorage.app',messagingSenderId:'436016502476',appId:'1:436016502476:web:c6a861d2dfeb0100021469',measurementId:'G-63QJR32Q4C'};
const adminUid='xCp3XpmIPVN6nVUFGO8LmQi0Sg33';
// Identidades técnicas: crear estas dos cuentas desde Firebase Authentication.
const staffAccounts=Object.freeze({encargado:'encargado@monti-compras.invalid',subencargado:'subencargado@monti-compras.invalid'});
const accountEmail=value=>staffAccounts[value.toLowerCase()]||value;
const auth=getAuth(initializeApp(config));
const db=getFirestore(auth.app);
const login=document.getElementById('firebaseLogin');
const form=document.getElementById('firebaseLoginForm');
const error=document.getElementById('firebaseLoginError');
const logout=document.getElementById('firebaseLogout');
const stockKey='monti.web.stock.v3';
const savedAtKey=stockKey+'.savedAt';
let signedIn=false;
let isAdmin=false;
let authorized=false;
const salesManifest=doc(db,'monti','fudo');
const salesChunks=collection(db,'monti','fudo','chunks');
const stockRef=doc(db,'monti','stock');
const receiptsRef=collection(db,'monti','stock','receipts');
const countsRef=collection(db,'monti','stock','counts');
const showError=(message)=>{error.textContent=message};
const localStock=()=>{try{return JSON.parse(localStorage.getItem(stockKey)||'{}')}catch{return {}}};
let cloudReady=false;
const status=(message)=>{const el=document.getElementById('cloudSaveStatus');if(el)el.textContent=message};
async function restoreCloudStock(){
 cloudReady=false;
 const snapshot=await getDoc(stockRef);
 if(!snapshot.exists()){status('Firebase no tiene stock inicial. Guardá para crearlo.');cloudReady=true;return}
 const remote=snapshot.data();
 if(!remote?.items || typeof remote.items!=='object')throw Error('Datos de stock inválidos en Firebase');
 localStorage.setItem(stockKey,JSON.stringify(remote.items));
 if(remote.savedAt)localStorage.setItem(savedAtKey,remote.savedAt);
 if(typeof window.renderStock==='function')window.renderStock();
 if(typeof window.generateOrders==='function')window.generateOrders();
 status('Stock cargado desde Firebase ✓');
 cloudReady=true;
}
window.MontiCloud={
 get isAdmin(){return isAdmin},
 async saveSales(data,meta){
  if(!signedIn||!isAdmin)throw Error('Solo el administrador puede actualizar ventas.');
  const json=JSON.stringify(data);
  const chunks=[];const chunkSize=150000;
  for(let i=0;i<json.length;i+=chunkSize)chunks.push(json.slice(i,i+chunkSize));
  if(chunks.length>200)throw Error('El Excel procesado es demasiado grande para sincronizar.');
  const version=Date.now().toString(36)+'-'+auth.currentUser.uid.slice(0,6);
  for(let i=0;i<chunks.length;i+=200){const batch=writeBatch(db);chunks.slice(i,i+200).forEach((part,j)=>batch.set(doc(salesChunks,version+'_'+(i+j)),{part}));await batch.commit()}
  await setDoc(salesManifest,{version,count:chunks.length,metaJson:JSON.stringify(meta),updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid});
  return true;
 },
 async loadSales(){
  if(!signedIn||!authorized)throw Error('Ingresá con una cuenta autorizada.');
  const manifest=await getDoc(salesManifest);if(!manifest.exists())return null;
  const {version,count,meta,metaJson}=manifest.data();
  if(!version||!Number.isInteger(count)||count<1||count>200)throw Error('Índice de ventas inválido');
  const parts=await Promise.all(Array.from({length:count},(_,i)=>getDoc(doc(salesChunks,version+'_'+i))));
  if(parts.some(p=>!p.exists()))throw Error('Faltan bloques de ventas en Firebase');
  return {data:JSON.parse(parts.map(p=>p.data().part).join('')),meta:metaJson?JSON.parse(metaJson):meta};
 },
 async listReceipts(){if(!signedIn||!authorized)throw Error('No autorizado');const snap=await getDocs(receiptsRef);return snap.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>String(a.at).localeCompare(String(b.at)));},
 async saveReceipt(provider,items,notes=''){if(!signedIn||!authorized||!cloudReady)throw Error('Firebase no está listo');if(!provider||!Array.isArray(items)||!items.length||items.some(x=>!x.name||!Number.isFinite(x.qty)||x.qty<=0))throw Error('Recepción inválida');const at=new Date().toISOString(),ref=doc(receiptsRef);await setDoc(ref,{provider,items,notes,at,by:auth.currentUser.uid,createdAt:serverTimestamp()});return {id:ref.id,at};},
 async listCounts(){if(!signedIn||!authorized)throw Error('No autorizado');const snap=await getDocs(countsRef);return snap.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>String(a.at).localeCompare(String(b.at)));},

 async getTurnStatus(){if(!signedIn||!authorized)throw Error('No autorizado');const snap=await getDoc(stockRef);return snap.exists()?snap.data().turnControl||null:null;},
 async saveProviderStock(provider,changes,turnKey){
  if(!signedIn||!authorized||!cloudReady)throw Error('Firebase no está listo');
  if(!provider||!turnKey||!changes||!Object.keys(changes).length)throw Error('Carga inválida');
  const savedAt=new Date().toISOString();
  const result=await runTransaction(db,async tx=>{
   const snap=await tx.get(stockRef),old=snap.exists()?snap.data():{};
   const prior=old.turnControl?.key===turnKey?old.turnControl:{key:turnKey,providers:{},closed:false};
   if(prior.closed)throw Error('El turno ya fue cerrado. No se puede modificar.');
   const items={...(old.items||{}),...changes};
   const turnControl={...prior,providers:{...prior.providers,[provider]:{at:savedAt,by:auth.currentUser.uid}},closed:false};
   tx.set(stockRef,{items,savedAt,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid,turnControl});
   return {items,turnControl};
  });
  localStorage.setItem(stockKey,JSON.stringify(result.items));
  localStorage.setItem(savedAtKey,savedAt);
  window.renderStock?.();window.generateOrders?.();
  return result;
 },
 async closeTurn(turnKey,providers,allowPending=false){
  if(!signedIn||!authorized||!cloudReady)throw Error('Firebase no está listo');
  if(allowPending&&!isAdmin)throw Error('Solo el administrador puede cerrar con pendientes');
  const at=new Date().toISOString();
  const result=await runTransaction(db,async tx=>{
   const snap=await tx.get(stockRef);if(!snap.exists())throw Error('No hay stock');
   const old=snap.data(),control=old.turnControl;
   if(!control||control.key!==turnKey)throw Error('El turno no tiene controles registrados');
   if(control.closed)throw Error('Este turno ya fue cerrado');
   const pending=providers.filter(p=>!control.providers?.[p]);
   if(pending.length&&!allowPending)throw Error('Faltan proveedores: '+pending.join(', '));
   const updated={...control,closed:true,closedAt:at,closedBy:auth.currentUser.uid,pending};
   tx.update(stockRef,{turnControl:updated});
   tx.set(doc(countsRef),{items:old.items,at,by:auth.currentUser.uid,turnKey,providers:control.providers,pending,createdAt:serverTimestamp()});
   return {items:old.items,control:updated};
  });
  return result;
 },
 async saveStock(items){
  if(!signedIn||!authorized||!cloudReady)throw Error('Usuario no autorizado o Firebase todavía no está listo. No se guardó.');
  const savedAt=new Date().toISOString();
  await setDoc(stockRef,{items,savedAt,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid});
  try{await setDoc(doc(countsRef),{items,at:savedAt,by:auth.currentUser.uid,createdAt:serverTimestamp()});}catch(e){console.warn('Conteo histórico no registrado; stock principal guardado',e)}
  const confirmed=await getDoc(stockRef);
  if(!confirmed.exists()||confirmed.data().savedAt!==savedAt)throw Error('Firebase no confirmó el guardado actual.');
  localStorage.setItem(stockKey,JSON.stringify(items)); // Copia técnica para el motor de cálculos, no fuente oficial.
  localStorage.setItem(savedAtKey,savedAt);
  if(typeof window.renderStock==='function')window.renderStock();
  if(typeof window.generateOrders==='function')window.generateOrders();
  return true;
 }
};
onAuthStateChanged(auth,async user=>{
 signedIn=!!user;
 isAdmin=signedIn&&user.uid===adminUid;
 authorized=!!user&&(isAdmin||Object.values(staffAccounts).includes((user.email||'').toLowerCase()));
 login.style.display=authorized?'none':'flex';
 logout.style.display=signedIn?'':'none';
 if(!authorized){cloudReady=false;window.MontiRole?.(false);if(signedIn){showError('Cuenta sin autorización para Monti Compras.');await signOut(auth)}return}
 window.MontiRole?.(isAdmin);
 try{await restoreCloudStock()}catch(e){cloudReady=false;status('ERROR: no se pudo leer Firebase. No guardes hasta recuperar conexión.');console.warn('No se pudo recuperar stock de la nube',e)}
 try{const result=await window.MontiCloud.loadSales();if(result)window.MontiSalesLoaded?.(result.data,result.meta);else window.MontiSalesMissing?.()}catch(e){console.warn('No se pudieron cargar ventas desde Firebase',e);window.MontiSalesError?.(e)}
});
form.addEventListener('submit',async event=>{
 event.preventDefault();showError('Ingresando…');
 try{await signInWithEmailAndPassword(auth,accountEmail(document.getElementById('firebaseEmail').value.trim().toLowerCase()),document.getElementById('firebasePassword').value);showError('')}
 catch(e){showError('No se pudo iniciar sesión. Revisá el correo y la contraseña.')}
});
document.getElementById('firebaseReset').addEventListener('click',async()=>{
 const email=document.getElementById('firebaseEmail').value.trim().toLowerCase();
 if(staffAccounts[email]){showError('El administrador debe restablecer la contraseña del personal.');return}
 if(!email){showError('Escribí tu correo electrónico primero.');return}
 try{await sendPasswordResetEmail(auth,email);showError('Si el correo está registrado, recibirás un enlace para recuperar la contraseña.')}
 catch(e){showError('No se pudo enviar el correo de recuperación. Intentá nuevamente.')}
});
logout.addEventListener('click',()=>signOut(auth));
