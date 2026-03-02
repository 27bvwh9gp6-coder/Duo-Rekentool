const fields=['household','income','partnerIncome','incomeGrowth','wml','debt1','runway1','rateRunway1','rateRepay1','term1','debt2','runway2','rateRunway2','rateRepay2','term2','hypRate','extraPayoff','extraTarget','savingsAmount','savingsRate','savingsYears','savTarget','hypIncome','hypIncome2','hypSingle','hypLabel','hypOtherDebt','wmOverride1','wmOverride2'];
function loadUrl(){try{const p=new URLSearchParams(location.search);fields.forEach(f=>{const v=p.get(f);if(v!==null){const el=document.getElementById(f);if(el)el.value=v}})}catch(e){}}
function updateUrl(){const p=new URLSearchParams();fields.forEach(f=>{const el=document.getElementById(f);if(!el)return;const isSelect=el.tagName==='SELECT';p.set(f,isSelect?el.value:parseNum(el.value))});const s='?'+p;try{history.replaceState(null,'',s)}catch(e){}try{document.getElementById('shareUrl').value=location.origin+(location.pathname||'/')+s}catch(e){document.getElementById('shareUrl').value=s}}
function copyUrl(){navigator.clipboard.writeText(document.getElementById('shareUrl').value).then(()=>{const b=document.getElementById('copyBtn');b.textContent='Gekopieerd ✓';b.classList.add('copied');setTimeout(()=>{b.textContent='Kopieer link';b.classList.remove('copied')},2000)})}
function tog(id){document.getElementById(id).classList.toggle('open')}
function showTab(id,btn){btn.parentElement.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');const w=btn.parentElement.parentElement;w.querySelectorAll(':scope > .tc').forEach(t=>t.classList.remove('active'));document.getElementById(id).classList.add('active')}
let tblMode='y';
function showTbl(m,btn){tblMode=m;btn.parentElement.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');renderTable()}
const eur=v=>'€\u00a0'+Math.round(v).toLocaleString('nl-NL');
const eur2=v=>'€\u00a0'+v.toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=v=>v.toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtI=v=>v.toLocaleString('nl-NL');
const pct1=v=>(v*100).toFixed(1)+'%';
const pct0=v=>Math.round(v*100)+'%';
function pmt(r,n,pv){if(!r||r===0)return n>0?Math.abs(pv/n):0;return Math.abs((pv*r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1))}
function brut(r){if(r<=.02)return 1.07;if(r<=.025)return 1.10;if(r<=.03)return 1.13;if(r<=.035)return 1.20;if(r<=.04)return 1.25;if(r<=.045)return 1.29;if(r<=.05)return 1.33;return 1.37}

let cPay=null,cDebt=null,cRatio=null,cDonut=null,cSave=null;
let simData=[],simMeta={};

// Read numeric value from any input (handles formatted text inputs)
function rv(id){return parseNum(document.getElementById(id).value)}

function calc(){
  const hh=+document.getElementById('household').value;
  const inc=rv('income');
  const pinc=rv('partnerIncome');
  const gr=rv('incomeGrowth')/100;
  const wml=rv('wml');
  const d1=rv('debt1');
  const rw1=rv('runway1');
  const rrw1=rv('rateRunway1')/100;
  const rr1=rv('rateRepay1')/100;
  const t1=rv('term1');
  const d2=rv('debt2');
  const rw2=rv('runway2');
  const rrw2=rv('rateRunway2')/100;
  const rr2=rv('rateRepay2')/100;
  const t2=rv('term2');
  const mrate=rv('hypRate')/100;
  const extra=rv('extraPayoff');
  const sAmt=rv('savingsAmount');
  const sRate=rv('savingsRate')/100;
  const sYrs=rv('savingsYears');

  // Income growth per 5-year period (if expanded)
  const igActive=document.getElementById('igBox').style.display!=='none';
  function getGrowthForYear(yr){
    if(!igActive)return gr;
    const p=Math.min(Math.floor(yr/5),6);
    const el=document.getElementById('ig_'+p);
    return el?(+(el.value)||0)/100:gr;
  }
  // Compute income for a given year using compounding per-period growth
  function incomeAtYear(yr){
    let income=inc+pinc;
    for(let y=0;y<yr;y++){income*=(1+getGrowthForYear(y))}
    return income;
  }

  const threshold=hh===1?wml:wml*1.43;
  const cInc=inc+pinc;const hasL2=d2>0;
  const cs1raw=d1*Math.pow(1+rrw1/12,rw1);
  const cs2raw=hasL2?d2*Math.pow(1+rrw2/12,rw2):0;
  // Apply extra aflossing based on target selection
  const exTarget=(document.getElementById('extraTarget').value)||'auto';
  let extraL1=0,extraL2=0;
  if(exTarget==='l1'){extraL1=Math.min(extra,cs1raw)}
  else if(exTarget==='l2'&&hasL2){extraL2=Math.min(extra,cs2raw)}
  else if(exTarget==='split'&&hasL2){const half=extra/2;extraL1=Math.min(half,cs1raw);extraL2=Math.min(half,cs2raw)}
  else{/* auto: L1 first, remainder to L2 */ extraL1=Math.min(extra,cs1raw);extraL2=Math.min(Math.max(extra-cs1raw,0),cs2raw)}
  // If target is L2 but no L2, fall back to L1
  if(!hasL2&&extra>0&&extraL1===0){extraL1=Math.min(extra,cs1raw)}
  const cs1=cs1raw-extraL1;
  const cs2=cs2raw-extraL2;
  const totalDebt=cs1+cs2;
  const blended=totalDebt>0?(cs1*rr1+cs2*rr2)/totalDebt:rr1;
  const minRw=hasL2?Math.min(rw1,rw2):rw1;
  const l1Off=rw1-minRw,l2Off=hasL2?rw2-minRw:9999;
  const phaseDiff=hasL2?Math.abs(rw1-rw2):0;
  const aflos1=Math.max(t1-rw1,1);
  const aflos2=hasL2?Math.max(t2-rw2,1):0;
  // Wettelijk maandbedrag: altijd annuïteit over 420 mnd (volledige SF35 looptijd)
  const wmCalc1=pmt(rr1/12,420,cs1);
  const wmCalc2=(hasL2)?pmt(rr2/12,420,cs2):0;
  // Override: als gebruiker het wettelijk maandbedrag uit Mijn DUO invult
  const wmOver1=rv('wmOverride1');
  const wmOver2=rv('wmOverride2');
  const wm1=wmOver1>0?wmOver1:wmCalc1;
  const wm2=hasL2?(wmOver2>0?wmOver2:wmCalc2):0;
  const wmT=wm1+wm2;
  const dk1=Math.max(cInc-threshold,0)*0.04/12;
  const pay1=Math.min(dk1,wmT);

  // Break-even: when does draagkracht >= wettelijk?
  const breakEvenInc=wmT>0?threshold+wmT*12/0.04:0;
  let breakEvenYear=null;
  if(cInc>=breakEvenInc){breakEvenYear=1}
  else{for(let y=1;y<=35;y++){if(incomeAtYear(y)>=breakEvenInc){breakEvenYear=y+1;break}}}

  // Sim - starting debt values account for extra aflossing
  let rL1=(!hasL2||rw1<=rw2)?cs1:Math.max(d1*Math.pow(1+rrw1/12,rw2)-extraL1,0);
  let rL2=!hasL2?0:(rw2<=rw1?cs2:Math.max(d2*Math.pow(1+rrw2/12,rw1)-extraL2,0));
  const months=Math.max(t1,hasL2?t2:0);
  let cum=0,tIntL1=0,tIntL2=0,tAflL1=0,tAflL2=0;
  simData=[];const yrs=Math.ceil(months/12);
  const yPayL1=new Array(yrs).fill(0),yPayL2=new Array(yrs).fill(0);
  const yIntL1=new Array(yrs).fill(0),yIntL2=new Array(yrs).fill(0);
  const yAflL1=new Array(yrs).fill(0),yAflL2=new Array(yrs).fill(0);
  for(let m=1;m<=months;m++){
    const yi=Math.floor((m-1)/12);const yInc=incomeAtYear(yi);
    const dk=Math.max(yInc-threshold,0)*0.04/12;
    const l1A=m>l1Off,l2A=hasL2&&m>l2Off;
    if(!l1A&&rL1>0)rL1*=(1+rrw1/12);if(!l2A&&rL2>0)rL2*=(1+rrw2/12);
    let wmA=0;if(l1A)wmA+=wm1;if(l2A)wmA+=wm2;
    const pay=(l1A||l2A)?Math.min(dk,wmA>0?wmA:0):0;
    let pL1=0,pL2=0,iL1=0,iL2=0,aL1=0,aL2=0;
    if(l1A&&rL1>0){iL1=rL1*rr1/12;pL1=(l2A&&rL2>0&&wmT>0)?pay*(wm1/wmT):pay;aL1=pL1-iL1;rL1=Math.max(rL1-aL1,0);tIntL1+=iL1;tAflL1+=Math.max(aL1,0)}
    if(l2A&&rL2>0){iL2=rL2*rr2/12;pL2=pay-pL1;aL2=pL2-iL2;rL2=Math.max(rL2-aL2,0);tIntL2+=iL2;tAflL2+=Math.max(aL2,0)}
    cum+=pay;
    simData.push({m,yi,inc:yInc,dk,pay,pL1,pL2,iL1,iL2,aL1:Math.max(aL1,0),aL2:Math.max(aL2,0),rL1,rL2,cum,l1A,l2A});
    if(yi<yrs){yPayL1[yi]+=pL1;yPayL2[yi]+=pL2;yIntL1[yi]+=iL1;yIntL2[yi]+=iL2;yAflL1[yi]+=Math.max(aL1,0);yAflL2[yi]+=Math.max(aL2,0)}
  }
  const fL1=rL1,fL2=rL2,forg=fL1+fL2,tInt=tIntL1+tIntL2;
  simMeta={l1Off,l2Off,phaseDiff,hasL2,totalDebt,cs1,cs2};

  // DOM
  const surplus=Math.max(cInc-threshold,0);
  const wmSrc1=wmOver1>0?'(uit Mijn DUO)':'(berekend: annuïteit 420 mnd)';
  const wmSrc2=wmOver2>0?'(uit Mijn DUO)':'(berekend: annuïteit 420 mnd)';
  document.getElementById('calcExplain').innerHTML=
    '<strong>Zo wordt je maandbedrag berekend:</strong><br>'+
    'Inkomen '+eur(cInc)+' − Vrijstelling '+eur(threshold)+' = Surplus '+eur(surplus)+'<br>'+
    'Draagkracht: '+eur(surplus)+' × 4% ÷ 12 = <strong>'+eur2(dk1)+'</strong>/mnd<br>'+
    'Wettelijk maandbedrag: <strong>'+eur2(wmT)+'</strong>/mnd (plafond) '+wmSrc1+'<br>'+
    'Je betaalt het <strong>laagste</strong> → '+eur2(pay1)+'/mnd';

  // Insight - dynamic based on all variables
  let ins='';
  if(dk1<wmT){
    ins='<strong>Je betaalt minder dan het maximum.</strong> Je draagkracht ('+eur2(dk1)+') is lager dan het plafond ('+eur2(wmT)+'). Hierdoor los je niet alles af en blijft er schuld over die na 35 jaar wordt kwijtgescholden. ';
    if(breakEvenYear&&breakEvenYear>1&&breakEvenYear<=35){
      ins+='Bij '+pct1(gr)+' inkomensstijging bereik je het plafond rond <strong>jaar '+breakEvenYear+'</strong> (inkomen ca. '+eur(breakEvenInc)+'). Vanaf dan betaal je het vaste maximum.';
    } else if(!breakEvenYear||breakEvenYear>35){
      ins+='Met '+pct1(gr)+' stijging per jaar bereik je het plafond niet binnen 35 jaar. Je zou een inkomen van '+eur(breakEvenInc)+' nodig hebben.';
    }
  } else {
    ins='<strong>Je draagkracht overstijgt het plafond.</strong> Je betaalt het maximale bedrag van '+eur2(wmT)+'/mnd. Bij deze betaling los je je volledige schuld af binnen de looptijd — er wordt niets kwijtgescholden.';
  }
  const exTargetLabel=exTarget==='l2'?'lening 2':exTarget==='split'?'50/50 verdeeld':exTarget==='l1'?'lening 1':'lening 1 eerst';
  document.getElementById('insightBox').innerHTML=ins+(extra>0?'<br><br><strong>📌 Extra aflossing van '+eur(extra)+' verwerkt</strong> (op '+exTargetLabel+'). De schuld, het wettelijk maandbedrag, kwijtschelding en totale rente zijn berekend ná deze aflossing. Zet het bedrag op 0 in sectie 5 om het scenario zonder te zien.':'');
  document.getElementById('r-pay').textContent=eur2(pay1);
  document.getElementById('r-dk').textContent=eur2(dk1);
  document.getElementById('r-dkSub').textContent='Vrijstelling: '+eur(threshold);
  document.getElementById('r-wm').textContent=eur2(wmT);
  document.getElementById('r-wmSub').textContent=hasL2?'L1: '+eur2(wm1)+' '+wmSrc1+' + L2: '+eur2(wm2)+' '+wmSrc2:'Annuïteit over 420 mnd '+wmSrc1;
  document.getElementById('r-payW').textContent=dk1<=wmT?'Draagkracht is lager → je betaalt dit':'Plafond bereikt → je betaalt dit';
  document.getElementById('r-blended').textContent=pct1(blended);
  document.getElementById('r-blended2').textContent=pct1(blended);
  document.getElementById('r-cs1').textContent=eur(cs1);
  document.getElementById('r-cs1s').textContent=extraL1>0?'na '+eur(extraL1)+' extra aflossing · '+pct1(rr1):'waarvan '+eur(cs1raw-d1)+' rente · '+pct1(rr1);
  document.getElementById('r-cs2').textContent=hasL2?eur(cs2):'—';
  document.getElementById('r-cs2s').textContent=hasL2?(extraL2>0?'na '+eur(extraL2)+' extra aflossing · '+pct1(rr2):'waarvan '+eur(cs2raw-d2)+' rente · '+pct1(rr2)):'Geen tweede lening';
  document.getElementById('r-totP').textContent=eur(cum);
  document.getElementById('r-totI').textContent=eur(tInt);
  document.getElementById('r-intP').textContent=totalDebt>0?pct1(tInt/totalDebt)+' van schuld':'';
  document.getElementById('r-forg').textContent=eur(forg);
  document.getElementById('r-kw1').textContent=eur(fL1)+' / '+eur(tIntL1);
  document.getElementById('r-kw1s').textContent='Aflossing: '+eur(tAflL1);
  document.getElementById('r-kw2').textContent=hasL2?eur(fL2)+' / '+eur(tIntL2):'—';
  document.getElementById('r-kw2s').textContent=hasL2?'Aflossing: '+eur(tAflL2):'';
  const pi=document.getElementById('phaseInfo');
  if(hasL2&&phaseDiff>0){const f=rw1<rw2?'1':'2',s=f==='1'?'2':'1';pi.innerHTML='<strong>Faseverschil ('+phaseDiff+' mnd):</strong> Lening '+f+' komt eerder in de aflosfase. Gedurende '+phaseDiff+' maanden gaat 100% van je betaling naar Lening '+f+'. Lening '+s+' bouwt alleen rente op.';pi.style.display=''}else pi.style.display='none';

  // Donut - fixed size
  const dd=[{l:'Aflossing Lening 1',v:tAflL1,c:'#4f46e5'},{l:'Rente Lening 1',v:tIntL1,c:'#a5b4fc'},...(hasL2?[{l:'Aflossing Lening 2',v:tAflL2,c:'#d97706'},{l:'Rente Lening 2',v:tIntL2,c:'#fcd34d'}]:[]),{l:'Kwijtgescholden',v:forg,c:'#10b981'}];
  const dT=dd.reduce((s,d)=>s+d.v,0);
  document.getElementById('donutLeg').innerHTML=dd.map(d=>'<div class="dl-item"><span class="dl-dot" style="background:'+d.c+'"></span>'+d.l+'<span class="dl-val">'+eur(d.v)+' <small>'+pct0(dT>0?d.v/dT:0)+'</small></span></div>').join('');

  // Charts (only if Chart.js is loaded)
  const lb=Array.from({length:yrs},(_,i)=>''+(i+1));
  const dL1=[],dL2=[];for(let y=0;y<yrs;y++){const i=Math.min(y*12+11,simData.length-1);dL1.push(simData[i]?.rL1||0);dL2.push(simData[i]?.rL2||0)}
  const rP1=[],rP2=[],aP1=[],aP2=[];
  for(let y=0;y<yrs;y++){const t=yPayL1[y]+yPayL2[y];if(t>0){rP1.push(+(yIntL1[y]/t*100).toFixed(1));aP1.push(+(yAflL1[y]/t*100).toFixed(1));rP2.push(+(yIntL2[y]/t*100).toFixed(1));aP2.push(+(yAflL2[y]/t*100).toFixed(1))}else{rP1.push(0);aP1.push(0);rP2.push(0);aP2.push(0)}}

  if(typeof Chart!=='undefined'){
    const dk=document.documentElement.classList.contains('dark');
    const gridC=dk?'#333':'#f0f0f0';
    const tickC=dk?'#ccc':'#666';
    const legendC=dk?'#ddd':'#333';

    if(cDonut)cDonut.destroy();
    cDonut=new Chart(document.getElementById('cDonut'),{type:'doughnut',data:{labels:dd.map(d=>d.l),datasets:[{data:dd.map(d=>d.v),backgroundColor:dd.map(d=>d.c),borderWidth:2,borderColor:dk?'#1a1a1a':'#fff',hoverOffset:4}]},options:{responsive:false,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.label+': '+eur(c.parsed)+' ('+pct0(c.parsed/dT)+')'}}}}});

    if(cPay)cPay.destroy();
    cPay=new Chart(document.getElementById('cPay'),{type:'bar',data:{labels:lb,datasets:[{label:'Lening 1',data:yPayL1.map(v=>+(v/12).toFixed(2)),backgroundColor:dk?'rgba(129,140,248,.6)':'rgba(79,70,229,.28)',borderColor:dk?'#818cf8':'#4f46e5',borderWidth:1,borderRadius:2},...(hasL2?[{label:'Lening 2',data:yPayL2.map(v=>+(v/12).toFixed(2)),backgroundColor:dk?'rgba(251,191,36,.5)':'rgba(217,119,6,.28)',borderColor:dk?'#fbbf24':'#d97706',borderWidth:1,borderRadius:2}]:[])]},options:mkB(hasL2,true,dk)});

    if(cDebt)cDebt.destroy();
    cDebt=new Chart(document.getElementById('cDebt'),{type:'line',data:{labels:lb,datasets:[{label:'Lening 1',data:dL1,borderColor:dk?'#818cf8':'#4f46e5',backgroundColor:dk?'rgba(129,140,248,.15)':'rgba(79,70,229,.05)',fill:true,tension:.3,pointRadius:0,borderWidth:2},...(hasL2?[{label:'Lening 2',data:dL2,borderColor:dk?'#fbbf24':'#d97706',backgroundColor:dk?'rgba(251,191,36,.15)':'rgba(217,119,6,.05)',fill:true,tension:.3,pointRadius:0,borderWidth:2}]:[])]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:hasL2,position:'top',labels:{boxWidth:12,color:legendC,font:{size:11,family:'DM Sans'}}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+eur(c.parsed.y)}}},scales:{x:{title:{display:true,text:'Jaar',color:tickC,font:{size:11,family:'DM Sans'}},grid:{display:false},ticks:{color:tickC,font:{size:9,family:'DM Sans'},maxRotation:0,autoSkip:true,maxTicksLimit:12}},y:{grid:{color:gridC},ticks:{color:tickC,font:{size:10,family:'DM Sans'},callback:v=>'€'+Math.round(v/1000)+'k'},beginAtZero:true}}}});

    if(cRatio)cRatio.destroy();
    cRatio=new Chart(document.getElementById('cRatio'),{type:'bar',data:{labels:lb,datasets:[{label:'Afl. Lening 1',data:aP1,backgroundColor:dk?'#818cf8':'#4f46e5',borderRadius:1},{label:'Rente Lening 1',data:rP1,backgroundColor:dk?'#c7d2fe':'#a5b4fc',borderRadius:1},...(hasL2?[{label:'Afl. Lening 2',data:aP2,backgroundColor:dk?'#fbbf24':'#d97706',borderRadius:1},{label:'Rente Lening 2',data:rP2,backgroundColor:dk?'#fde68a':'#fcd34d',borderRadius:1}]:[])]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:10,color:legendC,font:{size:10,family:'DM Sans'}}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+c.parsed.y+'%'}}},scales:{x:{stacked:true,title:{display:true,text:'Jaar',color:tickC,font:{size:11,family:'DM Sans'}},grid:{display:false},ticks:{color:tickC,font:{size:9,family:'DM Sans'},maxRotation:0,autoSkip:true,maxTicksLimit:12}},y:{stacked:true,max:100,grid:{color:gridC},ticks:{color:tickC,font:{size:10,family:'DM Sans'},callback:v=>v+'%'}}}}});
  }

  // Hypotheek (gebruteerd maandbedrag - used by calcHyp and extra aflossing)
  const bf=brut(mrate),gM=wmT*bf,mL=mrate>0?gM*12/mrate:0;
  document.getElementById('r-gM').textContent=eur2(gM);
  document.getElementById('r-bfSub').textContent=eur2(wmT)+' × '+bf.toFixed(2)+' (Trhk 2025)';
  const exBl=document.getElementById('exBl');
  if(extra>0){exBl.style.display='';
    // cs1/cs2 already have extra subtracted. WM with extra is wmT (already computed).
    // WM without extra (raw debt):
    const wmRaw1=pmt(rr1/12,420,cs1raw);
    const wmRaw2=(hasL2)?pmt(rr2/12,420,cs2raw):0;
    const wmRawT=wmRaw1+wmRaw2;
    const gMRaw=wmRawT*bf;
    const mLRaw=mrate>0?gMRaw*12/mrate:0;
    const extraRoom=mLRaw-mL;
    document.getElementById('r-exR').textContent=eur(extraRoom);
    document.getElementById('r-rE').textContent=extra>0?(extraRoom/extra).toFixed(2)+'×':'—';
    document.getElementById('r-wmB').textContent=eur2(wmRawT);
    document.getElementById('r-wmA').textContent=eur2(wmT);
    document.getElementById('r-wmS').textContent='Besparing: '+eur2(wmRawT-wmT)+'/mnd';
    // DUO rente besparing: what would you pay in total rente on 'extra' amount?
    const duoRestMnd=Math.max(t1-rw1, 1);
    const duoRenteExact=blended>0?pmt(blended/12,duoRestMnd,extra)*duoRestMnd-extra:0;
    const hypotheekJaren=30;
    const renteBesparingEigenInleg=extra*mrate*hypotheekJaren*0.5;
    const eigenInlegEl=document.getElementById('eigenInlegInfo');
    eigenInlegEl.innerHTML='<strong>Vergelijking: DUO aflossen vs. eigen inleg bij hypotheek</strong><br>'+
      '• DUO aflossen: je krijgt <strong>'+eur(extraRoom)+'</strong> extra hypotheekruimte ('+((extraRoom/extra).toFixed(2))+'× je inleg) en je bespaart ca. <strong>'+eur(duoRenteExact)+'</strong> aan DUO-rente over de resterende looptijd ('+Math.round(duoRestMnd/12)+' jaar, '+pct1(blended)+')<br>'+
      '• Eigen inleg hypotheek: je hypotheek daalt met <strong>'+eur(extra)+'</strong> (1×) en je bespaart ca. '+eur(renteBesparingEigenInleg)+' aan hypotheekrente over '+hypotheekJaren+' jaar ('+pct1(mrate)+')<br>'+
      (extraRoom>extra?'→ <strong>DUO aflossen levert meer hypotheekruimte op</strong> dan eigen inleg ('+((extraRoom/extra).toFixed(2))+'× vs. 1×).':'→ <strong>Eigen inleg geeft meer directe verlaging.</strong>')+
      ' Vergelijk ook de rentebesparing: '+eur(duoRenteExact)+' (DUO) vs. '+eur(renteBesparingEigenInleg)+' (hypotheek).'+
      '<br><small style="color:var(--muted)">💡 De extra aflossing is ook verwerkt in de simulatie hierboven (sectie 3) — de schuld, kwijtschelding en totale rente zijn inclusief deze aflossing.</small>';
  } else exBl.style.display='none';

  // Sparen/beleggen
  const savTgt=(document.getElementById('savTarget').value)||'blended';
  const aflRate=savTgt==='l1'?rr1:savTgt==='l2'&&hasL2?rr2:blended;
  const aflRateLabel=savTgt==='l1'?'L1: '+pct1(rr1):savTgt==='l2'&&hasL2?'L2: '+pct1(rr2):'Gewogen: '+pct1(blended);
  document.getElementById('r-blended2').textContent=aflRateLabel;
  document.getElementById('r-savRateDisp').textContent=pct1(sRate);
  // Aflossen: elke €100 extra aflossing bespaart samengestelde rente
  const sP=aflRate>0?sAmt*((Math.pow(1+aflRate/12,sYrs*12)-1)/(aflRate/12))-sAmt*sYrs*12:0;
  // Beleggen: samengestelde rente op maandelijkse inleg
  const sR=sRate>0?sAmt*((Math.pow(1+sRate/12,sYrs*12)-1)/(sRate/12))-sAmt*sYrs*12:0;
  document.getElementById('r-sP').textContent=eur(sP);
  document.getElementById('r-sR').textContent=eur(sR);
  const aEl=document.getElementById('r-aV'),aCd=document.getElementById('r-aC');
  if(sR>sP){aEl.textContent='→ Sparen/beleggen levert meer op (verschil: '+eur(sR-sP)+' over '+sYrs+' jaar)';aEl.style.color='var(--green)';aCd.style.background='var(--green-light)'}
  else{aEl.textContent='→ Extra aflossen is voordeliger (verschil: '+eur(sP-sR)+' over '+sYrs+' jaar)';aEl.style.color='var(--accent)';aCd.style.background='var(--accent-light)'}

  // Savings chart: cumulative growth of both options over time
  if(typeof Chart!=='undefined'){
    const savYrs=Math.min(sYrs,35);
    const savLabels=Array.from({length:savYrs},(_,i)=>''+(i+1));
    const savAflData=[],savBelData=[];
    for(let y=1;y<=savYrs;y++){
      const sPy=aflRate>0?sAmt*((Math.pow(1+aflRate/12,y*12)-1)/(aflRate/12))-sAmt*y*12:0;
      savAflData.push(+sPy.toFixed(0));
      const totInleg=sAmt*y*12;
      const totVal=sRate>0?sAmt*((Math.pow(1+sRate/12,y*12)-1)/(sRate/12)):totInleg;
      savBelData.push(+(totVal-totInleg).toFixed(0));
    }
    if(cSave)cSave.destroy();
    const dkS=document.documentElement.classList.contains('dark');
    const gridCS=dkS?'#333':'#f0f0f0',tickCS=dkS?'#ccc':'#666',legendCS=dkS?'#ddd':'#333';
    cSave=new Chart(document.getElementById('cSave'),{type:'line',data:{labels:savLabels,datasets:[
      {label:'Bespaard door aflossen',data:savAflData,borderColor:dkS?'#818cf8':'#4f46e5',backgroundColor:dkS?'rgba(129,140,248,.15)':'rgba(79,70,229,.08)',fill:true,tension:.3,pointRadius:0,borderWidth:2},
      {label:'Rendement beleggen',data:savBelData,borderColor:dkS?'#34d399':'#10b981',backgroundColor:dkS?'rgba(52,211,153,.15)':'rgba(16,185,129,.08)',fill:true,tension:.3,pointRadius:0,borderWidth:2}
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:12,color:legendCS,font:{size:11,family:'DM Sans'}}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+eur(c.parsed.y)}}},scales:{x:{title:{display:true,text:'Jaar',color:tickCS,font:{size:11,family:'DM Sans'}},grid:{display:false},ticks:{color:tickCS,font:{size:9,family:'DM Sans'},maxRotation:0}},y:{grid:{color:gridCS},ticks:{color:tickCS,font:{size:10,family:'DM Sans'},callback:v=>'€'+Math.round(v/1000)+'k'},beginAtZero:true}}}});
  }

  renderTable();updateUrl();calcHyp();
}

