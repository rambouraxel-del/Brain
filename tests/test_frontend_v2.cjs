'use strict';
/* Zero-dependency contracts for Brain V2. The existing API tests continue to
 * cover persistence; these checks ensure that responsive UI controls stay wired. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const themes=fs.readFileSync('visual-themes.js','utf8');
const layout=fs.readFileSync('v2-layout.css','utf8');

function hasId(id) { return html.includes('id="'+id+'"'); }
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Duplicate HTML id');
const controls=[
  'quickNewNote','heroNewNote','heroExploreSpaces','spacesShowcase',
  'spacesGallery','spacesAllButton','filterStrip','mobileCapture',
  'mobileSpaces','mobileSpacesOverlay','mobileSpacesList','mobileSpacesClose',
  'mobileCreateSpace','mobileSearch','mobileSettings','notesGrid','quickInput',
  'captureButton','editorOverlay','saveEdit','editDelete','settingsOverlay',
  'loginOverlay','visualThemeSelect','visualModeSelect','appearancePreview'
];
for(const id of controls)assert.ok(hasId(id),'Missing UI control: '+id);
for(const value of ['all','pinned','inbox','archived']) {
  assert.ok(html.includes('data-quick-filter="'+value+'"'),'Missing quick filter '+value);
}
for(const name of ['visual-themes.css','v2-layout.css','visual-themes.js','app.js']) {
  assert.ok(html.includes('"'+name+'"'),'Missing linked asset '+name);
}
for(const id of ['spacesGallery','mobileSpacesList','mobileSpacesOverlay','quickNewNote','heroNewNote','mobileSearch','mobileSpaces']) {
  assert.ok(app.includes("'"+id+"'"),'UI control not connected in app.js: '+id);
}
for(const mark of ['function renderSpaceCards()', 'function storeNew(', 'function storeUpdate(', 'function storeDelete(', "api('/notes')", 'function doLogin(', 'function exportData(', 'function importData(']) {
  assert.ok(app.includes(mark),'Existing capability lost: '+mark);
}
assert.ok(layout.includes('@media(max-width:600px)'),'Missing small-mobile layout');
assert.ok(layout.includes('@media(min-width:1180px)'),'Missing desktop side-editor layout');

// Exercise the theme selector without a browser, including local persistence.
const stored=new Map();
const elements={};
for(const id of ['visualThemeSelect','visualModeSelect','appearancePreview','themeButton']) {
  elements[id]={value:'',textContent:'',listeners:{},addEventListener(event,fn){this.listeners[event]=fn;}};
}
const properties=new Map();
const doc={
  readyState:'complete',
  body:{dataset:{}},
  documentElement:{style:{setProperty:(name,value)=>properties.set(name,value)}},
  getElementById:id=>elements[id]||null
};
const sandbox={document:doc,localStorage:{
  getItem:key=>stored.has(key)?stored.get(key):null,
  setItem:(key,value)=>stored.set(key,value)
},encodeURIComponent,Array,String,JSON};
vm.runInNewContext(themes,sandbox,{filename:'visual-themes.js'});
assert.equal(doc.body.dataset.visualTheme,'archipel');
assert.equal(doc.body.dataset.theme,'light');
assert.ok(properties.get('--brain-scene').startsWith('url('));
elements.visualThemeSelect.value='foret';
elements.visualThemeSelect.listeners.change();
assert.equal(doc.body.dataset.visualTheme,'foret');
elements.visualModeSelect.value='night';
elements.visualModeSelect.listeners.change();
assert.equal(doc.body.dataset.theme,'dark');
assert.equal(JSON.parse(stored.get('brain.v2.appearance')).mode,'night');
assert.equal(JSON.parse(stored.get('brain.v2.appearance')).theme,'foret');
assert.ok(elements.appearancePreview.textContent.includes('Nuit'));
console.log('Brain V2 UI contracts, layout and theme persistence: OK');
