'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const API_BASE = String(window.BRAIN_CONFIG?.apiBase || '').replace(/\/+$/, '');
  const serverMode = Boolean(API_BASE);
  const LOCAL_KEY = 'brain.v1.notes';
  const SPACE_KEY = 'brain.v1.spaces';
  const TOKEN_KEY = 'brain.v1.session';
  const DEFAULT_SPACES = [
    { name: 'Inbox', color: '#a4a9b9' },
    { name: 'Projets', color: '#7665e9' },
    { name: 'Idées', color: '#eda96f' },
    { name: 'Réflexions', color: '#6abfa9' },
    { name: 'Ressources', color: '#6c9bdf' }
  ];
  const seedNotes = () => {
    const now = new Date().toISOString();
    return [
      { id: createId(), title: 'Bienvenue dans ton deuxième cerveau ✨', content: 'Ceci est une note d’exemple. Clique dessus pour la modifier, l’épingler ou la supprimer.\n\nL’idée : pouvoir poser une pensée quelque part sans avoir à s’en souvenir ensuite.', space: 'Inbox', tags: ['bienvenue'], pinned: true, archived: false, created_at: now, updated_at: now },
      { id: createId(), title: 'Une idée pour un prochain projet', content: 'Tu peux noter tes envies, tes projets de jeux, tes réflexions et tout ce que tu veux retrouver plus tard.', space: 'Idées', tags: ['inspiration', 'projet'], pinned: false, archived: false, created_at: new Date(Date.now() - 86400000).toISOString(), updated_at: new Date(Date.now() - 86400000).toISOString() },
      { id: createId(), title: 'Capturer d’abord, organiser ensuite', content: 'Tu n’as pas besoin de tout classer parfaitement. Enregistre tes idées dans la boîte de réception et range-les quand tu as le temps.', space: 'Réflexions', tags: ['méthode'], pinned: false, archived: false, created_at: new Date(Date.now() - 172800000).toISOString(), updated_at: new Date(Date.now() - 172800000).toISOString() }
    ];
  };
  const initialStored = getJSON(LOCAL_KEY, null);
  const state = {
    notes: serverMode ? [] : (initialStored === null ? seedNotes() : Array.isArray(initialStored) ? initialStored : []),
    spaces: serverMode ? DEFAULT_SPACES : getJSON(SPACE_KEY, DEFAULT_SPACES),
    filter: 'all', query: '', sort: 'recent', view: localStorage.getItem('brain.v1.view') || 'grid',
    editId: null, editPinned: false, editArchived: false,
    token: serverMode ? (sessionStorage.getItem(TOKEN_KEY) || '') : '', busy: false, remoteReady: false
  };
  if (!serverMode && initialStored === null) localStorage.setItem(LOCAL_KEY, JSON.stringify(state.notes));
  if (!Array.isArray(state.spaces) || !state.spaces.length) state.spaces = DEFAULT_SPACES;

  function createId() { return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
  function getJSON(key, fallback) { try { const val = localStorage.getItem(key); return val === null ? fallback : JSON.parse(val); } catch { return fallback; } }
  function encode(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function dateLabel(iso) { const d = new Date(iso); return Number.isNaN(+d) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }); }
  function titleFrom(content) { const line = content.split('\n').map(s => s.trim()).find(Boolean) || 'Sans titre'; return line.slice(0, 76).replace(/^#+\s*/, '') || 'Sans titre'; }
  function tagsFrom(input) { return [...new Set(input.split(',').map(x => x.trim().replace(/^#/, '').slice(0, 35)).filter(Boolean))].slice(0, 12); }
  function findSpace(name) { return state.spaces.find(s => s.name === name) || {name, color:'#9da4b9'}; }
  function showToast(text) { const el = $('toast'); el.textContent = text; el.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => el.classList.remove('show'), 3100); }
  function showModal(id) { $(id).hidden = false; document.body.style.overflow = 'hidden'; }
  function closeModal(id) { $(id).hidden = true; if (![...document.querySelectorAll('.modal-overlay')].some(el => !el.hidden)) document.body.style.overflow = ''; }
  function showLogin(message = '') { $('loginError').textContent = message; showModal('loginOverlay'); setTimeout(() => $('passwordInput').focus(), 80); }
  function endSession() {
    state.token = '';
    state.remoteReady = false;
    sessionStorage.removeItem(TOKEN_KEY);
    // Never keep previously authenticated notes visible after logout.
    if (serverMode) { state.notes = []; state.spaces = DEFAULT_SPACES; state.filter = 'all'; render(); }
    showLogin();
  }
  function saveLocal() { localStorage.setItem(LOCAL_KEY, JSON.stringify(state.notes)); localStorage.setItem(SPACE_KEY, JSON.stringify(state.spaces)); }

  async function api(path, method = 'GET', data = undefined) {
    const headers = {'Accept':'application/json'};
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    let response;
    try { response = await fetch(`${API_BASE}/api${path}`, {method, headers, body:data === undefined ? undefined : JSON.stringify(data), cache:'no-store'}); }
    catch { throw new Error('Serveur indisponible. Vérifie la connexion à ton VPS.'); }
    if (response.status === 401) { endSession(); throw new Error('Session expirée : reconnecte-toi.'); }
    if (!response.ok) { const json = await response.json().catch(() => ({})); throw new Error(typeof json.detail === 'string' ? json.detail : `Erreur serveur (${response.status})`); }
    return response.status === 204 ? null : response.json();
  }
  async function reloadRemote() {
    const [notes, spaces] = await Promise.all([api('/notes'), api('/spaces')]);
    state.notes = notes; state.spaces = spaces; state.remoteReady = true;
    render();
  }
  async function storeNew(payload) {
    if (serverMode) { const note = await api('/notes','POST',payload); state.notes.unshift(note); return note; }
    const now = new Date().toISOString(); const note = {id:createId(),created_at:now,updated_at:now,pinned:false,archived:false,...payload};
    state.notes.unshift(note); saveLocal(); return note;
  }
  async function storeUpdate(id, payload) {
    if (serverMode) { const note = await api(`/notes/${encodeURIComponent(id)}`, 'PATCH', payload); state.notes = state.notes.map(n => n.id === id ? note : n); return note; }
    const note = state.notes.find(n => n.id === id); if (!note) throw new Error('Cette note est introuvable.');
    Object.assign(note, payload, { updated_at:new Date().toISOString() }); saveLocal(); return note;
  }
  async function storeDelete(id) {
    if (serverMode) await api(`/notes/${encodeURIComponent(id)}`, 'DELETE');
    state.notes = state.notes.filter(n => n.id !== id); if (!serverMode) saveLocal();
  }
  async function storeSpace(name) {
    if (serverMode) { const space = await api('/spaces','POST',{name}); state.spaces.push(space); return space; }
    const colors = ['#7665e9','#eda96f','#6abfa9','#6c9bdf','#ce8cc7'];
    const space = { name, color:colors[(state.spaces.length - 1) % colors.length] };
    state.spaces.push(space); saveLocal(); return space;
  }
  function render() { renderNav(); renderSpaceSelects(); renderStats(); renderNotes(); renderSync(); }
  function renderNav() {
    const nonArchived = state.notes.filter(n => !n.archived);
    $('navCountAll').textContent = nonArchived.length;
    $('navCountInbox').textContent = nonArchived.filter(n => n.space === 'Inbox').length;
    document.querySelectorAll('[data-filter]').forEach(el => el.classList.toggle('active', el.dataset.filter === state.filter));
    document.querySelectorAll('[data-mobile-filter]').forEach(el => el.classList.toggle('active', el.dataset.mobileFilter === state.filter));
    const spaceNav = $('spaceNav'); spaceNav.replaceChildren();
    for (const space of state.spaces.filter(s => s.name !== 'Inbox')) {
      const btn = document.createElement('button');btn.type = 'button'; btn.className = 'nav-item' + (state.filter === `space:${space.name}` ? ' active' : '');
      const dot = document.createElement('span'); dot.className = 'space-dot';dot.style.background = space.color;
      const label = document.createElement('span');label.textContent = space.name;
      const count = document.createElement('span');count.className = 'nav-count';count.textContent = nonArchived.filter(n => n.space === space.name).length;
      btn.append(dot,label,count);btn.addEventListener('click', () => setFilter(`space:${space.name}`));spaceNav.append(btn);
    }
  }
  function renderSpaceSelects() {
    for (const id of ['quickSpace','editSpace']) {
      const el = $(id); const previous = el.value;
      el.replaceChildren();
      for (const space of state.spaces) { const option = document.createElement('option');option.value = space.name;option.textContent = space.name === 'Inbox' ? 'Boîte de réception' : space.name;el.append(option); }
      if ([...el.options].some(x => x.value === previous)) el.value = previous; else el.value = 'Inbox';
    }
  }
  function renderStats() {
    const active = state.notes.filter(n => !n.archived);
    $('statNotes').textContent = active.length;
    $('statSpaces').textContent = new Set(active.map(n => n.space).filter(s => s !== 'Inbox')).size;
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    $('statWeek').textContent = active.filter(n => +new Date(n.created_at) >= since).length;
  }
  function filteredNotes() {
    const query = state.query.toLocaleLowerCase('fr').trim();
    return state.notes.filter(n => {
      if (state.filter === 'archived') { if (!n.archived) return false; }
      else if (n.archived) return false;
      if (state.filter === 'inbox' && n.space !== 'Inbox') return false;
      if (state.filter === 'pinned' && !n.pinned) return false;
      if (state.filter.startsWith('space:') && n.space !== state.filter.slice(6)) return false;
      return !query || [n.title,n.content,n.space,...(n.tags||[])].some(val => String(val).toLocaleLowerCase('fr').includes(query));
    }).sort((a,b) => {
      if (state.sort === 'az') return a.title.localeCompare(b.title,'fr');
      const diff = new Date(b.updated_at) - new Date(a.updated_at);
      return state.sort === 'oldest' ? -diff : diff || Number(b.pinned)-Number(a.pinned);
    });
  }
  function renderNotes() {
    const labels = { all:'Toutes mes notes', inbox:'Boîte de réception', pinned:'Notes épinglées', archived:'Archives' };
    const label = state.filter.startsWith('space:') ? state.filter.slice(6) : labels[state.filter] || 'Toutes mes notes';
    $('breadcrumbLabel').textContent = label; $('listTitle').firstChild.nodeValue = `${label} `;
    const notes = filteredNotes(); $('resultCount').textContent = notes.length;
    $('listOverline').textContent = state.filter === 'archived' ? 'IDÉES CONSERVÉES' : 'TA BIBLIOTHÈQUE';
    $('notesGrid').classList.toggle('list-mode',state.view === 'list');
    $('gridButton').classList.toggle('selected',state.view === 'grid');$('listButton').classList.toggle('selected',state.view === 'list');
    const grid = $('notesGrid'); grid.innerHTML = notes.map(n => {
      const space = findSpace(n.space);
      return `<article class="note-card" data-note-id="${encode(n.id)}"><div class="note-top"><span class="note-space"><span class="space-dot" style="background:${encode(space.color)}"></span>${encode(n.space === 'Inbox' ? 'Boîte de réception' : n.space)}</span><span class="note-options"><button type="button" class="note-icon-button ${n.pinned ? 'active':''}" data-action="pin" aria-label="${n.pinned ? 'Désépingler' : 'Épingler'}" title="${n.pinned ? 'Désépingler' : 'Épingler'}"><svg class="ic"><use href="#i-pin"/></svg></button><button type="button" class="note-icon-button" data-action="edit" aria-label="Modifier" title="Modifier"><svg class="ic"><use href="#i-dots"/></svg></button></span></div><button type="button" class="note-click" data-action="edit"><h3 class="note-title">${encode(n.title || titleFrom(n.content || ''))}</h3><p class="note-preview">${encode(n.content || '')}</p></button><div class="note-footer"><div class="note-tags">${(n.tags||[]).slice(0,3).map(t=>`<span class="tag">#${encode(t)}</span>`).join('')}</div><span class="note-date">${dateLabel(n.updated_at)}</span></div></article>`;
    }).join('');
    const empty = notes.length === 0; $('emptyState').hidden = !empty;
    if (empty) { $('emptyTitle').textContent = state.query ? 'Aucun résultat.' : state.filter === 'archived' ? 'Aucune note archivée.' : 'Ici commence la prochaine idée.'; $('emptyText').textContent = state.query ? 'Essaie un autre mot-clé ou efface la recherche.' : 'Capture une pensée quand elle arrive. Tu pourras la retrouver ici.'; }
    $('activeSearch').hidden = !state.query;
    if (state.query) $('activeSearch').innerHTML = `Résultats pour <strong>« ${encode(state.query)} »</strong><button class="clear-search" type="button" id="clearSearch">Effacer ×</button>`;
    $('clearSearch')?.addEventListener('click', () => {state.query = ''; renderNotes();});
  }
  function renderSync() {
    const el = $('syncState'); el.classList.toggle('connected',serverMode && !!state.token && state.remoteReady);
    el.lastChild.textContent = serverMode ? (state.token && state.remoteReady ? 'Synchronisé avec ton VPS' : state.token ? 'Connexion au VPS indisponible' : 'Connexion nécessaire') : 'Mode démo · navigateur uniquement';
    $('storageExplainer').textContent = serverMode ? 'Tes notes sont stockées sur ton VPS via une API privée. Seule ta session actuelle est conservée ici.' : 'Mode démo : ces notes sont uniquement enregistrées dans ce navigateur. Pas de synchronisation entre appareils.';
    $('storageBadge').textContent = serverMode ? 'VPS' : 'LOCAL'; $('logoutBlock').hidden = !serverMode;
    const legacy = getJSON(LOCAL_KEY, null);
    $('legacyImportBlock').hidden = !(serverMode && state.token && state.remoteReady && Array.isArray(legacy) && legacy.length > 0);
    if (!$('legacyImportBlock').hidden) $('legacyCount').textContent = legacy.length;
  }
  function setFilter(filter) { state.filter = filter; render(); window.scrollTo({top:0,behavior:'smooth'}); }
  async function handleCapture() {
    if (state.busy) return;
    const content = $('quickInput').value.trim(); if (!content) return showToast('Écris au moins une idée avant de sauvegarder.');
    state.busy = true; $('captureButton').disabled = true;
    try { await storeNew({title:titleFrom(content),content,space:$('quickSpace').value,tags:tagsFrom($('quickTags').value)});
      $('quickInput').value = ''; $('quickTags').value = ''; render(); showToast('Ton idée est enregistrée ✓');
    } catch (e) { showToast(e.message); } finally { state.busy = false; $('captureButton').disabled = false; }
  }
  function openEditor(id) {
    const note = state.notes.find(n => n.id === id); if (!note) return;
    state.editId = id; state.editPinned = !!note.pinned; state.editArchived = !!note.archived;
    $('editTitle').value = note.title; $('editContent').value = note.content;
    $('editSpace').value = note.space; $('editTags').value = (note.tags||[]).join(', '); updateEditButtons(); showModal('editorOverlay');
  }
  function updateEditButtons() {
    $('editPin').classList.toggle('active',state.editPinned); $('editPin').querySelector('span').textContent = state.editPinned ? 'Épinglée' : 'Épingler';
    $('editArchive').classList.toggle('active',state.editArchived); $('editArchive').querySelector('span').textContent = state.editArchived ? 'Restaurer' : 'Archiver';
  }
  async function saveEditor() {
    const content = $('editContent').value.trim(), title = $('editTitle').value.trim() || titleFrom(content);
    if (!title && !content) return showToast('Cette note est vide.');
    $('saveEdit').disabled = true;
    try { await storeUpdate(state.editId, { title, content, space:$('editSpace').value, tags:tagsFrom($('editTags').value), pinned:state.editPinned, archived:state.editArchived }); closeModal('editorOverlay');render();showToast('Note mise à jour ✓'); }
    catch (e) {showToast(e.message);} finally{$('saveEdit').disabled=false;}
  }
  async function deleteEditor() {
    if (!confirm('Supprimer définitivement cette note ? Cette action est irréversible.')) return;
    try {await storeDelete(state.editId);closeModal('editorOverlay');render();showToast('Note supprimée.');} catch(e){showToast(e.message);}
  }
  async function togglePin(id) { const n = state.notes.find(n => n.id === id); if (!n) return;const next = !n.pinned;try {await storeUpdate(id,{pinned:next});renderNotes();showToast(next ? 'Note épinglée' : 'Note désépinglée');} catch(e){showToast(e.message);} }
  async function addSpace() {
    const name = $('spaceName').value.trim();if (name.length < 2 || name.length > 40) return showToast('Entre un nom de 2 à 40 caractères.');
    if (state.spaces.some(s=>s.name.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'))) return showToast('Cet espace existe déjà.');
    try {await storeSpace(name);closeModal('spaceOverlay');$('spaceName').value='';setFilter(`space:${name}`);$('quickSpace').value = name;showToast('Nouvel espace créé ✓');} catch(e){showToast(e.message);}
  }
  function exportData() {
    const json = JSON.stringify({app:'Brain', version:1, exported_at:new Date().toISOString(),spaces:state.spaces,notes:state.notes},null,2);
    const blob = new Blob([json],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`brain-export-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('Export téléchargé ✓');
  }
  async function importData(file) {
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('Fichier trop volumineux (8 Mo maximum).');
      const obj = JSON.parse(await file.text());
      if (obj.app !== 'Brain' || !Array.isArray(obj.notes)) throw new Error('Fichier incompatible avec Brain.');
      if (obj.notes.length > 4000) throw new Error('Import limité à 4 000 notes.');
      let count = 0;
      if (serverMode) { const result = await api('/import','POST',{notes:obj.notes, spaces:obj.spaces||[]});count=result.imported;await reloadRemote(); }
      else {
        const known = new Set(state.notes.map(n=>n.id));
        for (const space of obj.spaces||[]) {if (space && typeof space.name === 'string' && !state.spaces.some(s=>s.name === space.name) && state.spaces.length < 100) state.spaces.push({name:space.name.slice(0,40),color:/^#[0-9A-Fa-f]{6}$/.test(space.color) ? space.color:'#7665e9'});}
        for (const n of obj.notes) {
          if (!n || typeof n !== 'object') continue;
          const id = typeof n.id === 'string' ? n.id.slice(0,100) : createId(); if (known.has(id)) continue;
          const now = new Date().toISOString();
          state.notes.push({id,title:String(n.title||'').slice(0,140),content:String(n.content||'').slice(0,30000),space:String(n.space||'Inbox').slice(0,40),tags:Array.isArray(n.tags)?n.tags.filter(x=>typeof x==='string').slice(0,12).map(x=>x.slice(0,35)):[],pinned:!!n.pinned,archived:!!n.archived,created_at:n.created_at||now,updated_at:n.updated_at||now});known.add(id);count++;
        }
        saveLocal();render();
      }
      showToast(`${count} note${count>1?'s':''} importée${count>1?'s':''} ✓`);
      closeModal('settingsOverlay');
    } catch(e) {showToast(e.message||'Import impossible.');}finally{$('importFile').value='';}
  }
  async function importLocalNotes() {
    if (!serverMode || !state.token || !state.remoteReady) return;
    const notes = getJSON(LOCAL_KEY, null);
    if (!Array.isArray(notes) || notes.length === 0) return showToast('Aucune ancienne note locale.');
    if (!confirm(`Importer ${notes.length} note(s) locales vers Brain ? Tes notes du navigateur seront conservées en sauvegarde.`)) return;
    const button = $('importLocalButton'); button.disabled = true;
    try {
      const localSpaces = getJSON(SPACE_KEY, DEFAULT_SPACES);
      const result = await api('/import', 'POST', {notes, spaces:Array.isArray(localSpaces) ? localSpaces : DEFAULT_SPACES});
      await reloadRemote();
      showToast(`${result.imported} note(s) ajoutée(s) au VPS. Les copies locales sont conservées.`);
    } catch (e) { showToast(e.message || 'Import des anciennes notes impossible.'); }
    finally { button.disabled = false; }
  }

  function setupSearch() {
    const panel=document.createElement('div');panel.className='search-panel';panel.hidden=true;panel.innerHTML='<svg class="ic"><use href="#i-search"/></svg><input id="searchBox" type="search" autocomplete="off" placeholder="Rechercher dans toutes tes notes…" aria-label="Recherche globale"/><button type="button" id="searchClose" aria-label="Fermer la recherche">✕</button>';
    document.body.append(panel);
    const input=$('searchBox'); const open=()=>{panel.hidden=false;input.value=state.query;input.focus();input.select();};
    const close=()=>{panel.hidden=true;};
    $('searchTrigger').addEventListener('click',open);$('searchClose').addEventListener('click',close);
    input.addEventListener('input',()=>{state.query=input.value;renderNotes();});
    document.addEventListener('keydown',(event)=>{
      if ((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();open();}
      if(event.key==='Escape')close();
    });
    document.addEventListener('pointerdown',e=>{if(!panel.hidden && !panel.contains(e.target) && !e.target.closest('#searchTrigger'))close();});
  }
  function setupTheme() {
    const current=localStorage.getItem('brain.v1.theme');document.body.dataset.theme=current==='dark'?'dark':'light';
    $('themeIcon').querySelector('use').setAttribute('href',current==='dark'?'#i-sun':'#i-moon');
    $('themeButton').addEventListener('click',()=>{const theme=document.body.dataset.theme==='dark'?'light':'dark';document.body.dataset.theme=theme;localStorage.setItem('brain.v1.theme',theme);$('themeIcon').querySelector('use').setAttribute('href',theme==='dark'?'#i-sun':'#i-moon');});
  }
  async function doLogin() {
    const password=$('passwordInput').value; if (!password) return;
    $('loginButton').disabled=true;$('loginError').textContent='';
    try { const response=await fetch(`${API_BASE}/api/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
      if (!response.ok) throw new Error(response.status===429?'Trop de tentatives. Réessaie plus tard.':response.status===401?'Mot de passe incorrect.':'Impossible de se connecter.');
      const result=await response.json();state.token=result.access_token;sessionStorage.setItem(TOKEN_KEY,state.token);$('passwordInput').value='';
      await reloadRemote();closeModal('loginOverlay');
      const legacy = getJSON(LOCAL_KEY, null);
      showToast(Array.isArray(legacy) && legacy.length ? 'Connecté au VPS ✓ · Anciennes notes disponibles dans Paramètres' : 'Connecté au VPS ✓');
    }catch(e){$('loginError').textContent=e.message;}finally{$('loginButton').disabled=false;}
  }
  function bindEvents() {
    $('captureButton').addEventListener('click',handleCapture);
    $('quickInput').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();handleCapture();}});
    $('mainNav').addEventListener('click',e=>{const btn=e.target.closest('[data-filter]');if(btn)setFilter(btn.dataset.filter);});
    document.querySelectorAll('[data-mobile-filter]').forEach(btn=>btn.addEventListener('click',()=>setFilter(btn.dataset.mobileFilter)));
    $('mobileCapture').addEventListener('click',()=>{$('quickInput').scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>$('quickInput').focus(),280);});
    $('mobileSettings').addEventListener('click',()=>showModal('settingsOverlay'));
    $('emptyNewButton').addEventListener('click',()=>{$('quickInput').scrollIntoView({behavior:'smooth',block:'center'});$('quickInput').focus();});
    $('notesGrid').addEventListener('click',e=>{const button=e.target.closest('[data-action]'),card=e.target.closest('[data-note-id]');if(!button||!card)return;if(button.dataset.action==='pin')togglePin(card.dataset.noteId);else openEditor(card.dataset.noteId);});
    $('sortSelect').addEventListener('change',e=>{state.sort=e.target.value;renderNotes();});
    for(const view of ['grid','list'])$(view+'Button').addEventListener('click',()=>{state.view=view;localStorage.setItem('brain.v1.view',view);renderNotes();});
    $('editorClose').addEventListener('click',()=>closeModal('editorOverlay'));
    $('saveEdit').addEventListener('click',saveEditor);$('editDelete').addEventListener('click',deleteEditor);
    $('editPin').addEventListener('click',()=>{state.editPinned=!state.editPinned;updateEditButtons();});
    $('editArchive').addEventListener('click',()=>{state.editArchived=!state.editArchived;updateEditButtons();});
    $('settingsButton').addEventListener('click',()=>showModal('settingsOverlay'));$('settingsClose').addEventListener('click',()=>closeModal('settingsOverlay'));
    $('addSpaceButton').addEventListener('click',()=>{showModal('spaceOverlay');$('spaceName').focus();});
    $('spaceClose').addEventListener('click',()=>closeModal('spaceOverlay'));$('spaceSave').addEventListener('click',addSpace);
    $('spaceName').addEventListener('keydown',e=>{if(e.key==='Enter')addSpace();});
    $('importLocalButton').addEventListener('click',importLocalNotes);
    $('exportButton').addEventListener('click',exportData);$('importButton').addEventListener('click',()=>$('importFile').click());$('importFile').addEventListener('change',e=>importData(e.target.files?.[0]));
    $('logoutButton').addEventListener('click',()=>{closeModal('settingsOverlay');endSession();});
    $('loginButton').addEventListener('click',doLogin);$('passwordInput').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
    for(const id of ['editorOverlay','settingsOverlay','spaceOverlay']) $(id).addEventListener('click',e=>{if(e.target===$(id))closeModal(id);});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){for(const id of ['editorOverlay','settingsOverlay','spaceOverlay'])closeModal(id);}});
  }
  function setupDate() { const date=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});$('todayChip').textContent=date.charAt(0).toUpperCase()+date.slice(1); }
  async function init() {
    setupDate();setupTheme();bindEvents();setupSearch();render();
    if(serverMode){
      if(state.token){try{await reloadRemote();}catch(e){if(state.token) showToast(e.message);}}
      else showLogin();
    }
  }
  init();
})();