// === HYPOTHEEKCALCULATOR ===
// Simplified NIBUD 2026 financieringslastpercentage approximation
// Based on the official NIBUD table for non-AOW, standard energy label (E/F/G)
// Toetsrente 5% column (most common)
function getNibud2026FL(income,toetsRentePct){
  // Approximate NIBUD 2026 financieringslastpercentages for non-AOW
  // Standard table (energielabel E/F/G), toetsrente 5%
  // Source: NIBUD Advies hypotheeknormen 2026, afgerond op 0.1%
  const tbl=[
    [28000,20.5],[30000,22.5],[32000,24.0],[34000,25.0],[36000,25.5],
    [38000,26.5],[40000,27.0],[42000,27.5],[44000,28.0],[46000,28.0],
    [48000,28.5],[50000,29.0],[52000,29.5],[54000,29.5],[56000,30.0],
    [58000,30.0],[60000,30.5],[62000,30.5],[64000,31.0],[66000,31.0],
    [68000,31.5],[70000,31.5],[75000,32.0],[80000,32.5],[85000,33.0],
    [90000,33.5],[95000,33.5],[100000,34.0],[110000,34.5],[120000,35.0],
    [150000,35.5],[200000,36.0]
  ];
  // Small adjustment for different toetsrente columns
  const renteAdj=(toetsRentePct-5)*0.2;
  if(income<28000)return Math.max(18+renteAdj,10);
  for(let i=tbl.length-1;i>=0;i--){
    if(income>=tbl[i][0])return Math.min(tbl[i][1]+renteAdj,40);
  }
  return 20+renteAdj;
}

