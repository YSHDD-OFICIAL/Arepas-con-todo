import { router } from './router.js';
import { getSession } from './auth.js';
import { renderAuth } from './ui.js';
import { clearCart } from './cart.js';

window.addEventListener("load",()=>{
  const user=getSession();

  if(!user){
    document.getElementById("app").innerHTML=renderAuth();
    return;
  }

  router();
});

window.pay=()=>{
  document.getElementById("app").innerHTML=`
  <div class="loader">
    <div class="spinner"></div>
  </div>`;

  setTimeout(()=>{
    clearCart();
    document.getElementById("app").innerHTML="<h1>Pedido enviado 🔥</h1>";
  },1500);
};

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js");
}