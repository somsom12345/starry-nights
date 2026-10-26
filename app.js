"use strict";
const COVERS={rose:["#8E1F4B","#FBE4EE"],plum:["#3E2459","#EADCF7"],ink:["#1F2A44","#E3E8F5"],teal:["#0F5257","#D6F1EE"],forest:["#2F4A2A","#E2EFD9"],gold:["#C4912F","#2A1C05"],coral:["#D9634B","#2B0E07"],sky:["#9CC3E6","#102033"],blush:["#F2C6D3","#4A1428"]};
const STATUS={ongoing:"Ongoing",completed:"Completed",hiatus:"On hiatus"};
const MSTATUS={active:"Active",paused:"Paused",cancelled:"Cancelled"};
const DEFAULT_TIERS=["Bronze","Silver","Gold"];
const DEFAULT_NAME="Starry Nights Translation";
const DEFAULT_TAG="Romance, fantasy and everything in between.";
const S={books:[],members:[],links:{},config:{},counts:{},latest:{},hot:{},hotWin:7,updLimit:12,tocP:{},chaptersReady:true,homeReady:true,q:"",genres:new Set(),status:"all",access:"all",sort:"updated",
  canEdit:false,authReady:false,route:{name:""},seq:0,loaded:false,editBook:null,editMember:null,editChapter:null,cover:"rose",readerNav:{}};
const $=id=>document.getElementById(id);