function calcHyp(){
  const inc1=rv('hypIncome');
  const inc2=rv('hypIncome2');
  const hypR=rv('hypRate')/100;
  // Use the entered rate directly as toetsrente for full user control
  const effectiveRate=hypR;
  const single=+(document.getElementById('hypSingle').value)||0;
  const labelExtra=+(document.getElementById('hypLabel').value)||0;
  const otherDebt=rv('hypOtherDebt');
  const totalInc=inc1+inc2;

  const elMax=document.getElementById('r-hypMax');
  const elSub=document.getElementById('r-hypSub');
  const elMonth=document.getElementById('r-hypMonth');
  const elMonthSub=document.getElementById('r-hypMonthSub');
  const elLTI=document.getElementById('r-hypLTI');
  const elDuo=document.getElementById('r-hypDuo');
  const elDuoSub=document.getElementById('r-hypDuoSub');
  const elFL=document.getElementById('r-hypFL');

  if(totalInc<1){
    elMax.textContent='—';elSub.textContent='Vul je inkomen in';
    elMonth.textContent='—';elMonthSub.textContent='';
    elLTI.textContent='—';elDuo.textContent='—';elDuoSub.textContent='';
    elFL.textContent='—';return;
  }

  // Effective toetsrente = entered rate
  const effectiveRatePct=effectiveRate*100;

  // NIBUD financieringslastpercentage
  const flPct=getNibud2026FL(totalInc,effectiveRatePct);
  elFL.textContent=flPct.toFixed(1)+'%';

  // Max bruto jaarlast = inkomen × FL%
  const maxBrutoJaar=totalInc*(flPct/100);

  // Annuity factor at TOETSRENTE (not actual rate) for LTI calculation
  const mrToets=effectiveRate/12;
  const n=360; // 30 years
  const annFactorToets=mrToets>0?(1-Math.pow(1+mrToets,-n))/mrToets:n;

  // DUO impact: gebruteerd maandbedrag
  const wmT_el=document.getElementById('r-wm');
  const wmT_val=wmT_el?parseFloat(wmT_el.textContent.replace(/[^0-9,.]/g,'').replace(',','.'))||0:0;
  const bf_val=brut(hypR);
  const gM_val=wmT_val*bf_val;
  const duoJaar=gM_val*12;

  // Other debts (annualized)
  const otherDebtYear=otherDebt*12;

  // Max hypotheek on income (before DUO deduction)
  const beschikbaarVoor=Math.max(maxBrutoJaar-otherDebtYear,0);
  const maxHypVoor=beschikbaarVoor/12*annFactorToets;

  // Available after DUO
  const beschikbaar=Math.max(maxBrutoJaar-otherDebtYear-duoJaar,0);
  const maxHyp=beschikbaar/12*annFactorToets;

  // Add bonuses
  const singleBonus=single?17000:0;
  const totalMax=Math.max(maxHyp+singleBonus+labelExtra,0);
  const totalMaxVoor=Math.max(maxHypVoor+singleBonus+labelExtra,0);

  // Verlaging door DUO
  const duoVerlaging=totalMaxVoor-totalMax;

  // Maandlast at ACTUAL rate (what you'd really pay)
  const mrActual=hypR/12;
  const maandlast=totalMax>0&&mrActual>0?totalMax*mrActual/(1-Math.pow(1+mrActual,-n)):totalMax>0?totalMax/n:0;

  // Display
  elMax.textContent=eur(totalMax);
  elSub.textContent='Op basis van '+eur(totalInc)+' bruto jaarinkomen';
  elMonth.textContent=eur2(maandlast);
  elMonthSub.textContent='Annuïteit 30 jr bij '+((hypR*100).toFixed(1))+'% rente';
  elLTI.textContent=eur(totalMaxVoor);
  elDuo.textContent='− '+eur(duoVerlaging);
  elDuoSub.textContent=wmT_val>0?'Gebruteerd: '+eur2(gM_val)+'/mnd × 12 = '+eur(duoJaar)+'/jr':'Geen studieschuld opgegeven';
}

