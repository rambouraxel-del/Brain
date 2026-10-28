/* Brain V2 — visual themes only. No API or note storage changes. */
(() => {
  'use strict';
  const KEY = 'brain.v2.appearance';
  const THEMES = {
    archipel: {label:'Archipel', accent:'#487de8', day:['#90d6ff','#f7d8a0','#588fb4','#3d805f'], night:['#091a42','#604e90','#273d79','#234c59']},
    foret: {label:'Forêt enchantée', accent:'#238d6c', day:['#a9e9c9','#f5e9a7','#52997c','#2e7654'], night:['#0a2736','#255a62','#1c5453','#15443f']},
    cosmos: {label:'Cosmos', accent:'#8660e6', day:['#93c3ff','#f9b8dc','#7785ca','#4c568b'], night:['#100f36','#3a286b','#352d79','#1c295a']},
    riviera: {label:'Riviera', accent:'#e47750', day:['#8ddbf2','#ffddb5','#4ca9b7','#34899d'], night:['#0b2749','#825b85','#315e8b','#164b78']}
  };
  function getSaved() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return {theme:THEMES[v.theme]?v.theme:'archipel',mode:v.mode==='night'?'night':'day'}; }
    catch { return {theme:'archipel',mode:'day'}; }
  }
  const current = getSaved();
  function landscape(theme,mode) {
    const t=THEMES[theme],c=t[mode],night=mode==='night';
    const stars=night?Array.from({length:17},(_,i)=>'<circle cx="'+(40+i*83%1180)+'" cy="'+(25+i*47%150)+'" r="'+(i%3===0?2:1)+'" fill="#fff" opacity=".7"/>').join(''):'';
    const celestial=night?'<circle cx="990" cy="90" r="38" fill="#fff1c8" opacity=".85"/>':'<circle cx="990" cy="90" r="48" fill="#fff6c8" opacity=".85"/>';
    const feature=theme==='cosmos'
      ?'<ellipse cx="625" cy="290" rx="260" ry="70" fill="'+c[2]+'" opacity=".75"/><circle cx="650" cy="225" r="145" fill="'+c[3]+'"/><ellipse cx="650" cy="230" rx="250" ry="45" fill="none" stroke="#f4c2df" stroke-width="24" transform="rotate(-18 650 230)" opacity=".65"/>'
      :theme==='riviera'
      ?'<path d="M0 340 Q350 310 600 355 T1200 340 V500 H0Z" fill="'+c[2]+'"/><path d="M90 310h80v-110h70v110h65v-145h70v145h45v-80h90v80h65v190H90Z" fill="'+c[3]+'" opacity=".88"/><path d="M260 165l35-45 35 45M415 230l40-40 40 40" stroke="#fff1d0" stroke-width="14" fill="none"/>'
      :theme==='foret'
      ?Array.from({length:11},(_,i)=>{const x=i*125-20,h=140+(i*37%115);return '<path d="M'+x+' 410l60-'+h+' 60 '+h+'Z" fill="'+(i%2?c[2]:c[3])+'"/><rect x="'+(x+53)+'" y="385" width="14" height="90" fill="'+c[3]+'"/>';}).join('')
      :'<path d="M0 370 Q100 250 210 340 T460 310 T720 325 T960 290 T1200 340 V500 H0Z" fill="'+c[2]+'"/><path d="M100 360l180-170 125 170 110-100 160 110 155-210 210 210 160-95v225H0Z" fill="'+c[3]+'" opacity=".88"/><path d="M235 234l45-44 32 44M793 205l37-45 43 45" fill="#fff" opacity=".8"/>';
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="500" viewBox="0 0 1200 500"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="'+c[0]+'"/><stop offset="1" stop-color="'+c[1]+'"/></linearGradient></defs><rect width="1200" height="500" fill="url(#sky)"/>'+stars+celestial+feature+'<rect y="465" width="1200" height="35" fill="'+c[3]+'" opacity=".4"/></svg>';
    return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
  }
  function apply() {
    const t=THEMES[current.theme];
    document.body.dataset.visualTheme=current.theme;
    document.body.dataset.theme=current.mode==='night'?'dark':'light';
    document.documentElement.style.setProperty('--brain-theme-accent',t.accent);
    document.documentElement.style.setProperty('--brain-scene',landscape(current.theme,current.mode));
    document.documentElement.style.setProperty('--brain-scene-position','center');
    const select=document.getElementById('visualThemeSelect'),mode=document.getElementById('visualModeSelect');
    if(select)select.value=current.theme;
    if(mode)mode.value=current.mode;
    // Keep the existing header toggle icon aligned with the explicit V2 setting.
    const icon=document.getElementById('themeIcon');
    const iconUse=icon && icon.querySelector('use');
    if(iconUse)iconUse.setAttribute('href',current.mode==='night'?'#i-sun':'#i-moon');
    const status=document.getElementById('appearancePreview');
    if(status)status.textContent=t.label+' · '+(current.mode==='night'?'Nuit':'Jour');
    try {localStorage.setItem(KEY,JSON.stringify(current));}catch{}
  }
  function setup() {
    const theme=document.getElementById('visualThemeSelect'),mode=document.getElementById('visualModeSelect');
    if(theme)theme.addEventListener('change',()=>{if(THEMES[theme.value])current.theme=theme.value;apply();});
    if(mode)mode.addEventListener('change',()=>{current.mode=mode.value==='night'?'night':'day';apply();});
    // Existing header theme toggle remains useful and now updates the explicit V2 choice.
    const old=document.getElementById('themeButton');
    if(old)old.addEventListener('click',()=>{current.mode=document.body.dataset.theme==='dark'?'night':'day';apply();});
    apply();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
