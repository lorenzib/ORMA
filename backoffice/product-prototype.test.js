'use strict';

const {render}=require('../product-prototype');

test('Product Designer results render as an interactive visual prototype',()=>{
  document.body.innerHTML='<div id="prototype"></div>';
  const result={visualDirection:{tone:'calm','palette':'forest and stone',density:'airy'},screens:[
    {name:'Trail overview',objective:'Orient the hiker',device:'mobile',layout:'single-column',blocks:[{type:'hero',label:'Seceda loop',content:'Dog-first trail overview',interaction:'Open conditions',emphasis:'primary'}]},
    {name:'Conditions',objective:'Review safety',device:'mobile',layout:'single-column',blocks:[{type:'alert',label:'Access status',content:'Current approved status',interaction:'Return to overview',emphasis:'secondary'}]},
  ]};
  render(document.getElementById('prototype'),result);
  expect(document.querySelectorAll('.bo-prototype-screen')).toHaveLength(2);
  expect(document.querySelector('.bo-prototype-block.is-hero').textContent).toContain('Seceda loop');
  const second=document.querySelectorAll('.bo-prototype-tabs button')[1];second.click();
  expect(document.querySelectorAll('.bo-prototype-screen')[0].hidden).toBe(true);
  expect(document.querySelectorAll('.bo-prototype-screen')[1].hidden).toBe(false);
});