function mkB(l,s,dk){const gridC=dk?'#333':'#f0f0f0',tickC=dk?'#ccc':'#666',legendC=dk?'#ddd':'#333';return{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:l,position:'top',labels:{boxWidth:12,color:legendC,font:{size:11,family:'DM Sans'}}},tooltip:{callbacks:{label:c=>c.dataset.label+': '+eur2(c.parsed.y)+'/mnd'}}},scales:{x:{stacked:s,title:{display:true,text:'Jaar',color:tickC,font:{size:11,family:'DM Sans'}},grid:{display:false},ticks:{color:tickC,font:{size:9,family:'DM Sans'},maxRotation:0,autoSkip:true,maxTicksLimit:12}},y:{stacked:s,grid:{color:gridC},ticks:{color:tickC,font:{size:10,family:'DM Sans'},callback:v=>'€'+v},beginAtZero:true}}}}

function renderTable(){
  const w=document.getElementById('tblWrap');if(!simData.length){w.innerHTML='';return}
  const h2=simMeta.hasL2,td=simMeta.totalDebt;let h='<table class="tbl"><thead><tr>';
  if(tblMode==='y'){
    h+='<th>Jaar</th>';
    h+='<th title="Totaalbedrag betaald in dit jaar (12 maanden)">Betaald</th>';
    h+='<th title="Rentekosten dit jaar over alle leningen">Rente</th>';
    h+='<th title="Daadwerkelijke schuldverlaging (betaling minus rente)">Aflossing</th>';
    if(h2){h+='<th title="Percentage van je totale betaling dit jaar dat naar Lening 1 gaat" class="c1">% → L1</th>';
    h+='<th title="Percentage van je totale betaling dit jaar dat naar Lening 2 gaat" class="c2">% → L2</th>'}
    h+='<th title="Restschuld Lening 1 einde jaar" class="c1">Rest Len.1</th>';
    if(h2)h+='<th title="Restschuld Lening 2 einde jaar" class="c2">Rest Len.2</th>';
    h+='<th title="Totale restschuld einde jaar">Totaal rest</th>';
    h+='<th title="Percentage van oorspronkelijke schuld afgelost">Voortgang</th>';
    h+='</tr></thead><tbody>';
    const yrs=Math.ceil(simData.length/12);
    for(let y=0;y<yrs;y++){
      const s=y*12,e=Math.min(s+12,simData.length),last=simData[e-1];
      let sp=0,si1=0,si2=0,sa1=0,sa2=0,spL1=0,spL2=0;
      for(let i=s;i<e;i++){sp+=simData[i].pay;si1+=simData[i].iL1;si2+=simData[i].iL2;sa1+=simData[i].aL1;sa2+=simData[i].aL2;spL1+=simData[i].pL1;spL2+=simData[i].pL2}
      const rest=last.rL1+last.rL2,pp=td>0?Math.min(1-rest/td,1):1;
      h+='<tr><td>'+(y+1)+'</td>';
      h+='<td><strong>'+fmtI(Math.round(sp))+'</strong></td>';
      h+='<td class="cr">'+fmtI(Math.round(si1+si2))+'</td>';
      h+='<td class="cg">'+fmtI(Math.round(sa1+sa2))+'</td>';
      if(h2){h+='<td class="c1">'+pct0(sp>0?spL1/sp:0)+'</td><td class="c2">'+pct0(sp>0?spL2/sp:0)+'</td>'}
      h+='<td class="c1">'+fmtI(Math.round(last.rL1))+'</td>';
      if(h2)h+='<td class="c2">'+fmtI(Math.round(last.rL2))+'</td>';
      h+='<td>'+fmtI(Math.round(rest))+' <span class="pbar"><span class="pf" style="width:'+Math.round(pp*100)+'%"></span></span></td>';
      h+='<td>'+pct0(pp)+'</td></tr>';
    }
  } else {
    h+='<th>Mnd</th>';
    h+='<th title="Maandelijks betaald bedrag (minimum van draagkracht en wettelijk maandbedrag)">Betaling</th>';
    h+='<th title="Rentekosten deze maand op Lening 1" class="c1">L1 rente</th>';
    h+='<th title="Aflossing op Lening 1 (betaling minus rente)" class="c1">L1 afl.</th>';
    h+='<th title="Restschuld Lening 1 na deze maand" class="c1">L1 rest</th>';
    if(h2){h+='<th title="Rentekosten op Lening 2" class="c2">L2 rente</th>';
    h+='<th title="Aflossing op Lening 2" class="c2">L2 afl.</th>';
    h+='<th title="Restschuld Lening 2" class="c2">L2 rest</th>'}
    h+='<th title="Totaal betaald sinds start aflossing">Cumulatief</th>';
    h+='</tr></thead><tbody>';
    const show=new Set();for(let i=0;i<Math.min(24,simData.length);i++)show.add(i);
    for(let i=24;i<Math.min(60,simData.length);i+=6)show.add(i);
    for(let i=60;i<simData.length;i+=12)show.add(i);show.add(simData.length-1);
    for(const i of [...show].sort((a,b)=>a-b)){
      const r=simData[i];const bg=r.l1A&&!r.l2A&&h2?' style="background:rgba(79,70,229,.03)"':'';
      h+='<tr'+bg+'><td>'+r.m+'</td><td><strong>'+fmt(+r.pay.toFixed(2))+'</strong></td>';
      h+='<td>'+fmt(+r.iL1.toFixed(2))+'</td><td>'+fmt(+r.aL1.toFixed(2))+'</td><td>'+fmtI(Math.round(r.rL1))+'</td>';
      if(h2)h+='<td>'+fmt(+r.iL2.toFixed(2))+'</td><td>'+fmt(+r.aL2.toFixed(2))+'</td><td>'+fmtI(Math.round(r.rL2))+'</td>';
      h+='<td>'+fmtI(Math.round(r.cum))+'</td></tr>';
    }
  }
  h+='</tbody></table>';w.innerHTML=h;
  const n=document.getElementById('tblNote');
  if(simMeta.hasL2&&simMeta.phaseDiff>0){n.textContent='Lening '+(simMeta.l1Off===0?'1':'2')+' start '+simMeta.phaseDiff+' maanden eerder.'}else n.textContent='';
}

