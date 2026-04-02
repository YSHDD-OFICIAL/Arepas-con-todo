import { renderMenu, renderCart, renderAccount } from './ui.js';

const routes={
  "/":()=>"<h1>Inicio 🔥</h1>",
  "/menu":renderMenu,
  "/carrito":renderCart,
  "/cuenta":renderAccount
};

export const router=()=>{
  const view=routes[location.pathname]||routes["/"];
  document.getElementById("app").innerHTML=view();
};
