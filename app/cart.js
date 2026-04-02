import DB from './database.js';
import AI from './ai.js';

export const getCart = ()=>DB.get("cart")||[];

export const addToCart = (p)=>{
  const cart=getCart();
  cart.push(p);
  DB.set("cart",cart);
  AI.track(p);
};

export const total = ()=>getCart().reduce((a,b)=>a+b.price,0);

export const clearCart = ()=>DB.set("cart",[]);
