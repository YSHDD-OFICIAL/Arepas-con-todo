class DB{
  key(k){ return "app_"+k; }

  set(k,v){ localStorage.setItem(this.key(k), JSON.stringify(v)); }
  get(k){ return JSON.parse(localStorage.getItem(this.key(k))); }
}

export default new DB();
