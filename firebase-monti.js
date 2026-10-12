import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

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
const stockRef=doc(db,'monti','stock');
const showError=(message)=>{error.textContent=message};
const localStock=()=>{try{return JSON.parse(localStorage.getItem(stockKey)||'{}')}catch{return {}}};
async function restoreCloudStock(){
 const snapshot=await getDoc(stockRef);
 if(!snapshot.exists())return;
 const remote=snapshot.data();
 if(!remote?.items || typeof remote.items!=='object')return;
 const local=localStock();
 if(Object.keys(local).length===0){
   localStorage.setItem(stockKey,JSON.stringify(remote.items));
   if(remote.savedAt)localStorage.setItem(savedAtKey,remote.savedAt);
   if(typeof window.renderStock==='function')window.renderStock();
   if(typeof window.generateOrders==='function')window.generateOrders();
 }else if(JSON.stringify(local)!==JSON.stringify(remote.items)){
   const status=document.getElementById('stockSavedAt');
   if(status)status.textContent='Hay stock en la nube distinto del de este dispositivo. Guardá stock para subir el actual o consultá antes de reemplazarlo.';
 }
}
window.MontiCloud={
 async saveStock(){
  if(!signedIn)throw Error('Iniciá sesión para guardar en la nube.');
  const items=localStock();const savedAt=localStorage.getItem(savedAtKey)||new Date().toISOString();await setDoc(stockRef,{items,savedAt,updatedAt:serverTimestamp(),updatedBy:auth.currentUser.uid});const confirmed=await getDoc(stockRef);if(!confirmed.exists()||confirmed.data().savedAt!==savedAt)throw Error('Firebase no confirmó el guardado actual.');
 }
};
onAuthStateChanged(auth,async user=>{
 signedIn=!!user&&user.uid===adminUid;
 login.style.display=signedIn?'none':'flex';
 logout.style.display=signedIn?'':'none';
 if(user&&!signedIn){showError('Esta cuenta no tiene autorización para ingresar.');await signOut(auth);return;}
 if(signedIn){try{await restoreCloudStock()}catch(e){console.warn('No se pudo recuperar stock de la nube',e)}}
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
