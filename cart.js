(function(){
  const KEY='mcp-cart-v1';
  const SERVICES_KEY='mcp-cart-services-v1';
  function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
  function save(items){localStorage.setItem(KEY,JSON.stringify(items));updateBadges()}
  function readServices(){try{const x=JSON.parse(localStorage.getItem(SERVICES_KEY)||'[]');return Array.isArray(x)?x:[]}catch{return[]}}
  function saveServices(items){localStorage.setItem(SERVICES_KEY,JSON.stringify(items))}
  function count(){return read().reduce((n,x)=>n+(Number(x.qty)||0),0)}
  // Dimensions are stored as strings such as 205/55R16; use the Rxx rim marker.
  function rimOf(dimension){const match=String(dimension||'').match(/R\s*(\d{2})/i);return match?Number(match[1]):null}
  // Run Flat markers are searched across the available product text, case-insensitively.
  function isRunFlat(items){return items.some(item=>/run\s?flat|rft/i.test([item.marque,item.modele,item.dimension,item.description,item.nom].filter(Boolean).join(' ')))}
  function updateBadges(){document.querySelectorAll('[data-cart-count]').forEach(e=>e.textContent=count())}
  function add(product,qty){const list=read(),id=String(product.id);const found=list.find(x=>String(x.id)===id);if(found)found.qty+=qty;else list.push({id,marque:product.marque,modele:product.modele,dimension:product.dimension,prix:Number(product.prix)||0,stock:Number(product.stock)||0,photo:product.photo||'',qty});save(list)}
  window.MCPCart={read,save,count,updateBadges,add,readServices,saveServices,rimOf,isRunFlat};
  document.addEventListener('DOMContentLoaded',updateBadges);updateBadges();
})();
