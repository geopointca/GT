(() => {
  'use strict';
  const config=window.GEOTOCHKA_SITE_CONFIG||{};
  const enabled=config.password_enabled===true;
  const key='GT_GATE:'+String(config.password_hash||'');
  function runScripts(){
    const nodes=[...document.querySelectorAll('script[data-gt-src]')];
    (async()=>{
      for(const node of nodes){
        await new Promise((resolve,reject)=>{
          const el=document.createElement('script');el.async=false;
          el.onload=resolve;el.onerror=()=>reject(new Error('Не удалось загрузить '+node.dataset.gtSrc));
          el.src=node.dataset.gtSrc;
          if(node.hasAttribute('crossorigin'))el.crossOrigin=node.getAttribute('crossorigin')||'anonymous';
          document.body.appendChild(el);
        });
      }
    })().catch(e=>{
      const msg=document.getElementById('gtPasswordError');
      if(msg)msg.textContent=e.message;
      else console.error(e);
    });
  }
  if(!enabled){runScripts();return;}
  try{if(sessionStorage.getItem(key)==='ok'){runScripts();return;}}catch(_){}
  const overlay=document.createElement('div');
  overlay.id='gtPasswordGate';
  overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:#e7edf3;color:#243244;font:16px system-ui,-apple-system,sans-serif;padding:18px;box-sizing:border-box';
  const card=document.createElement('form');card.style.cssText='background:white;border-radius:12px;box-shadow:0 12px 48px #33445544;padding:28px;width:min(95vw,520px);display:grid;gap:16px';
  const heading=document.createElement('h2');heading.textContent='Геоточка · вход';heading.style.cssText='margin:0;font-size:24px';
  const message=document.createElement('p');message.textContent=String(config.password_message||'Введите пароль для просмотра карты.');message.style.cssText='margin:0;white-space:pre-wrap;line-height:1.5;max-height:40vh;overflow:auto';
  const input=document.createElement('input');input.type='password';input.required=true;input.autocomplete='current-password';input.placeholder='Пароль';input.setAttribute('aria-label','Пароль');input.style.cssText='padding:12px;font:inherit;border-radius:7px;border:1px solid #aabbcc;width:100%;box-sizing:border-box';
  const button=document.createElement('button');button.type='submit';button.textContent='Войти';button.style.cssText='padding:11px;border:0;border-radius:7px;background:#1467bd;color:white;font:600 16px system-ui;cursor:pointer';
  const error=document.createElement('div');error.id='gtPasswordError';error.setAttribute('role','alert');error.style.cssText='color:#c32730;min-height:18px;font-size:14px';
  card.append(heading,message,input,button,error);overlay.append(card);document.body.append(overlay);input.focus();
  card.addEventListener('submit',async event=>{
    event.preventDefault();
    button.disabled=true;error.textContent='';
    try{
      if(!crypto?.subtle)throw Error('Для проверки пароля откройте сайт по HTTPS.');
      const raw=new TextEncoder().encode(String(config.password_salt||'')+':'+input.value);
      const hash=await crypto.subtle.digest('SHA-256',raw);
      const hex=[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
      if(hex!==String(config.password_hash||'')){error.textContent='Неверный пароль';input.select();return;}
      try{sessionStorage.setItem(key,'ok');}catch(_){}
      overlay.remove();runScripts();
    }catch(e){error.textContent=e.message||'Не удалось проверить пароль';}
    finally{button.disabled=false;}
  });
})();
