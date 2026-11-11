(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const PROFILE_FIELDS = ['prenom','nom','telephone','adresse','complement_adresse','code_postal','ville'];
  let mode = 'signup', client = null, user = null;
  const form = $('auth-form');
  $('year').textContent = new Date().getFullYear();
  function status(id, message, error=false) { const el=$(id); el.textContent=message; el.classList.toggle('error',error); }
  function setMode(next) {
    mode=next;
    $('show-login').setAttribute('aria-pressed',String(next==='login'));
    $('show-signup').setAttribute('aria-pressed',String(next==='signup'));
    $('auth-title').textContent=next==='login'?'Ravi de vous retrouver':'Créer mon espace client';
    $('auth-subtitle').textContent=next==='login'?'Connectez-vous pour retrouver votre fiche client.':'Renseignez vos coordonnées pour créer votre compte.';
    $('auth-submit').innerHTML=next==='login'?'Se connecter <span aria-hidden="true">→</span>':'Créer mon compte <span aria-hidden="true">→</span>';
    form.elements.password.autocomplete=next==='login'?'current-password':'new-password';
    document.querySelectorAll('[data-signup-only]').forEach(label=>{
      label.hidden=next!=='signup';
      const input=label.querySelector('input');
      input.required=next==='signup' && input.name!=='complement_adresse';
    });
    form.elements.password_confirmation.required=next==='signup';
    status('auth-status','');
  }
  function loadCDN() {
    if (window.supabase?.createClient) return Promise.resolve(true);
    return new Promise(resolve=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.async=true;
      script.onload=()=>resolve(Boolean(window.supabase?.createClient));
      script.onerror=()=>resolve(false);
      document.head.appendChild(script);
    });
  }
  async function initialize() {
    const loaded=await loadCDN();
    if (!loaded) { status('auth-status','Formulaire accessible ; service de compte indisponible (chargement Supabase impossible). Réessayez lorsque vous êtes connecté à Internet.',true); return; }
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) { status('auth-status','Formulaire accessible ; configurez l’URL et la clé publique Supabase dans supabase-config.js.',true); return; }
    try {
      client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      client.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;});
      const {data,error}=await client.auth.getSession();
      if(error) throw error;
      user=data.session?.user||null;
      if(user) { await showProfile(); }
    } catch(error) { status('auth-status',error.message||'Impossible de contacter Supabase.',true); }
  }
  function rowFrom(values) { const row={}; PROFILE_FIELDS.forEach(key=>row[key]=String(values.get(key)||'').trim()||null); return row; }
  async function persistProfile(row) { const {error}=await client.from('clients').upsert({user_id:user.id,...row},{onConflict:'user_id'}); if(error) throw error; }
  async function showProfile() {
    if(!user) return;
    $('auth-view').hidden=true; $('profile-view').hidden=false;
    const profileForm=$('profile-form'); profileForm.elements.email.value=user.email||'';
    status('profile-status','Chargement de votre fiche…');
    const {data,error}=await client.from('clients').select(PROFILE_FIELDS.join(',')).eq('user_id',user.id).maybeSingle();
    if(error) throw error;
    if(data) PROFILE_FIELDS.forEach(key=>profileForm.elements[key].value=data[key]||'');
    else {
      const metadata={}; PROFILE_FIELDS.forEach(key=>{ metadata[key]=user.user_metadata?.[key]||''; profileForm.elements[key].value=metadata[key]; });
      if(metadata.prenom && metadata.nom) { await persistProfile(metadata); status('profile-status','Votre fiche d’inscription est enregistrée.'); return; }
      status('profile-status','Complétez votre fiche puis enregistrez-la.'); return;
    }
    status('profile-status','Votre fiche client est chargée.');
  }
  $('show-login').addEventListener('click',()=>setMode('login'));
  $('show-signup').addEventListener('click',()=>setMode('signup'));
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!client) { status('auth-status','Le formulaire reste disponible, mais Supabase n’est pas connecté. Vérifiez votre connexion et la configuration du projet.',true); return; }
    const values=new FormData(form),button=$('auth-submit'); button.disabled=true; status('auth-status','');
    try {
      const email=String(values.get('email')||'').trim(),password=String(values.get('password')||'');
      if(mode==='signup') {
        if(password!==values.get('password_confirmation')) throw new Error('Les deux mots de passe ne correspondent pas.');
        const profile=rowFrom(values);
        const {data,error}=await client.auth.signUp({email,password,options:{data:profile}});
        if(error) throw error;
        user=data.user||null;
        if(data.session && user) { await persistProfile(profile); location.href='index.html'; return; }
        status('auth-status','Compte créé. Vérifiez votre boîte e-mail pour confirmer l’adresse ; vous pourrez ensuite vous connecter. Redirection vers l’accueil…');
        setTimeout(()=>{location.href='index.html';},1800);
      } else {
        const {data,error}=await client.auth.signInWithPassword({email,password}); if(error) throw error;
        user=data.user; location.href='index.html';
      }
    } catch(error) { status('auth-status',error.message||'Une erreur est survenue. Réessayez.',true); }
    finally { button.disabled=false; }
  });
  $('profile-form').addEventListener('submit',async event=>{
    event.preventDefault(); const button=$('save-profile'); button.disabled=true;
    try { if(!user) throw new Error('Votre session a expiré. Reconnectez-vous.'); await persistProfile(rowFrom(new FormData(event.currentTarget))); status('profile-status','Votre fiche client est enregistrée.'); }
    catch(error) { status('profile-status',error.message||'Enregistrement impossible.',true); }
    finally { button.disabled=false; }
  });
  $('signout').addEventListener('click',async()=>{
    try { if(!client) throw new Error('Supabase n’est pas disponible.'); const {error}=await client.auth.signOut(); if(error) throw error; user=null; $('profile-view').hidden=true; $('auth-view').hidden=false; setMode('login'); status('auth-status','Vous êtes déconnecté.'); }
    catch(error) { status('profile-status',error.message||'Déconnexion impossible.',true); }
  });
  setMode('signup');
  initialize();
})();