// === TOOLTIP SYSTEM ===
let activeTip=null,hideTimer=null;
function positionTT(tip){
  const tt=tip.querySelector('.tt');if(!tt)return;
  const r=tip.getBoundingClientRect();
  let l=r.left+r.width/2-140;
  if(l<8)l=8;if(l+280>window.innerWidth-8)l=window.innerWidth-288;
  tt.style.left=l+'px';
  if(r.top>180){tt.style.top=(r.top-4)+'px';tt.style.transform='translateY(-100%)'}
  else{tt.style.top=(r.bottom+4)+'px';tt.style.transform='none'}
}
function showTip(tip){
  if(hideTimer){clearTimeout(hideTimer);hideTimer=null}
  if(activeTip&&activeTip!==tip)hideTipNow(activeTip);
  const tt=tip.querySelector('.tt');if(!tt)return;
  positionTT(tip);tip.classList.add('active');tt.classList.add('show');activeTip=tip;
}
function hideTipNow(tip){
  const tt=tip.querySelector('.tt');if(tt)tt.classList.remove('show');
  tip.classList.remove('active');if(activeTip===tip)activeTip=null;
}
function hideTipDelayed(tip){
  if(hideTimer)clearTimeout(hideTimer);
  hideTimer=setTimeout(()=>{hideTipNow(tip);hideTimer=null},280);
}
function cancelHide(){if(hideTimer){clearTimeout(hideTimer);hideTimer=null}}
document.addEventListener('mouseover',function(e){
  if(!e.target||!e.target.closest)return;
  const tip=e.target.closest('.tip');
  const tt=e.target.closest('.tt');
  if(tip){showTip(tip)}
  else if(tt){cancelHide()}
});
document.addEventListener('mouseout',function(e){
  if(!e.target||!e.target.closest)return;
  const tip=e.target.closest('.tip');
  const tt=e.target.closest('.tt');
  if(tip&&!tip.contains(e.relatedTarget)){hideTipDelayed(tip)}
  else if(tt){const p=tt.closest('.tip');if(p&&!p.contains(e.relatedTarget))hideTipDelayed(p)}
});
document.addEventListener('click',function(e){
  if(!e.target||!e.target.closest)return;
  if(activeTip&&!e.target.closest('.tip'))hideTipNow(activeTip);
});

