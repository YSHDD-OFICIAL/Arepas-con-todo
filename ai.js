import DB from './database.js';

class AI{
  brain(){ return DB.get("brain")||{products:{},combos:{}}; }

  track(p){
    const b=this.brain();
    b.products[p.name]=(b.products[p.name]||0)+1;
    DB.set("brain",b);
  }

  recommend(cart){
    if(!cart.length) return null;
    const b=this.brain();

    const top=Object.entries(b.products).sort((a,b)=>b[1]-a[1])[0];
    if(top) return {name:top[0],price:5000};

    return null;
  }
}

export default new AI();