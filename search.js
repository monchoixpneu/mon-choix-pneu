(function () {
  'use strict';
  const projectUrl=String(window.SUPABASE_URL||'').replace(/\/+$/,'');
  const API=projectUrl?projectUrl+'/rest/v1/':'';
  const API_KEY=window.SUPABASE_ANON_KEY||'';
  const hasSupabaseConfig=!!projectUrl&&!projectUrl.includes('VOTRE-PROJET')&&!!API_KEY&&!API_KEY.includes('VOTRE_CLE');
  const TABLE='mon%20choix%20pneu';
  const FIELDS='id,marque,modele,dimension,indice_charge,indice_vitesse,saison,etiquette_ue,prix,url_produit,stock,photo,ue_classe_efficacite_energetique,ue_classe_adherence_mouillee,ue_classe_bruit_externe,ue_bruit_externe_db,ue_adherence_neige_severe,ue_adherence_glace';
  const norm=value=>String(value??'').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  const tokens=value=>String(value??'').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z0-9]+/g)||[];
  const dimensionForms=value=>{const compact=norm(value);return [compact,compact.replace(/r/g,'')];};
  const profileOf=tire=>{const m=String(tire.dimension??'').match(/\d{3}\s*[\/ -]\s*(\d{2,3})/);return m?m[1]:(tire.profil||'');};
  const dimensionParts=tire=>{const m=String(tire?.dimension??'').match(/(\d{3})\s*[/ -]\s*(\d{2,3})\s*[rR]?\s*(\d{2})/);return m?{width:m[1],profile:m[2],rim:m[3]}:null;};
  function dimensionValues(rows,key,filters={}){const values=new Set();for(const tire of rows||[]){const d=dimensionParts(tire);if(!d)continue;if(filters.width&&d.width!==filters.width)continue;if(filters.profile&&d.profile!==filters.profile)continue;if(filters.rim&&d.rim!==filters.rim)continue;values.add(d[key]);}return [...values].sort((a,b)=>Number(a)-Number(b));}
  function indexValues(rows,key){
    const values=new Set();for(const tire of rows||[]){const value=String(tire?.[key]??'').trim();if(value)values.add(key==='indice_vitesse'?value.toUpperCase():value);}
    const speedOrder=['Q','R','S','T','U','H','V','W','Y','Z','ZR','(Y)'];
    return [...values].sort((a,b)=>key==='indice_charge'?Number(a)-Number(b):(speedOrder.indexOf(a)<0?99:speedOrder.indexOf(a))-(speedOrder.indexOf(b)<0?99:speedOrder.indexOf(b))||a.localeCompare(b,'fr'));
  }
  function availableIndexCombinations(rows,dimension={}){
    const pairs=new Map();
    for(const tire of rows||[]){const d=dimensionParts(tire);if(!d||!dimension.width||!dimension.profile||!dimension.rim||d.width!==String(dimension.width)||d.profile!==String(dimension.profile)||d.rim!==String(dimension.rim))continue;const loadIndex=String(tire?.indice_charge??'').trim(),speedIndex=String(tire?.indice_vitesse??'').trim().toUpperCase();if(loadIndex&&speedIndex)pairs.set(loadIndex+'\u0000'+speedIndex,{loadIndex,speedIndex});}
    const speedOrder=['Q','R','S','T','U','H','V','W','Y','Z','ZR','(Y)'];
    return [...pairs.values()].sort((a,b)=>Number(a.loadIndex)-Number(b.loadIndex)||(speedOrder.indexOf(a.speedIndex)<0?99:speedOrder.indexOf(a.speedIndex))-(speedOrder.indexOf(b.speedIndex)<0?99:speedOrder.indexOf(b.speedIndex))||a.speedIndex.localeCompare(b.speedIndex,'fr'));
  }
  function filterDimensions(rows,filters={}){return (rows||[]).filter(tire=>{const d=dimensionParts(tire);const load=String(tire?.indice_charge??'').trim(),speed=String(tire?.indice_vitesse??'').trim().toUpperCase();return !!d&&(!filters.width||d.width===filters.width)&&(!filters.profile||d.profile===filters.profile)&&(!filters.rim||d.rim===filters.rim)&&(!filters.loadIndex||load===String(filters.loadIndex).trim())&&(!filters.speedIndex||speed===String(filters.speedIndex).trim().toUpperCase());});}
  function seasonOf(tire){const explicit=seasonParam(tire?.saison);if(explicit)return explicit;const text=norm([tire?.modele,tire?.url_produit].filter(Boolean).join(' '));if(/4saisons?|4seasons?|allseasons?|toutesaisons?|quadraxer|crossclimate/.test(text))return '4saisons';if(/hiver|winter|snow|ice/.test(text))return 'hiver';if(/ete|summer/.test(text))return 'ete';return ''; }
  function seasonParam(value){const v=norm(value);if(['hiver','winter'].includes(v))return 'hiver';if(['ete','summer'].includes(v))return 'ete';if(['4saisons','4saison','allseason','toutesaison'].includes(v))return '4saisons';return ''; }
  function dimensionQuery(width,profile,rim){return `${String(width||'').trim()}/${String(profile||'').trim()} R${String(rim||'').trim()}`.trim();}
  function resultsUrl(query,season){const params=new URLSearchParams();if(String(query||'').trim())params.set('q',String(query).trim());const selected=seasonParam(season);if(selected)params.set('saison',selected);return 'resultats.html?'+params.toString();}
  let catalog=[],loadPromise,timer,localPhotoPromise;
  async function localPhotos(){if(!localPhotoPromise)localPhotoPromise=loadLocal().then(rows=>new Map(rows.filter(x=>x&&x.id!=null).map(x=>[String(x.id),x.photo||x.image_url||x.image||''])));return localPhotoPromise;}
  async function alignPhotos(rows){try{const photos=await localPhotos();return rows.map(tire=>{const photo=photos.get(String(tire.id));return photo?{...tire,photo}:tire;});}catch(error){console.info('Photos locales indisponibles; conservation des photos distantes.',error);return rows;}}
  async function loadLocal(){const r=await fetch('catalogue.json');if(!r.ok)throw Error('catalogue.json : HTTP '+r.status);const rows=await r.json();if(!Array.isArray(rows))throw Error('Catalogue local invalide');return rows;}
  async function loadRemote(){if(!hasSupabaseConfig)throw Error('Project URL Supabase non configurée');const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);try{const rows=[];let offset=0;while(offset<10000){const r=await fetch(API+TABLE+'?select='+encodeURIComponent(FIELDS)+'&limit=1000&offset='+offset,{headers:{apikey:API_KEY,Accept:'application/json'},signal:controller.signal});if(!r.ok)throw Error('Supabase HTTP '+r.status);const batch=await r.json();if(!Array.isArray(batch))throw Error('Réponse Supabase invalide');rows.push(...batch);if(batch.length<1000)break;offset+=batch.length;}if(!rows.length)throw Error('Supabase a retourné un catalogue vide');return rows;}finally{clearTimeout(timeout);}}
  function load(){if(!loadPromise)loadPromise=(async()=>{try{catalog=await loadRemote();catalog=await alignPhotos(catalog);}catch(error){console.info('Catalogue Supabase indisponible; utilisation de catalogue.json.',error);try{catalog=await loadLocal();}catch(localError){catalog=[];console.error('Impossible de charger le catalogue local.',localError);}}return catalog;})();return loadPromise;}
  function compactProduct(tire){
    const match=String(tire?.dimension||'').match(/(\d{3})\D*(\d{2,3})\D*(\d{2})/);
    const dim=match?match[1]+match[2]+match[3]:norm(tire?.dimension).replace(/r/g,'');
    return dim+norm([tire?.marque,tire?.modele].filter(Boolean).join(' '));
  }
  function editDistance(a,b){
    if(Math.abs(a.length-b.length)>1)return 2;
    let prev=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const row=[i];let min=i;
      for(let j=1;j<=b.length;j++){row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));min=Math.min(min,row[j]);}
      if(min>1)return 2;prev=row;
    }
    return prev[b.length];
  }
  function fuzzyContains(haystack,needle){
    if(!needle)return false;if(haystack.includes(needle))return true;
    if(needle.length<5)return false;
    for(let size=Math.max(needle.length-1,4);size<=needle.length+1;size++){
      for(let i=0;i+size<=haystack.length;i++)if(editDistance(needle,haystack.slice(i,i+size))<=1)return true;
    }
    return false;
  }
  function parseQuery(query){
    let rest=String(query||'').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const dim={width:'',profile:'',rim:''};
    // Standard and compact dimensions: 205/55 R16, 205 55 16, 2055516 or 1956515.
    let m=rest.match(/(?<!\d)(\d{3})\s*\/\s*(\d{2,3})\s*r?\s*(\d{2})(?!\d)/i);
    if(!m)m=rest.match(/(?<!\d)(\d{3})(\d{2,3})(\d{2})(?!\d)/);
    if(m){dim.width=m[1];dim.profile=m[2];dim.rim=m[3];rest=rest.slice(0,m.index)+' '+rest.slice(m.index+m[0].length);}
    else {
      // A rim written as R15/R16 is a dimension component, not a model token.
      const rim=rest.match(/\br\s*(\d{2})\b/i);
      if(rim){dim.rim=rim[1];rest=rest.slice(0,rim.index)+' '+rest.slice(rim.index+rim[0].length);}
      // Also accept two adjacent dimension components, e.g. 205 55 or 55 R16.
      const nums=[...rest.matchAll(/(?<![a-z0-9])(\d{2,3})(?![a-z0-9])/g)];
      if(!dim.width){const width=nums.find(x=>x[1].length===3);if(width){dim.width=width[1];rest=rest.slice(0,width.index)+' '+rest.slice(width.index+width[0].length);}}
      if(!dim.profile){const remaining=[...rest.matchAll(/(?<![a-z0-9])(\d{2,3})(?![a-z0-9])/g)];const profile=remaining.find(x=>x[1].length===2||dim.width&&x[1].length===3);if(profile){dim.profile=profile[1];rest=rest.slice(0,profile.index)+' '+rest.slice(profile.index+profile[0].length);}}
    }
    const dimension=Object.values(dim).some(Boolean)?dim:null;
    return {dimension,terms:(rest.match(/[a-z0-9]+/g)||[]).filter(Boolean)};
  }
  function searchInfo(tire,query){
    const parsed=parseQuery(query),spec=String(tire?.dimension||'').match(/(\d{3})\D*(\d{2,3})\D*(\d{2})/);
    const fields={
      width:spec?.[1]||'',profile:spec?.[2]||'',rim:spec?.[3]||'',
      brand:norm(tire?.marque),model:norm(tire?.modele),
      other:[tire?.dimension,tire?.saison,tire?.indice_charge,tire?.indice_vitesse,tire?.etiquette_ue,tire?.url_produit].map(norm)
    };
    const requested=parsed.dimension;
    const dimensionValues=requested?[['width',requested.width],['profile',requested.profile],['rim',requested.rim]].filter(([,v])=>v):[];
    const dimensionCount=dimensionValues.length;
    const dimensionMatches=dimensionValues.filter(([k,v])=>fields[k]===v).length;
    const exactDimension=dimensionCount===3&&dimensionMatches===3;
    const partialDimension=dimensionCount>=2&&dimensionMatches>=2&&!exactDimension;
    const singleDimensionMatch=dimensionCount===1&&dimensionMatches===1;
    const termMatches=parsed.terms.map(term=>({
      brand:fuzzyContains(fields.brand,term),
      model:fuzzyContains(fields.model,term),
      other:fields.other.some(field=>fuzzyContains(field,term))
    }));
    const brandMatch=termMatches.some(x=>x.brand);
    const modelMatch=termMatches.some(x=>x.model);
    const otherMatches=termMatches.filter(x=>!x.brand&&!x.model&&x.other).length;
    const matchedTerms=termMatches.filter(x=>x.brand||x.model||x.other).length;
    const points=(exactDimension?1000:partialDimension?500:singleDimensionMatch?10:0)+(brandMatch?100:0)+(modelMatch?50:0)+otherMatches*10;
    const compactQuery=(dimensionValues.map(([,v])=>v).join(''))+parsed.terms.join('');
    const compactMatch=compactQuery.length>=5&&fuzzyContains(compactProduct(tire),compactQuery);
    const dimensionSatisfied=dimensionCount===3?exactDimension:!dimensionCount||partialDimension||singleDimensionMatch;
    // Si une recherche contient des termes, il faut qu'ils correspondent au produit;
    // la dimension seule ne doit pas faire remonter des marques/modèles sans rapport.
    const termsSatisfied=parsed.terms.length===0||matchedTerms===parsed.terms.length;
    const loose=dimensionSatisfied&&termsSatisfied&&(points>0||compactMatch);
    return {strong:loose,loose,points,matchedCount:matchedTerms,dimensionMatch:exactDimension,partialDimension,compactMatch,brandMatch,modelMatch};
  }
  function score(tire,query){const info=searchInfo(tire,query);return info.loose?info.points:-1;}
  function matches(tire,query){return searchInfo(tire,query).strong;}
  function matchesQuery(tire,query){return searchInfo(tire,query).strong;}
  const SEARCH_FIELDS=['marque','modele','dimension','saison','etiquette_ue','url_produit'];
  function rankedSearch(rows,query,selected){
    const scored=rows.filter(tire=>!selected||seasonOf(tire)===selected).map(tire=>({tire,info:searchInfo(tire,query)}));
    return scored.filter(x=>x.info.loose).sort((a,b)=>{
      // Résultats groupés strictement : dimension exacte, marque, puis le reste.
      const tier=x=>x.info.dimensionMatch?0:x.info.brandMatch?1:2;
      const byTier=tier(a)-tier(b);if(byTier)return byTier;
      if(tier(a)>=2&&a.info.points!==b.info.points)return b.info.points-a.info.points;
      return (Number(a.tire.prix)||Infinity)-(Number(b.tire.prix)||Infinity)||String(a.tire.marque||'').localeCompare(String(b.tire.marque||''),'fr');
    }).map(x=>x.tire);
  }
  async function search(query,season){
    const selected=seasonParam(season);
    if(!hasSupabaseConfig)return rankedSearch(await load(),query,selected);
    const parsed=parseQuery(query),filters=[];
    if(parsed.dimension){
      const components=[parsed.dimension.width,parsed.dimension.profile,parsed.dimension.rim].filter(Boolean);
      if(components.length)filters.push(`dimension.ilike.*${components.join('*')}*`);
    }
    for(const term of parsed.terms){const safe=term.replace(/[(),.*]/g,'');if(safe)for(const field of SEARCH_FIELDS)filters.push(`${field}.ilike.*${safe}*`);}
    if(!filters.length)return [];
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const rows=[];let offset=0;
      while(offset<10000){
        const params=new URLSearchParams({select:FIELDS,or:`(${filters.join(',')})`,order:'prix.asc.nullslast',limit:'1000',offset:String(offset)});
        const r=await fetch(API+TABLE+'?'+params.toString(),{headers:{apikey:API_KEY,Accept:'application/json'},signal:controller.signal});
        if(!r.ok){let body='';try{body=await r.text();}catch(_){}throw Error(`Supabase HTTP ${r.status}: ${body.slice(0,300)}`);}
        const batch=await r.json();if(!Array.isArray(batch))throw Error('Réponse Supabase invalide');
        rows.push(...batch);if(batch.length<1000)break;offset+=batch.length;
      }
      const hits=rankedSearch(rows,query,selected);
      if(hits.length)return hits;
      // Le filtre REST exact peut exclure une faute de frappe : élargir au catalogue puis appliquer le scoring.
      const full=await load();return rankedSearch(full,query,selected);
    }catch(error){
      console.error('Recherche Supabase par OR/ilike échouée; tentative catalogue local.',error);
      const fallback=await load();return rankedSearch(fallback,query,selected);
    }finally{clearTimeout(timeout);}
  }
  function render(box,query,season){
    box.replaceChildren();if(tokens(query).join('').length<2){box.hidden=true;return [];}
    const selected=seasonParam(season);
    const hits=rankedSearch(catalog,query,selected).slice(0,10);
    if(!hits.length){const e=document.createElement('div');e.className='suggestion-empty';e.textContent='Aucun pneu trouvé. Essayez une marque, un modèle ou une dimension.';box.append(e);const more=document.createElement('a');more.className='suggestion suggestion-all';more.href=resultsUrl(query,season);more.textContent='Voir tous les pneus correspondants →';box.append(more);box.hidden=false;return hits;}
    hits.forEach(tire=>{const a=document.createElement('a');a.className='suggestion';a.setAttribute('role','option');a.href=resultsUrl(query,season);const desc=document.createElement('span'),name=document.createElement('strong');name.textContent=[tire.marque,tire.modele].filter(Boolean).join(' ');const details=document.createElement('small');details.textContent=[tire.dimension,profileOf(tire)?'profil '+profileOf(tire):'',tire.saison].filter(Boolean).join(' · ');desc.append(name,details);const price=document.createElement('b');price.textContent=tire.prix==null?'':Number(tire.prix).toLocaleString('fr-FR',{minimumFractionDigits:2})+' €';a.append(desc,price);box.append(a);});const more=document.createElement('a');more.className='suggestion suggestion-all';more.href=resultsUrl(query,season);more.textContent='Voir tous les pneus correspondants →';box.append(more);box.hidden=false;return hits;
  }
  function goToResults(query,season){if(String(query||'').trim())location.href=resultsUrl(query,season);}
  function init(){const input=document.getElementById('tireSearch'),box=document.getElementById('searchSuggestions'),form=document.getElementById('tireSearchForm'),season=document.getElementById('seasonFilter');if(!input||!box)return;if(form)form.addEventListener('submit',e=>{e.preventDefault();goToResults(input.value,season?.value)});
    input.addEventListener('input',()=>{clearTimeout(timer);const q=input.value.trim();if(tokens(q).join('').length<2){box.replaceChildren();box.hidden=true;return;}timer=setTimeout(async()=>{await load();render(box,input.value.trim(),season?.value);},120);});
    season?.addEventListener('change',async()=>{if(input.value.trim()){await load();render(box,input.value.trim(),season.value);}});
    input.addEventListener('keydown',e=>{if(e.key==='Escape'){box.hidden=true;return;}if(e.key==='ArrowDown'){const first=box.querySelector('a');if(first){e.preventDefault();first.focus();}}if(e.key==='Enter'){e.preventDefault();goToResults(input.value,season?.value);}});
    document.addEventListener('click',e=>{if(!e.target.closest('.top-search'))box.hidden=true;});load();
  }
  function allMatches(query,season){return rankedSearch(catalog,query,seasonParam(season));}
  window.MCPSearch={load,normalize:norm,matches,score,profileOf,seasonOf,seasonParam,allMatches,search,parseQuery,matchesQuery,searchInfo,goToResults,dimensionParts,dimensionValues,indexValues,availableIndexCombinations,filterDimensions,dimensionQuery,resultsUrl};
  document.addEventListener('DOMContentLoaded',init);
})();