// === INCOME GROWTH PERIODES (5-jaar) ===
function initIncomeGrowth(){
  const baseGr=rv('incomeGrowth')||5;
  const grid=document.getElementById('igGrid');
  let html='';
  for(let p=0;p<7;p++){
    const yr1=p*5+1,yr2=Math.min((p+1)*5,35);
    html+='<div class="rp-cell"><div class="rp-yr">Jr '+yr1+'-'+yr2+'</div><input type="number" step="0.5" value="'+baseGr.toFixed(1)+'" id="ig_'+p+'" oninput="calc()"></div>';
  }
  grid.innerHTML=html;
}

// === RENTE PERIODES (5-jaar) ===
function initRentePeriodes(){
  const r1=rv('rateRepay1');
  const r2=rv('rateRepay2');
  for(let g=1;g<=2;g++){
    const grid=document.getElementById('rpGrid'+g);
    const baseRate=g===1?r1:r2;
    let html='';
    for(let p=0;p<7;p++){
      const yr1=p*5+1,yr2=Math.min((p+1)*5,35);
      html+='<div class="rp-cell"><div class="rp-yr">Jr '+yr1+'-'+yr2+'</div><input type="number" step="0.01" value="'+baseRate.toFixed(2)+'" id="rp'+g+'_'+p+'" oninput="calc()"></div>';
    }
    grid.innerHTML=html;
  }
}
function getRentePeriodes(lening){
  const box=document.getElementById('rpBox');
  if(box.style.display==='none'){return null} // not active
  const rates=[];
  for(let p=0;p<7;p++){
    const el=document.getElementById('rp'+lening+'_'+p);
    rates.push(el?(+(el.value)||0)/100:0);
  }
  return rates;
}

// === PDF EXPORT ===
function exportPDF(){
  const btn=document.querySelector('.pdf-btn');
  btn.textContent='Rapport genereren...';btn.disabled=true;
  if(window.jspdf){buildPDF(btn)}
  else{
    // Fallback: try loading again, then fall back to print
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
    s.onload=()=>buildPDF(btn);
    s.onerror=()=>{
      // Last resort: browser print dialog
      document.querySelectorAll('.sec').forEach(s2=>s2.classList.add('open'));
      setTimeout(()=>{window.print();resetPDFBtn(btn)},200);
    };
    document.head.appendChild(s);
  }
}
function resetPDFBtn(btn){
  btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Rapport opslaan als PDF';btn.disabled=false;
}
function buildPDF(btn){
  try{
  const{jsPDF}=window.jspdf;
  const doc=new jsPDF({unit:'mm',format:'a4'});
  const W=210,M=18,CW=W-2*M;
  let y=18;
  const g=id=>(document.getElementById(id)||{}).textContent||'—';
  const c=(r,g2,b)=>doc.setTextColor(r,g2,b);
  const gray=()=>c(100,100,100);
  const dark=()=>c(30,30,30);
  const accent=()=>c(29,78,216);

  // Helper: add page if needed
  const checkPage=(need)=>{if(y+need>280){doc.addPage();y=18;return true}return false};

  // Header
  accent();doc.setFontSize(20);doc.setFont('helvetica','bold');
  doc.text('DUO Rekentool — SF35 Rapport',M,y);
  y+=7;gray();doc.setFontSize(8);doc.setFont('helvetica','normal');
  doc.text('Gegenereerd op '+new Date().toLocaleDateString('nl-NL',{day:'numeric',month:'long',year:'numeric'})+' · Indicatieve berekening, geen financieel advies',M,y);
  y+=6;doc.setDrawColor(200);doc.line(M,y,W-M,y);y+=8;

  // Section helper
  const section=(title)=>{checkPage(16);dark();doc.setFontSize(12);doc.setFont('helvetica','bold');doc.text(title,M,y);y+=6};
  const row=(label,val,indent)=>{
    checkPage(6);
    const x=M+(indent||0);
    gray();doc.setFontSize(8.5);doc.setFont('helvetica','normal');doc.text(label,x,y);
    dark();doc.setFont('helvetica','bold');doc.text(val+'',W-M,y,{align:'right'});
    y+=5;
  };
  const note=(text)=>{checkPage(8);gray();doc.setFontSize(7.5);doc.setFont('helvetica','italic');const lines=doc.splitTextToSize(text,CW);doc.text(lines,M,y);y+=lines.length*3.5+2};

  // 1. Invoergegevens
  section('1. Jouw situatie');
  const hhTxt=document.getElementById('household').options[document.getElementById('household').selectedIndex].text;
  row('Huishoudsituatie',hhTxt);
  row('Verzamelinkomen',g('income')+' €/jr');
  row('Inkomen partner',g('partnerIncome')+' €/jr');
  row('Inkomensstijging',g('incomeGrowth')+'% per jaar');
  row('Wettelijk minimumloon (WML)',g('wml')+' €/jr');
  y+=3;

  // 2. Leningen
  section('2. Leningen');
  row('Lening 1 — schuld',g('debt1')+' €',2);
  row('Lening 1 — aanloopfase',g('runway1')+' mnd',2);
  row('Lening 1 — rente aflosfase',g('rateRepay1')+'%',2);
  const d2=rv('debt2');
  if(d2>0){
    row('Lening 2 — schuld',g('debt2')+' €',2);
    row('Lening 2 — aanloopfase',g('runway2')+' mnd',2);
    row('Lening 2 — rente aflosfase',g('rateRepay2')+'%',2);
  }
  y+=3;

  // 3. Resultaat
  section('3. Resultaat');
  // Explanation
  const expl=document.getElementById('calcExplain');
  if(expl){note(expl.textContent.replace(/\s+/g,' ').trim())}
  y+=1;
  row('Maandbedrag (jaar 1)',g('r-pay'));
  row('Draagkracht',g('r-dk'));
  row('Wettelijk maandbedrag (plafond)',g('r-wm'));
  row('Gewogen rente',g('r-blended'));
  y+=2;
  row('Lening 1 bij start aflosfase',g('r-cs1'));
  if(d2>0)row('Lening 2 bij start aflosfase',g('r-cs2'));
  y+=2;

  // Insight
  const ins=document.getElementById('insightBox');
  if(ins&&ins.textContent.trim()){
    checkPage(14);
    doc.setFillColor(254,252,232);doc.roundedRect(M,y-2,CW,12,2,2,'F');
    dark();doc.setFontSize(7.5);doc.setFont('helvetica','normal');
    const iLines=doc.splitTextToSize(ins.textContent.replace(/\s+/g,' ').trim(),CW-6);
    doc.text(iLines,M+3,y+2);y+=Math.max(12,iLines.length*3.5)+4;
  }

  row('Totaal betaald (35 jr)',g('r-totP'));
  row('Totaal rente',g('r-totI'));
  row('Kwijtgescholden',g('r-forg'));
  if(d2>0){
    y+=1;
    row('Lening 1: kwijtschelding / rente',g('r-kw1'),2);
    row('Lening 2: kwijtschelding / rente',g('r-kw2'),2);
  }
  y+=3;

  // 4. Aflossingstabel (eerste 10 jaar)
  section('4. Aflossingstabel (eerste 10 jaar)');
  if(simData.length>0){
    checkPage(50);
    const cols=d2>0?['Jaar','Betaald','Rente','Aflossing','Rest L1','Rest L2','Totaal','%']:['Jaar','Betaald','Rente','Aflossing','Restschuld','%'];
    const colW=d2>0?[12,22,20,22,22,22,24,14]:[14,28,26,28,40,18];
    // Header
    doc.setFillColor(42,42,42);doc.rect(M,y-3.5,CW,5,'F');
    doc.setTextColor(200,200,200);doc.setFontSize(6.5);doc.setFont('helvetica','bold');
    let cx=M+1;for(let i=0;i<cols.length;i++){doc.text(cols[i],cx,y);cx+=colW[i]}
    y+=3;dark();doc.setFont('helvetica','normal');doc.setFontSize(7);
    const td2=simMeta.totalDebt;
    for(let yr=0;yr<Math.min(10,Math.ceil(simData.length/12));yr++){
      if(y>274){doc.addPage();y=18}
      const s2=yr*12,e2=Math.min(s2+12,simData.length),last=simData[e2-1];
      let sp2=0,si2a=0,si2b=0,sa2a=0,sa2b=0;
      for(let i=s2;i<e2;i++){sp2+=simData[i].pay;si2a+=simData[i].iL1;si2b+=simData[i].iL2;sa2a+=simData[i].aL1;sa2b+=simData[i].aL2}
      const rest=last.rL1+last.rL2,pp=td2>0?Math.min(1-rest/td2,1):1;
      if(yr%2===0){doc.setFillColor(248,248,248);doc.rect(M,y-3,CW,4.5,'F')}
      cx=M+1;dark();
      const vals=d2>0?[''+(yr+1),Math.round(sp2).toLocaleString('nl-NL'),Math.round(si2a+si2b).toLocaleString('nl-NL'),Math.round(sa2a+sa2b).toLocaleString('nl-NL'),Math.round(last.rL1).toLocaleString('nl-NL'),Math.round(last.rL2).toLocaleString('nl-NL'),Math.round(rest).toLocaleString('nl-NL'),Math.round(pp*100)+'%']:
      [''+(yr+1),Math.round(sp2).toLocaleString('nl-NL'),Math.round(si2a+si2b).toLocaleString('nl-NL'),Math.round(sa2a+sa2b).toLocaleString('nl-NL'),Math.round(rest).toLocaleString('nl-NL'),Math.round(pp*100)+'%'];
      for(let i=0;i<vals.length;i++){doc.text(vals[i],cx,y);cx+=colW[i]}
      y+=4.5;
    }
    note('Volledige tabel (35 jaar) beschikbaar in de online tool.');
  }
  y+=3;

  // 5. Hypotheekcalculator
  section('5. Hypotheekcalculator');
  const hypInc1=rv('hypIncome');
  const hypInc2=rv('hypIncome2');
  if(hypInc1>0||hypInc2>0){
    row('Bruto jaarinkomen',eur(hypInc1+(hypInc2||0)));
    row('Hypotheekrente',g('hypRate')+'%');
    row('Financieringslastpercentage',g('r-hypFL'));
    row('Maximale hypotheek (indicatie)',g('r-hypMax'));
    row('Indicatieve bruto maandlast',g('r-hypMonth'));
    row('Max. hypotheek vóór studieschuld',g('r-hypLTI'));
    row('Verlaging door studieschuld',g('r-hypDuo'));
  }
  row('Gebruteerd DUO-maandbedrag',g('r-gM'));
  const ex=rv('extraPayoff');
  if(ex>0){
    y+=1;
    row('Extra aflossing',ex.toLocaleString('nl-NL')+' €');
    row('Extra hypotheekruimte',g('r-exR'));
  }
  y+=3;

  // 6. Sparen/beleggen
  section('6. Extra aflossen vs. sparen/beleggen');
  row('Maandelijks bedrag',g('savingsAmount')+' €/mnd');
  row('Verwacht rendement',g('savingsRate')+'%');
  row('Vergelijkingsperiode',g('savingsYears')+' jaar');
  row('Bespaard door aflossen',g('r-sP'));
  row('Opbrengst sparen/beleggen',g('r-sR'));
  const concl=g('r-aV');
  if(concl&&concl!=='—')note(concl);

  // Footer
  y+=6;checkPage(12);
  doc.setDrawColor(200);doc.line(M,y,W-M,y);y+=4;
  gray();doc.setFontSize(7);doc.setFont('helvetica','normal');
  doc.text('DUO Rekentool — duo-rekentool.nl — Indicatieve berekening o.b.v. SF35-regels (2026). Geen financieel advies.',M,y);
  y+=3.5;doc.text('Bronnen: duo.nl · nibud.nl · belastingdienst.nl · hypotheker.nl',M,y);

  doc.save('DUO-Rekentool-Rapport.pdf');
  }catch(e){console.error('PDF error:',e);alert('Er ging iets mis bij het genereren van de PDF. Probeer het opnieuw.')}
  resetPDFBtn(btn);
}

