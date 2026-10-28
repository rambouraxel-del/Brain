/* Brain V2 — Dashboard and mind map.
 * Pure frontend layer. Reads the existing notes/spaces, never writes to the API.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const NS='http://www.w3.org/2000/svg';
  const WIDGET_KEY = window.BRAIN_CONFIG?.preview ? 'brain.v2.preview.dashboard' : 'brain.v2.dashboard';
  const WIDGETS=[
    {id:'capture',label:'Capture rapide',description:'Un champ toujours prêt pour tes nouvelles idées.',element:'quickCapture',shown:true},
    {id:'spaces',label:'Mes espaces',description:'Des cartes illustrées pour retrouver tes projets.',element:'spacesShowcase',shown:true},
    {id:'pinned',label:'Idées épinglées',description:'Tes notes préférées au premier regard.',element:'pinnedWidget',shown:true},
    {id:'stats',label:'En quelques chiffres',description:'Notes, espaces actifs et activité récente.',element:null,shown:false}
  ];
  // The original stat block uses the V1 class; its IDs and render logic remain intact.
  WIDGETS[3].element='overview';
  const defaults=()=>WIDGETS.map(w=>({id:w.id,visible:w.shown}));
  function readSettings(){
    try{
      const raw=JSON.parse(localStorage.getItem(WIDGET_KEY)||'null');
      if(!Array.isArray(raw))return defaults();
      const byId=new Map(raw.filter(x=>x&&typeof x.id==='string').map(x=>[x.id,x]));
      const order=raw.filter(x=>WIDGETS.some(w=>w.id===x?.id)).map(x=>x.id);
      const remaining=WIDGETS.filter(w=>!order.includes(w.id)).map(w=>w.id);
      return [...new Set([...order,...remaining])].map(id=>{
        const w=WIDGETS.find(x=>x.id===id),saved=byId.get(id);
        return {id,visible:typeof saved?.visible==='boolean'?saved.visible:w.shown};
      });
    }catch{return defaults();}
  }
  let settings=readSettings();
  let mapMode=false;
  let mapZoom=1, mapX=0, mapY=0, dragging=null;
  const point=(name,attributes={})=>{
    const element=document.createElementNS(NS,name);
    for(const [key,value] of Object.entries(attributes))element.setAttribute(key,String(value));
    return element;
  };
  function text(value){return document.createTextNode(String(value));}
  function saveSettings(){try{localStorage.setItem(WIDGET_KEY,JSON.stringify(settings));}catch{}}
  function applyWidgets(){
    const container=$('homeWidgets');
    for(const item of settings){
      const w=WIDGETS.find(x=>x.id===item.id);
      const node=w && (w.id==='stats' ? document.querySelector('.overview') : $(w.element));
      if(!node)continue;
      container.append(node);
      node.hidden=!item.visible;
    }
    // Keep the essential notes section accessible, regardless of settings.
    saveSettings();
  }
  function button(label,aria,callback){
    const b=document.createElement('button');
    b.type='button';b.textContent=label;b.setAttribute('aria-label',aria);b.addEventListener('click',callback);
    return b;
  }
  function renderSettings(){
    const list=$('dashboardConfigList');list.replaceChildren();
    settings.forEach((item,index)=>{
      const w=WIDGETS.find(x=>x.id===item.id);
      const row=document.createElement('div');row.className='dashboard-widget-choice';
      const label=document.createElement('label');label.className='dashboard-widget-label';
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=item.visible;
      checkbox.addEventListener('change',()=>{item.visible=checkbox.checked;applyWidgets();});
      const copy=document.createElement('span');copy.className='dashboard-widget-copy';
      const strong=document.createElement('strong');strong.textContent=w.label;
      const desc=document.createElement('small');desc.textContent=w.description;
      copy.append(strong,desc);label.append(checkbox,copy);
      const actions=document.createElement('div');actions.className='dashboard-widget-actions';
      const up=button('↑','Monter '+w.label,()=>move(index,-1));
      const down=button('↓','Descendre '+w.label,()=>move(index,1));
      up.disabled=index===0;down.disabled=index===settings.length-1;
      actions.append(up,down);row.append(label,actions);list.append(row);
    });
  }
  function move(i,delta){
    const j=i+delta;if(j<0||j>=settings.length)return;
    [settings[i],settings[j]]=[settings[j],settings[i]];
    applyWidgets();renderSettings();
  }
  function openConfig(){
    $('dashboardConfigOverlay').hidden=false;
    document.body.style.overflow='hidden';
    renderSettings();
    $('dashboardConfigClose').focus();
  }
  function closeConfig(){
    $('dashboardConfigOverlay').hidden=true;
    // Opening settings over a desktop editor should not freeze the page.
    const otherBlocking=[...document.querySelectorAll('.modal-overlay')].some(el=>!el.hidden&&
      !(el.id==='editorOverlay'&&window.matchMedia('(min-width: 1180px)').matches));
    document.body.style.overflow=otherBlocking?'hidden':'';
  }
  function pinnedNotes(){
    const snapshot=window.BrainV2.snapshot();
    return snapshot.notes.filter(n=>n.pinned&&!n.archived).sort((a,b)=>
      new Date(b.updated_at)-new Date(a.updated_at));
  }
  function renderPinned(){
    const container=$('pinnedWidgetList');
    container.replaceChildren();
    const notes=pinnedNotes().slice(0,3);
    if(!notes.length){
      const p=document.createElement('p');p.className='pinned-widget-empty';
      p.textContent='Épingle tes idées importantes : elles apparaîtront ici.';
      container.append(p);
      return;
    }
    for(const n of notes){
      const b=document.createElement('button');b.className='pinned-mini-card';b.type='button';
      const top=document.createElement('small');top.textContent='✦  '+(n.space==='Inbox'?'Boîte de réception':n.space);
      const heading=document.createElement('strong');heading.textContent=n.title||'Sans titre';
      const preview=document.createElement('span');preview.textContent=(n.content||'').slice(0,160);
      b.append(top,heading,preview);b.addEventListener('click',()=>window.BrainV2.openNote(n.id));
      container.append(b);
    }
  }
  const shorten=(value,max=22)=>String(value||'Sans titre').length<=max?String(value||'Sans titre'):String(value||'Sans titre').slice(0,max-1)+'…';
  function svgText(x,y,label,className){
    const e=point('text',{x,y,class:className,'text-anchor':'middle','dominant-baseline':'middle'});
    e.textContent=label;return e;
  }
  function line(parent,x1,y1,x2,y2,kind){
    parent.append(point('path',{d:'M '+x1+' '+y1+' Q '+((x1+x2)/2)+' '+((y1+y2)/2-28)+' '+x2+' '+y2,class:'mindmap-line '+kind}));
  }
  function node(parent,opts){
    const {x,y,title,subtitle,type,color,activate}=opts;
    const width=type==='root'?242:type==='space'?235:194;
    const height=type==='root'?106:type==='space'?90:78;
    const g=point('g',{class:'mindmap-node mindmap-'+type,role:'button',tabindex:'0',
      transform:'translate('+x+' '+y+')','aria-label':title+' — '+subtitle});
    const bg=point('rect',{x:-width/2,y:-height/2,width,height,rx:type==='root'?29:23,ry:type==='root'?29:23,
      fill:color||'#5b86b9'});
    const tip=point('title');tip.textContent=title+(subtitle?' · '+subtitle:'');
    g.append(bg,svgText(0,-10,shorten(title,type==='root'?24:type==='space'?21:18),'mindmap-label'));
    if(subtitle)g.append(svgText(0,20,shorten(subtitle,25),'mindmap-sub'));
    g.append(tip);
    const invoke=event=>{event.stopPropagation();activate();};
    g.addEventListener('click',invoke);
    g.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();invoke(event);}
    });
    parent.append(g);return g;
  }
  function transform(){
    // Transform about the map's center, with user pan offset.
    $('mindmapPanzoom').setAttribute('transform',
      'translate('+(900+mapX)+' '+(510+mapY)+') scale('+mapZoom+') translate(-900 -510)');
  }
  function clampZoom(n){return Math.min(5,Math.max(.55,n));}
  function setZoom(n){mapZoom=clampZoom(n);transform();}
  function renderMap(){
    if(!mapMode)return;
    const group=$('mindmapPanzoom');
    group.replaceChildren();
    const snapshot=window.BrainV2.snapshot();
    const all=snapshot.notes.filter(n=>!n.archived);
    const spaces=[...snapshot.spaces];
    for(const n of all)if(!spaces.some(s=>s.name===n.space))
      spaces.push({name:n.space,color:'#708cb7'});
    if(!snapshot.ready){
      $('mindmapFootnote').textContent='Connecte-toi pour explorer tes notes.';
      node(group,{x:900,y:510,title:'Brain',subtitle:'Connexion nécessaire',
        type:'root',color:'#5d80b3',activate:()=>{}});
      transform();return;
    }
    const limit=10,visible=spaces.slice(0,limit),cx=900,cy=510;
    const edges=point('g',{class:'mindmap-edges'});
    const nodes=point('g',{class:'mindmap-nodes'});
    group.append(edges,nodes);
    const active=all.length;
    node(nodes,{x:cx,y:cy,title:'Mon Brain',subtitle:active+' idée'+(active!==1?'s':''),
      type:'root',color:'#5b7ce2',activate:()=>showDashboard()});
    visible.forEach((space,i)=>{
      const angle=-Math.PI/2+i*2*Math.PI/visible.length;
      const radius=visible.length>7?370:310;
      const x=cx+radius*Math.cos(angle),y=cy+radius*Math.sin(angle)*.84;
      const notes=all.filter(n=>n.space===space.name);
      const color=/^#[\da-f]{6}$/i.test(space.color)?space.color:'#547da9';
      line(edges,cx,cy,x,y,'mindmap-main-edge');
      node(nodes,{x,y,title:space.name==='Inbox'?'Boîte de réception':space.name,
        subtitle:notes.length+' note'+(notes.length!==1?'s':''),type:'space',color,
        activate:()=>{showDashboard();window.BrainV2.filterSpace(space.name);}});
      const maxNotes=notes.length>6?5:6;
      notes.slice(0,maxNotes).forEach((note,j)=>{
        const start=angle-.7,arc=1.4;
        const nangle=notes.length===1?angle:start+j/(Math.min(maxNotes,notes.length)-1||1)*arc;
        const nr=190;
        const nx=x+Math.cos(nangle)*nr,ny=y+Math.sin(nangle)*nr*.82;
        line(edges,x,y,nx,ny,'mindmap-note-edge');
        node(nodes,{x:nx,y:ny,title:note.title||'Sans titre',
          subtitle:(note.tags||[]).length?'#'+note.tags[0]:'Ouvrir la note',
          type:'note',color:'#fff',activate:()=>window.BrainV2.openNote(note.id)});
      });
      if(notes.length>maxNotes){
        const bx=x+Math.cos(angle)*170,by=y+Math.sin(angle)*170;
        // Place the overflow marker below the space to avoid hiding notes.
        node(nodes,{x:bx,y:by+75,title:'+'+(notes.length-maxNotes)+' autres notes',
          subtitle:'Voir cet espace',type:'overflow',color:'#dbe7fb',
          activate:()=>{showDashboard();window.BrainV2.filterSpace(space.name);}});
      }
    });
    $('mindmapFootnote').textContent=
      active+' notes actives · '+spaces.length+' espaces · '+(spaces.length>limit?'10 espaces affichés · ':'')+
      'Les notes archivées sont masquées. Clique sur un nœud pour naviguer.';
    transform();
  }
  function showDashboard(){
    mapMode=false;
    $('mindmapSection').hidden=true;
    $('homeWidgets').hidden=false;
    document.querySelector('.notes-section').hidden=false;
    document.querySelector('.welcome').hidden=false;
    $('dashboardMindmap').classList.remove('active');
    $('dashboardMindmap').setAttribute('aria-pressed','false');
  }
  function showMindmap(){
    mapMode=true;
    $('mindmapSection').hidden=false;
    $('homeWidgets').hidden=true;
    document.querySelector('.notes-section').hidden=true;
    document.querySelector('.welcome').hidden=true;
    $('dashboardMindmap').classList.add('active');
    $('dashboardMindmap').setAttribute('aria-pressed','true');
    mapZoom=window.matchMedia('(max-width: 700px)').matches?2.45:1;
    mapX=0;mapY=0;renderMap();
    $('mindmapSection').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function setupPointer(){
    const svg=$('mindmapSvg');
    svg.addEventListener('wheel',event=>{
      if(!mapMode)return;
      event.preventDefault();
      setZoom(mapZoom*(event.deltaY<0?1.12:.89));
    },{passive:false});
    svg.addEventListener('pointerdown',event=>{
      if(!mapMode||event.target.closest('.mindmap-node'))return;
      dragging={pointerId:event.pointerId,x:event.clientX,y:event.clientY,mapX,mapY};
      try{svg.setPointerCapture(event.pointerId);}catch{}
      svg.classList.add('dragging');
    });
    svg.addEventListener('pointermove',event=>{
      if(!dragging||dragging.pointerId!==event.pointerId)return;
      const rect=svg.getBoundingClientRect();
      const ratio=rect.width?1800/rect.width:1;
      mapX=dragging.mapX+(event.clientX-dragging.x)*ratio;
      mapY=dragging.mapY+(event.clientY-dragging.y)*ratio;
      transform();
    });
    const done=()=>{dragging=null;svg.classList.remove('dragging');};
    svg.addEventListener('pointerup',done);
    svg.addEventListener('pointercancel',done);
    svg.addEventListener('lostpointercapture',done);
  }
  function setup(){
    if(!window.BrainV2||!$('homeWidgets'))return;
    applyWidgets();renderPinned();
    $('dashboardCustomize').addEventListener('click',openConfig);
    $('dashboardConfigClose').addEventListener('click',closeConfig);
    $('dashboardConfigOverlay').addEventListener('click',e=>{if(e.target===$('dashboardConfigOverlay'))closeConfig();});
    $('dashboardConfigReset').addEventListener('click',()=>{settings=defaults();applyWidgets();renderSettings();});
    $('dashboardMindmap').addEventListener('click',()=>mapMode?showDashboard():showMindmap());
    $('mindmapBack').addEventListener('click',showDashboard);
    $('mindmapZoomIn').addEventListener('click',()=>setZoom(mapZoom*1.25));
    $('mindmapZoomOut').addEventListener('click',()=>setZoom(mapZoom*.8));
    $('mindmapReset').addEventListener('click',()=>{
      mapX=0;mapY=0;setZoom(window.matchMedia('(max-width: 700px)').matches?2.45:1);
    });
    $('pinnedAllButton').addEventListener('click',()=>{
      showDashboard();window.BrainV2.filterPinned();
    });
    // Existing navigation remains the way out of the mind map.
    document.querySelectorAll('[data-filter],[data-mobile-filter],[data-quick-filter]').forEach(el=>
      el.addEventListener('click',showDashboard));
    $('mobileCapture').addEventListener('click',showDashboard);
    $('heroNewNote').addEventListener('click',showDashboard);
    $('quickNewNote').addEventListener('click',showDashboard);
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!$('dashboardConfigOverlay').hidden)closeConfig();
    });
    document.addEventListener('brain:updated',()=>{renderPinned();if(mapMode)renderMap();});
    setupPointer();
    $('dashboardMindmap').setAttribute('aria-pressed','false');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();
