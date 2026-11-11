/* Authentification partagée — dépend de Supabase JS CDN et supabase-config.js chargés avant. */
(() => {
  const configured = window.SUPABASE_URL && !window.SUPABASE_URL.includes('VOTRE-PROJET') && window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.includes('VOTRE_CLE');
  const client = configured && window.supabase?.createClient ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
  let user = null;
  function render() { document.querySelectorAll('[data-auth-link]').forEach(a => { a.textContent = user ? 'Mon compte' : 'Se connecter'; a.href = user ? 'compte.html' : `compte.html?retour=${encodeURIComponent(location.pathname.split('/').pop() || 'index.html')}`; }); }
  async function ready() {
    if (client) { const {data,error}=await client.auth.getSession(); if(error) console.warn('Session Supabase:',error.message); user=data?.session?.user||null; client.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;render()}); }
    render(); return user;
  }
  const readyPromise=ready();
  async function getUser(){ await readyPromise; if(!client)return null; const {data,error}=await client.auth.getUser(); if(error && error.name!=='AuthSessionMissingError') throw error; user=data?.user||null;render();return user; }
  async function signIn(email,password){if(!client)throw new Error('Remplacez les valeurs d’exemple dans supabase-config.js.');const {data,error}=await client.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;user=data.user;render();return data}
  async function signUp(email,password){if(!client)throw new Error('Remplacez les valeurs d’exemple dans supabase-config.js.');const {data,error}=await client.auth.signUp({email:email.trim(),password});if(error)throw error;user=data.user||null;render();return data}
  async function signOut(){if(client){const {error}=await client.auth.signOut();if(error)throw error}user=null;render()}
  window.MCPAuth={client,ready:readyPromise,getUser,signIn,signUp,signOut};
})();