// === SCENARIO COMPARISON (enhanced with mini-charts & plafond) ===
let scenarios=[],scenDonutCharts=[];
function getSnapshot(){
  const g=id=>document.getElementById(id);
  const breakYear=document.getElementById('insightBox').textContent.match(/jaar (\d+)/);
  return {
    name:'Scenario '+(scenarios.length+1),
    inputs:{
      income:+(g('income').value)||0,partnerIncome:+(g('partnerIncome').value)||0,
      incomeGrowth:+(g('incomeGrowth').value)||0,
      debt1:+(g('debt1').value)||0,debt2:+(g('debt2').value)||0,
      rateRepay1:+(g('rateRepay1').value)||0,rateRepay2:+(g('rateRepay2').value)||0,
      extraPayoff:+(g('extraPayoff').value)||0
    },
    results:{
      pay:g('r-pay').textContent,dk:g('r-dk').textContent,wm:g('r-wm').textContent,
      blended:g('r-blended').textContent,totP:g('r-totP').textContent,
      totI:g('r-totI').textContent,forg:g('r-forg').textContent,mL:g('r-hypDuo').textContent
    },
    num:{
      pay:parseFloat(g('r-pay').textContent.replace(/[^\d,]/g,'').replace(',','.'))||0,
      totP:parseFloat(g('r-totP').textContent.replace(/[^\d]/g,''))||0,
      totI:parseFloat(g('r-totI').textContent.replace(/[^\d]/g,''))||0,
      forg:parseFloat(g('r-forg').textContent.replace(/[^\d]/g,''))||0,
      mL:parseFloat(g('r-hypDuo').textContent.replace(/[^\d]/g,''))||0
    },
    breakEvenYear:breakYear?parseInt(breakYear[1]):null,
    // Save donut data for mini-chart
    donutData:simData.length>0?(() => {
      const last=simData[simData.length-1];
      let tAfl1=0,tAfl2=0,tInt1=0,tInt2=0;
      simData.forEach(d=>{tAfl1+=d.aL1;tAfl2+=d.aL2;tInt1+=d.iL1;tInt2+=d.iL2});
      return [tAfl1,tInt1,tAfl2,tInt2,last.rL1+last.rL2];
    })():null
  };
}
function saveScenario(){
  if(scenarios.length>=3){alert('Maximaal 3 scenario\'s. Wis er eerst een.');return}
  scenarios.push(getSnapshot());renderScenarios();
}
function delScenario(i){scenarios.splice(i,1);renderScenarios()}
function clearScenarios(){scenarios=[];renderScenarios()}
function renameScenario(i,name){scenarios[i].name=name}

function renderScenarios(){
  const el=document.getElementById('scenResult');
  const cb=document.getElementById('clearScenBtn');
  const ch=document.getElementById('scenCharts');
  // Destroy old mini-charts
  scenDonutCharts.forEach(c=>{if(c)c.destroy()});scenDonutCharts=[];
  if(!scenarios.length){el.innerHTML='<div class="scen-empty">Nog geen scenario\'s bewaard. Pas je invoer aan en bewaar om te vergelijken.</div>';cb.style.display='none';ch.innerHTML='';return}
  cb.style.display='';const n=scenarios.length;
  const rows=[
    {label:'Maandbedrag (jr 1)',key:'pay'},
    {label:'Totaal betaald',key:'totP'},
    {label:'Totaal rente',key:'totI'},
    {label:'Kwijtgescholden',key:'forg'},
    {label:'Hypotheek-impact',key:'mL'}
  ];
  let h='<div class="scen-grid" style="grid-template-columns:140px repeat('+n+',1fr)">';
  h+='<div class="sg-head"></div>';
  for(let i=0;i<n;i++){
    const s=scenarios[i];
    h+='<div class="sg-head'+(i===n-1?' active':'')+'"><input class="scen-name-input" value="'+s.name+'" onchange="renameScenario('+i+',this.value)"><br><span style="font-size:.66rem;font-weight:400;color:var(--muted)">'+
    'Ink. €'+Math.round(s.inputs.income/1000)+'k · Schuld €'+Math.round((s.inputs.debt1+s.inputs.debt2)/1000)+'k'+
    '</span><span class="scen-del" onclick="delScenario('+i+')" title="Verwijder">✕</span></div>';
  }
  for(const row of rows){
    h+='<div class="sg-row-label">'+row.label+'</div>';
    for(let i=0;i<n;i++){
      const val=scenarios[i].results[row.key];
      let diff='';
      if(i>0&&scenarios[0].num[row.key]){
        const d=scenarios[i].num[row.key]-scenarios[0].num[row.key];
        if(Math.abs(d)>1){const pct=((d/scenarios[0].num[row.key])*100).toFixed(0);
          const cls=row.key==='forg'?(d>0?'down':'up'):(d>0?'up':'down');
          diff=' <span class="scen-diff '+cls+'">'+(d>0?'+':'')+pct+'%</span>';}
      }
      h+='<div class="sg-cell"><div class="sg-val">'+val+diff+'</div></div>';
    }
  }
  // Plafond row
  h+='<div class="sg-row-label">Plafond bereikt</div>';
  for(let i=0;i<n;i++){
    const by=scenarios[i].breakEvenYear;
    h+='<div class="sg-cell"><div class="sg-val">'+(by?'Jaar '+by:'Niet binnen 35 jr')+'</div></div>';
  }
  // Rente & stijging rows
  h+='<div class="sg-row-label" style="border-top:2px solid var(--border)">Gewogen rente</div>';
  for(let i=0;i<n;i++){h+='<div class="sg-cell"><div class="sg-val">'+scenarios[i].results.blended+'</div></div>'}
  h+='<div class="sg-row-label">Inkomensstijging</div>';
  for(let i=0;i<n;i++){h+='<div class="sg-cell"><div class="sg-val">'+scenarios[i].inputs.incomeGrowth+'%</div></div>'}
  h+='</div>';
  el.innerHTML=h;

  // Mini donut charts with legends
  const clrs=['#4f46e5','#a5b4fc','#d97706','#fcd34d','#10b981'];
  const clbls=['Afl. L1','Rente L1','Afl. L2','Rente L2','Kwijtschelding'];
  let chHtml='';
  for(let i=0;i<n;i++){
    const d=scenarios[i].donutData;
    if(!d)continue;
    const tot=d.reduce((s,v)=>s+v,0);
    chHtml+='<div class="scen-chart-box"><div class="sc-title">'+scenarios[i].name+'</div><div class="scen-chart-inner"><canvas id="scDonut'+i+'" width="100" height="100" style="width:100px;height:100px"></canvas><div class="scen-legend-mini">';
    for(let j=0;j<d.length;j++){
      if(d[j]<1)continue;
      chHtml+='<div class="sl-item"><span class="sl-dot" style="background:'+clrs[j]+'"></span>'+clbls[j]+'<span class="sl-val">'+eur(d[j])+'</span></div>';
    }
    chHtml+='</div></div></div>';
  }
  ch.innerHTML=chHtml;
  if(typeof Chart!=='undefined'){
  for(let i=0;i<n;i++){
    const d=scenarios[i].donutData;
    if(!d)continue;
    const cvs=document.getElementById('scDonut'+i);
    if(!cvs)continue;
    scenDonutCharts.push(new Chart(cvs,{type:'doughnut',data:{labels:clbls,datasets:[{data:d,backgroundColor:clrs,borderWidth:1,borderColor:'#fff',hoverOffset:3}]},options:{responsive:false,maintainAspectRatio:false,cutout:'55%',plugins:{legend:{display:false},tooltip:{enabled:false}}}}));
  }
  }
}

