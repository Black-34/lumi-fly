const {chromium}=require('playwright');
const F='file://'+process.argv[2];let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++}else{fail++;console.log('FAIL',m)}};
(async()=>{const b=await chromium.launch();
for(const [w,h] of [[320,568],[360,640],[390,844],[412,915],[768,1024]]){
 const p=await b.newPage({viewport:{width:w,height:h}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(F);await p.evaluate(()=>{localStorage.clear();localStorage.setItem('lf5-dev','0');localStorage.setItem('lf4-coins','450')});await p.reload();await p.waitForTimeout(300);
 await p.evaluate(()=>{const s=document.getElementById('splash');if(s)s.remove()});await p.waitForTimeout(200);
 const tag=w+'x'+h;
 // daily popup
 await p.click('#giftBtn');await p.waitForTimeout(350);
 let r=await p.evaluate(()=>{const g=document.querySelector('#daily .gpop').getBoundingClientRect(),a=document.getElementById('app').getBoundingClientRect(),x=document.getElementById('dClose').getBoundingClientRect();
   return {inside:g.top>=a.top-1&&g.bottom<=a.bottom+1&&g.left>=a.left-1&&g.right<=a.right+1,xv:x.width>=40,startVisible:!document.getElementById('start').hidden,days:document.querySelectorAll('#dyGrid .dy').length,mis:document.querySelectorAll('#misList .mis').length,coins}});
 ok(r.inside,tag+' popup inside');ok(r.xv,tag+' close size');ok(r.startVisible,tag+' start behind');ok(r.days===7,tag+' 7 days');ok(r.mis===3,tag+' 3 missions');
 const c0=r.coins;
 // background blocked: click on backdrop area where play button is -> should close popup, not start game
 await p.evaluate(()=>document.querySelector('#dyGrid .now').click());
 r=await p.evaluate(()=>({coins,cl:dState().claimed,txt:document.getElementById('dCoins').textContent}));ok(r.coins===c0+30&&r.cl,tag+' claim +30');ok(r.txt==='★ '+(c0+30),tag+' popup coins update');
 await p.evaluate(()=>document.querySelector('#dyGrid .now')&&document.querySelector('#dyGrid .now').click());
 r=await p.evaluate(()=>coins);ok(r===c0+30,tag+' no double claim');
 const ab=await p.evaluate(()=>{const a=document.getElementById('app').getBoundingClientRect();return [a.left+5,a.top+a.height/2]});
 await p.mouse.click(ab[0],ab[1]);await p.waitForTimeout(350);
 r=await p.evaluate(()=>({hid:document.getElementById('daily').hidden,st,coinN:document.getElementById('coinN').textContent,coins}));
 ok(r.hid,tag+' backdrop closes');ok(r.st==='menu',tag+' game not started');
 await p.screenshot({path:`t-${tag}-menu.png`});
 // power-ups
 await p.click('#puBtn');await p.waitForTimeout(300);
 r=await p.evaluate(()=>({n:document.querySelectorAll('#pgrid .pc').length,pc:document.getElementById('pCoins').textContent,coins,ov:[...document.querySelectorAll('#pgrid .pc')].some(e=>e.scrollWidth>e.clientWidth+1)}));
 ok(r.n===3,tag+' 3 cards');ok(r.pc==='★ '+r.coins,tag+' pu coins same');ok(!r.ov,tag+' no overflow');
 await p.screenshot({path:`t-${tag}-pu.png`});
 await p.evaluate(()=>document.querySelector('#pgrid .pc[data-k="ghost"]').click());await p.waitForTimeout(200);
 await p.screenshot({path:`t-${tag}-pud.png`});
 r=await p.evaluate(()=>{const d=document.querySelector('.dbox').getBoundingClientRect(),a=document.getElementById('app').getBoundingClientRect();return {txt:document.querySelector('.dbox').innerText,inside:d.top>=a.top-1&&d.bottom<=a.bottom+1,buy:!!document.getElementById('puB')}});
 ok(/5 seconds/.test(r.txt)&&/ghost button/.test(r.txt),tag+' ghost text');ok(r.inside,tag+' detail inside');ok(r.buy,tag+' buy btn');
 const before=await p.evaluate(()=>({c:coins,g:pu.ghost}));
 await p.evaluate(()=>{const b=document.getElementById('puB');b.click();b.click();b.click()});await p.waitForTimeout(400);
 r=await p.evaluate(()=>({c:coins,g:pu.ghost,ls:JSON.parse(localStorage.getItem('lf4-pu')).ghost,lc:+localStorage.getItem('lf4-coins')}));
 ok(r.c===before.c-200&&r.g===before.g+1,tag+' bought once (triple tap)');ok(r.ls===r.g&&r.lc===r.c,tag+' saved');
 // not enough for heart now? coins 480-200=280 <350
 await p.evaluate(()=>closeDlg());await p.evaluate(()=>document.querySelector('#pgrid .pc[data-k="heart"]').click());await p.waitForTimeout(150);
 r=await p.evaluate(()=>({need:document.querySelector('.dbox .need').textContent,buy:!!document.getElementById('puB'),coins}));
 ok(/70/.test(r.need)&&!r.buy,tag+' not enough msg '+r.need);
 await p.evaluate(()=>closeDlg());
 r=await p.evaluate(()=>document.querySelector('#pgrid .pc[data-k="ghost"] .cnt').textContent);ok(r==='× 1',tag+' count shown '+r);
 // reload persistence
 await p.reload();await p.waitForTimeout(300);r=await p.evaluate(()=>({c:coins,g:pu.ghost}));ok(r.c===280&&r.g===1,tag+' persists '+JSON.stringify(r));
 ok(errs.length===0,tag+' js errors '+errs.join('|'));
 await p.close()}
console.log('PASS',pass,'FAIL',fail);await b.close()})();
