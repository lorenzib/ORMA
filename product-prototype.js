(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ORMAProductPrototype=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function el(document,tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
  function blockNode(document,block){
    const type=block.type||'text';const node=el(document,'section',`bo-prototype-block is-${type} is-${block.emphasis||'secondary'}`);
    node.append(el(document,'small','bo-prototype-block-type',type.replace(/-/g,' ')),el(document,'strong','',block.label),el(document,'p','',block.content));
    if(block.interaction)node.append(el(document,'span','bo-prototype-interaction',`↗ ${block.interaction}`));
    return node;
  }
  function screenNode(document,screen,index){
    const panel=el(document,'article',`bo-prototype-screen is-${screen.device||'mobile'} is-${screen.layout||'single-column'}`);panel.dataset.screen=String(index);panel.hidden=index!==0;
    const chrome=el(document,'div','bo-prototype-chrome');chrome.append(el(document,'span','',screen.device==='desktop'?'ORMA web':'9:41'),el(document,'b','','ORMA'),el(document,'span','','•••'));
    const heading=el(document,'header','bo-prototype-screen-head');heading.append(el(document,'small','','Screen objective'),el(document,'h5','',screen.name),el(document,'p','',screen.objective));
    const body=el(document,'div','bo-prototype-screen-body');for(const block of screen.blocks||[])body.append(blockNode(document,block));panel.append(chrome,heading,body);return panel;
  }
  function render(container,result){
    const document=container.ownerDocument;const screens=result.screens||[];const shell=el(document,'div','bo-prototype');
    const direction=result.visualDirection||{};const meta=el(document,'div','bo-prototype-direction');meta.append(el(document,'strong','',direction.tone||'ORMA visual direction'),el(document,'span','',direction.palette||'Existing ORMA palette'),el(document,'span','',direction.density||'Calm density'));shell.append(meta);
    const tabs=el(document,'div','bo-prototype-tabs');tabs.setAttribute('role','tablist');
    const stage=el(document,'div','bo-prototype-stage');const panels=screens.map((screen,index)=>screenNode(document,screen,index));
    screens.forEach((screen,index)=>{const button=el(document,'button',index===0?'is-active':'',screen.name);button.type='button';button.setAttribute('role','tab');button.setAttribute('aria-selected',index===0?'true':'false');button.addEventListener('click',()=>{[...tabs.children].forEach((item,i)=>{item.classList.toggle('is-active',i===index);item.setAttribute('aria-selected',i===index?'true':'false');});panels.forEach((panel,i)=>{panel.hidden=i!==index;});});tabs.append(button);});
    panels.forEach(panel=>stage.append(panel));shell.append(tabs,stage);container.replaceChildren(shell);return shell;
  }
  return {render,blockNode,screenNode};
});
