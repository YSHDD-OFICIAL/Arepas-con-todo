import { login, register, exportAccount, importAccount } from './auth.js';
import { getCart, addToCart, total } from './cart.js';
import AI from './ai.js';

export const renderAuth = ()=>`
<div class="auth">
  <h2>🔥 Bienvenido</h2>
  <input id="email" placeholder="Correo">
  <input id="pass" type="password" placeholder="Contraseña">
  <button onclick="doLogin()">Login</button>
  <button onclick="doRegister()">Registro</button>
</div>`;

export const renderMenu = ()=>{
  const products=[
    {name:"Arepa Reina",price:12000},
    {name:"Arepa Carne",price:15000}
  ];

  return products.map(p=>`
  <div class="card">
    <h3>${p.name}</h3>
    <p>$${p.price}</p>
    <button onclick='add(${JSON.stringify(p)})'>Agregar</button>
  </div>`).join("");
};

export const renderCart = ()=>{
  const cart=getCart();
  const rec=AI.recommend(cart);

  return `
  ${cart.map(p=>`<div class="card">${p.name}</div>`).join("")}
  <h3>Total: $${total()}</h3>

  ${rec?`<div class="card ai-box">${rec.name}</div>`:""}

  <button onclick="pay()">Pagar Nequi</button>
  `;
};

export const renderAccount = ()=>`
<div class="card">
  <button onclick="exportAcc()">Exportar</button>
  <textarea id="code"></textarea>
  <button onclick="importAcc()">Importar</button>
</div>
`;

window.doLogin=()=>{
  const e=email.value,p=pass.value;
  import('./auth.js').then(m=>{
    const r=m.login(e,p);
    if(r.error) alert("Error"); else location.reload();
  });
};

window.doRegister=()=>{
  const e=email.value,p=pass.value;
  import('./auth.js').then(m=>{
    m.register(e,p); location.reload();
  });
};

window.add=addToCart;

window.exportAcc=()=>{
  import('./auth.js').then(m=>{
    const c=m.exportAccount();
    navigator.clipboard.writeText(c);
    alert("Copiado");
  });
};

window.importAcc=()=>{
  const c=document.getElementById("code").value;
  import('./auth.js').then(m=>{
    m.importAccount(c); location.reload();
  });
};
