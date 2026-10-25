const q = async (params) => (await fetch('/w/api.php?origin=*&format=json&' + new URLSearchParams(params))).json();
window.__files = window.__files || {};
const cats = {grasset:'Category:La plante et ses applications ornementales', verneuil:"Category:Etude de la plante : son application aux industries d'art"};
for (const [k,c] of Object.entries(cats)) {
  if (window.__files[k]) continue;
  let all=[], cont={};
  do {
    const r = await q({action:'query', generator:'categorymembers', gcmtitle:c, gcmtype:'file', gcmlimit:50, prop:'imageinfo', iiprop:'url|size', iiurlwidth:150, ...cont});
    all = all.concat(Object.values(r.query?.pages||{}).map(p=>({t:p.title, w:p.imageinfo[0].width, h:p.imageinfo[0].height, thumb:p.imageinfo[0].thumburl, url:p.imageinfo[0].url})));
    cont = r.continue||{};
  } while (cont.gcmcontinue);
  all.sort((a,b)=>a.t.localeCompare(b.t));
  window.__files[k]=all;
}
const extra = ['File:Ivy (1901) by Alfons Mucha.jpg','File:Laurel (1901) by Alfons Mucha.jpg','File:Art Nouveau frame.svg',"File:Oiseaux et glycines, tenture. Lézards et lierre, bordure - L'animal dans la décoration, by M. P. Verneuil 1897 (digitally enhanced by Rawpixel).jpg"];
if (!window.__files.extra) { const r = await q({action:'query', titles: extra.join('|'), prop:'imageinfo', iiprop:'url|size', iiurlwidth: 300}); window.__files.extra = extra.map(t => { const p = Object.values(r.query.pages).find(p => p.title === t); return {t, w:p.imageinfo[0].width, h:p.imageinfo[0].height, thumb:p.imageinfo[0].thumburl, url:p.imageinfo[0].url}; }); }
document.body.innerHTML = '<div id="t" style="position:fixed;left:0;top:0;width:100vw;height:100vh;overflow:hidden;background:#000"></div>'; document.body.style.margin='0'; document.documentElement.style.overflow='hidden';
window.__prep = (key, idx, fx0, fy0, fx1, fy1, maxDim=1200) => new Promise((res, rej) => { const f = window.__files[key][idx]; const im = new Image(); im.crossOrigin='anonymous'; im.onload = () => { const sx=Math.round(fx0*im.naturalWidth), sy=Math.round(fy0*im.naturalHeight), sw=Math.round((fx1-fx0)*im.naturalWidth), sh=Math.round((fy1-fy0)*im.naturalHeight); const s=Math.min(1, maxDim/Math.max(sw,sh)); const cv=document.createElement('canvas'); cv.width=Math.round(sw*s); cv.height=Math.round(sh*s); cv.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, cv.width, cv.height); cv.style.cssText='position:absolute;left:0;top:0'; const t=document.getElementById('t'); t.innerHTML=''; t.appendChild(cv); window.__cv=cv; res([cv.width, cv.height, innerWidth, innerHeight, devicePixelRatio]); }; im.onerror = e => rej('load fail'); im.src = f.url.split('?')[0]; });
window.__tile = (x, y) => { window.__cv.style.left = (-x)+'px'; window.__cv.style.top = (-y)+'px'; return 'tile '+x+','+y; };
[Object.fromEntries(Object.entries(window.__files).map(([k,v])=>[k,v.length])), innerWidth, innerHeight, devicePixelRatio]
