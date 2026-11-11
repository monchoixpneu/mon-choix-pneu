(function(){
  'use strict';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220"><rect width="320" height="220" rx="20" fill="#f1f2f5"/><ellipse cx="160" cy="113" rx="70" ry="91" fill="#24242b"/><ellipse cx="160" cy="113" rx="43" ry="64" fill="#f1f2f5"/><ellipse cx="160" cy="113" rx="24" ry="38" fill="#24242b"/><path d="M105 47l18 17m74-17l-18 17M89 84l25 7m92-7l-25 7M88 137l26-7m92 7l-25-7m-76 43l18-18m74 18l-18-18" stroke="#777985" stroke-width="7" stroke-linecap="round"/><text x="160" y="207" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#555">PHOTO INDISPONIBLE</text></svg>';
  const placeholder='data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
  function resolve(value){
    if(value&&typeof value==='object')value=value.url||value.src||value.href||'';
    const raw=String(value??'').trim();
    if(!raw)return placeholder;
    if(/^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);/i.test(raw))return raw;
    try{
      const url=new URL(raw,document.baseURI);
      if(url.protocol==='http:')url.protocol='https:';
      if(url.protocol!=='https:')return placeholder;
      return url.href;
    }catch(_){return placeholder;}
  }
  function source(product){
    if(!product)return placeholder;
    for(const key of ['photo','image_url','image']){
      const value=product[key];if(value!=null&&String(value).trim())return resolve(value);
    }
    return placeholder;
  }
  window.MCPImages={resolve,source,placeholder};
})();