function h(tag,attrs,...kids){const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(v==null||v===false)continue;if(k==="text")e.textContent=v;else if(k==="class")e.className=v;else if(k==="style")e.setAttribute("style",v);else if(k.startsWith("on"))e.addEventListener(k.slice(2),v);else e.setAttribute(k,v===true?"":v)}for(const c of kids.flat()){if(c==null||c===false)continue;e.append(c.nodeType?c:document.createTextNode(String(c)))}return e}
function toast(msg){const t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,2400)}
function tidyGenre(g){return g.trim().replace(/\s+/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
function parseGenres(s){const seen=new Map();for(const g of s.split(",")){const t=tidyGenre(g);if(t&&!seen.has(t.toLowerCase()))seen.set(t.toLowerCase(),t)}return[...seen.values()].slice(0,8)}
function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function fmtDate(s){if(!s)return"";const d=new Date(String(s).length===10?s+"T00:00:00":s);return isNaN(d)?s:d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}
function isUrl(s){return/^https?:\/\/\S+$/i.test(s||"")}
function tiers(){return Array.isArray(S.config.tiers)&&S.config.tiers.length?S.config.tiers:DEFAULT_TIERS}
function time(b){return Date.parse(b.created_at)||0}
function siteName(){return S.config.site_name||DEFAULT_NAME}
function chCount(b){return S.counts[b.id]||b.chapters||0}
function num(n){return String(+n)}
function words(t){const m=(t||"").trim().match(/\S+/g);return m?m.length:0}
function emptyBox(t,p){return h("div",{class:"empty"},h("h3",{text:t}),p?h("p",{text:p}):null)}
function backLink(label,hash){return h("a",{class:"back",href:"#"+hash},"← ",label)}
function ago(s){const t=Date.parse(s);if(!t)return"";const d=Math.max(0,(Date.now()-t)/1000);if(d<60)return"just now";
  for(const[n,l]of [[31536000,"y"],[2592000,"mo"],[604800,"w"],[86400,"d"],[3600,"h"],[60,"m"]])if(d>=n)return Math.floor(d/n)+l+" ago"}
function kfmt(n){n=+n||0;return n>=1e6?(n/1e6).toFixed(1).replace(/\.0$/,"")+"M":n>=1e3?(n/1e3).toFixed(1).replace(/\.0$/,"")+"k":String(n)}
function lastUpd(b){return S.latest[b.id]?.[0]?.created_at||""}
function updTime(b){return Date.parse(lastUpd(b))||0}
function thumb(b){if(b.cover_url)return h("img",{class:"thumb",src:b.cover_url,alt:"",loading:"lazy"});const c=COVERS[b.cover]||COVERS.rose;
  return h("span",{class:"thumb",style:`background:${c[0]};color:${c[1]}`,"aria-hidden":"true",text:(b.title||"?").trim().charAt(0).toUpperCase()})}
function linkify(text){const out=[];const re=/https?:\/\/[^\s<>"]+/g;let last=0,m;while((m=re.exec(text))){if(m.index>last)out.push(text.slice(last,m.index));const u=m[0].replace(/[.,!?)]+$/,"");
  out.push(h("a",{href:u,target:"_blank",rel:"noopener",text:u.replace(/^https?:\/\/(www\.)?/,"")}));last=m.index+u.length}if(last<text.length)out.push(text.slice(last));return out}
const LS={get(k,d){try{const v=localStorage.getItem("sn:"+k);return v==null?d:JSON.parse(v)}catch{return d}},set(k,v){try{localStorage.setItem("sn:"+k,JSON.stringify(v))}catch{}},del(k){try{localStorage.removeItem("sn:"+k)}catch{}}};

/* ---------- Supabase ---------- */
const CFG=window.SN_CONFIG||{};
const configured=isUrl(CFG.url)&&CFG.key&&!/PASTE_/.test(CFG.key);
const sb=configured&&window.supabase?window.supabase.createClient(CFG.url,CFG.key):null;

async function loadPublic(){
  const [b,c,n,l]=await Promise.all([sb.from("books").select("*").order("created_at",{ascending:false}),sb.from("site_config").select("*").eq("id",1).maybeSingle(),sb.from("chapter_counts").select("*"),
    sb.from("latest_chapters").select("*").order("number",{ascending:false}).range(0,2999)]);
  if(b.error)throw b.error;
  S.books=b.data||[];S.config=c.data||{};
  S.chaptersReady=!n.error;S.counts=n.error?{}:Object.fromEntries((n.data||[]).map(r=>[r.book_id,r.n]));
  S.homeReady=!l.error;S.latest={};for(const r of (l.error?[]:l.data||[]))(S.latest[r.book_id]||=[]).push(r);
  S.loaded=true;applyConfig();
}
async function loadPrivate(){
  if(!S.canEdit){S.members=[];S.links={};return}
  const [m,l]=await Promise.all([sb.from("members").select("*"),sb.from("private_links").select("*")]);
  S.members=m.data||[];S.links=Object.fromEntries((l.data||[]).map(r=>[r.book_id,r.url]));
}
async function refresh(){try{await loadPublic();await loadPrivate()}catch(e){console.error(e);showNotice("Couldn't load the library. Refresh the page to try again.")}rerender()}
async function checkOwner(){const {data:{session}}=await sb.auth.getSession();if(!session)return false;const {data,error}=await sb.rpc("is_owner");return !error&&data===true}
function loadToc(bookId,force){
  if(!force&&S.tocP[bookId])return S.tocP[bookId];
  const p=(async()=>{const out=[];
    for(let from=0;;from+=1000){const r=await sb.from("chapters").select("id,book_id,number,title,words,published,created_at,updated_at").eq("book_id",bookId).order("number",{ascending:true}).range(from,from+999);
      if(r.error)throw r.error;out.push(...r.data);if(r.data.length<1000)break}
    return out})();
  S.tocP[bookId]=p;p.catch(()=>{delete S.tocP[bookId]});return p}

function showNotice(text){$("notice").replaceChildren(h("div",{class:"banner",text}))}

/* ---------- Covers & bits ---------- */
function cover(b,big){const c=COVERS[b.cover]||COVERS.rose;const box=h("div",{class:"covbox"});
  const el=b.cover_url?h("div",{class:"cover has-img",style:`--cv-bg:${c[0]};--cv-fg:${c[1]}`},h("img",{src:b.cover_url,alt:"Cover of "+(b.title||"this book"),loading:"lazy",decoding:"async"}))
   :h("div",{class:"cover",style:`--cv-bg:${c[0]};--cv-fg:${c[1]}`},
    h("span",{class:"cg",text:(b.genres||[]).slice(0,2).join(" · ")||"Novel"}),
    h("span",{class:"ct",text:b.title||"Untitled"}),
    h("span",{class:"ca",text:b.author||" "}));
  if(b.access==="members"&&!S.counts[b.id])el.append(h("span",{class:"lock",text:"Members"}));
  if(b.featured&&!big)el.append(h("span",{class:"star",text:"★"}));
  box.append(el);return box}
function pill(kind,label){return h("span",{class:"pill p-"+kind,text:label})}

/* ---------- Library ---------- */
function filtered(){const q=S.q.trim().toLowerCase();const list=S.books.filter(b=>{
  if(S.status!=="all"&&b.status!==S.status)return false;
  if(S.access!=="all"&&b.access!==S.access)return false;
  for(const g of S.genres)if(!(b.genres||[]).some(x=>x.toLowerCase()===g))return false;
  if(q){const hay=[b.title,b.author,(b.genres||[]).join(" "),b.synopsis].join(" ").toLowerCase();if(!q.split(/\s+/).every(w=>hay.includes(w)))return false}
  return true});
  const by={updated:(a,b)=>updTime(b)-updTime(a)||time(b)-time(a),new:(a,b)=>time(b)-time(a),az:(a,b)=>(a.title||"").localeCompare(b.title||""),chapters:(a,b)=>chCount(b)-chCount(a)}[S.sort];
  return list.sort(by)}
function genreCounts(){const m=new Map();for(const b of S.books)for(const g of b.genres||[]){const k=g.toLowerCase();const e=m.get(k)||{label:g,n:0};e.n++;m.set(k,e)}return[...m.entries()].sort((a,b)=>b[1].n-a[1].n||a[1].label.localeCompare(b[1].label))}
function card(b,rank){const n=chCount(b);const cv=cover(b);
  if(rank)cv.querySelector(".cover").append(h("span",{class:"rankb",text:"#"+rank}));
  const lt=S.latest[b.id]?.[0];
  return h("a",{class:"card",href:"#book/"+b.id,"aria-label":`${b.title}${b.author?" by "+b.author:""}`},
  cv,lt?h("span",{class:"cmeta"},h("span",{text:"Ch. "+num(lt.number)}),h("span",{text:ago(lt.created_at)})):null,
  h("span",{class:"t",text:b.title}),b.author?h("span",{class:"a",text:b.author}):null,
  h("span",{class:"meta"},pill(b.status||"ongoing",STATUS[b.status]||"Ongoing"),n?h("span",{class:"mono",text:n+" ch"}):null))}
function renderLibrary(){
  $("rail").replaceChildren(h("button",{type:"button",class:"chip","aria-pressed":String(S.genres.size===0),onclick:()=>{S.genres.clear();renderLibrary()}},"All genres"),
    ...genreCounts().map(([k,v])=>h("button",{type:"button",class:"chip","aria-pressed":String(S.genres.has(k)),onclick:()=>{S.genres.has(k)?S.genres.delete(k):S.genres.add(k);renderLibrary()}},v.label,h("span",{class:"n",text:v.n}))));
  const active=!!(S.q.trim()||S.genres.size||S.status!=="all"||S.access!=="all");
  $("clear").hidden=!active;
  const list=filtered();$("grid").replaceChildren(...list.map(card));
  $("count").textContent=!S.loaded?"Loading the shelf":`${list.length} ${list.length===1?"book":"books"}${active?" match":""}`;
  const em=$("libEmpty");em.hidden=!(S.loaded&&!list.length);
  if(!em.hidden)em.replaceChildren(emptyBox(S.books.length?"Nothing matches yet":"The shelf is empty",
    S.books.length?"Try fewer genres or a shorter search.":(S.canEdit?"Open the Dashboard and add your first book.":"New books are on the way. Check back soon.")));
}

/* ---------- Home ---------- */
function carousel(stripId,books,ranked){const el=$(stripId);el.replaceChildren(...books.map((b,i)=>card(b,ranked?i+1:0)));el.scrollLeft=0}
function updCard(b){const ch=S.latest[b.id]||[];
  return h("article",{class:"ucard"},h("a",{class:"ucov",href:"#book/"+b.id,tabindex:"-1","aria-hidden":"true"},cover(b,true)),
    h("div",{class:"ubody"},h("a",{class:"ut",href:"#book/"+b.id,text:b.title}),
      ch.length?h("ul",{class:"uch"},...ch.map(c=>h("li",{},h("a",{href:"#read/"+c.id,text:"Ch. "+num(c.number)+(c.title?" · "+c.title:"")}),h("span",{class:"ago",text:ago(c.created_at)}))))
        :h("p",{class:"note",style:"margin:8px 0 0",text:b.status==="completed"?"Completed":"Chapters coming soon"})))}
function rankRow(b,i,sub){return h("li",{},h("a",{href:"#book/"+b.id},i?h("span",{class:"rn",text:i}):null,thumb(b),
  h("span",{class:"rb"},h("span",{class:"re",text:(b.genres||[])[0]||"Novel"}),h("span",{class:"rt",text:b.title}),h("span",{class:"rs",text:sub}))))}
async function loadHot(days){if(S.hot[days])return S.hot[days];
  const r=await sb.rpc("popular_books",{p_days:days});if(r.error)throw r.error;S.hot[days]=r.data||[];return S.hot[days]}
async function drawHot(seq){const tabs=$("hotTabs");
  tabs.replaceChildren(...[[1,"Today"],[7,"This week"],[30,"This month"]].map(([d,t])=>h("button",{type:"button","aria-pressed":String(S.hotWin===d),text:t,onclick:()=>{S.hotWin=d;LS.set("hotWin",d);drawHot(S.seq)}})));
  const list=$("hotList");let rows=null;
  try{rows=await loadHot(S.hotWin)}catch(e){console.warn(e)}
  if(seq!==S.seq)return;
  const byId=Object.fromEntries(S.books.map(b=>[b.id,b]));
  const ranked=(rows||[]).map(r=>({b:byId[r.book_id],v:r.views})).filter(x=>x.b).slice(0,10);
  if(ranked.length){$("hotNote").textContent="";list.replaceChildren(...ranked.map((x,i)=>rankRow(x.b,i+1,kfmt(x.v)+" reads")))}
  else{$("hotNote").textContent=rows?"no reads yet":"";
    const fb=[...S.books].sort((a,b)=>updTime(b)-updTime(a)||time(b)-time(a)).slice(0,5);
    list.replaceChildren(h("li",{class:"note rnote",text:rows?"Rankings fill in as people read. Recently updated for now:":"Run update-home.sql in Supabase to turn on rankings. Recently updated for now:"}),...fb.map((b,i)=>rankRow(b,i+1,lastUpd(b)?"updated "+ago(lastUpd(b)):chCount(b)+" chapters")))}}
async function renderHome(seq){
  const ann=(S.config.announcement||"").split("\n").map(x=>x.trim()).filter(Boolean);
  $("announce").replaceChildren(...(ann.length?[h("div",{class:"announce"},h("p",{class:"eyebrow",style:"margin:0",text:"Announcements"}),h("ul",{},...ann.map(a=>h("li",{},...linkify(a)))))]:[]));
  if(!S.loaded){$("updates").replaceChildren(h("p",{class:"count",text:"Loading the shelf"}));return}
  if(!S.books.length){$("featSec").hidden=true;$("doneSec").hidden=true;$("moreUpdates").hidden=true;
    $("updates").replaceChildren(emptyBox("The shelf is empty",S.canEdit?"Open the Dashboard and add your first book.":"New books are on the way. Check back soon."));
    $("hotList").replaceChildren();$("recentList").replaceChildren();return}
  // Featured, else popular this week, else newest
  let feat=S.books.filter(b=>b.featured),title="Featured",ranked=false;
  if(!feat.length){let wk=[];try{wk=await loadHot(7)}catch{}if(seq!==S.seq)return;const byId=Object.fromEntries(S.books.map(b=>[b.id,b]));
    feat=wk.map(r=>byId[r.book_id]).filter(Boolean).slice(0,10);title="Popular this week";ranked=true;
    if(!feat.length){feat=[...S.books].sort((a,b)=>time(b)-time(a)).slice(0,10);title="New on the shelf";ranked=false}}
  $("featTitle").textContent=title;$("featSec").hidden=!feat.length;carousel("featStrip",feat,ranked);
  const ups=[...S.books].sort((a,b)=>updTime(b)-updTime(a)||time(b)-time(a));
  $("updates").replaceChildren(...ups.slice(0,S.updLimit).map(updCard));$("moreUpdates").hidden=ups.length<=S.updLimit;
  const done=S.books.filter(b=>b.status==="completed");$("doneSec").hidden=done.length<2;carousel("doneStrip",done,false);
  $("recentList").replaceChildren(...[...S.books].sort((a,b)=>time(b)-time(a)).slice(0,6).map(b=>rankRow(b,0,(chCount(b)?chCount(b)+" ch · ":"")+"added "+ago(b.created_at))));
  drawHot(seq)}
$("moreUpdates").addEventListener("click",()=>{S.updLimit+=12;renderHome(S.seq)});
for(const btn of document.querySelectorAll("[data-scroll]"))btn.addEventListener("click",()=>{const strip=btn.closest(".hsec").querySelector(".carousel");strip.scrollBy({left:+btn.dataset.scroll*strip.clientWidth*.9,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})});
$("recentAll").addEventListener("click",()=>{S.sort="new";$("fSort").value="new"});

/* ---------- Header search ---------- */
function matches(q){q=q.trim().toLowerCase();if(!q)return[];const ws=q.split(/\s+/);
  return S.books.map(b=>{const t=(b.title||"").toLowerCase();const hay=[t,b.author,(b.genres||[]).join(" ")].join(" ").toLowerCase();
    if(!ws.every(w=>hay.includes(w)))return null;return{b,score:t.startsWith(q)?0:t.includes(q)?1:2}}).filter(Boolean).sort((x,y)=>x.score-y.score||updTime(y.b)-updTime(x.b)).map(x=>x.b)}
let hsel=-1;
function closeResults(){$("hresults").hidden=true;$("hq").setAttribute("aria-expanded","false");hsel=-1}
function drawResults(){const q=$("hq").value;const box=$("hresults");
  if(S.route.name==="browse"||!q.trim()){closeResults();return}
  const all=matches(q);hsel=-1;
  box.replaceChildren(...(all.length?all.slice(0,6).map(b=>h("a",{class:"hres",href:"#book/"+b.id,role:"option",onclick:closeResults},thumb(b),
      h("span",{class:"rb"},h("span",{class:"rt",text:b.title}),h("span",{class:"rs",text:[b.author,(b.genres||[]).slice(0,2).join(", "),chCount(b)?chCount(b)+" ch":""].filter(Boolean).join(" · ")}))))
    :[h("p",{class:"hnone",text:"No books match “"+q.trim()+"”."})]),
    all.length?h("a",{class:"hall",href:"#browse",onclick:closeResults,text:all.length>6?`See all ${all.length} results →`:"Open in Browse →"}):null);
  box.hidden=false;$("hq").setAttribute("aria-expanded","true")}
$("hq").addEventListener("input",e=>{S.q=e.target.value;if(S.route.name==="browse")renderLibrary();else drawResults()});
$("hq").addEventListener("focus",drawResults);
$("hq").addEventListener("keydown",e=>{const opts=[...$("hresults").querySelectorAll("a")];
  if(e.key==="Escape"){closeResults();return}
  if((e.key==="ArrowDown"||e.key==="ArrowUp")&&!$("hresults").hidden&&opts.length){e.preventDefault();hsel=(hsel+(e.key==="ArrowDown"?1:-1)+opts.length)%opts.length;opts.forEach((o,i)=>o.classList.toggle("on",i===hsel));return}
  if(e.key==="Enter"){e.preventDefault();if(hsel>=0&&opts[hsel]){location.hash=opts[hsel].getAttribute("href").slice(1);closeResults()}else{closeResults();go("browse")}}});
document.addEventListener("click",e=>{if(!e.target.closest("#hsearch"))closeResults()});

/* ---------- Theme ---------- */
function siteTheme(){return LS.get("siteTheme","dark")}
function applyTheme(){const rp=readerPrefs().theme;const t=S.route.name==="read"&&rp!=="auto"?rp:siteTheme();document.documentElement.setAttribute("data-theme",t);
  const dark=siteTheme()==="dark";const icon=dark?'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>':'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
  for(const b of document.querySelectorAll(".themebtn")){b.innerHTML=icon;b.setAttribute("aria-label",dark?"Switch to light theme":"Switch to dark theme");b.title=b.getAttribute("aria-label")}}
for(const b of document.querySelectorAll(".themebtn"))b.addEventListener("click",()=>{LS.set("siteTheme",siteTheme()==="dark"?"light":"dark");applyTheme()});

/* ---------- Book page ---------- */
async function renderBook(id,seq){
  const el=$("bookPage");
  if(!S.loaded){el.replaceChildren(h("p",{class:"count pad",text:"Loading"}));return}
  const b=S.books.find(x=>x.id===id);
  if(!b){el.replaceChildren(h("div",{class:"pagehead"},backLink("Home","")),emptyBox("Book not found","It may have been removed or renamed."));return}
  document.title=b.title+" · "+siteName();
  const acts=h("div",{class:"actions"},h("span",{class:"note",text:"Loading chapters…"}));
  const tocBox=h("div",{class:"tocwrap"});
  const n=chCount(b);
  el.replaceChildren(h("div",{class:"pagehead"},backLink("Home","")),
    h("div",{class:"detail"},cover(b,true),h("div",{style:"min-width:0"},h("h2",{text:b.title}),b.author?h("p",{class:"by",text:"by "+b.author}):null,
      h("div",{class:"tags"},...(b.genres||[]).map(g=>h("span",{class:"tag",text:g}))),
      h("dl",{class:"facts"},h("div",{},h("dt",{text:"Status"}),h("dd",{},pill(b.status||"ongoing",STATUS[b.status]||"Ongoing"))),h("div",{},h("dt",{text:"Chapters"}),h("dd",{class:"mono",style:"color:var(--ink);font-size:15px",text:n||"–"}))),
      b.synopsis?h("p",{class:"syn",text:b.synopsis}):h("p",{class:"syn note",text:"No synopsis yet."}),acts)),tocBox);
  let all=null;try{all=await loadToc(id)}catch(e){console.warn(e)}
  if(seq!==S.seq)return;
  const toc=(all||[]).filter(c=>c.published);
  const join=S.config.join_url;acts.replaceChildren();
  if(toc.length){
    const last=LS.get("last:"+id,null);const lastCh=last&&toc.find(c=>c.id===last.id);
    if(lastCh){acts.append(h("a",{class:"btn primary",href:"#read/"+lastCh.id,text:"Continue · Ch. "+num(lastCh.number)}),h("a",{class:"btn",href:"#read/"+toc[0].id,text:"Start from Ch. "+num(toc[0].number)}))}
    else acts.append(h("a",{class:"btn primary",href:"#read/"+toc[0].id,text:"Start reading"}));
    if(toc.length>1&&toc.at(-1).id!==lastCh?.id)acts.append(h("a",{class:"btn",href:"#read/"+toc.at(-1).id,text:"Latest · Ch. "+num(toc.at(-1).number)}));
    if(isUrl(join))acts.append(h("a",{class:"linkbtn",href:join,target:"_blank",rel:"noopener",text:/patreon/i.test(join)?"Support us on Patreon":"Support us"}));
  }else if(b.access==="members"){
    if(isUrl(join))acts.append(h("a",{class:"btn primary",href:join,target:"_blank",rel:"noopener",text:"Join to read"}));
    acts.append(h("span",{class:"note",text:"This book is for paid members."}));
  }else if(isUrl(b.read_url))acts.append(h("a",{class:"btn primary",href:b.read_url,target:"_blank",rel:"noopener",text:"Start reading"}));
  else acts.append(h("span",{class:"note",text:"Chapters coming soon."}));
  if(S.canEdit)acts.append(h("a",{class:"btn",href:"#admin/chapters/"+id,text:"Manage chapters"}),h("button",{type:"button",class:"btn",text:"Edit book",onclick:()=>openBookForm(id)}));
  if(!toc.length){tocBox.replaceChildren();return}
  const last=LS.get("last:"+id,null);
  let desc=LS.get("tocDesc",false);
  const list=h("div",{class:"toc"});
  const draw=()=>{const items=desc?[...toc].reverse():toc;
    list.replaceChildren(...items.map(c=>h("a",{class:"tocrow"+(last?.id===c.id?" last":""),href:"#read/"+c.id},
      h("span",{class:"tn",text:num(c.number)}),h("span",{class:"tt",text:c.title||"Chapter "+num(c.number)}),h("span",{class:"td",text:fmtDate(c.created_at)}))));
    sortBtn.textContent=desc?"Newest first":"Oldest first"};
  const sortBtn=h("button",{type:"button",class:"btn sm",onclick:()=>{desc=!desc;LS.set("tocDesc",desc);draw()}});
  const jump=toc.length>20?h("form",{class:"jump",onsubmit:e=>{e.preventDefault();const v=+jump.querySelector("input").value;const c=toc.find(x=>+x.number===v)||toc.find(x=>+x.number>=v);if(c)go("read/"+c.id);else toast("No chapter "+v+" yet")}},
    h("input",{type:"number",min:"0",step:"any",placeholder:"Go to ch.","aria-label":"Go to chapter number",id:"tocJump"}),h("button",{type:"submit",class:"btn sm",text:"Go"})):null;
  tocBox.replaceChildren(h("div",{class:"tochead"},h("h2",{},"Chapters ",h("span",{class:"mono",text:toc.length})),h("div",{class:"tools"},jump,sortBtn)),list);
  draw();
}

/* ---------- Reader ---------- */
function inline(s){const out=[];const re=/\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;let last=0,m;
  while((m=re.exec(s))){if(m.index>last)out.push(s.slice(last,m.index));out.push(m[1]!=null?h("strong",{text:m[1]}):h("em",{text:m[2]}));last=re.lastIndex}
  if(last<s.length)out.push(s.slice(last));return out}
function renderBody(text){
  const t=(text||"").replace(/\r\n?/g,"\n").trim();
  let paras=t.split(/\n[ \t]*\n/);
  if(paras.length===1&&t.includes("\n"))paras=t.split("\n");
  return paras.map(p=>p.trim()).filter(Boolean).map(p=>/^([*\-_~=#◇◆•✦]\s*){3,}$/.test(p)?h("hr",{class:"scene"}):h("p",{},...inline(p)))}
function readerPrefs(){return Object.assign({size:19,font:"serif",theme:"auto"},LS.get("reader",{}))}
function applyReaderPrefs(on){const p=readerPrefs();const r=$("reader");
  r.style.setProperty("--r-size",p.size+"px");r.classList.toggle("sans",p.font==="sans");
  applyTheme()}
function setPref(k,v){const p=readerPrefs();p[k]=v;LS.set("reader",p);applyReaderPrefs(true);drawSettings()}
function drawSettings(){const box=$("rset");if(!box)return;const p=readerPrefs();
  const seg=(label,key,opts)=>h("div",{class:"setrow"},h("span",{class:"lbl",text:label}),h("div",{class:"seg"},...opts.map(([v,t])=>h("button",{type:"button","aria-pressed":String(p[key]===v),text:t,onclick:()=>setPref(key,v)}))));
  box.replaceChildren(
    h("div",{class:"setrow"},h("span",{class:"lbl",text:"Text size"}),h("div",{class:"seg"},
      h("button",{type:"button","aria-label":"Smaller text",text:"A−",onclick:()=>setPref("size",Math.max(14,p.size-1))}),
      h("span",{class:"mono",style:"padding:0 10px;align-self:center",text:p.size}),
      h("button",{type:"button","aria-label":"Larger text",text:"A+",onclick:()=>setPref("size",Math.min(28,p.size+1))}))),
    seg("Font","font",[["serif","Serif"],["sans","Sans"]]),
    seg("Theme","theme",[["auto","Site"],["light","Light"],["sepia","Sepia"],["dark","Dark"]]))}
async function renderReader(id,seq){
  const el=$("reader");
  el.replaceChildren(h("p",{class:"count pad",text:"Loading chapter"}));
  const r=await sb.from("chapters").select("*").eq("id",id).maybeSingle();
  if(seq!==S.seq)return;
  if(r.error||!r.data){el.replaceChildren(h("div",{class:"pagehead"},backLink("Home","")),emptyBox("Chapter not available","It may have been moved, or it isn't published yet."));return}
  const c=r.data;const b=S.books.find(x=>x.id===c.book_id)||{id:c.book_id,title:"Back to book"};
  let toc=[];try{toc=await loadToc(c.book_id)}catch(e){console.warn(e)}
  if(seq!==S.seq)return;
  const nav=toc.filter(x=>x.published||x.id===c.id);if(!nav.some(x=>x.id===c.id))nav.push(c);nav.sort((a,b)=>a.number-b.number);
  const i=nav.findIndex(x=>x.id===c.id);const prev=nav[i-1],next=nav[i+1];S.readerNav={prev,next};
  if(c.published){LS.set("last:"+c.book_id,{id:c.id,number:c.number});
    const vk="v:"+c.id+":"+today();if(!S.canEdit&&!LS.get(vk,false)){LS.set(vk,true);sb.rpc("record_view",{p_book:c.book_id}).then(()=>{},()=>{})}}
  document.title=`Ch. ${num(c.number)}${c.title?": "+c.title:""} · ${b.title}`;
  const navBar=()=>h("nav",{class:"rnav","aria-label":"Chapter navigation"},
    prev?h("a",{class:"btn",href:"#read/"+prev.id,rel:"prev"},"← Previous"):h("span",{class:"btn ghost","aria-hidden":"true"},"← Previous"),
    h("a",{class:"btn",href:"#book/"+b.id,text:"Contents"}),
    next?h("a",{class:"btn primary",href:"#read/"+next.id,rel:"next"},"Next →"):h("span",{class:"note",text:"You're all caught up"}));
  const setBox=h("div",{class:"rset",id:"rset",hidden:true});
  const setBtn=h("button",{type:"button",class:"btn sm","aria-expanded":"false","aria-controls":"rset",text:"Aa",title:"Reading settings",onclick:()=>{setBox.hidden=!setBox.hidden;setBtn.setAttribute("aria-expanded",String(!setBox.hidden))}});
  el.replaceChildren(
    h("div",{class:"rtop"},h("a",{class:"back",href:"#book/"+b.id},"← ",h("span",{class:"rbk",text:b.title})),
      h("div",{class:"rtools"},h("select",{class:"rjump","aria-label":"Jump to chapter",onchange:e=>go("read/"+e.target.value)},
        ...nav.map(x=>h("option",{value:x.id,selected:x.id===c.id?true:null,text:"Ch. "+num(x.number)+(x.title?" · "+x.title:"")+(x.published?"":" (draft)")}))),setBtn)),
    setBox,
    h("article",{class:"chapter"},
      h("h2",{class:"rtitle"},h("span",{class:"rnum",text:"Chapter "+num(c.number)}),c.title?h("span",{text:c.title}):null),
      c.published?null:h("p",{class:"banner",text:"Draft: only you can see this chapter."}),
      h("div",{class:"chapter-body"},...renderBody(c.content))),
    navBar());
  drawSettings();
  if(S.canEdit)el.querySelector(".rtools").append(h("button",{type:"button",class:"btn sm",text:"Edit",onclick:()=>openChapterForm(c.book_id,c.id)}));
}
document.addEventListener("keydown",e=>{if(S.route.name!=="read"||e.altKey||e.ctrlKey||e.metaKey||document.querySelector("dialog[open]")||/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName||""))return;
  if(e.key==="ArrowLeft"&&S.readerNav.prev)go("read/"+S.readerNav.prev.id);if(e.key==="ArrowRight"&&S.readerNav.next)go("read/"+S.readerNav.next.id)});
for(const ev of ["copy","cut","contextmenu","dragstart"])document.addEventListener(ev,e=>{if(!S.canEdit&&e.target?.closest?.(".chapter-body"))e.preventDefault()});

/* ---------- Chapter editor ---------- */
function draftKey(){const e=S.editChapter;return e?"draft:"+e.bookId+":"+(e.id||"new"):null}
function updWords(){$("chWords").textContent=words($("chBody").value).toLocaleString()+" words"}
let draftT;
function saveDraftSoon(){clearTimeout(draftT);draftT=setTimeout(()=>{const k=draftKey();if(k&&S.editChapter.dirty)LS.set(k,{num:$("chNum").value,title:$("chTitle").value,body:$("chBody").value})},500)}
for(const id of ["chNum","chTitle","chBody"])$(id).addEventListener("input",()=>{if(S.editChapter)S.editChapter.dirty=true;if(id==="chBody")updWords();saveDraftSoon()});
function fillBookSel(bookId,lock){const sel=$("chBookSel");
  sel.replaceChildren(...[...S.books].sort((a,b)=>(a.title||"").localeCompare(b.title||"")).map(b=>h("option",{value:b.id,text:b.title,selected:b.id===bookId?true:null})));sel.disabled=!!lock}
$("chBookSel").addEventListener("change",async e=>{const e2=S.editChapter;if(!e2||e2.id)return;e2.bookId=e.target.value;let toc=[];try{toc=await loadToc(e2.bookId)}catch{}
  $("chNum").value=toc.length?Math.floor(Math.max(...toc.map(x=>+x.number)))+1:1});
async function openChapterForm(bookId,id){
  if(!S.chaptersReady){toast("Run update-chapters.sql in Supabase first");return}
  if(!S.books.length){toast("Add a novel first");return}
  if(!bookId||!S.books.some(b=>b.id===bookId))bookId=S.books[0].id;
  let c=null;
  if(id){const r=await sb.from("chapters").select("*").eq("id",id).maybeSingle();if(r.error||!r.data){toast("Couldn't open that chapter");return}c=r.data}
  let toc=[];try{toc=await loadToc(bookId)}catch{}
  const next=toc.length?Math.floor(Math.max(...toc.map(x=>+x.number)))+1:1;
  S.editChapter={bookId,id:id||null,dirty:false};
  $("chDlgTitle").textContent=c?"Edit chapter":"Add chapter";fillBookSel(bookId,!!c);
  $("chNum").value=c?num(c.number):next;$("chTitle").value=c?.title||"";$("chBody").value=c?.content||"";$("chPub").checked=c?!!c.published:true;
  $("chErr").textContent="";$("chSaveNext").hidden=!!c;
  const d=LS.get(draftKey(),null);
  if(d&&(d.body||"")!==($("chBody").value||"")){$("chNum").value=d.num||$("chNum").value;$("chTitle").value=d.title||"";$("chBody").value=d.body||"";S.editChapter.dirty=true;$("chErr").textContent="Restored your unsaved text.";}
  updWords();$("chapterDlg").showModal();(c||d?$("chBody"):$("chTitle")).focus()}
async function saveChapter(addNext){
  const e=S.editChapter;if(!e)return;const err=$("chErr");err.textContent="";
  const n=parseFloat($("chNum").value),body=$("chBody").value.replace(/\r\n?/g,"\n").trim();
  if(!Number.isFinite(n)||n<0){err.textContent="Add a chapter number, like 12 or 12.5.";$("chNum").focus();return}
  if(!body){err.textContent="Paste the chapter text before saving.";$("chBody").focus();return}
  const row={book_id:e.bookId,number:n,title:$("chTitle").value.trim(),content:body,words:words(body),published:$("chPub").checked,updated_at:new Date().toISOString()};
  for(const b of [$("chSave"),$("chSaveNext")])b.disabled=true;
  try{const r=e.id?await sb.from("chapters").update(row).eq("id",e.id):await sb.from("chapters").insert(row);
    if(r.error)throw r.error;
    LS.del(draftKey());toast(e.id?"Chapter updated":"Chapter "+num(n)+" saved");
    await loadToc(e.bookId,true);
    if(addNext){S.editChapter={bookId:e.bookId,id:null,dirty:false};$("chNum").value=Math.floor(n)+1;$("chTitle").value="";$("chBody").value="";updWords();$("chTitle").focus();
      $("chDlgTitle").textContent="Add chapter";}
    else{S.editChapter=null;$("chapterDlg").close()}
    await refresh();
    if(S.route.name==="read"&&!addNext)route()}
  catch(x){console.error(x);err.textContent=x?.code==="23505"?"Chapter "+num(n)+" already exists in this book. Use a different number or edit that chapter.":"Couldn't save. Check you're still logged in, then try again."}
  finally{for(const b of [$("chSave"),$("chSaveNext")])b.disabled=false}}
$("chapterForm").addEventListener("submit",ev=>{ev.preventDefault();saveChapter(false)});
$("chSaveNext").addEventListener("click",()=>saveChapter(true));
$("chapterDlg").addEventListener("close",()=>{S.editChapter=null});
async function deleteChapter(bookId,id){const r=await sb.from("chapters").delete().eq("id",id);toast(r.error?"Couldn't delete that chapter":"Chapter deleted");await loadToc(bookId,true).catch(()=>{});await refresh()}

/* Keep bold/italics when pasting from Google Docs or Word */
function htmlToText(html){
  const doc=new DOMParser().parseFromString(html,"text/html");const BLOCK=/^(P|DIV|H[1-6]|LI|BLOCKQUOTE|TR|SECTION|ARTICLE)$/;let out="";
  const walk=(n,b,i)=>{
    if(n.nodeType===3){out+=n.nodeValue.replace(/[ \t\r\n]+/g," ");return}
    if(n.nodeType!==1)return;const tag=n.tagName;if(/^(STYLE|SCRIPT|META|TITLE|HEAD)$/.test(tag))return;
    if(tag==="BR"){out+="\n";return}if(tag==="HR"){out+="\n\n***\n\n";return}
    const st=(n.getAttribute("style")||"").toLowerCase();const fw=(st.match(/font-weight:\s*([a-z0-9]+)/)||[])[1];
    let nb=b,ni=i;
    if(fw&&(fw==="normal"||(+fw&&+fw<600)))nb=false;
    if(((tag==="B"||tag==="STRONG")&&!(fw==="normal"||(+fw&&+fw<600)))||(fw&&(fw==="bold"||+fw>=600)))nb=true;
    if(tag==="I"||tag==="EM"||/font-style:\s*italic/.test(st))ni=true;if(/font-style:\s*normal/.test(st))ni=false;
    const block=BLOCK.test(tag);if(block&&out&&!out.endsWith("\n"))out+="\n\n";
    const open=(nb&&!b?"**":"")+(ni&&!i?"*":""),close=(ni&&!i?"*":"")+(nb&&!b?"**":"");
    const start=out.length;for(const k of n.childNodes)walk(k,nb,ni);
    if(open){const inner=out.slice(start),tr=inner.trim();if(tr&&!inner.includes("\n"))out=out.slice(0,start)+inner.match(/^\s*/)[0]+open+tr+close+inner.match(/\s*$/)[0]}
    if(block&&!out.endsWith("\n"))out+="\n\n"};
  walk(doc.body,false,false);
  return out.replace(/[ \t]+\n/g,"\n").replace(/\n[ \t]+/g,"\n").replace(/\n{3,}/g,"\n\n").trim()}
$("chBody").addEventListener("paste",e=>{const html=e.clipboardData?.getData("text/html");if(!html)return;let t="";try{t=htmlToText(html)}catch{}if(!t)return;
  e.preventDefault();const ta=e.target;if(!document.execCommand("insertText",false,t))ta.setRangeText(t,ta.selectionStart,ta.selectionEnd,"end");
  if(S.editChapter)S.editChapter.dirty=true;updWords();saveDraftSoon()});

/* ---------- Dashboard (admin) ---------- */
function confirmBtn(label,fn){const b=h("button",{type:"button",class:"btn sm danger",text:label});let armed=false,t;
  b.addEventListener("click",()=>{if(!armed){armed=true;b.textContent="Confirm";b.classList.add("armed");t=setTimeout(()=>{armed=false;b.textContent=label;b.classList.remove("armed")},4000)}else{clearTimeout(t);b.disabled=true;fn()}});return b}
function fillSettings(){if(document.activeElement?.closest?.("#cfgForm"))return;$("cName").value=S.config.site_name||"";$("cTag").value=S.config.tagline||"";$("cJoin").value=S.config.join_url||"";$("cTiers").value=tiers().join(", ");$("cAnn").value=S.config.announcement||""}
const ICON_SEARCH='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
function lstate(col,def){S.L||={};return S.L[col]||=Object.assign({q:"",page:1,per:LS.get("per",25),filters:{},sel:new Set()},def)}
function cmp(v,dir){return(a,b)=>{const x=v(a),y=v(b);return(x>y?1:x<y?-1:0)*(dir==="asc"?1:-1)}}
function localPage(rows,st,vals){const v=vals[st.sort.key]||Object.values(vals)[0];rows.sort(cmp(v,st.sort.dir));return{rows:rows.slice((st.page-1)*st.per,st.page*st.per),total:rows.length}}
function bookTitle(id){return S.books.find(b=>b.id===id)?.title||"Unknown novel"}
function adminCfg(col){
  const byTitle=[...S.books].sort((a,b)=>(a.title||"").localeCompare(b.title||""));
  if(col==="novels")return{col,title:"Novels",create:()=>openBookForm(null),search:"Search by title or author",defSort:{key:"updated",dir:"desc"},
    filters:[{key:"status",label:"Any status",opts:Object.entries(STATUS)},{key:"genre",label:"Any genre",opts:genreCounts().map(([k,v])=>[k,v.label])}],
    cols:[{key:"title",label:"Title",cell:b=>h("div",{class:"tcell"},thumb(b),h("div",{class:"tmeta"},h("button",{type:"button",class:"alink",text:b.title,onclick:()=>openBookForm(b.id)}),b.author?h("div",{class:"sub",text:b.author}):null))},
      {key:"status",label:"Status",cell:b=>pill(b.status||"ongoing",STATUS[b.status]||"Ongoing")},
      {key:"chapters",label:"Chapters",cell:b=>h("a",{class:"alink num",href:"#admin/chapters/"+b.id,title:"Open this novel's chapters"},String(chCount(b))," →")},
      {key:"updated",label:"Last update",cell:b=>h("span",{class:"num muted",text:lastUpd(b)?ago(lastUpd(b)):"—"})},
      {key:"featured",label:"Featured",cell:b=>b.featured?h("span",{class:"feat",text:"★ Featured"}):h("span",{class:"muted",text:"—"})},
      {key:"view",label:"",nosort:true,cell:b=>h("a",{class:"alink muted",href:"#book/"+b.id,text:"View ↗"})}],
    async fetch(st){const q=st.q.trim().toLowerCase();
      const rows=S.books.filter(b=>(!st.filters.status||b.status===st.filters.status)&&(!st.filters.genre||(b.genres||[]).some(g=>g.toLowerCase()===st.filters.genre))&&(!q||(b.title+" "+(b.author||"")).toLowerCase().includes(q)));
      return localPage(rows,st,{updated:b=>updTime(b)||time(b),title:b=>(b.title||"").toLowerCase(),status:b=>b.status||"",chapters:b=>chCount(b),featured:b=>b.featured?1:0})},
    bulk:[{label:"Feature",run:ids=>sb.from("books").update({featured:true}).in("id",ids),done:n=>n+" featured"},
      {label:"Unfeature",run:ids=>sb.from("books").update({featured:false}).in("id",ids),done:n=>n+" unfeatured"},
      {label:"Delete",danger:true,done:n=>n+" deleted",run:async ids=>{const paths=S.books.filter(b=>ids.includes(b.id)).map(b=>b.cover_path).filter(Boolean);
        const r=await sb.from("books").delete().in("id",ids);if(!r.error){if(paths.length)await sb.storage.from("covers").remove(paths).catch(()=>{});for(const id of ids)delete S.tocP[id]}return r}}],
    empty:"No novels yet. Click Create new to add your first one."};
  if(col==="chapters")return{col,title:"Chapters",create:()=>openChapterForm(lstate("chapters").filters.book,null),search:"Search by title or chapter number",server:true,defSort:{key:"updated",dir:"desc"},
    notice:S.chaptersReady?null:"Chapters aren't switched on yet. Run update-chapters.sql in Supabase (SQL Editor), then refresh this page.",
    filters:[{key:"book",label:"All novels",opts:byTitle.map(b=>[b.id,b.title])},{key:"status",label:"Any status",opts:[["published","Published"],["draft","Draft"]]}],
    cols:[{key:"number",label:"Ch.",cell:c=>h("span",{class:"num",text:num(c.number)})},
      {key:"title",label:"Title",cell:c=>h("button",{type:"button",class:"alink",text:c.title||"Chapter "+num(c.number),onclick:()=>openChapterForm(c.book_id,c.id)})},
      {key:"book",label:"Novel",nosort:true,cell:c=>h("span",{class:"muted",text:bookTitle(c.book_id)})},
      {key:"status",label:"Status",cell:c=>c.published?pill("published","Published"):pill("draft","Draft")},
      {key:"words",label:"Words",cell:c=>h("span",{class:"num muted",text:(c.words||0).toLocaleString()})},
      {key:"updated",label:"Updated",cell:c=>h("span",{class:"num muted",text:ago(c.updated_at||c.created_at)})},
      {key:"view",label:"",nosort:true,cell:c=>h("a",{class:"alink muted",href:"#read/"+c.id,text:"View ↗"})}],
    async fetch(st){if(!S.chaptersReady)return{rows:[],total:0};
      let q=sb.from("chapters").select("id,book_id,number,title,words,published,created_at,updated_at",{count:"exact"});
      if(st.filters.book)q=q.eq("book_id",st.filters.book);
      if(st.filters.status)q=q.eq("published",st.filters.status==="published");
      const s=st.q.trim();if(s){if(/^\d+(\.\d+)?$/.test(s))q=q.eq("number",+s);else q=q.ilike("title","%"+s.replace(/[%_\\]/g,"")+"%")}
      const key={number:"number",title:"title",status:"published",words:"words",updated:"updated_at"}[st.sort.key]||"updated_at";
      q=q.order(key,{ascending:st.sort.dir==="asc"});if(key!=="number")q=q.order("number",{ascending:false});
      const r=await q.range((st.page-1)*st.per,st.page*st.per-1);if(r.error)throw r.error;return{rows:r.data||[],total:r.count??(r.data||[]).length}},
    bulk:[{label:"Publish",run:ids=>sb.from("chapters").update({published:true,updated_at:new Date().toISOString()}).in("id",ids),done:n=>n+" published"},
      {label:"Make draft",run:ids=>sb.from("chapters").update({published:false,updated_at:new Date().toISOString()}).in("id",ids),done:n=>n+" set to draft"},
      {label:"Delete",danger:true,run:ids=>sb.from("chapters").delete().in("id",ids),done:n=>n+" deleted"}],
    after(){S.tocP={}},
    empty:"No chapters yet. Click Create new to add one."};
  if(col==="genres")return{col,title:"Genres",search:"Search genres",defSort:{key:"novels",dir:"desc"},filters:[],
    cols:[{key:"name",label:"Name",cell:g=>h("button",{type:"button",class:"alink",text:g.label,onclick:()=>renameGenre(g.id,g.label)})},
      {key:"novels",label:"Novels",cell:g=>h("a",{class:"alink num",href:"#admin/novels",onclick:()=>{const st=lstate("novels",{sort:{key:"updated",dir:"desc"}});st.filters={genre:g.id};st.page=1}},String(g.n)," →")}],
    async fetch(st){const q=st.q.trim().toLowerCase();const rows=genreCounts().map(([k,v])=>({id:k,label:v.label,n:v.n})).filter(g=>!q||g.id.includes(q));
      return localPage(rows,st,{novels:g=>g.n,name:g=>g.id})},
    bulk:[{label:"Delete",danger:true,done:n=>n+" removed from all novels",run:async ids=>{const set=new Set(ids);
      for(const b of S.books){const gs=(b.genres||[]).filter(g=>!set.has(g.toLowerCase()));if(gs.length!==(b.genres||[]).length){const r=await sb.from("books").update({genres:gs}).eq("id",b.id);if(r.error)return r}}return{}}}],
    empty:"No genres yet. They appear here when you add them to a novel."};
  if(col==="members")return{col,title:"Paid members",create:()=>openMemberForm(null),search:"Search by name or contact",defSort:{key:"status",dir:"asc"},
    filters:[{key:"status",label:"Any status",opts:Object.entries(MSTATUS)},{key:"tier",label:"Any tier",opts:tiers().map(t=>[t,t])}],
    cols:[{key:"name",label:"Name",cell:m=>h("div",{class:"tmeta"},h("button",{type:"button",class:"alink",text:m.name,onclick:()=>openMemberForm(m.id)}),m.contact?h("div",{class:"sub",text:m.contact}):null)},
      {key:"tier",label:"Tier",cell:m=>h("span",{text:m.tier||"—"})},
      {key:"status",label:"Status",cell:m=>pill(m.status,MSTATUS[m.status]||m.status)},
      {key:"renews",label:"Renews",cell:m=>m.status==="active"&&m.renew_on&&m.renew_on<today()?pill("due","Due "+fmtDate(m.renew_on)):h("span",{class:"num muted",text:fmtDate(m.renew_on)||"—"})}],
    async fetch(st){const q=st.q.trim().toLowerCase();const order={active:0,paused:1,cancelled:2};
      const rows=S.members.filter(m=>(!st.filters.status||m.status===st.filters.status)&&(!st.filters.tier||m.tier===st.filters.tier)&&(!q||((m.name||"")+" "+(m.contact||"")).toLowerCase().includes(q)));
      return localPage(rows,st,{status:m=>(order[m.status]??3)+(m.name||"").toLowerCase(),name:m=>(m.name||"").toLowerCase(),tier:m=>tiers().indexOf(m.tier),renews:m=>m.renew_on||"9999"})},
    bulk:[{label:"Mark cancelled",run:ids=>sb.from("members").update({status:"cancelled"}).in("id",ids),done:n=>n+" marked cancelled"},
      {label:"Delete",danger:true,run:ids=>sb.from("members").delete().in("id",ids),done:n=>n+" deleted"}],
    empty:"No paid members yet. Click Create new when someone subscribes."};
}
function crumbs(title){return h("div",{class:"crumbs"},h("a",{href:"#",text:siteName()}),h("span",{"aria-hidden":"true",text:"/"}),h("span",{text:title}))}
function renderAdmin(col,id){
  if(!COLS_OK.includes(col))col="novels";
  for(const a of document.querySelectorAll(".anav a"))a.dataset.col===col?a.setAttribute("aria-current","page"):a.removeAttribute("aria-current");
  document.title=(col==="settings"?"Settings":adminCfg(col).title)+" · Dashboard";
  if(col==="settings"){S.list=null;fillSettings();$("amain").replaceChildren(crumbs("Settings"),h("div",{class:"ahead"},h("h1",{text:"Settings"})),$("cfgForm"));return}
  const cfg=adminCfg(col);const st=lstate(col,{sort:cfg.defSort});
  if(col==="chapters"&&id){st.filters.book=id;st.q="";st.page=1}
  if(S.list?.cfg.col!==col||id)st.sel.clear();
  mountList(cfg,st)}
const COLS_OK=["novels","chapters","genres","members","settings"];
function mountList(cfg,st){
  const E={bulk:h("div",{class:"abulk",hidden:true}),thead:h("thead"),tbody:h("tbody"),empty:h("div",{class:"aempty",hidden:true}),pager:h("div",{class:"apager"}),count:h("span",{class:"acount"})};
  S.list={cfg,st,el:E};
  const sbox=h("div",{class:"asearch"});sbox.innerHTML=ICON_SEARCH;
  sbox.append(h("input",{type:"search",id:"aq",placeholder:cfg.search,"aria-label":cfg.search,value:st.q,oninput:e=>{st.q=e.target.value;st.page=1;clearTimeout(S.aqT);S.aqT=setTimeout(refreshList,cfg.server?250:0)}}));
  const filters=cfg.filters.map(f=>h("select",{"aria-label":f.label,onchange:e=>{st.filters[f.key]=e.target.value;st.page=1;st.sel.clear();refreshList()}},
    h("option",{value:"",text:f.label}),...f.opts.map(([v,t])=>h("option",{value:v,text:t,selected:st.filters[f.key]===v?true:null}))));
  $("amain").replaceChildren(...[crumbs(cfg.title),
    h("div",{class:"ahead"},h("h1",{text:cfg.title}),cfg.create?h("button",{type:"button",class:"btn sm",text:"Create new",onclick:cfg.create}):null,E.count),
    cfg.notice?h("div",{class:"banner",text:cfg.notice}):null,
    h("div",{class:"atools"},sbox,filters.length?h("div",{class:"afilters"},...filters):null),
    E.bulk,h("div",{class:"tscroll atable"},h("table",{},E.thead,E.tbody)),E.empty,E.pager].filter(Boolean));
  refreshList()}
async function refreshList(){const L=S.list;if(!L)return;const {cfg,st,el:E}=L;
  let res;try{res=await cfg.fetch(st)}catch(e){console.error(e);if(S.list!==L)return;E.tbody.replaceChildren();E.empty.hidden=false;E.empty.textContent="Couldn't load this list. Refresh the page to try again.";return}
  if(S.list!==L)return;
  const pages=Math.max(1,Math.ceil(res.total/st.per));if(st.page>pages){st.page=pages;return refreshList()}
  const ids=res.rows.map(r=>r.id);const allSel=ids.length>0&&ids.every(i=>st.sel.has(i));const canBulk=!!cfg.bulk?.length;
  E.thead.replaceChildren(h("tr",{},canBulk?h("th",{class:"ck"},h("input",{type:"checkbox","aria-label":"Select all on this page",checked:allSel?true:null,onchange:e=>{ids.forEach(i=>e.target.checked?st.sel.add(i):st.sel.delete(i));refreshList()}})):null,
    ...cfg.cols.map(c=>h("th",{"aria-sort":st.sort.key===c.key?(st.sort.dir==="asc"?"ascending":"descending"):null},c.nosort?h("span",{text:c.label}):
      h("button",{type:"button",class:"sorth"+(st.sort.key===c.key?" on":""),onclick:()=>{st.sort=st.sort.key===c.key?{key:c.key,dir:st.sort.dir==="asc"?"desc":"asc"}:{key:c.key,dir:/updated|chapters|words|featured|novels/.test(c.key)?"desc":"asc"};st.page=1;refreshList()}},
        c.label,h("span",{class:"arr","aria-hidden":"true",text:st.sort.key===c.key?(st.sort.dir==="asc"?"↑":"↓"):"↕"}))))));
  E.tbody.replaceChildren(...res.rows.map(r=>h("tr",{class:st.sel.has(r.id)?"sel":null},
    canBulk?h("td",{class:"ck"},h("input",{type:"checkbox","aria-label":"Select row",checked:st.sel.has(r.id)?true:null,onchange:e=>{e.target.checked?st.sel.add(r.id):st.sel.delete(r.id);refreshList()}})):null,
    ...cfg.cols.map(c=>h("td",{class:"c-"+c.key},c.cell(r))))));
  const filtered=!!st.q.trim()||Object.values(st.filters).some(Boolean);
  E.empty.hidden=res.rows.length>0;E.empty.textContent=filtered?"Nothing matches. Try a different search or filter.":cfg.empty;
  E.count.textContent=res.total.toLocaleString()+(filtered?" found":" total");
  E.bulk.hidden=!st.sel.size;
  if(st.sel.size)E.bulk.replaceChildren(h("span",{class:"bsel",text:st.sel.size+" selected"}),
    ...cfg.bulk.map(b=>b.danger?confirmBtn(b.label,()=>runBulk(b)):h("button",{type:"button",class:"btn sm",text:b.label,onclick:()=>runBulk(b)})),
    h("button",{type:"button",class:"linkbtn",text:"Clear selection",onclick:()=>{st.sel.clear();refreshList()}}));
  const from=res.total?(st.page-1)*st.per+1:0,to=Math.min(res.total,st.page*st.per);
  const nums=[];for(const p of [1,st.page-1,st.page,st.page+1,pages])if(p>=1&&p<=pages&&!nums.includes(p))nums.push(p);nums.sort((a,b)=>a-b);
  const pb=[];nums.forEach((p,i)=>{if(i&&p-nums[i-1]>1)pb.push(h("span",{class:"gap","aria-hidden":"true",text:"…"}));pb.push(h("button",{type:"button",class:"pg"+(p===st.page?" on":""),"aria-current":p===st.page?"page":null,"aria-label":"Page "+p,text:p,onclick:()=>{st.page=p;refreshList()}}))});
  E.pager.replaceChildren(h("div",{class:"pgs"},h("button",{type:"button",class:"pg",disabled:st.page<=1?true:null,"aria-label":"Previous page",text:"‹",onclick:()=>{st.page--;refreshList()}}),...pb,
      h("button",{type:"button",class:"pg",disabled:st.page>=pages?true:null,"aria-label":"Next page",text:"›",onclick:()=>{st.page++;refreshList()}})),
    h("div",{class:"pinfo"},h("span",{class:"num",text:`${from}–${to} of ${res.total.toLocaleString()}`}),
      h("label",{class:"per"},"Per page",h("select",{onchange:e=>{st.per=+e.target.value;LS.set("per",st.per);st.page=1;refreshList()}},...[10,25,50,100].map(n=>h("option",{value:n,text:n,selected:n===st.per?true:null}))))));
}
async function runBulk(b){const L=S.list;if(!L)return;const ids=[...L.st.sel];if(!ids.length)return;
  for(const x of L.el.bulk.querySelectorAll("button"))x.disabled=true;
  let r;try{r=await b.run(ids)}catch(e){r={error:e}}
  if(r?.error){console.error(r.error);toast("Couldn't finish that. Check you're still logged in, then try again.");refreshList();return}
  L.st.sel.clear();toast(b.done?b.done(ids.length):"Done");L.cfg.after?.();await refresh()}
let promptSave=null;
function openPrompt({title,label,value,onSave}){$("pTitle").textContent=title;$("pLabel").textContent=label;$("pInput").value=value||"";$("pErr").textContent="";promptSave=onSave;$("promptDlg").showModal();$("pInput").select()}
$("promptForm").addEventListener("submit",async e=>{e.preventDefault();if(!promptSave)return;$("pSave").disabled=true;const msg=await promptSave($("pInput").value);$("pSave").disabled=false;
  if(msg){$("pErr").textContent=msg;return}$("promptDlg").close()});
function renameGenre(key,label){openPrompt({title:"Rename genre",label:"Genre name",value:label,async onSave(v){const nv=tidyGenre(v);if(!nv)return"Add a name for the genre.";
  for(const b of S.books.filter(b=>(b.genres||[]).some(g=>g.toLowerCase()===key))){const gs=[];for(const g of b.genres){const x=g.toLowerCase()===key?nv:g;if(!gs.some(y=>y.toLowerCase()===x.toLowerCase()))gs.push(x)}
    const r=await sb.from("books").update({genres:gs}).eq("id",b.id);if(r.error)return"Couldn't rename it. Check you're still logged in, then try again."}
  toast("Genre renamed");await refresh()}})}
$("aLogout").addEventListener("click",()=>logout());

/* ---------- Book form ---------- */
function setCover(k){S.cover=k;for(const b of $("bSwatches").children)b.setAttribute("aria-pressed",String(b.dataset.k===k));if($("bookDlg").open)coverPreview()}
$("bSwatches").append(...Object.entries(COVERS).map(([k,c])=>h("button",{type:"button","data-k":k,"aria-label":k+" cover","aria-pressed":"false",style:`background:${c[0]}`,onclick:()=>setCover(k)})));
function updUrlHint(){$("bUrlHint").textContent=$("bAccess").value==="members"?"Kept private: only you see this link. Readers get your membership link instead.":"Optional. Only used when the book has no chapters on this site."}
$("bAccess").addEventListener("change",updUrlHint);
async function shrink(file){
  try{const img=await createImageBitmap(file);const max=900,sc=Math.min(1,max/Math.max(img.width,img.height));
    const c=document.createElement("canvas");c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
    c.getContext("2d").drawImage(img,0,0,c.width,c.height);const blob=await new Promise(r=>c.toBlob(r,"image/jpeg",0.86));if(blob)return blob}catch(e){console.warn(e)}
  if(file.size<=3*1024*1024)return file;throw new Error("too_big")}
function coverPreview(){const old=S.editBook?S.books.find(x=>x.id===S.editBook):null;
  if(S.coverPreviewUrl){URL.revokeObjectURL(S.coverPreviewUrl);S.coverPreviewUrl=null}
  let url="";if(S.coverFile){S.coverPreviewUrl=URL.createObjectURL(S.coverFile);url=S.coverPreviewUrl}else if(!S.coverRemove&&old?.cover_url)url=old.cover_url;
  $("bCovPrev").replaceChildren(cover({title:$("bTitle").value.trim()||"Your title",author:$("bAuthor").value.trim(),genres:parseGenres($("bGenres").value),cover:S.cover,cover_url:url},true));
  $("bCoverRemove").hidden=!url;$("bSwatchField").hidden=!!url}
$("bCoverFile").addEventListener("change",e=>{const f=e.target.files[0];e.target.value="";if(!f)return;
  if(!/^image\//.test(f.type)){$("bErr").textContent="That file isn't an image. Pick a JPG, PNG or WebP.";return}
  $("bErr").textContent="";S.coverFile=f;S.coverRemove=false;coverPreview()});
$("bCoverRemove").addEventListener("click",()=>{S.coverFile=null;S.coverRemove=true;coverPreview()});
for(const id of ["bTitle","bAuthor","bGenres"])$(id).addEventListener("input",()=>{if(!$("bCovPrev").querySelector("img"))coverPreview()});
async function removeCoverFile(path){if(path)await sb.storage.from("covers").remove([path]).catch(()=>{})}
function openBookForm(id){const b=id?S.books.find(x=>x.id===id):null;S.editBook=id||null;
  $("bookDlgTitle").textContent=b?"Edit book":"Add book";$("bTitle").value=b?.title||"";$("bAuthor").value=b?.author||"";$("bChapters").value=b?.chapters||"";
  $("bGenres").value=(b?.genres||[]).join(", ");$("bSyn").value=b?.synopsis||"";$("bStatus").value=b?.status||"ongoing";$("bAccess").value=b?.access||"free";
  $("bUrl").value=b?(b.access==="members"?(S.links[b.id]||""):(b.read_url||"")):"";$("bFeatured").checked=!!b?.featured;$("bErr").textContent="";
  S.coverFile=null;S.coverRemove=false;setCover(b?.cover||Object.keys(COVERS)[S.books.length%9]);updUrlHint();coverPreview();
  $("bSuggest").replaceChildren(...genreCounts().slice(0,14).map(([,v])=>h("button",{type:"button",text:"+ "+v.label,onclick:()=>{const cur=parseGenres($("bGenres").value);if(!cur.some(g=>g.toLowerCase()===v.label.toLowerCase()))cur.push(v.label);$("bGenres").value=cur.join(", ")}})));
  $("bookDlg").showModal();$("bTitle").focus()}
$("bookForm").addEventListener("submit",async e=>{e.preventDefault();const err=$("bErr");err.textContent="";
  const title=$("bTitle").value.trim(),url=$("bUrl").value.trim(),access=$("bAccess").value;
  if(!title){err.textContent="Add a title to save the book.";$("bTitle").focus();return}
  if(url&&!isUrl(url)){err.textContent="The reading link needs to start with https://";$("bUrl").focus();return}
  const ch=parseInt($("bChapters").value,10);
  const row={title,author:$("bAuthor").value.trim(),genres:parseGenres($("bGenres").value),synopsis:$("bSyn").value.trim(),status:$("bStatus").value,access,
    chapters:Number.isFinite(ch)&&ch>=0?ch:0,cover:S.cover,featured:$("bFeatured").checked,read_url:access==="free"?url:"",updated_at:new Date().toISOString()};
  const old=S.editBook?S.books.find(x=>x.id===S.editBook):null;let newPath="",oldPath=old?.cover_path||"";
  $("bSave").disabled=true;
  try{
    if(S.coverFile){$("bSave").textContent="Uploading cover…";const blob=await shrink(S.coverFile);
      newPath=(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2))+".jpg";
      const up=await sb.storage.from("covers").upload(newPath,blob,{contentType:blob.type||"image/jpeg",cacheControl:"31536000",upsert:false});if(up.error)throw up.error;
      row.cover_url=sb.storage.from("covers").getPublicUrl(newPath).data.publicUrl;row.cover_path=newPath}
    else if(S.coverRemove){row.cover_url="";row.cover_path=""}
    $("bSave").textContent="Saving…";
    let id=S.editBook;
    if(id){const r=await sb.from("books").update(row).eq("id",id);if(r.error)throw r.error}
    else{const r=await sb.from("books").insert(row).select("id").single();if(r.error)throw r.error;id=r.data.id}
    if(access==="members"&&url){const r=await sb.from("private_links").upsert({book_id:id,url});if(r.error)throw r.error}
    else if(S.links[id]){await sb.from("private_links").delete().eq("book_id",id)}
    if(oldPath&&(newPath||S.coverRemove))await removeCoverFile(oldPath);
    $("bookDlg").close();toast(S.editBook?"Book updated":"Book added");await refresh()}
  catch(x){console.error(x);if(newPath)await removeCoverFile(newPath);
    err.textContent=x?.message==="too_big"?"That image is too large. Try one under 3 MB.":(x?.statusCode||x?.message||"").toString().match(/bucket|row-level|403|not found/i)?"Couldn't upload the cover. Run update-covers.sql in Supabase first.":"Couldn't save. Check you're still logged in, then try again."}
  finally{$("bSave").disabled=false;$("bSave").textContent="Save book"}});
async function deleteBook(id){const b=S.books.find(x=>x.id===id);const r=await sb.from("books").delete().eq("id",id);if(!r.error){await removeCoverFile(b?.cover_path);delete S.tocP[id]}toast(r.error?"Couldn't delete that book":"Book deleted");await refresh()}

/* ---------- Member form ---------- */
function openMemberForm(id){const m=id?S.members.find(x=>x.id===id):null;S.editMember=id||null;
  $("memberDlgTitle").textContent=m?"Edit member":"Add member";
  const ts=tiers().slice();if(m?.tier&&!ts.includes(m.tier))ts.push(m.tier);
  $("mTier").replaceChildren(...ts.map(t=>h("option",{value:t,text:t})));
  $("mName").value=m?.name||"";$("mContact").value=m?.contact||"";$("mTier").value=m?.tier||ts[0];$("mState").value=m?.status||"active";
  $("mSince").value=m?.since||today();$("mRenew").value=m?.renew_on||"";$("mNotes").value=m?.notes||"";$("mErr").textContent="";
  $("memberDlg").showModal();$("mName").focus()}
$("memberForm").addEventListener("submit",async e=>{e.preventDefault();const err=$("mErr");err.textContent="";
  const name=$("mName").value.trim();if(!name){err.textContent="Add the member's name to save.";$("mName").focus();return}
  const row={name,contact:$("mContact").value.trim(),tier:$("mTier").value,status:$("mState").value,since:$("mSince").value||null,renew_on:$("mRenew").value||null,notes:$("mNotes").value.trim(),updated_at:new Date().toISOString()};
  $("mSave").disabled=true;
  try{const r=S.editMember?await sb.from("members").update(row).eq("id",S.editMember):await sb.from("members").insert(row);if(r.error)throw r.error;
    $("memberDlg").close();toast(S.editMember?"Member updated":"Member added");await refresh()}
  catch(x){console.error(x);err.textContent="Couldn't save. Check you're still logged in, then try again."}
  finally{$("mSave").disabled=false}});
async function deleteMember(id){const r=await sb.from("members").delete().eq("id",id);toast(r.error?"Couldn't remove that member":"Member removed");await refresh()}

$("cfgForm").addEventListener("submit",async e=>{e.preventDefault();const err=$("cfgErr");err.textContent="";const join=$("cJoin").value.trim();
  if(join&&!isUrl(join)){err.textContent="The membership link needs to start with https://";return}
  const t=$("cTiers").value.split(",").map(x=>x.trim()).filter(Boolean);
  const row={id:1,site_name:$("cName").value.trim(),tagline:$("cTag").value.trim(),join_url:join,tiers:t.length?t:DEFAULT_TIERS};
  if(S.homeReady)row.announcement=$("cAnn").value.trim();
  const r=await sb.from("site_config").upsert(row);
  if(r.error){err.textContent="Couldn't save settings. Try again.";return}
  if(!S.homeReady&&$("cAnn").value.trim())err.textContent="Saved, except announcements. Run update-home.sql in Supabase to turn them on.";
  document.activeElement?.blur();toast("Settings saved");await refresh()});

/* ---------- Login ---------- */
function openLogin(){$("lErr").textContent="";if(!$("loginDlg").open)$("loginDlg").showModal();$("lEmail").focus()}
$("ownerLogin").addEventListener("click",openLogin);
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();const err=$("lErr");err.textContent="";$("lBtn").disabled=true;
  const {error}=await sb.auth.signInWithPassword({email:$("lEmail").value.trim(),password:$("lPass").value});
  $("lBtn").disabled=false;
  if(error){const m=(error.message||"").toLowerCase();err.textContent=m.includes("not confirmed")?"This email isn't confirmed. In Supabase, delete the user and add it again with Auto Confirm ticked.":m.includes("invalid login")?"Wrong email or password (Supabase says: "+error.message+")":"Login failed: "+error.message;return}
  $("lPass").value="";await afterAuth();
  if(!S.canEdit){err.textContent="This account isn't set up as the site owner.";await sb.auth.signOut();return}
  $("loginDlg").close();toast("Logged in");
  if(parseHash().name==="admin")route();else go("admin/novels")});
async function logout(){await sb.auth.signOut();S.canEdit=false;await afterAuth();if(S.route.name==="admin")go("");else route();toast("Logged out")}
async function afterAuth(){S.canEdit=await checkOwner();$("navDash").hidden=!S.canEdit;
  $("who").replaceChildren(S.canEdit?h("button",{type:"button",text:"Log out",onclick:logout}):h("button",{type:"button",text:"Owner login",onclick:openLogin}));
  await refresh()}

/* ---------- Routing ---------- */
function parseHash(){const raw=decodeURIComponent(location.hash.replace(/^#\/?/,""));const [name,id,sub]=raw.split("/");
  if((name==="book"||name==="read")&&id)return{name,id};
  if(name==="admin")return{name,col:COLS_OK.includes(id)?id:"novels",id:sub||null};
  if(name==="manage"&&id)return{name:"admin",col:"chapters",id};
  if(name==="dashboard")return{name:"admin",col:"novels"};
  if(name==="browse")return{name};return{name:"home"}}
function go(hash){if(location.hash.replace(/^#/,"")===hash)route();else location.hash=hash}
const VIEWS={home:"home",browse:"library",book:"bookPage",read:"reader",admin:"admin"};
function route(){
  const prev=S.route;let r=parseHash();
  if(r.name==="admin"&&!S.canEdit){if(S.authReady)openLogin();r={name:"home"}}
  const keep=n=>n==="home"||n==="browse";
  if(keep(prev.name)&&prev.name!==r.name)(S.scroll||={})[prev.name]=window.scrollY;
  S.route=r;const seq=++S.seq;
  for(const [k,id] of Object.entries(VIEWS))$(id).hidden=k!==r.name;
  document.body.classList.toggle("reading",r.name==="read");document.body.classList.toggle("is-admin",r.name==="admin");
  const cur={navHome:r.name==="home",navBrowse:r.name==="browse",navDash:r.name==="admin"};
  for(const [id,on] of Object.entries(cur))on?$(id).setAttribute("aria-current","page"):$(id).removeAttribute("aria-current");
  closeResults();if(r.name==="browse"&&$("hq").value!==S.q)$("hq").value=S.q;
  applyReaderPrefs(r.name==="read");
  if(!/^(book|read|admin)$/.test(r.name))document.title=siteName();
  if(keep(r.name)){r.name==="home"?renderHome(seq):renderLibrary();if(prev.name!==r.name)requestAnimationFrame(()=>window.scrollTo(0,(S.scroll||{})[r.name]||0))}
  else{window.scrollTo(0,0);
    if(r.name==="admin")renderAdmin(r.col,r.id);
    else if(r.name==="book")renderBook(r.id,seq);
    else if(r.name==="read"){if(sb)renderReader(r.id,seq)}}
}
function rerender(){const r=S.route,seq=S.seq;
  if(r.name==="browse")renderLibrary();else if(r.name==="home")renderHome(seq);else if(r.name==="admin")renderAdmin(r.col,null);
  else if(r.name==="book")renderBook(r.id,seq)}
window.addEventListener("hashchange",route);

/* ---------- Wiring ---------- */
for(const d of document.querySelectorAll("dialog")){d.addEventListener("click",e=>{if((e.target===d&&d.id!=="chapterDlg")||e.target.closest("[data-close]"))d.close()})}
$("fStatus").addEventListener("change",e=>{S.status=e.target.value;renderLibrary()});
$("fAccess").addEventListener("change",e=>{S.access=e.target.value;renderLibrary()});
$("fSort").addEventListener("change",e=>{S.sort=e.target.value;renderLibrary()});
$("clear").addEventListener("click",()=>{S.q="";S.genres.clear();S.status="all";S.access="all";$("hq").value="";$("fStatus").value="all";$("fAccess").value="all";renderLibrary()});
function applyConfig(){const n=siteName();$("siteName").textContent=n;if(!/^(book|read|admin)$/.test(S.route.name))document.title=n;$("hq").placeholder="Search "+(S.books.length?S.books.length+" titles":"titles")+", authors or genres";$("tagline").textContent=S.config.tagline||DEFAULT_TAG;$("footName").textContent="© "+new Date().getFullYear()+" "+n}

S.hotWin=LS.get("hotWin",7);
route();
(async()=>{
  if(!sb){S.loaded=true;$("count").textContent="0 books";showNotice("This site isn't connected to its database yet. Add the Supabase details in config.js.");renderLibrary();return}
  await afterAuth();S.authReady=true;route();
})();
