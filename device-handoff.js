/**
 * Desktop-to-phone handoff for actions that require a device carried outdoors.
 * Record-a-walk links are intercepted on laptops; hike-mode uses the exported
 * API for its Start hike button. Phones and tablets keep the direct action.
 */
(function(){
  'use strict';
  if(window.ORMADeviceHandoff) return;

  const PUBLIC_ORIGIN='https://www.app-orma.com';
  let dialog=null;
  let returnFocus=null;

  function mediaMatches(query){
    return typeof window.matchMedia==='function'&&window.matchMedia(query).matches;
  }

  function isHandheld(){
    if(navigator.userAgentData&&navigator.userAgentData.mobile===true) return true;
    if(/Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(navigator.userAgent||'')) return true;
    return mediaMatches('(pointer: coarse)')&&!mediaMatches('(any-pointer: fine)');
  }

  function shouldHandoff(){
    return !isHandheld();
  }

  function publicPath(fileUrl){
    const path=fileUrl.pathname||'/';
    const nested=path.match(/\/(trails|guides)\/[^/]+\.html$/);
    if(nested) return nested[0];
    const leaf=path.split('/').filter(Boolean).pop()||'';
    return `/${leaf}`;
  }

  function mobileUrlFor(input){
    const url=new URL(input||window.location.href,window.location.href);
    if(url.protocol==='file:') return `${PUBLIC_ORIGIN}${publicPath(url)}${url.search}${url.hash}`;
    if(['localhost','127.0.0.1','0.0.0.0'].includes(url.hostname)){
      return `${PUBLIC_ORIGIN}${url.pathname}${url.search}${url.hash}`;
    }
    return url.href;
  }

  function qrCodeSvg(text){
    const bytes=[];
    for(const character of text){
      const code=character.codePointAt(0);
      if(code<=0x7F)bytes.push(code);
      else if(code<=0x7FF)bytes.push(0xC0|(code>>>6),0x80|(code&0x3F));
      else if(code<=0xFFFF)bytes.push(0xE0|(code>>>12),0x80|((code>>>6)&0x3F),0x80|(code&0x3F));
      else bytes.push(0xF0|(code>>>18),0x80|((code>>>12)&0x3F),0x80|((code>>>6)&0x3F),0x80|(code&0x3F));
    }
    const versions=[
      {version:1,capacity:17,data:19,ecc:7,align:[]},
      {version:2,capacity:32,data:34,ecc:10,align:[6,18]},
      {version:3,capacity:53,data:55,ecc:15,align:[6,22]},
      {version:4,capacity:78,data:80,ecc:20,align:[6,26]},
      {version:5,capacity:106,data:108,ecc:26,align:[6,30]},
    ];
    const spec=versions.find(item=>bytes.length<=item.capacity);
    if(!spec)return null;
    const bits=[];
    const pushBits=(value,count)=>{for(let i=count-1;i>=0;i--)bits.push((value>>>i)&1);};
    pushBits(4,4);pushBits(bytes.length,8);bytes.forEach(byte=>pushBits(byte,8));
    const dataBits=spec.data*8;
    for(let i=0;i<Math.min(4,dataBits-bits.length);i++)bits.push(0);
    while(bits.length%8)bits.push(0);
    const data=[];
    for(let i=0;i<bits.length;i+=8)data.push(bits.slice(i,i+8).reduce((result,bit)=>(result<<1)|bit,0));
    for(let pad=0;data.length<spec.data;pad++)data.push(pad%2===0?0xEC:0x11);

    const exp=new Array(512),log=new Array(256);let value=1;
    for(let i=0;i<255;i++){exp[i]=value;log[value]=i;value<<=1;if(value&0x100)value^=0x11D;}
    for(let i=255;i<512;i++)exp[i]=exp[i-255];
    const multiply=(a,b)=>a&&b?exp[log[a]+log[b]]:0;
    let generator=[1];
    for(let root=0;root<spec.ecc;root++){
      const next=new Array(generator.length+1).fill(0);
      generator.forEach((coefficient,index)=>{next[index]^=coefficient;next[index+1]^=multiply(coefficient,exp[root]);});
      generator=next;
    }
    const ecc=new Array(spec.ecc).fill(0);
    data.forEach(byte=>{
      const factor=byte^ecc[0];ecc.shift();ecc.push(0);
      for(let i=0;i<spec.ecc;i++)ecc[i]^=multiply(generator[i+1],factor);
    });
    const codewords=data.concat(ecc);
    const size=17+spec.version*4;
    const modules=Array.from({length:size},()=>Array(size).fill(false));
    const fixed=Array.from({length:size},()=>Array(size).fill(false));
    const setFixed=(x,y,dark)=>{if(x>=0&&y>=0&&x<size&&y<size){modules[y][x]=!!dark;fixed[y][x]=true;}};
    const finder=(cx,cy)=>{
      for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
        const distance=Math.max(Math.abs(dx),Math.abs(dy));setFixed(cx+dx,cy+dy,distance!==2&&distance!==4);
      }
    };
    finder(3,3);finder(size-4,3);finder(3,size-4);
    for(let i=8;i<size-8;i++){setFixed(i,6,i%2===0);setFixed(6,i,i%2===0);}
    spec.align.forEach(cy=>spec.align.forEach(cx=>{
      if(fixed[cy][cx])return;
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)setFixed(cx+dx,cy+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
    }));
    const reserved=[];
    for(let i=0;i<=5;i++)reserved.push([8,i]);
    reserved.push([8,7],[8,8],[7,8]);
    for(let i=9;i<15;i++)reserved.push([14-i,8]);
    for(let i=0;i<8;i++)reserved.push([size-1-i,8]);
    for(let i=8;i<15;i++)reserved.push([8,size-15+i]);
    reserved.forEach(([x,y])=>setFixed(x,y,false));setFixed(8,size-8,true);

    let bitIndex=0;
    for(let right=size-1;right>=1;right-=2){
      if(right===6)right=5;
      for(let vertical=0;vertical<size;vertical++){
        const y=((right+1)&2)===0?size-1-vertical:vertical;
        for(let offset=0;offset<2;offset++){
          const x=right-offset;if(fixed[y][x])continue;
          const bit=bitIndex<codewords.length*8?((codewords[bitIndex>>>3]>>>(7-(bitIndex&7)))&1):0;
          modules[y][x]=Boolean(bit)^((x+y)%2===0);bitIndex++;
        }
      }
    }

    const formatData=8;let remainder=formatData;
    for(let i=0;i<10;i++)remainder=(remainder<<1)^(((remainder>>>9)&1)*0x537);
    const formatBits=((formatData<<10)|remainder)^0x5412;
    const formatBit=index=>((formatBits>>>index)&1)!==0;
    for(let i=0;i<=5;i++)setFixed(8,i,formatBit(i));
    setFixed(8,7,formatBit(6));setFixed(8,8,formatBit(7));setFixed(7,8,formatBit(8));
    for(let i=9;i<15;i++)setFixed(14-i,8,formatBit(i));
    for(let i=0;i<8;i++)setFixed(size-1-i,8,formatBit(i));
    for(let i=8;i<15;i++)setFixed(8,size-15+i,formatBit(i));
    setFixed(8,size-8,true);

    const quiet=4;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox',`0 0 ${size+quiet*2} ${size+quiet*2}`);
    svg.setAttribute('role','img');svg.setAttribute('aria-label','QR code to open this action on your phone');svg.setAttribute('shape-rendering','crispEdges');
    const background=document.createElementNS(svg.namespaceURI,'rect');
    background.setAttribute('width','100%');background.setAttribute('height','100%');background.setAttribute('fill','#fff');svg.appendChild(background);
    const path=document.createElementNS(svg.namespaceURI,'path');let drawing='';
    modules.forEach((row,y)=>row.forEach((dark,x)=>{if(dark)drawing+=`M${x+quiet} ${y+quiet}h1v1h-1z`;}));
    path.setAttribute('d',drawing);path.setAttribute('fill','#1B1F19');svg.appendChild(path);
    return svg;
  }

  function addStyles(){
    if(document.getElementById('ormaDeviceHandoffStyles')) return;
    const style=document.createElement('style');
    style.id='ormaDeviceHandoffStyles';
    style.textContent=`
      .device-handoff{position:fixed;inset:0;z-index:10020;display:grid;place-items:center;padding:24px;background:rgba(27,31,25,.58);backdrop-filter:blur(3px)}
      .device-handoff[hidden]{display:none}.device-handoff__panel{position:relative;width:min(520px,100%);max-height:calc(100vh - 48px);overflow:auto;padding:34px;border-radius:24px;background:#fff;color:#1B1F19;box-shadow:0 24px 80px rgba(20,29,23,.3)}
      .device-handoff__close{position:absolute;top:18px;right:18px;display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:50%;background:#F0F1ED;color:#1B1F19;font:400 25px/1 sans-serif;cursor:pointer}
      .device-handoff__eyebrow{margin:0 48px 8px 0;color:#3E7A91;font:800 10px/1.2 Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase}.device-handoff h2{margin:0 48px 10px 0;font:700 34px/1.05 'Bricolage Grotesque',Inter,sans-serif}.device-handoff__intro{margin:0;color:#68736B;font:400 14px/1.55 Inter,sans-serif}
      .device-handoff__body{display:grid;grid-template-columns:210px minmax(0,1fr);gap:24px;align-items:center;margin-top:26px;padding-top:26px;border-top:1px solid #E4E0D3}.device-handoff__qr{display:grid;place-items:center;min-height:210px;padding:10px;border:1px solid #E4E0D3;border-radius:16px;background:#fff}.device-handoff__qr svg{display:block;width:188px;height:188px}.device-handoff__qr-fallback{color:#68736B;font:600 12px/1.4 Inter,sans-serif;text-align:center}
      .device-handoff__instructions{margin:0 0 15px;font:600 14px/1.45 Inter,sans-serif}.device-handoff__url{display:block;max-width:100%;overflow:hidden;margin:0 0 14px;color:#68736B;font:500 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;text-overflow:ellipsis;white-space:nowrap}.device-handoff__actions{display:grid;gap:9px}.device-handoff__actions button,.device-handoff__actions a{display:flex;align-items:center;justify-content:center;min-height:42px;padding:0 14px;border-radius:10px;font:800 12px/1 Inter,sans-serif;text-decoration:none;cursor:pointer}.device-handoff__copy{border:1px solid #2E4034;background:#2E4034;color:#fff}.device-handoff__share{border:1px solid #D7DDD7;background:#fff;color:#2E4034}
      @media(max-width:620px){.device-handoff{padding:14px}.device-handoff__panel{padding:28px 22px;border-radius:19px}.device-handoff h2{font-size:29px}.device-handoff__body{grid-template-columns:1fr}.device-handoff__qr{width:210px;justify-self:center}}
    `;
    document.head.appendChild(style);
  }

  function close(){
    if(!dialog||dialog.hidden) return;
    dialog.hidden=true;
    document.body.style.overflow=dialog.dataset.previousOverflow||'';
    if(returnFocus&&typeof returnFocus.focus==='function') returnFocus.focus();
  }

  function ensureDialog(){
    if(dialog) return dialog;
    addStyles();
    dialog=document.createElement('div');
    dialog.className='device-handoff';
    dialog.hidden=true;
    dialog.innerHTML=`
      <section class="device-handoff__panel" role="dialog" aria-modal="true" aria-labelledby="deviceHandoffTitle" aria-describedby="deviceHandoffIntro">
        <button class="device-handoff__close" type="button" aria-label="Close">×</button>
        <p class="device-handoff__eyebrow">Best used outdoors</p>
        <h2 id="deviceHandoffTitle">Continue on your phone</h2>
        <p id="deviceHandoffIntro" class="device-handoff__intro"></p>
        <div class="device-handoff__body">
          <div class="device-handoff__qr"><span class="device-handoff__qr-fallback" hidden>QR code unavailable. Copy the link instead.</span></div>
          <div>
            <p class="device-handoff__instructions">Scan with your phone camera, or share the link with yourself by email.</p>
            <span class="device-handoff__url"></span>
            <div class="device-handoff__actions"><button class="device-handoff__copy" type="button">Copy link</button><a class="device-handoff__share" href="#">Share by email</a></div>
          </div>
        </div>
      </section>`;
    document.body.appendChild(dialog);
    const closeButton=dialog.querySelector('.device-handoff__close');
    closeButton.addEventListener('click',close);
    dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
    dialog.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();close();return;}
      if(event.key!=='Tab') return;
      const focusable=Array.from(dialog.querySelectorAll('button,a[href]')).filter(node=>!node.hidden);
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    });
    return dialog;
  }

  function copyLink(url,button){
    const copied=()=>{button.textContent='Link copied';window.setTimeout(()=>{button.textContent='Copy link';},1800);};
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(copied).catch(()=>fallbackCopy(url,copied));
    }else fallbackCopy(url,copied);
  }

  function fallbackCopy(url,done){
    const input=document.createElement('textarea');
    input.value=url;input.setAttribute('readonly','');input.style.position='fixed';input.style.opacity='0';
    document.body.appendChild(input);input.select();
    try{document.execCommand('copy');done();}catch(error){/* The visible URL remains available. */}
    input.remove();
  }

  function open(options){
    const target=mobileUrlFor(options&&options.url);
    const modal=ensureDialog();
    returnFocus=document.activeElement;
    modal.querySelector('#deviceHandoffTitle').textContent=options&&options.title||'Continue on your phone';
    modal.querySelector('#deviceHandoffIntro').textContent=options&&options.description||'This action needs your phone’s location while you are outdoors.';
    modal.querySelector('.device-handoff__url').textContent=target;
    const shareLink=modal.querySelector('.device-handoff__share');
    const shareTitle=options&&options.title||'Continue on your phone';
    shareLink.href=`mailto:?subject=${encodeURIComponent(`ORMA | ${shareTitle}`)}&body=${encodeURIComponent(`Open this ORMA link on your phone:\n${target}`)}`;
    const copyButton=modal.querySelector('.device-handoff__copy');
    copyButton.textContent='Copy link';
    copyButton.onclick=()=>copyLink(target,copyButton);
    const qr=modal.querySelector('.device-handoff__qr');
    const fallback=modal.querySelector('.device-handoff__qr-fallback');
    qr.querySelector('svg')?.remove();
    const qrSvg=qrCodeSvg(target);
    fallback.hidden=!!qrSvg;
    if(qrSvg)qr.insertBefore(qrSvg,fallback);
    modal.dataset.previousOverflow=document.body.style.overflow||'';
    document.body.style.overflow='hidden';
    modal.hidden=false;
    modal.querySelector('.device-handoff__close').focus();
    return target;
  }

  document.addEventListener('click',event=>{
    if(!shouldHandoff()||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey) return;
    const link=event.target.closest&&event.target.closest('a[href]');
    if(!link) return;
    let url;
    try{url=new URL(link.href,window.location.href);}catch(error){return;}
    if(!/(^|\/)walk\.html$/.test(url.pathname)) return;
    event.preventDefault();
    open({title:'Record your walk on your phone',description:'Walk recording uses your phone’s GPS while you are outdoors.',url:url.href});
  });

  window.ORMADeviceHandoff={isHandheld,shouldHandoff,mobileUrlFor,open,close};

  if(shouldHandoff()&&/(^|\/)walk\.html$/.test(window.location.pathname)){
    window.setTimeout(()=>open({
      title:'Record your walk on your phone',
      description:'Walk recording uses your phone’s GPS while you are outdoors.',
      url:window.location.href,
    }),0);
  }
})();