loadUrl();calc();initRentePeriodes();initIncomeGrowth();renderScenarios();

document.addEventListener('DOMContentLoaded',()=>{initFormatting()});

// === VOORBEELDEN LADEN ===
function loadEx(data){
  for(const[k,v]of Object.entries(data)){const el=document.getElementById(k);if(el)el.value=v}
  calc();initRentePeriodes();initIncomeGrowth();formatAllInputs();
  ['s1','s2','s3'].forEach(id=>{const el=document.getElementById(id);if(el&&!el.classList.contains('open'))el.classList.add('open')});
  window.scrollTo({top:0,behavior:'smooth'});
}
function loadExample(){
  loadEx({
    household:'1',income:'46500',partnerIncome:'0',incomeGrowth:'3',wml:'26819',
    debt1:'30000',runway1:'0',rateRunway1:'2.33',rateRepay1:'2.33',term1:'420',wmOverride1:'0',
    debt2:'0',runway2:'0',rateRunway2:'2.33',rateRepay2:'2.33',term2:'420',wmOverride2:'0',
    hypRate:'4.0',extraPayoff:'0',extraTarget:'auto',savingsAmount:'100',savingsRate:'3.0',savingsYears:'10',
    hypIncome:'46500',hypIncome2:'0',hypSingle:'1',hypLabel:'0',hypOtherDebt:'0'
  });
}
function loadExample2(){
  loadEx({
    household:'1',income:'38000',partnerIncome:'0',incomeGrowth:'4',wml:'26819',
    debt1:'25000',runway1:'12',rateRunway1:'0.46',rateRepay1:'0.46',term1:'420',wmOverride1:'0',
    debt2:'18000',runway2:'24',rateRunway2:'2.33',rateRepay2:'2.33',term2:'420',wmOverride2:'0',
    hypRate:'4.0',extraPayoff:'0',extraTarget:'auto',savingsAmount:'100',savingsRate:'5.0',savingsYears:'10',
    hypIncome:'38000',hypIncome2:'0',hypSingle:'1',hypLabel:'0',hypOtherDebt:'0'
  });
}

// === DARK MODE ===
function toggleDark(){
  const d=document.documentElement.classList.toggle('dark');
  localStorage.setItem('duo-dark',d?'1':'0');
  document.getElementById('darkBtn').textContent=d?'☀️ Light mode':'🌙 Dark mode';
  if(typeof Chart!=='undefined'){
    Chart.defaults.color=d?'#ccc':'#666';
    Chart.defaults.borderColor=d?'#333':'#e5e5e5';
    calc();
  }
}
// Init dark mode from localStorage or system preference
(function(){
  const saved=localStorage.getItem('duo-dark');
  const prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
  if(saved==='1'||(saved===null&&prefersDark)){
    document.documentElement.classList.add('dark');
    const btn=document.getElementById('darkBtn');
    if(btn)btn.textContent='☀️ Light mode';
  }
})();

// === INPUT FORMATTING ===
// Parse Dutch/international number input: accept both comma and dot
function parseNum(s){
  if(typeof s==='number')return s;
  s=String(s).trim();
  if(!s)return 0;
  const lastDot=s.lastIndexOf('.'),lastComma=s.lastIndexOf(',');
  if(lastComma>lastDot){
    // Comma after dot → comma is decimal sep (Dutch: 1.234,56)
    s=s.replace(/\./g,'').replace(',','.');
  } else if(lastDot>lastComma&&lastComma>=0){
    // Dot after comma → dot is decimal sep (intl: 1,234.56)
    s=s.replace(/,/g,'');
  } else if(lastComma>=0&&lastDot<0){
    // Only comma → decimal sep (Dutch: 3,5)
    s=s.replace(',','.');
  } else if(lastDot>=0&&lastComma<0){
    // Only dot: ambiguous. Check if it looks like Dutch thousand separator:
    // - Exactly 3 digits after dot (26.819, 100.000)
    // - OR multiple dots (1.000.000)
    const afterDot=s.substring(lastDot+1);
    const dotCount=(s.match(/\./g)||[]).length;
    if((afterDot.length===3&&/^\d{3}$/.test(afterDot))||dotCount>1){
      s=s.replace(/\./g,''); // thousand separator
    }
    // else: keep as decimal (2.33, 0.5)
  }
  s=s.replace(/[^\d.\-]/g,'');
  return parseFloat(s)||0;
}

// Format number with Dutch thousand separators for display
function fmtInput(v,decimals){
  if(v===0&&decimals===0)return '0';
  if(decimals>0)return v.toLocaleString('nl-NL',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
  return Math.round(v).toLocaleString('nl-NL');
}

// Fields that need thousand separators (large €)
const fmtFieldsInt=['income','partnerIncome','wml','debt1','debt2','extraPayoff','hypIncome','hypIncome2','savingsAmount','hypOtherDebt'];
// Fields with decimals (%, small €)
const fmtFieldsDec=['rateRunway1','rateRepay1','rateRunway2','rateRepay2','hypRate','savingsRate','incomeGrowth','wmOverride1','wmOverride2'];

function initFormatting(){
  // Convert number inputs to text with inputmode
  [...fmtFieldsInt,...fmtFieldsDec].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    const isDec=fmtFieldsDec.includes(id);
    el.type='text';
    el.inputMode='decimal';
    el.setAttribute('autocomplete','off');

    // Format on blur
    el.addEventListener('blur',()=>{
      const v=parseNum(el.value);
      el.value=isDec?fmtInput(v,v%1!==0?Math.min(String(v).split('.')[1]?.length||0,2):0):fmtInput(v,0);
    });

    // On focus: show raw number for editing
    el.addEventListener('focus',()=>{
      const v=parseNum(el.value);
      el.value=v!==0?String(v):'';
      el.select();
    });
  });
  formatAllInputs();
}

function formatAllInputs(){
  fmtFieldsInt.forEach(id=>{
    const el=document.getElementById(id);
    if(el){const v=parseNum(el.value);el.value=fmtInput(v,0)}
  });
  fmtFieldsDec.forEach(id=>{
    const el=document.getElementById(id);
    if(el){const v=parseNum(el.value);el.value=v!==0?fmtInput(v,v%1!==0?Math.min(String(v).split('.')[1]?.length||0,2):0):'0'}
  });
}
