import DB from './database.js';

const SESSION = "session";

export const register = (email, pass)=>{
  const user = {
    id: crypto.randomUUID(),
    email,
    pass,
    token: crypto.randomUUID()
  };

  DB.set("user_"+user.id, user);
  DB.set(SESSION, user);

  return {success:true};
};

export const login = (email, pass)=>{
  const keys = Object.keys(localStorage);

  for(const k of keys){
    if(k.includes("user_")){
      const u = JSON.parse(localStorage.getItem(k));
      if(u.email===email && u.pass===pass){
        DB.set(SESSION,u);
        return {success:true};
      }
    }
  }
  return {error:"Error"};
};

export const getSession = ()=>DB.get(SESSION);
export const logout = ()=>DB.set(SESSION,null);

export const exportAccount = ()=>{
  return btoa(JSON.stringify(getSession()));
};

export const importAccount = (code)=>{
  const user = JSON.parse(atob(code));
  DB.set("user_"+user.id,user);
  DB.set(SESSION,user);
};
