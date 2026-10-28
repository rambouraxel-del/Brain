'use strict';
/* Integration smoke test using a DOM emulator. Runs with jsdom in GitHub CI.
 * No connection to the actual VPS is made; test stays in demo/local mode. */
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const themes=fs.readFileSync('visual-themes.js','utf8');

(async()=>{
  const dom=new JSDOM(html,{url:'https://example.test/Brain/',runScripts:'outside-only',pretendToBeVisual:true});
  const {window:w}=dom;
  w.BRAIN_CONFIG={apiBase:''};
  w.matchMedia=query=>({matches:query.includes('min-width')&&query.includes('1180'),media:query,addListener(){},removeListener(){}});
  w.scrollTo=()=>{};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  w.confirm=()=>true;
  w.eval(app);
  w.eval(themes);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded',{bubbles:true}));
  const $=id=>w.document.getElementById(id);
  const settle=()=>new Promise(resolve=>setTimeout(resolve,0));

  // Demo notes and spaces must render without external API calls.
  assert.equal($('notesGrid').querySelectorAll('.note-card').length,3);
  assert.ok($('spacesGallery').querySelectorAll('.space-art-card').length>=3);
  assert.ok($('mobileSpacesList').querySelectorAll('.mobile-space-entry').length>=3);

  $('heroNewNote').click();
  assert.ok($('quickCapture'));
  $('quickInput').value='Une nouvelle idée pour Brain V2';
  $('captureButton').click();
  await settle();
  assert.equal($('notesGrid').querySelectorAll('.note-card').length,4);
  assert.ok($('notesGrid').textContent.includes('Une nouvelle idée pour Brain V2'));

  const firstNote=$('notesGrid').querySelector('.note-card .note-click');
  firstNote.click();
  assert.equal($('editorOverlay').hidden,false);
  assert.ok(w.document.body.classList.contains('editor-side-open'),'Desktop editor should be a side panel');
  $('editTitle').value='Note révisée sur PC';
  $('saveEdit').click();
  await settle();
  assert.equal($('editorOverlay').hidden,true);
  assert.ok($('notesGrid').textContent.includes('Note révisée sur PC'));
  assert.ok(!w.document.body.classList.contains('editor-side-open'));

  $('mobileSpaces').click();
  assert.equal($('mobileSpacesOverlay').hidden,false);
  $('mobileSpacesList').querySelector('.mobile-space-entry').click();
  assert.equal($('mobileSpacesOverlay').hidden,true);
  assert.equal($('listTitle').textContent.includes('Projets'),true);

  $('mobileSearch').click();
  const box=$('searchBox');
  assert.ok(box);
  assert.equal(box.closest('.search-panel').hidden,false);
  box.value='indispensable-inexistant';
  box.dispatchEvent(new w.Event('input',{bubbles:true}));
  assert.equal($('notesGrid').querySelectorAll('.note-card').length,0);
  $('searchClose').click();

  // Reset search via the UI, then exercise fast filters.
  $('clearSearch').click();
  w.document.querySelector('[data-quick-filter="pinned"]').click();
  assert.ok($('notesGrid').querySelectorAll('.note-card').length>=1);
  w.document.querySelector('[data-quick-filter="all"]').click();

  $('visualThemeSelect').value='cosmos';
  $('visualThemeSelect').dispatchEvent(new w.Event('change',{bubbles:true}));
  $('visualModeSelect').value='night';
  $('visualModeSelect').dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(w.document.body.dataset.visualTheme,'cosmos');
  assert.equal(w.document.body.dataset.theme,'dark');
  assert.equal(JSON.parse(w.localStorage.getItem('brain.v2.appearance')).mode,'night');

  // Opening settings alongside a desktop note must not trap document scrolling.
  $('notesGrid').querySelector('.note-card .note-click').click();
  $('settingsButton').click();
  assert.equal(w.document.body.style.overflow,'hidden');
  $('settingsClose').click();
  assert.equal(w.document.body.style.overflow,'');
  $('editorClose').click();
  dom.window.close();

  // Repeat the editing path with the mobile breakpoint: use a modal, not a
  // desktop side pane, and unlock scrolling on close.
  const mobile=new JSDOM(html,{url:'https://example.test/Brain/',runScripts:'outside-only',pretendToBeVisual:true});
  const m=mobile.window;
  m.BRAIN_CONFIG={apiBase:''};
  m.matchMedia=query=>({matches:false,media:query,addListener(){},removeListener(){}});
  m.scrollTo=()=>{};
  m.HTMLElement.prototype.scrollIntoView=function(){};
  m.eval(app);
  m.eval(themes);
  m.document.dispatchEvent(new m.Event('DOMContentLoaded',{bubbles:true}));
  const mobileNote=m.document.querySelector('#notesGrid .note-card .note-click');
  assert.ok(mobileNote,'Mobile notes should render');
  mobileNote.click();
  assert.equal(m.document.getElementById('editorOverlay').hidden,false);
  assert.equal(m.document.body.classList.contains('editor-side-open'),false);
  assert.equal(m.document.body.style.overflow,'hidden');
  m.document.getElementById('editorClose').click();
  assert.equal(m.document.body.style.overflow,'');
  mobile.window.close();

  console.log('Brain V2 DOM smoke: capture, edit (PC/mobile), spaces, search, filters and themes OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
