import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, writeBatch } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const config={apiKey:'AIzaSyCK5bTZLaKRa27YvRIXc5O3Q6pQHOz7XHo',authDomain:'monti-compras.firebaseapp.com',projectId:'monti-compras',storageBucket:'monti-compras.firebasestorage.app',messagingSenderId:'436016502476',appId:'1:436016502476:web:c6a861d2dfeb0100021469',measurementId:'G-63QJR32Q4C'};
const adminUid='xCp3XpmIPVN6nVUFGO8LmQi0Sg33';
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
const salesManifest=doc(db,'monti','fudo');
const salesChunks=collection(db,'monti','fudo','chunks');
const stockRef=doc(db,'monti','stock');
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
  await setDoc(salesManifest,{version,count:chunks.length,meta:{...meta,sheets:(meta.sheets||[]).map(entry=>({name:String(entry[0]||''),rows:Number(entry[1]||0)}))},updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid});
  return true;
 },
 async loadSales(){
  if(!signedIn)throw Error('Ingresá con una cuenta autorizada.');
  const manifest=await getDoc(salesManifest);if(!manifest.exists())return null;
  const {version,count,meta}=manifest.data();
  if(!version||!Number.isInteger(count)||count<1||count>200)throw Error('Índice de ventas inválido');
  const parts=await Promise.all(Array.from({length:count},(_,i)=>getDoc(doc(salesChunks,version+'_'+i))));
  if(parts.some(p=>!p.exists()))throw Error('Faltan bloques de ventas en Firebase');
  return {data:JSON.parse(parts.map(p=>p.data().part).join('')),meta};
 },
 async saveStock(items){
  if(!signedIn||!cloudReady)throw Error('Firebase todavía no está listo. No se guardó.');
  const savedAt=new Date().toISOString();
  await setDoc(stockRef,{items,savedAt,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid});
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
 login.style.display=signedIn?'none':'flex';
 logout.style.display=signedIn?'':'none';
 if(!signedIn){cloudReady=false;window.MontiRole?.(false);return}
 window.MontiRole?.(isAdmin);
 try{await restoreCloudStock()}catch(e){cloudReady=false;status('ERROR: no se pudo leer Firebase. No guardes hasta recuperar conexión.');console.warn('No se pudo recuperar stock de la nube',e)}
 try{const result=await window.MontiCloud.loadSales();if(result)window.MontiSalesLoaded?.(result.data,result.meta);else window.MontiSalesMissing?.()}catch(e){console.warn('No se pudieron cargar ventas desde Firebase',e);window.MontiSalesError?.(e)}
});
form.addEventListener('submit',async event=>{
 event.preventDefault();showError('Ingresando…');
 try{await signInWithEmailAndPassword(auth,document.getElementById('firebaseEmail').value.trim(),document.getElementById('firebasePassword').value);showError('')}
 catch(e){showError('No se pudo iniciar sesión. Revisá el correo y la contraseña.')}
});
document.getElementById('firebaseReset').addEventListener('click',async()=>{
 const email=document.getElementById('firebaseEmail').value.trim();
 if(!email){showError('Escribí tu correo electrónico primero.');return}
 try{await sendPasswordResetEmail(auth,email);showError('Si el correo está registrado, recibirás un enlace para recuperar la contraseña.')}
 catch(e){showError('No se pudo enviar el correo de recuperación. Intentá nuevamente.')}
});
logout.addEventListener('click',()=>signOut(auth));
