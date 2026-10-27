"use strict";
const COVERS={rose:["#8E1F4B","#FBE4EE"],plum:["#3E2459","#EADCF7"],ink:["#1F2A44","#E3E8F5"],teal:["#0F5257","#D6F1EE"],forest:["#2F4A2A","#E2EFD9"],gold:["#C4912F","#2A1C05"],coral:["#D9634B","#2B0E07"],sky:["#9CC3E6","#102033"],blush:["#F2C6D3","#4A1428"]};
const STATUS={ongoing:"Ongoing",completed:"Completed",hiatus:"On hiatus"};
const MSTATUS={active:"Active",paused:"Paused",cancelled:"Cancelled"};
const DEFAULT_TIERS=["Bronze","Silver","Gold"];
const DEFAULT_NAME="Starry Nights Translation";
const DEFAULT_TAG="Romance, fantasy and everything in between.";
const S={books:[],members:[],links:{},config:{},counts:{},latest:{},hot:{},hotWin:7,updLimit:12,tocP:{},chaptersReady:true,homeReady:true,q:"",f:{sort:"updated",inc:new Set(),exc:new Set(),match:"and",status:"",access:"",authors:new Set(),minCh:0,upd:0,here:""},bLimit:24,
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
function kfmtg(n){n=+n||0;return Number.isInteger(n)?n.toLocaleString():n.toLocaleString(undefined,{maximumFractionDigits:2})}
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
  const [b,c,n,l,t]=await Promise.all([sb.from("books").select("*").order("created_at",{ascending:false}),sb.from("site_config").select("*").eq("id",1).maybeSingle(),sb.from("chapter_counts").select("*"),
    sb.from("latest_chapters").select("*").order("number",{ascending:false}).range(0,2999),sb.from("tiers").select("*").order("price",{ascending:true})]);
  S.memReady=!t.error;S.tiers=t.error?[]:(t.data||[]);
  try{const hc=await sb.rpc("list_collections",{p_sort:"popular",p_limit:6});S.commReady=!hc.error;S.homeColls=hc.error?[]:(hc.data||[])}catch{S.commReady=false;S.homeColls=[]}
  if(b.error)throw b.error;
  S.books=b.data||[];S.config=c.data||{};if(S.books.length){S.hasExtra="original_title" in S.books[0];S.hasExtra2="staff" in S.books[0]}
  S.chaptersReady=!n.error;S.counts=n.error?{}:Object.fromEntries((n.data||[]).map(r=>[r.book_id,r.n]));
  S.homeReady=!l.error;S.latest={};for(const r of (l.error?[]:l.data||[]))(S.latest[r.book_id]||=[]).push(r);
  S.loaded=true;applyConfig();
}
async function loadPrivate(){
  S.mine=[];S.profile=null;if(S.uid&&patSql()&&S.pat===undefined)await loadPatreon();
  if(S.uid&&S.commReady){const p=await sb.from("profiles").select("user_id,display_name").eq("user_id",S.uid).maybeSingle();S.profile=p.data||null}
  if(!S.canEdit){S.members=[];S.links={};
    if(S.email&&S.memReady){const r=await sb.from("memberships").select("id,tier_id,status,expires_at");S.mine=r.error?[]:(r.data||[])}
    return}
  const [m,l]=await Promise.all([sb.from("members").select("*"),sb.from("private_links").select("*")]);
  S.members=m.data||[];S.links=Object.fromEntries((l.data||[]).map(r=>[r.book_id,r.url]));
}
async function refresh(){try{await loadPublic();await loadPrivate()}catch(e){console.error(e);showNotice("Couldn't load the library. Refresh the page to try again.")}rerender()}
async function checkOwner(){const {data:{session}}=await sb.auth.getSession();S.session=session;S.uid=session?.user?.id||null;S.email=(session?.user?.email||"").toLowerCase();if(!session)return false;const {data,error}=await sb.rpc("is_owner");return !error&&data===true}
/* Tiers & access */
function autoReady(){return S.books.some(b=>"auto_release" in b)}
function autoMax(bookId){return Math.max(0,...tiersFor(bookId).map(t=>+t.chapters_ahead||0))}
function isAuto(bookId){const b=S.books.find(x=>x.id===bookId);return !!(b&&b.auto_release&&autoMax(bookId)>0)}
function tierById(id){return (S.tiers||[]).find(t=>t.id===id)}
function money(n){n=+n||0;return "$"+(Number.isInteger(n)?n:n.toFixed(2))}
function activeMine(){const now=Date.now();return(S.mine||[]).filter(m=>m.status==="active"&&(!m.expires_at||Date.parse(m.expires_at)>now))}
function canReadTier(tid){if(!tid||S.canEdit)return true;const need=tierById(tid);if(!need)return false;
  return activeMine().some(m=>{const t=tierById(m.tier_id);return t&&(!t.book_id||t.book_id===need.book_id)&&+t.price>=+need.price})}
function tiersFor(bookId){return S.tiers.filter(t=>!t.book_id||t.book_id===bookId).sort((a,b)=>+a.price-+b.price||(a.name||"").localeCompare(b.name||""))}
function chCols(){return "id,book_id,number,title,words,published,created_at,updated_at"+(S.memReady?",tier_id,volume,volume_title":"")}
function lockIcon(){const s=document.createElementNS("http://www.w3.org/2000/svg","svg");s.setAttribute("viewBox","0 0 24 24");s.setAttribute("width","13");s.setAttribute("height","13");s.setAttribute("aria-hidden","true");s.setAttribute("class","lk");
  s.innerHTML='<rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.2"/>';return s}
async function getChapter(id){
  if(S.memReady!==false){const r=await sb.rpc("read_chapter",{p_id:id});
    if(!r.error)return{data:Array.isArray(r.data)?r.data[0]||null:r.data};
    if(!/read_chapter|function|schema cache/i.test(r.error.message||""))return{error:r.error}}
  return await sb.from("chapters").select("*").eq("id",id).maybeSingle()}
function loadToc(bookId,force){
  if(!force&&S.tocP[bookId])return S.tocP[bookId];
  const p=(async()=>{const out=[];
    for(let from=0;;from+=1000){const r=await sb.from("chapters").select(chCols()).eq("book_id",bookId).order("number",{ascending:true}).range(from,from+999);
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
function filtered(){const q=S.q.trim().toLowerCase(),f=S.f;
  const list=S.books.filter(b=>{
    if(f.status&&b.status!==f.status)return false;
    if(f.access&&b.access!==f.access)return false;
    const gs=(b.genres||[]).map(g=>g.toLowerCase());
    if(f.inc.size){if(f.match==="and"){for(const g of f.inc)if(!gs.includes(g))return false}else if(![...f.inc].some(g=>gs.includes(g)))return false}
    for(const g of f.exc)if(gs.includes(g))return false;
    if(f.authors.size&&!f.authors.has((b.author||"").trim().toLowerCase()))return false;
    if(f.minCh&&chCount(b)<f.minCh)return false;
    if(f.upd){const t=updTime(b);if(!t||Date.now()-t>f.upd*86400000)return false}
    if(f.here==="site"&&!S.counts[b.id])return false;
    if(q){const hay=[b.title,b.author,(b.genres||[]).join(" "),b.synopsis].join(" ").toLowerCase();if(!q.split(/\s+/).every(w=>hay.includes(w)))return false}
    return true});
  const views=Object.fromEntries((S.hot[30]||[]).map(r=>[r.book_id,+r.views]));
  const by={updated:(a,b)=>updTime(b)-updTime(a)||time(b)-time(a),popular:(a,b)=>(views[b.id]||0)-(views[a.id]||0)||updTime(b)-updTime(a),new:(a,b)=>time(b)-time(a),az:(a,b)=>(a.title||"").localeCompare(b.title||""),chapters:(a,b)=>chCount(b)-chCount(a)}[f.sort]||((a,b)=>0);
  return list.sort(by)}
function savedGenres(){return Array.isArray(S.config.genres)?S.config.genres:[]}
function allGenres(){const m=new Map(genreCounts());for(const g of savedGenres()){const k=g.toLowerCase();if(!m.has(k))m.set(k,{label:g,n:0})}return[...m.entries()]}
async function saveGenreList(list){const r=await sb.from("site_config").update({genres:list}).eq("id",1);if(r.error)return r;S.config.genres=list;return r}
function genreCounts(){const m=new Map();for(const b of S.books)for(const g of b.genres||[]){const k=g.toLowerCase();const e=m.get(k)||{label:g,n:0};e.n++;m.set(k,e)}return[...m.entries()].sort((a,b)=>b[1].n-a[1].n||a[1].label.localeCompare(b[1].label))}
function card(b,rank){const n=chCount(b);const cv=cover(b);
  if(rank)cv.querySelector(".cover").append(h("span",{class:"rankb",text:"#"+rank}));
  const lt=S.latest[b.id]?.[0];
  return h("a",{class:"card",href:"#book/"+b.id,"aria-label":`${b.title}${b.author?" by "+b.author:""}`},
  cv,lt?h("span",{class:"cmeta"},h("span",{text:"Ch. "+num(lt.number)}),h("span",{text:ago(lt.created_at)})):null,
  h("span",{class:"t",text:b.title}),b.author?h("span",{class:"a",text:b.author}):null,
  h("span",{class:"meta"},pill(b.status||"ongoing",STATUS[b.status]||"Ongoing"),n?h("span",{class:"mono",text:n+" ch"}):null))}
function authorsList(){const m=new Map();for(const b of S.books){const a=(b.author||"").trim();if(!a)continue;const k=a.toLowerCase();const e=m.get(k)||{label:a,n:0};e.n++;m.set(k,e)}return[...m.entries()].sort((a,b)=>a[1].label.localeCompare(b[1].label))}
function listItem(b){const n=chCount(b),lt=S.latest[b.id]?.[0];
  const meta=[STATUS[b.status]||"Ongoing",n?"Ch. "+(lt?num(lt.number):n):null,(b.genres||[]).slice(0,3).join(", ")||null,b.access==="members"&&!S.counts[b.id]?"Members":null].filter(Boolean);
  return h("article",{class:"litem"},h("a",{class:"lcov",href:"#book/"+b.id,tabindex:"-1","aria-hidden":"true"},cover(b,true)),
    h("div",{class:"lbody"},h("a",{class:"ltitle",href:"#book/"+b.id,text:b.title}),
      h("div",{class:"lmeta"},...meta.map((m,i)=>h("span",{class:i===0?"st-"+(b.status||"ongoing"):null,text:m}))),
      b.author?h("div",{class:"lauth",text:"by "+b.author}):null,
      b.synopsis?h("p",{class:"lsyn",text:b.synopsis}):null,
      h("div",{class:"lfoot"},lt?h("a",{href:"#read/"+lt.id,class:"lnew",text:"Ch. "+num(lt.number)+" →"}):null,h("span",{class:"mono",text:lt?ago(lt.created_at):"added "+ago(b.created_at)}))))}
function genreState(k){return S.f.inc.has(k)?"inc":S.f.exc.has(k)?"exc":""}
function cycleGenre(k){const f=S.f;if(f.inc.has(k)){f.inc.delete(k);f.exc.add(k)}else if(f.exc.has(k))f.exc.delete(k);else f.inc.add(k)}
function drawGenrePanel(){const panel=$("ddGenres").querySelector(".ddpanel");const f=S.f;
  const search=panel.querySelector("#gSearch")?.value||"";
  const gl=genreCounts().filter(([k,v])=>!search||v.label.toLowerCase().includes(search.toLowerCase()));
  const keep=document.activeElement?.id==="gSearch";
  panel.replaceChildren(
    h("div",{class:"ddrow"},h("span",{class:"flab",text:"Match"}),h("div",{class:"seg sm"},...[["and","All (AND)"],["or","Any (OR)"]].map(([v,t])=>h("button",{type:"button","aria-pressed":String(f.match===v),text:t,onclick:()=>{f.match=v;S.bLimit=24;drawGenrePanel();renderLibrary()}})))),
    h("div",{class:"ddsearch"},h("input",{type:"search",id:"gSearch",placeholder:"Find a genre","aria-label":"Find a genre",value:search,oninput:()=>drawGenrePanel()})),
    h("p",{class:"ddhint",text:"Click once to include, twice to exclude, again to clear."}),
    gl.length?h("div",{class:"gchecks"},...gl.map(([k,v])=>{const st=genreState(k);
      return h("button",{type:"button",class:"gck "+st,"aria-pressed":st==="inc"?"true":st==="exc"?"mixed":"false","aria-label":v.label+(st==="inc"?", included":st==="exc"?", excluded":""),onclick:()=>{cycleGenre(k);S.bLimit=24;drawGenrePanel();renderLibrary()}},
        h("span",{class:"box","aria-hidden":"true",text:st==="inc"?"✓":st==="exc"?"✕":""}),h("span",{class:"gname",text:v.label}),h("span",{class:"gn",text:v.n}))}))
      :h("p",{class:"note",style:"margin:8px 0",text:"No genres match."}),
    h("div",{class:"ddfoot"},h("button",{type:"button",class:"linkbtn",text:"Clear genres",onclick:()=>{f.inc.clear();f.exc.clear();drawGenrePanel();renderLibrary()}}),h("button",{type:"button",class:"btn sm primary",text:"Done",onclick:()=>closeDD()})));
  if(keep){const i=$("gSearch");i.focus();i.setSelectionRange(i.value.length,i.value.length)}}
function drawAuthorPanel(){const panel=$("ddAuthors").querySelector(".ddpanel");const f=S.f;const search=panel.querySelector("#auSearch")?.value||"";const keep=document.activeElement?.id==="auSearch";
  const al=authorsList().filter(([,v])=>!search||v.label.toLowerCase().includes(search.toLowerCase()));
  panel.replaceChildren(h("div",{class:"ddsearch"},h("input",{type:"search",id:"auSearch",placeholder:"Find an author","aria-label":"Find an author",value:search,oninput:()=>drawAuthorPanel()})),
    al.length?h("div",{class:"gchecks one"},...al.map(([k,v])=>{const on=f.authors.has(k);return h("button",{type:"button",class:"gck"+(on?" inc":""),"aria-pressed":String(on),onclick:()=>{on?f.authors.delete(k):f.authors.add(k);S.bLimit=24;drawAuthorPanel();renderLibrary()}},
      h("span",{class:"box","aria-hidden":"true",text:on?"✓":""}),h("span",{class:"gname",text:v.label}),h("span",{class:"gn",text:v.n}))})):h("p",{class:"note",style:"margin:8px 0",text:"No authors match."}),
    h("div",{class:"ddfoot"},h("button",{type:"button",class:"linkbtn",text:"Clear authors",onclick:()=>{f.authors.clear();drawAuthorPanel();renderLibrary()}}),h("button",{type:"button",class:"btn sm primary",text:"Done",onclick:()=>closeDD()})));
  if(keep){const i=$("auSearch");i.focus();i.setSelectionRange(i.value.length,i.value.length)}}
let openDD=null;
function closeDD(refocus=true){if(!openDD)return;openDD.querySelector(".ddpanel").hidden=true;const b=openDD.querySelector(".ddbtn");b.setAttribute("aria-expanded","false");openDD=null;if(refocus)b.focus()}
function toggleDD(id){const dd=$(id);if(openDD===dd){closeDD();return}if(openDD)closeDD(false);openDD=dd;dd.querySelector(".ddbtn").setAttribute("aria-expanded","true");
  const panel=dd.querySelector(".ddpanel");panel.hidden=false;id==="ddGenres"?drawGenrePanel():drawAuthorPanel();panel.querySelector("input")?.focus()}
$("ddGenres").querySelector(".ddbtn").addEventListener("click",()=>toggleDD("ddGenres"));
$("ddAuthors").querySelector(".ddbtn").addEventListener("click",()=>toggleDD("ddAuthors"));
document.addEventListener("click",e=>{if(openDD&&!e.composedPath().includes(openDD))closeDD(false)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&openDD)closeDD()});
function syncControls(){const f=S.f;$("fSort").value=f.sort;$("fStatus").value=f.status;$("fAccess").value=f.access;$("fUpd").value=f.upd||"";$("fHere").value=f.here;
  if(document.activeElement!==$("fMinCh"))$("fMinCh").value=f.minCh||"";if(document.activeElement!==$("bq"))$("bq").value=S.q}
function renderLibrary(){const f=S.f;syncControls();
  const gl=Object.fromEntries(genreCounts());const lab=k=>gl[k]?.label||k;
  $("gVal").textContent=!f.inc.size&&!f.exc.size?"Any":[...[...f.inc].map(lab),...[...f.exc].map(k=>"not "+lab(k))].join(", ");
  const al=Object.fromEntries(authorsList());$("auVal").textContent=f.authors.size?[...f.authors].map(k=>al[k]?.label||k).join(", "):"Any";
  const advN=(f.minCh?1:0)+(f.upd?1:0)+(f.authors.size?1:0)+(f.here?1:0);$("advCount").hidden=!advN;$("advCount").textContent=advN;
  if(advN&&$("advRow").hidden){$("advRow").hidden=false;$("advBtn").setAttribute("aria-expanded","true")}
  // chips
  const chips=[];const chip=(text,off,cls)=>chips.push(h("button",{type:"button",class:"fchip"+(cls?" "+cls:""),"aria-label":"Remove filter: "+text,onclick:()=>{off();S.bLimit=24;renderLibrary()}},text,h("span",{"aria-hidden":"true",text:"×"})));
  if(S.q.trim())chip("“"+S.q.trim()+"”",()=>{S.q="";$("hq").value=""});
  for(const k of f.inc)chip(lab(k),()=>f.inc.delete(k));
  for(const k of f.exc)chip("Not "+lab(k),()=>f.exc.delete(k),"neg");
  if(f.inc.size>1)chip(f.match==="and"?"Has all genres":"Has any genre",()=>{f.match=f.match==="and"?"or":"and"});
  if(f.status)chip(STATUS[f.status],()=>f.status="");
  if(f.access)chip(f.access==="free"?"Free to read":"Members only",()=>f.access="");
  for(const k of f.authors)chip("By "+(al[k]?.label||k),()=>f.authors.delete(k));
  if(f.minCh)chip(f.minCh+"+ chapters",()=>f.minCh=0);
  if(f.upd)chip("Updated in "+({1:"24 hours",7:"7 days",30:"30 days",90:"3 months"}[f.upd]||f.upd+" days"),()=>f.upd=0);
  if(f.here)chip("On this site",()=>f.here="");
  if(chips.length>1)chips.push(h("button",{type:"button",class:"linkbtn",text:"Reset all",onclick:resetFilters}));
  $("fchips").replaceChildren(...chips);
  const list=filtered();const view=LS.get("bview","list");
  for(const b of document.querySelectorAll(".viewtog button"))b.setAttribute("aria-pressed",String(b.dataset.view===view));
  const res=$("results");res.className=view==="grid"?"grid":"blist";
  res.replaceChildren(...list.slice(0,S.bLimit).map(view==="grid"?b=>card(b):listItem));
  $("bMore").hidden=list.length<=S.bLimit;$("bMore").textContent="Show more ("+(list.length-S.bLimit)+" left)";
  $("count").replaceChildren(...(!S.loaded?["Loading the shelf"]:[h("b",{text:list.length.toLocaleString()})," "+(list.length===1?"item":"items")]));
  const em=$("libEmpty");em.hidden=!(S.loaded&&!list.length);
  if(!em.hidden)em.replaceChildren(emptyBox(S.books.length?"Nothing matches yet":"The shelf is empty",
    S.books.length?"Try removing a filter or two.":(S.canEdit?"Open the Dashboard and add your first book.":"New books are on the way. Check back soon.")));
  if(openDD)openDD.id==="ddGenres"?drawGenrePanel():drawAuthorPanel();
}
function resetFilters(){const f=S.f;S.q="";$("hq").value="";f.inc.clear();f.exc.clear();f.authors.clear();Object.assign(f,{match:"and",status:"",access:"",minCh:0,upd:0,here:""});S.bLimit=24;renderLibrary()}
$("bq").addEventListener("input",e=>{S.q=e.target.value;$("hq").value=S.q;S.bLimit=24;renderLibrary()});
$("fSort").addEventListener("change",async e=>{S.f.sort=e.target.value;if(S.f.sort==="popular"&&!S.hot[30]){try{await loadHot(30)}catch{}}renderLibrary()});
$("fStatus").addEventListener("change",e=>{S.f.status=e.target.value;S.bLimit=24;renderLibrary()});
$("fAccess").addEventListener("change",e=>{S.f.access=e.target.value;S.bLimit=24;renderLibrary()});
$("fUpd").addEventListener("change",e=>{S.f.upd=+e.target.value||0;S.bLimit=24;renderLibrary()});
$("fHere").addEventListener("change",e=>{S.f.here=e.target.value;S.bLimit=24;renderLibrary()});
let minT;$("fMinCh").addEventListener("input",e=>{clearTimeout(minT);minT=setTimeout(()=>{S.f.minCh=Math.max(0,parseInt(e.target.value,10)||0);S.bLimit=24;renderLibrary()},250)});
$("advBtn").addEventListener("click",()=>{const open=$("advRow").hidden;$("advRow").hidden=!open;$("advBtn").setAttribute("aria-expanded",String(open))});
for(const b of document.querySelectorAll(".viewtog button"))b.addEventListener("click",()=>{LS.set("bview",b.dataset.view);renderLibrary()});
$("bMore").addEventListener("click",()=>{S.bLimit+=24;renderLibrary()});
function browseGenre(label){resetFilters();S.f.inc.add(label.toLowerCase());go("browse")}

/* ---------- Home ---------- */
function carousel(stripId,books,ranked){const el=$(stripId);el.replaceChildren(...books.map((b,i)=>card(b,ranked?i+1:0)));el.scrollLeft=0}
function updCard(b){const ch=S.latest[b.id]||[];
  return h("article",{class:"ucard"},h("a",{class:"ucov",href:"#book/"+b.id,tabindex:"-1","aria-hidden":"true"},cover(b,true)),
    h("div",{class:"ubody"},h("a",{class:"ut",href:"#book/"+b.id,text:b.title}),
      ch.length?h("ul",{class:"uch"},...ch.map(c=>{const lk=c.tier_id&&!canReadTier(c.tier_id);return h("li",{class:lk?"locked":null},h("a",{href:"#read/"+c.id,title:lk?"Locked for supporters":null},lk?lockIcon():null,"Ch. "+num(c.number)+(c.title?" · "+c.title:"")),h("span",{class:"ago",text:ago(c.created_at)}))}))
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
  const hc=(S.homeColls||[]).filter(c=>+c.items>0).slice(0,3);$("collSec").hidden=!hc.length;$("homeColls").replaceChildren(...hc.map(collCard));
  $("recentList").replaceChildren(...[...S.books].sort((a,b)=>time(b)-time(a)).slice(0,6).map(b=>rankRow(b,0,(chCount(b)?chCount(b)+" ch · ":"")+"added "+ago(b.created_at))));
  drawHot(seq)}
$("moreUpdates").addEventListener("click",()=>{S.updLimit+=12;renderHome(S.seq)});
for(const btn of document.querySelectorAll("[data-scroll]"))btn.addEventListener("click",()=>{const strip=btn.closest(".hsec").querySelector(".carousel");strip.scrollBy({left:+btn.dataset.scroll*strip.clientWidth*.9,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})});
$("recentAll").addEventListener("click",()=>{S.f.sort="new"});

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
$("hq").addEventListener("input",e=>{S.q=e.target.value;if(S.route.name==="browse"){S.bLimit=24;renderLibrary()}else drawResults()});
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
  const staff=(Array.isArray(b.staff)?b.staff:[]).filter(p=>p&&p.name);const g=b.goal||{};
  const goal=g.target>0?h("div",{class:"goalbar"},h("div",{class:"gtop"},h("b",{text:(g.unit||"")+kfmtg(g.current)+" of "+(g.unit||"")+kfmtg(g.target)}),g.title?h("span",{text:" toward "+g.title}):null),
    h("div",{class:"gtrack",role:"progressbar","aria-valuemin":"0","aria-valuemax":String(g.target),"aria-valuenow":String(Math.min(g.current||0,g.target)),"aria-label":(g.title||"Goal")+" progress"},h("span",{style:`width:${Math.min(100,Math.round((g.current||0)/g.target*100))}%`}))):null;
  el.replaceChildren(...[h("div",{class:"pagehead"},backLink("Home","")),
    b.banner_url?h("div",{class:"bbanner"},h("img",{src:b.banner_url,alt:""})):null,
    h("div",{class:"detail"},cover(b,true),h("div",{style:"min-width:0"},h("h2",{text:b.title}),b.original_title?h("p",{class:"orig",lang:"und",text:b.original_title}):null,b.author?h("p",{class:"by",text:"by "+b.author}):null,
      staff.length?h("p",{class:"staffline"},...staff.flatMap((p,i)=>[i?" · ":"",h("span",{class:"muted",text:p.role+": "}),p.name])):null,
      h("div",{class:"tags"},...(b.genres||[]).map(g=>h("button",{type:"button",class:"tag",title:"Browse "+g,text:g,onclick:()=>browseGenre(g)}))),
      h("dl",{class:"facts"},h("div",{},h("dt",{text:"Status"}),h("dd",{},pill(b.status||"ongoing",STATUS[b.status]||"Ongoing"))),h("div",{},h("dt",{text:"Chapters"}),h("dd",{class:"mono",style:"color:var(--ink);font-size:15px",text:n||"–"}))),
      b.synopsis?h("p",{class:"syn",text:b.synopsis}):h("p",{class:"syn note",text:"No synopsis yet."}),goal,acts)),tocBox].filter(Boolean));
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
  if(S.commReady)acts.append(h("button",{type:"button",class:"btn",onclick:()=>openAddToCollection(b)},"+ Add to collection"));
  if(isUrl(b.paypal))acts.append(h("a",{class:"btn",href:b.paypal,target:"_blank",rel:"noopener",text:"Support on PayPal ↗"}));
  if(isUrl(b.discord_url))acts.append(h("a",{class:"btn",href:b.discord_url,target:"_blank",rel:"noopener",text:"Discord ↗"}));
  if(isUrl(b.discord_supporter_url))acts.append(h("a",{class:"linkbtn",href:b.discord_supporter_url,target:"_blank",rel:"noopener",text:"Supporter Discord ↗"}));
  if(isUrl(b.external_url))acts.append(h("a",{class:"linkbtn",href:b.external_url,target:"_blank",rel:"noopener",text:/novelupdates/i.test(b.external_url)?"Novel Updates ↗":"More info ↗"}));
  if(S.canEdit)acts.append(h("a",{class:"btn",href:"#admin/chapters/"+id,text:"Manage chapters"}),h("button",{type:"button",class:"btn",text:"Edit book",onclick:()=>openBookForm(id)}));
  bookCollectionsSection(id,seq).then(sec=>{if(sec&&seq===S.seq)tocBox.after(sec)});
  if(!toc.length){tocBox.replaceChildren();return}
  const last=LS.get("last:"+id,null);
  let desc=LS.get("tocDesc",false);
  const list=h("div",{class:"toc"});
  const draw=()=>{const items=desc?[...toc].reverse():toc;
    list.replaceChildren(...items.map(c=>{const lk=c.tier_id&&!canReadTier(c.tier_id);const t=c.tier_id&&tierById(c.tier_id);
      return h("a",{class:"tocrow"+(last?.id===c.id?" last":"")+(lk?" locked":""),href:"#read/"+c.id,title:t?(lk?"Locked: ":"Tier: ")+t.name:null},
      h("span",{class:"tn",text:num(c.number)}),h("span",{class:"tt"},lk?lockIcon():null,c.title||"Chapter "+num(c.number)),h("span",{class:"td",text:t?(lk?t.name:"✓ "+t.name):fmtDate(c.created_at)}))}));
    sortBtn.textContent=desc?"Newest first":"Oldest first"};
  const sortBtn=h("button",{type:"button",class:"btn sm",onclick:()=>{desc=!desc;LS.set("tocDesc",desc);draw()}});
  const jump=toc.length>20?h("form",{class:"jump",onsubmit:e=>{e.preventDefault();const v=+jump.querySelector("input").value;const c=toc.find(x=>+x.number===v)||toc.find(x=>+x.number>=v);if(c)go("read/"+c.id);else toast("No chapter "+v+" yet")}},
    h("input",{type:"number",min:"0",step:"any",placeholder:"Go to ch.","aria-label":"Go to chapter number",id:"tocJump"}),h("button",{type:"submit",class:"btn sm",text:"Go"})):null;
  const ts=tiersFor(id);
  if(ts.length){const mineT=new Set(activeMine().map(m=>m.tier_id));
    tocBox.before(h("section",{class:"tiersec"},h("div",{class:"tochead"},h("h2",{},"Support tiers")),
      h("div",{class:"tiergrid"},...ts.map(t=>h("article",{class:"tiercard"+(mineT.has(t.id)?" mine":"")},
        h("div",{class:"tname"},h("b",{text:t.name}),mineT.has(t.id)?h("span",{class:"pill p-published",text:"Your tier"}):null),
        h("div",{class:"tprice"},h("span",{text:money(t.price)}),h("span",{class:"muted",text:" / month"})),
        t.book_id?null:h("p",{class:"note",style:"margin:0",text:"Covers every novel"}),
        t.description?h("p",{class:"tdesc",text:t.description}):null,
        isUrl(t.patreon_url||S.config.join_url)?h("a",{class:"btn sm",href:t.patreon_url||S.config.join_url,target:"_blank",rel:"noopener",text:"Join on Patreon ↗"}):null)))))}
  tocBox.replaceChildren(h("div",{class:"tochead"},h("h2",{},"Chapters ",h("span",{class:"mono",text:toc.length})),h("div",{class:"tools"},jump,sortBtn)),list);
  draw();
}


/* ---------- Patreon (automatic unlocks) ---------- */
function patSql(){return "patreon_tiers" in (S.config||{})}
function patOn(){return !!(S.config&&S.config.patreon_campaign_id)}
function patTiers(){return Array.isArray(S.config?.patreon_tiers)?S.config.patreon_tiers:[]}
const PAT_ERR={sign_in:"Sign in first, then connect Patreon.",not_configured:"Patreon isn't set up on this site yet.",no_function:"Patreon isn't set up on this site yet.",run_sql:"Run update-patreon.sql in Supabase first.",
  expired:"That took too long. Please try connecting again.",reconnect:"Patreon needs you to connect again.",already_linked:"That Patreon account is already connected to a different account on this site.",
  creator_not_connected:"The site owner hasn't finished setting up Patreon yet.",not_owner:"Only the site owner can do that.",no_campaign:"That Patreon account doesn't have a creator page.",patreon_down:"Patreon didn't answer. Try again in a minute.",
  not_connected:"Connect your Patreon first.",server_error:"Something went wrong. Try again in a minute.",access_denied:"Patreon connection was cancelled."};
const PAT_STATUS={active:"Active patron",no_matching_tier:"Your Patreon tier doesn't unlock anything on this site yet",not_a_patron:"No pledge found on our Patreon",former_patron:"Your pledge has ended",declined_patron:"Your last Patreon payment was declined",reconnect:"Please connect again"};
function patMsg(e){return PAT_ERR[e]||PAT_ERR.server_error}
async function patCall(action,extra){if(!sb?.functions)return{ok:false,error:"no_function"};
  try{const r=await sb.functions.invoke("patreon",{body:{action,...(extra||{})}});if(r.error)return{ok:false,error:"no_function"};return r.data||{ok:false,error:"server_error"}}catch(e){return{ok:false,error:"no_function"}}}
async function connectPatreon(kind){if(!S.email){openAuth("in");toast("Sign in or create an account first, then connect Patreon.");return}
  LS.set("patReturn",kind==="creator"?"#admin/settings":(location.hash||"#"));toast("Opening Patreon…");
  const r=await patCall("start",{kind:kind||"reader"});if(r.ok&&r.url){location.href=r.url;return}toast(patMsg(r.error))}
async function loadPatreon(){S.pat=null;if(!S.uid||!patSql())return;const r=await sb.rpc("my_patreon");if(!r.error){const d=Array.isArray(r.data)?r.data[0]:r.data;S.pat=d&&d.connected?d:{connected:false}}}
async function syncPatreon(manual){if(!S.pat?.connected){if(manual)connectPatreon("reader");return}
  if(manual)toast("Checking your Patreon…");const r=await patCall("sync");LS.set("patSync:"+S.uid,Date.now());
  if(r.ok){await loadPatreon();await loadPrivate();rerender();if(manual)toast(r.status==="active"?"All set. Your chapters are unlocked.":PAT_STATUS[r.status]||"Checked")}
  else{if(r.error==="reconnect")await loadPatreon();if(manual||r.error==="reconnect")toast(patMsg(r.error));if(r.error==="reconnect")rerender()}}
async function unlinkPatreon(){const r=await patCall("unlink");if(!r.ok){toast(patMsg(r.error));return}LS.del?.("patSync:"+S.uid);await loadPatreon();await loadPrivate();rerender();toast("Patreon disconnected")}
async function finishPatreon(){const q=new URLSearchParams(location.search);const state=q.get("state"),code=q.get("code"),err=q.get("error");
  if(!state||!(code||err))return false;
  const back=LS.get("patReturn","#")||"#";history.replaceState(null,"",location.pathname+back);
  if(err){toast(patMsg(err==="access_denied"?"access_denied":"server_error"));return true}
  toast("Connecting Patreon…");const r=await patCall("finish",{code,state});
  if(!r.ok){toast(patMsg(r.error));return true}
  if(r.kind==="creator"){await refresh();toast(`Patreon connected. Found ${r.tiers} tier${r.tiers===1?"":"s"}. Now match them under Tiers.`)}
  else{LS.set("patSync:"+S.uid,Date.now());await loadPatreon();await loadPrivate();rerender();toast(r.status==="active"?"Patreon connected. Your chapters are unlocked.":"Patreon connected. "+(PAT_STATUS[r.status]||""))}
  return true}
function patBlock(){if(!patOn()||S.canEdit||!S.email)return null;const p=S.pat;
  if(!p?.connected)return h("div",{class:"accpat"},h("p",{class:"note",text:"Pledged on Patreon? Connect it once and your chapters unlock by themselves."}),h("button",{type:"button",class:"btn primary sm",text:"Connect Patreon",onclick:()=>{closeAcct();connectPatreon("reader")}}));
  return h("div",{class:"accpat"},h("p",{class:"note"},h("b",{text:"Patreon connected"}),p.status?" · "+(PAT_STATUS[p.status]||p.status):"",p.last_sync?" · checked "+ago(p.last_sync):""),
    h("div",{class:"accpatacts"},h("button",{type:"button",class:"btn sm",text:p.status==="reconnect"?"Connect again":"Check now",onclick:()=>{closeAcct();p.status==="reconnect"?connectPatreon("reader"):syncPatreon(true)}}),
      h("button",{type:"button",class:"btn sm",text:"Disconnect",onclick:()=>{closeAcct();unlinkPatreon()}})))}
function patPanel(){const box=h("section",{class:"apanel patpanel"});
  const head=h("div",{class:"patphead"},h("h2",{text:"Patreon"}),h("p",{class:"muted",text:"Readers connect their Patreon once, and their paid chapters unlock by themselves. No more CSV imports."}));
  if(!patSql()){box.append(head,h("p",{class:"banner",text:"Run update-patreon.sql in Supabase (SQL Editor) first, then refresh this page."}));return box}
  const pts=patTiers();
  if(!patOn()){box.append(head,h("p",{text:"Step 1 is done when you see your tiers here. Connect the Patreon account that owns your creator page:"}),
    h("div",{class:"actions"},h("button",{type:"button",class:"btn primary",text:"Connect your Patreon",onclick:()=>connectPatreon("creator")})),
    h("p",{class:"hint",text:"If this says Patreon isn't set up, the Patreon function or its secrets are missing in Supabase."}));return box}
  const mapped=t=>S.tiers.filter(x=>String(x.patreon_tier_id||"")===t.id).map(x=>x.name+(x.book_id?" ("+bookTitle(x.book_id)+")":""));
  box.append(head,h("p",{},h("span",{class:"pill p-active",text:"Connected"})," ",h("span",{class:"muted",text:S.config.patreon_connected_at?"Tier list updated "+ago(S.config.patreon_connected_at):""})),
    h("table",{class:"pattable"},h("thead",{},h("tr",{},h("th",{text:"Patreon tier"}),h("th",{text:"Price"}),h("th",{text:"Unlocks on this site"}))),
      h("tbody",{},...pts.map(t=>{const m=mapped(t);return h("tr",{},h("td",{text:t.title}),h("td",{class:"num",text:money((t.amount_cents||0)/100)}),h("td",{class:m.length?"":"muted",text:m.length?m.join(", "):"Nothing yet. Pick it in a tier under Tiers."}))}))),
    h("div",{class:"actions"},h("a",{class:"btn primary",href:"#admin/tiers",text:"Match tiers"}),
      h("button",{type:"button",class:"btn",text:"Refresh tier list",onclick:async e=>{e.target.disabled=true;const r=await patCall("tiers");e.target.disabled=false;if(r.ok){await refresh();toast("Tier list updated")}else toast(r.error==="reconnect"?"Patreon needs you to connect again.":patMsg(r.error))}}),
      h("button",{type:"button",class:"btn",text:"Reconnect",onclick:()=>connectPatreon("creator")})));
  return box}
/* ---------- Reader ---------- */
/* ---------- Members card (one per tier) ---------- */
const CARD_STORY="Thank you for reading this far. Members get the next chapters early, and every pledge keeps the translations coming.";
const CARD_STICK="Support us\nearly access";
function parseFields(txt){return String(txt||"").split("\n").map(x=>x.trim()).filter(Boolean).slice(0,6).map(x=>{const i=x.indexOf(":");return i>0?{l:x.slice(0,i).trim(),v:x.slice(i+1).trim()}:{l:"",v:x}})}
function autoFields(t,b,from){return[["tier",t?.name||"Members"],["price",money(t?.price)+" / month"],["novel",t?.book_id?(b?.title||"This novel"):"Every novel"],["unlocks",from!=null?"Ch. "+num(from)+" onwards":"Advance chapters"]].map(([l,v])=>({l,v}))}
function cardData(t,ctx={}){const c=t?.card||{};const b=ctx.book&&ctx.book.cover!==undefined?ctx.book:(t?.book_id?S.books.find(x=>x.id===t.book_id):ctx.book)||null;
  const f=parseFields(c.fields);
  return{title:c.title||t?.name||"Members",sub:c.sub||"members card",story:c.story||(t?.description||"").split("\n")[0]||CARD_STORY,
    fields:f.length?f:autoFields(t,b,ctx.from),label:c.label||"",sign:c.sign||siteName().split(/\s+/).slice(0,2).join(" "),stamp:c.stamp||"Members only",
    tri:c.tri==="-"?"":(c.tri||"VIP zone"),stick:c.stick==="-"?"":(c.stick||CARD_STICK),photo:c.photo_url||"",stickImg:c.sticker_url||"",
    coverBook:b&&b.title?b:null,code:t?.id||"members"}}
function svgSpan(cls,markup){const e=h("span",{class:cls,"aria-hidden":"true"});e.innerHTML=markup;return e}
const SVG_CLIP='<svg viewBox="0 0 40 110"><defs><linearGradient id="clipg" x1="0" x2="1"><stop offset="0" stop-color="#8E959C"/><stop offset=".45" stop-color="#F4F6F8"/><stop offset="1" stop-color="#9AA1A8"/></linearGradient></defs><path d="M13 34V88a10 10 0 0 0 20 0V20a14 14 0 0 0-28 0v62a6 6 0 0 0 12 0V34" fill="none" stroke="#5E646B" stroke-width="4.6" stroke-linecap="round" opacity=".35" transform="translate(1.2 1.6)"/><path d="M13 34V88a10 10 0 0 0 20 0V20a14 14 0 0 0-28 0v62a6 6 0 0 0 12 0V34" fill="none" stroke="url(#clipg)" stroke-width="4" stroke-linecap="round"/></svg>';
const SVG_STAR='<svg viewBox="0 0 100 100"><path d="M50 4l13.6 30.4 33 3.6-24.7 22.3 7 32.6L50 76.4 21.1 92.9l7-32.6L3.4 38l33-3.6z" fill="currentColor" stroke="rgba(0,0,0,.18)" stroke-width="2" stroke-linejoin="round"/></svg>';
function triSvg(text){const t=String(text).replace(/[<>&"]/g,"");return svgSpan("tctri",`<svg viewBox="0 0 100 90"><path d="M50 6 95 84H5z" fill="#F4C21A" stroke="#1B1A17" stroke-width="5" stroke-linejoin="round"/><circle cx="50" cy="47" r="10" fill="none" stroke="#1B1A17" stroke-width="2.6"/><circle cx="46.5" cy="44.5" r="1.5" fill="#1B1A17"/><circle cx="53.5" cy="44.5" r="1.5" fill="#1B1A17"/><path d="M45 50a6 6 0 0 0 10 0" fill="none" stroke="#1B1A17" stroke-width="2.2" stroke-linecap="round"/><text x="50" y="74" text-anchor="middle" font-family="Courier Prime,Courier New,monospace" font-weight="700" font-size="10.5" fill="#1B1A17"${t.length>7?' textLength="58" lengthAdjust="spacingAndGlyphs"':""}>${t.toUpperCase()}</text></svg>`)}
function barcodeEl(code){let seed=7;for(const ch of String(code))seed=(seed*31+ch.charCodeAt(0))>>>0;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  let x=0,bars="",i=0;while(x<180){const w=1+Math.floor(rnd()*3.2);if(i%2===0)bars+=`<rect x="${x}" width="${w}" height="44"/>`;x+=w+(i%2===0?0:1);i++}
  let digits="";for(let k=0;k<12;k++)digits+=Math.floor(rnd()*10);
  const e=svgSpan("tcbar",`<svg viewBox="0 0 ${x} 44" preserveAspectRatio="none" fill="#1B1A17">${bars}</svg>`);e.append(h("span",{text:digits}));return e}
function memberCard(d){const [s1,s2]=(d.stick||"").split("\n");
  const ph=d.photo?h("img",{src:d.photo,alt:"",loading:"lazy",decoding:"async"}):d.coverBook?cover(d.coverBook,true):h("span",{class:"tcmono",text:(d.title||"S").trim()[0]||"S"});
  return h("div",{class:"tcwrap"},h("div",{class:"tcard"+(d.stick?" has-stick":"")+(d.tri?" has-tri":"")},
    h("div",{class:"tcleft"},
      h("div",{class:"tcphoto"},h("div",{class:"tcph"},ph),svgSpan("tcclip",SVG_CLIP),svgSpan("tcstar s1",SVG_STAR),svgSpan("tcstar s2",SVG_STAR),d.label?h("span",{class:"tclabel",text:d.label}):null),
      barcodeEl(d.code)),
    h("div",{class:"tchd"},h("span",{class:"tcname",text:d.title}),h("span",{class:"tcsub",text:d.sub})),
    h("div",{class:"tcmain"},
      h("p",{class:"tcstory",text:d.story}),
      d.fields.length?h("dl",{class:"tcform"+(d.fields.length%2?" odd":"")},...d.fields.map(f=>h("div",{class:"tcf"},h("dt",{text:f.l?f.l+":":""}),h("dd",{text:f.v})))):null,
      d.sign?h("p",{class:"tcsign",text:d.sign}):null),
    d.stick?h("span",{class:"tcstick"},h("span",{class:"a",text:s1||""}),s2?h("span",{class:"b",text:s2}):null):null,
    d.tri?triSvg(d.tri):null,
    d.stamp?h("span",{class:"tcstamp",text:d.stamp}):null,
    d.stickImg?h("img",{class:"tcsimg",src:d.stickImg,alt:""}):null))}
function paywall(t,b,mode,from){const join=t.patreon_url||S.config.join_url;
  return h("section",{class:"paywall "+mode,"aria-label":"Members only"},
    h("p",{class:"pwkick",text:mode==="end"?"That was the last free chapter":"Members only"}),
    h("h3",{class:"pwhead",text:mode==="end"?`The story continues for ${t.name} members`:`Chapter ${num(from)} unlocks with ${t.name}`}),
    memberCard(cardData(t,{book:b,from})),
    S.freeIn&&S.freeIn.book===b.id&&S.freeIn.n>0?h("p",{class:"pwfree"},"Free for everyone after ",h("b",{text:S.freeIn.n+" more chapter"+(S.freeIn.n===1?"":"s")}),"."):null,
    h("p",{class:"pwprice"},h("b",{text:money(t.price)}),` a month on Patreon, or any higher tier${t.book_id?" for "+(b.title||"this novel"):""}.`),
    h("div",{class:"actions pwacts"},isUrl(join)?h("a",{class:"btn primary",href:join,target:"_blank",rel:"noopener",text:"Join on Patreon ↗"}):null,
      !S.email?h("button",{type:"button",class:"btn",text:patOn()?"Already a patron? Sign in":"I'm a member, sign in",onclick:()=>openAuth("in")})
      :patOn()&&!S.pat?.connected?h("button",{type:"button",class:"btn",text:"Already a patron? Connect Patreon",onclick:()=>connectPatreon("reader")})
      :patOn()&&S.pat?.connected?h("button",{type:"button",class:"btn",text:S.pat.status==="reconnect"?"Connect Patreon again":"Check my Patreon again",onclick:()=>S.pat.status==="reconnect"?connectPatreon("reader"):syncPatreon(true)}):null),
    h("p",{class:"note",text:patOn()?(!S.email?"Already pledged? Sign in (or make a free account), then connect your Patreon once. Your chapters unlock by themselves after that."
        :S.pat?.connected?(S.pat.status==="active"?"Your Patreon is connected, but your tier doesn't include this chapter. A higher tier unlocks it.":(PAT_STATUS[S.pat.status]||"Your Patreon is connected.")+". If you just pledged, tap Check again.")
        :"Already pledged? Connect your Patreon once and your chapters unlock by themselves.")
      :S.email?`You're signed in as ${S.email}. If you've just joined, your access may take a little while to be added. Make sure Patreon uses this same email.`:"Sign in with the same email you use on Patreon."}))}

function lockBox(c,b){const t=tierById(c.tier_id);const join=t?.patreon_url||S.config.join_url;
  return h("div",{class:"lockbox"},h("div",{class:"lockic"},lockIcon()),
    h("h3",{text:"This chapter is for supporters"}),
    h("p",{text:t?`It unlocks with the ${t.name} tier (${money(t.price)}/month) or any higher tier for ${b.title}.`:"It unlocks with a membership."}),
    S.email?h("p",{class:"note",text:`You're signed in as ${S.email}. If you've just joined on Patreon, your access may take a little while to be added. Make sure Patreon uses this same email.`})
      :h("p",{class:"note",text:"Already a member? Sign in with the same email you use on Patreon."}),
    h("div",{class:"actions",style:"justify-content:center"},isUrl(join)?h("a",{class:"btn primary",href:join,target:"_blank",rel:"noopener",text:"Join on Patreon ↗"}):null,
      S.email?null:h("button",{type:"button",class:"btn",text:"Sign in",onclick:()=>openAuth("in")})))}
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
  const r=await getChapter(id);
  if(seq!==S.seq)return;
  if(r.error||!r.data){el.replaceChildren(h("div",{class:"pagehead"},backLink("Home","")),emptyBox("Chapter not available","It may have been moved, or it isn't published yet."));return}
  const c=r.data;const b=S.books.find(x=>x.id===c.book_id)||{id:c.book_id,title:"Back to book"};
  let toc=[];try{toc=await loadToc(c.book_id)}catch(e){console.warn(e)}
  if(seq!==S.seq)return;
  const nav=toc.filter(x=>x.published||x.id===c.id);if(!nav.some(x=>x.id===c.id))nav.push(c);nav.sort((a,b)=>a.number-b.number);
  const i=nav.findIndex(x=>x.id===c.id);const prev=nav[i-1],next=nav[i+1];S.readerNav={prev,next};
  {const pub=nav.filter(x=>x.published);const tgt=c.locked?c:next;const rn=tgt?pub.filter(x=>+x.number>=+tgt.number).length:0;S.freeIn=isAuto(c.book_id)&&tgt?{book:c.book_id,n:autoMax(c.book_id)-rn+1}:null}
  if(c.published&&!c.locked){LS.set("last:"+c.book_id,{id:c.id,number:c.number});
    const vk="v:"+c.id+":"+today();if(!S.canEdit&&!LS.get(vk,false)){LS.set(vk,true);sb.rpc("record_view",{p_book:c.book_id}).then(()=>{},()=>{})}}
  document.title=`Ch. ${num(c.number)}${c.title?": "+c.title:""} · ${b.title}`;
  const navBar=()=>h("nav",{class:"rnav","aria-label":"Chapter navigation"},
    prev?h("a",{class:"btn",href:"#read/"+prev.id,rel:"prev"},"← Previous"):h("span",{class:"btn ghost","aria-hidden":"true"},"← Previous"),
    h("a",{class:"btn",href:"#book/"+b.id,text:"Contents"}),
    next?h("a",{class:"btn primary",href:"#read/"+next.id,rel:"next"},"Next →"):h("span",{class:"note",text:"You're all caught up"}));
  const setBox=h("div",{class:"rset",id:"rset",hidden:true});
  const setBtn=h("button",{type:"button",class:"btn sm","aria-expanded":"false","aria-controls":"rset",text:"Aa",title:"Reading settings",onclick:()=>{setBox.hidden=!setBox.hidden;setBtn.setAttribute("aria-expanded",String(!setBox.hidden))}});
  const cbox=h("section",{class:"comments",id:"comments","aria-label":"Comments"});
  el.replaceChildren(
    h("div",{class:"rtop"},h("a",{class:"back",href:"#book/"+b.id},"← ",h("span",{class:"rbk",text:b.title})),
      h("div",{class:"rtools"},h("select",{class:"rjump","aria-label":"Jump to chapter",onchange:e=>go("read/"+e.target.value)},
        ...nav.map(x=>h("option",{value:x.id,selected:x.id===c.id?true:null,text:"Ch. "+num(x.number)+(x.title?" · "+x.title:"")+(x.published?"":" (draft)")}))),setBtn)),
    setBox,
    h("article",{class:"chapter"},
      h("h2",{class:"rtitle"},h("span",{class:"rnum",text:(c.volume?"Volume "+c.volume+(c.volume_title?": "+c.volume_title:"")+" · ":"")+"Chapter "+num(c.number)}),c.title?h("span",{text:c.title}):null),
      c.published?null:h("p",{class:"banner",text:"Draft: only you can see this chapter."}),
      c.locked?(tierById(c.tier_id)?paywall(tierById(c.tier_id),b,"locked",c.number):lockBox(c,b)):h("div",{class:"chapter-body"},...renderBody(c.content)),
      !c.locked&&c.note?h("aside",{class:"tlnote"},h("p",{class:"eyebrow",text:"Translator's note"}),h("div",{},...renderBody(c.note))):null),
    !c.locked&&next&&next.tier_id&&tierById(next.tier_id)&&!canReadTier(next.tier_id)?paywall(tierById(next.tier_id),b,"end",next.number):null,
    navBar(),cbox);
  drawSettings();
  if(S.commReady&&!c.locked)el.querySelector(".rtools").prepend(h("button",{type:"button",class:"btn sm",id:"jumpComments",text:"Comments",onclick:()=>cbox.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})}));
  renderComments(c,cbox);
  if(S.canEdit)el.querySelector(".rtools").append(h("button",{type:"button",class:"btn sm",text:"Edit",onclick:()=>openChapterForm(c.book_id,c.id)}));
}
document.addEventListener("keydown",e=>{if(S.route.name!=="read"||e.altKey||e.ctrlKey||e.metaKey||document.querySelector("dialog[open]")||/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName||""))return;
  if(e.key==="ArrowLeft"&&S.readerNav.prev)go("read/"+S.readerNav.prev.id);if(e.key==="ArrowRight"&&S.readerNav.next)go("read/"+S.readerNav.next.id)});
for(const ev of ["copy","cut","contextmenu","dragstart"])document.addEventListener(ev,e=>{if(!S.canEdit&&e.target?.closest?.(".chapter-body"))e.preventDefault()});

/* ---------- Chapter editor (full page) ---------- */
function draftKey(){const e=S.editChapter;return e?"draft:"+e.bookId+":"+(e.id||"new"):null}
function bodyText(){return htmlToText($("chBody").innerHTML)}
function brify(root){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const ts=[];while(w.nextNode())if(w.currentNode.nodeValue.includes("\n"))ts.push(w.currentNode);
  for(const t of ts){const parts=t.nodeValue.split("\n");const frag=document.createDocumentFragment();parts.forEach((p,i)=>{if(i)frag.append(document.createElement("br"));if(p)frag.append(p)});t.replaceWith(frag)}return root}
function setBody(text){const nodes=renderBody(text).map(brify);$("chBody").replaceChildren(...(nodes.length?nodes:[h("p",{},h("br"))]))}
let wordT;function updWords(){clearTimeout(wordT);wordT=setTimeout(()=>{$("chWords").textContent=words($("chBody").innerText).toLocaleString()+" words"},200)}
let draftT;
function saveDraftSoon(){clearTimeout(draftT);draftT=setTimeout(()=>{const k=draftKey();if(k&&S.chDirty)LS.set(k,{num:$("chNum").value,title:$("chTitle").value,body:bodyText(),note:$("chNote").value})},800)}
function chMarkDirty(){if(!S.editChapter)return;S.chDirty=true;$("chDirty").hidden=false;saveDraftSoon()}
function chClearDirty(){S.chDirty=false;$("chDirty").hidden=true}
$("chapterForm").addEventListener("input",e=>{if(e.target.id==="chBody")updWords();if(e.target.id==="chTitle")$("chDlgTitle").textContent=e.target.value.trim()||("Chapter "+($("chNum").value||""));chMarkDirty()});
$("chapterForm").addEventListener("change",()=>chMarkDirty());
try{document.execCommand("defaultParagraphSeparator",false,"p")}catch{}
for(const b of document.querySelectorAll(".rtebar [data-cmd]"))b.addEventListener("mousedown",e=>e.preventDefault());
for(const b of document.querySelectorAll(".rtebar [data-cmd]"))b.addEventListener("click",()=>{$("chBody").focus();const c=b.dataset.cmd;
  if(c==="scene")document.execCommand("insertHTML",false,'<hr class="scene"><p><br></p>');else document.execCommand(c,false,null);updWords();chMarkDirty()});
$("chBody").addEventListener("paste",e=>{const cd=e.clipboardData;if(!cd)return;const html=cd.getData("text/html"),plain=cd.getData("text/plain");
  let t="";try{t=html?htmlToText(html):plain}catch{t=plain}if(!t)return;e.preventDefault();
  const wrap=brify(h("div",{},...renderBody(t)));document.execCommand("insertHTML",false,wrap.innerHTML);updWords();chMarkDirty()});
$("chBody").addEventListener("drop",e=>{if(e.dataTransfer?.files?.length)e.preventDefault()});
function fillBookSel(bookId,lock){const sel=$("chBookSel");
  sel.replaceChildren(...[...S.books].sort((a,b)=>(a.title||"").localeCompare(b.title||"")).map(b=>h("option",{value:b.id,text:b.title,selected:b.id===bookId?true:null})));sel.disabled=!!lock}
function fillTierSel(bookId,tierId){const sel=$("chTier");
  if(!S.memReady){sel.replaceChildren(h("option",{value:"",text:"Free (tiers not set up yet)"}));sel.disabled=true;$("chTierHint").textContent="Run update-memberships.sql in Supabase to lock chapters to tiers.";return}
  sel.disabled=false;const ts=tiersFor(bookId);
  sel.replaceChildren(h("option",{value:"",text:"Free — everyone can read"}),...ts.map(t=>h("option",{value:t.id,selected:t.id===tierId?true:null,text:t.name+" ("+money(t.price)+")"+(t.book_id?"":" · all novels")})));
  const hint=()=>{const t=tierById(sel.value);$("chTierHint").textContent=t?`Locked. Readers need ${t.name} or a higher tier.`:ts.length?"Free chapters can be read by everyone.":"No tiers for this novel yet. Add them under Subscriptions → Tiers."};hint();sel.onchange=hint;
  if(isAuto(bookId)){sel.disabled=true;$("chTierHint").textContent=`Automatic: published chapters stay ${autoMax(bookId)} ahead of free readers, so this is set for you when you publish.`}}
$("chBookSel").addEventListener("change",async e=>{const e2=S.editChapter;if(!e2||e2.id)return;e2.bookId=e.target.value;let toc=[];try{toc=await loadToc(e2.bookId)}catch{}
  $("chNum").value=toc.length?Math.floor(Math.max(...toc.map(x=>+x.number)))+1:1;fillTierSel(e2.bookId,"");chCrumbs()});
function chCrumbs(){const e=S.editChapter;const b=S.books.find(x=>x.id===e?.bookId);
  $("chCrumbs").replaceChildren(h("a",{href:"#",text:siteName()}),h("span",{"aria-hidden":"true",text:"/"}),h("a",{href:"#admin/chapters",text:"Chapters"}),h("span",{"aria-hidden":"true",text:"/"}),b?h("a",{href:"#admin/novels/"+b.id,text:b.title}):null)}
function chMeta(c){const m=$("chMeta");
  if(!c){m.replaceChildren(h("span",{},"Status: ",h("b",{text:"Not saved yet"})));return}
  m.replaceChildren(h("span",{},"Status: ",h("b",{text:c.published?"Published":"Draft"})," — ",h("button",{type:"button",class:"linkbtn inl",text:c.published?"Unpublish":"Publish",onclick:()=>saveChapter(!c.published,false)})),
    h("span",{},"Last modified: ",h("b",{text:fmtDateTime(c.updated_at||c.created_at)})),h("span",{},"Created: ",h("b",{text:fmtDateTime(c.created_at)})))}
function setTab(t){const notes=t==="notes";$("tabContent").setAttribute("aria-selected",String(!notes));$("tabNotes").setAttribute("aria-selected",String(notes));$("paneContent").hidden=notes;$("paneNotes").hidden=!notes}
$("tabContent").addEventListener("click",()=>setTab("content"));$("tabNotes").addEventListener("click",()=>setTab("notes"));
function openChapterForm(bookId,id){if(!S.chaptersReady){toast("Run update-chapters.sql in Supabase first");return}if(!S.books.length){toast("Add a novel first");return}
  go("admin/chapter/"+(id?id:"new"+(bookId?"/"+bookId:"")))}
const CH_PAGE=$("chPage");
async function renderChapterEditor(id,bookId,seq){stashForms();
  for(const a of document.querySelectorAll(".anav a"))a.dataset.col==="chapters"?a.setAttribute("aria-current","page"):a.removeAttribute("aria-current");
  if(!S.loaded){$("amain").replaceChildren(h("p",{class:"count pad",text:"Loading"}));return}
  if(!S.chaptersReady){$("amain").replaceChildren(crumbs("Chapters"),h("div",{class:"banner",text:"Chapters aren't switched on yet. Run update-chapters.sql in Supabase, then refresh."}));return}
  if(!S.books.length){$("amain").replaceChildren(crumbs("Chapters"),emptyBox("Add a novel first","Chapters belong to a novel. Create one under Novels."));return}
  let c=null;
  if(id!=="new"){$("amain").replaceChildren(h("p",{class:"count pad",text:"Loading chapter"}));const r=await getChapter(id);if(seq!==S.seq)return;
    if(r.error||!r.data){$("amain").replaceChildren(crumbs("Chapters"),emptyBox("Chapter not found","It may have been deleted."));return}c=r.data;bookId=c.book_id}
  if(!bookId||!S.books.some(b=>b.id===bookId))bookId=lstate("chapters").filters.book||S.books[0].id;
  let toc=[];try{toc=await loadToc(bookId)}catch{}if(seq!==S.seq)return;
  const next=toc.length?Math.floor(Math.max(...toc.map(x=>+x.number)))+1:1;
  S.editChapter={bookId,id:c?.id||null,published:c?!!c.published:false,chapter:c};S.chOpen=true;
  $("amain").replaceChildren(CH_PAGE);setTab("content");
  fillBookSel(bookId,!!c);fillTierSel(bookId,c?.tier_id||"");chCrumbs();chMeta(c);
  $("chNum").value=c?num(c.number):next;$("chTitle").value=c?.title||"";setBody(c?.content||"");$("chNote").value=c?.note||"";$("chVol").value=c?.volume||"";$("chVolTitle").value=c?.volume_title||"";
  if(!c&&toc.length){const prev=[...toc].sort((a,b)=>b.number-a.number)[0];if(prev?.volume){$("chVol").value=prev.volume;$("chVolTitle").value=prev.volume_title||""}if(prev?.tier_id&&S.memReady)fillTierSel(bookId,prev.tier_id)}
  $("chErr").textContent="";chClearDirty();
  const d=LS.get(draftKey(),null);
  if(d&&(d.body||"")!==bodyText()){$("chNum").value=d.num||$("chNum").value;$("chTitle").value=d.title||"";setBody(d.body||"");$("chNote").value=d.note||"";S.chDirty=true;$("chDirty").hidden=false;$("chErr").textContent="Restored your unsaved text from this device."}
  $("chDlgTitle").textContent=$("chTitle").value.trim()||(c?"Chapter "+num(c.number):"New chapter");
  document.title=($("chTitle").value.trim()||"Chapter")+" · Dashboard";
  updWords();(c?$("chBody"):$("chTitle")).focus()}
async function saveChapter(published,addNext){
  const e=S.editChapter;if(!e)return;const err=$("chErr");err.textContent="";
  const n=parseFloat($("chNum").value),body=bodyText();
  if(!Number.isFinite(n)||n<0){err.textContent="Add a chapter number, like 12 or 12.5.";$("chNum").focus();return}
  if(!body){err.textContent="Add the chapter text before saving.";setTab("content");$("chBody").focus();return}
  const row={book_id:e.bookId,number:n,title:$("chTitle").value.trim(),content:body,words:words(body),published,updated_at:new Date().toISOString()};
  if(S.memReady)Object.assign(row,{tier_id:$("chTier").value||null,volume:$("chVol").value.trim(),volume_title:$("chVolTitle").value.trim(),note:$("chNote").value.trim()});
  const btns=[$("chSave"),$("chDraftBtn"),$("chPubMore")];btns.forEach(b=>b.disabled=true);closeChMenus();
  try{const r=e.id?await sb.from("chapters").update(row).eq("id",e.id):await sb.from("chapters").insert(row).select("id").single();
    if(r.error)throw r.error;const newId=e.id||r.data?.id;
    LS.del(draftKey());chClearDirty();
    toast(published?(e.published||!e.id?"Chapter "+num(n)+" published":"Chapter "+num(n)+" published"):"Draft saved");
    await loadToc(e.bookId,true);await refresh();
    if(addNext){go("admin/chapter/new/"+e.bookId);return}
    if(!e.id&&newId){location.replace("#admin/chapter/"+newId);return}
    e.published=published;const fresh=(await loadToc(e.bookId)).find(x=>x.id===e.id);chMeta(fresh||{...e.chapter,published,updated_at:row.updated_at});
    if(S.route.name==="read")route()}
  catch(x){console.error(x);err.textContent=x?.code==="23505"?"Chapter "+num(n)+" already exists in this novel. Use a different number or edit that chapter.":"Couldn't save. Check you're still signed in, then try again."}
  finally{btns.forEach(b=>b.disabled=false)}}
$("chapterForm").addEventListener("submit",ev=>{ev.preventDefault();saveChapter(true,false)});
$("chDraftBtn").addEventListener("click",()=>saveChapter(false,false));
$("chSaveNext").addEventListener("click",()=>saveChapter(true,true));
$("chDraftNext").addEventListener("click",()=>saveChapter(false,true));
function closeChMenus(){for(const [m,b] of [["chPubMenu","chPubMore"],["chMenu","chMore"]]){$(m).hidden=true;$(b).setAttribute("aria-expanded","false")}}
$("chPubMore").addEventListener("click",()=>{const open=$("chPubMenu").hidden;closeChMenus();$("chPubMenu").hidden=!open;$("chPubMore").setAttribute("aria-expanded",String(open))});
$("chMore").addEventListener("click",()=>{const open=$("chMenu").hidden;closeChMenus();if(!open)return;const e=S.editChapter;
  $("chMenu").replaceChildren(...(e?.id?[h("a",{class:"mi",href:"#read/"+e.id,target:"_blank",rel:"noopener",text:"View on site ↗"}),h("a",{class:"mi",href:"#admin/novels/"+e.bookId,text:"Open the novel"}),
    confirmBtn("Delete chapter",async()=>{const r=await sb.from("chapters").delete().eq("id",e.id);if(r.error){toast("Couldn't delete it. Try again.");return}LS.del(draftKey());chClearDirty();toast("Chapter deleted");await loadToc(e.bookId,true).catch(()=>{});await refresh();go("admin/chapters/"+e.bookId)})]
    :[h("p",{class:"note",style:"margin:4px 6px",text:"Save the chapter to see more actions."})]));$("chMenu").hidden=false;$("chMore").setAttribute("aria-expanded","true")});
document.addEventListener("click",e=>{const p=e.composedPath();if(!p.includes($("ddChPub"))&&!p.includes($("ddChMore")))closeChMenus()});
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
      {label:"Delete",danger:true,done:n=>n+" deleted",run:async ids=>{const paths=S.books.filter(b=>ids.includes(b.id)).flatMap(b=>[b.cover_path,b.banner_path]).filter(Boolean);
        const r=await sb.from("books").delete().in("id",ids);if(!r.error){if(paths.length)await sb.storage.from("covers").remove(paths).catch(()=>{});for(const id of ids)delete S.tocP[id]}return r}}],
    empty:"No novels yet. Click Create new to add your first one."};
  if(col==="chapters")return{col,title:"Chapters",create:()=>openChapterForm(lstate("chapters").filters.book,null),search:"Search by title or chapter number",server:true,defSort:{key:"updated",dir:"desc"},
    notice:S.chaptersReady?null:"Chapters aren't switched on yet. Run update-chapters.sql in Supabase (SQL Editor), then refresh this page.",
    filters:[{key:"book",label:"All novels",opts:byTitle.map(b=>[b.id,b.title])},{key:"status",label:"Any status",opts:[["published","Published"],["draft","Draft"]]}],
    cols:[{key:"number",label:"Ch.",cell:c=>h("span",{class:"num",text:num(c.number)})},
      {key:"title",label:"Title",cell:c=>h("button",{type:"button",class:"alink",text:c.title||"Chapter "+num(c.number),onclick:()=>openChapterForm(c.book_id,c.id)})},
      {key:"book",label:"Novel",nosort:true,cell:c=>h("span",{class:"muted",text:bookTitle(c.book_id)})},
      {key:"volume",label:"Volume",nosort:true,cell:c=>h("span",{class:"muted",text:c.volume?c.volume+(c.volume_title?" · "+c.volume_title:""):"—"})},
      {key:"status",label:"Status",cell:c=>c.published?pill("published","Published"):pill("draft","Draft")},
      {key:"tier",label:"Tier",nosort:true,cell:c=>{const t=c.tier_id&&tierById(c.tier_id);return t?h("span",{class:"tierchip"},lockIcon(),t.name):h("span",{class:"muted",text:"Free"})}},
      {key:"words",label:"Words",cell:c=>h("span",{class:"num muted",text:(c.words||0).toLocaleString()})},
      {key:"updated",label:"Updated",cell:c=>h("span",{class:"num muted",text:ago(c.updated_at||c.created_at)})},
      {key:"view",label:"",nosort:true,cell:c=>h("a",{class:"alink muted",href:"#read/"+c.id,text:"View ↗"})}],
    async fetch(st){if(!S.chaptersReady)return{rows:[],total:0};
      let q=sb.from("chapters").select(chCols(),{count:"exact"});
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
  if(col==="genres")return{col,title:"Genres",create:addGenre,createLabel:"Add genre",search:"Search genres",defSort:{key:"novels",dir:"desc"},filters:[],
    cols:[{key:"name",label:"Name",cell:g=>h("button",{type:"button",class:"alink",text:g.label,onclick:()=>renameGenre(g.id,g.label)})},
      {key:"novels",label:"Novels",cell:g=>h("a",{class:"alink num",href:"#admin/novels",onclick:()=>{const st=lstate("novels",{sort:{key:"updated",dir:"desc"}});st.filters={genre:g.id};st.page=1}},String(g.n)," →")}],
    async fetch(st){const q=st.q.trim().toLowerCase();const rows=allGenres().map(([k,v])=>({id:k,label:v.label,n:v.n})).filter(g=>!q||g.id.includes(q));
      return localPage(rows,st,{novels:g=>g.n,name:g=>g.id})},
    bulk:[{label:"Delete",danger:true,done:n=>n+" deleted",run:async ids=>{const set=new Set(ids);
      const keep=savedGenres().filter(g=>!set.has(g.toLowerCase()));if(keep.length!==savedGenres().length){const r=await saveGenreList(keep);if(r.error)return r}
      for(const b of S.books){const gs=(b.genres||[]).filter(g=>!set.has(g.toLowerCase()));if(gs.length!==(b.genres||[]).length){const r=await sb.from("books").update({genres:gs}).eq("id",b.id);if(r.error)return r}}return{}}}],
    empty:"No genres yet. Click Add genre to create your first one."};
  if(col==="tiers")return{col,title:"Tiers",intro:"Tiers are the levels readers pay for on Patreon. A chapter locked to a tier can be read by members of that tier, or of any higher-priced tier for the same novel.",
    create:()=>openTier(null),search:"Search by name",defSort:{key:"novel",dir:"asc"},
    notice:S.memReady?null:"Tiers aren't switched on yet. Run update-memberships.sql in Supabase (SQL Editor), then refresh this page.",
    filters:[{key:"book",label:"All novels",opts:[["__all","Tiers for all novels"],...byTitle.map(b=>[b.id,b.title])]}],
    cols:[{key:"name",label:"Name",cell:t=>h("button",{type:"button",class:"alink",text:t.name,onclick:()=>openTier(t.id)})},
      {key:"novel",label:"Novel",cell:t=>h("span",{text:t.book_id?bookTitle(t.book_id):"All novels"})},
      {key:"description",label:"Description",nosort:true,cell:t=>h("span",{class:"muted clamp1",text:t.description||"—"})},
      {key:"price",label:"Price",cell:t=>h("span",{class:"num",text:money(t.price)})},
      ...(autoReady()?[{key:"ahead",label:"Ahead",cell:t=>h("span",{class:+t.chapters_ahead?"num":"muted",text:+t.chapters_ahead?t.chapters_ahead+" ch":"—"})}]:[]),
      ...(patSql()?[{key:"patreon",label:"Patreon tier",nosort:true,cell:t=>{const p=patTiers().find(x=>x.id===String(t.patreon_tier_id||""));return h("span",{class:p?"":"muted",text:p?p.title:"Not linked"})}}]:[])],
    async fetch(st){const q=st.q.trim().toLowerCase();const f=st.filters.book;
      const rows=S.tiers.filter(t=>(!f||(f==="__all"?!t.book_id:t.book_id===f))&&(!q||(t.name||"").toLowerCase().includes(q)));
      return localPage(rows,st,{novel:t=>(t.book_id?bookTitle(t.book_id):"").toLowerCase()+"|"+String(+t.price).padStart(8,"0"),name:t=>(t.name||"").toLowerCase(),price:t=>+t.price})},
    bulk:[{label:"Delete",danger:true,run:ids=>sb.from("tiers").delete().in("id",ids),done:n=>n+" deleted. Chapters that used them are now free; memberships for them were removed."}],
    after(){S.tocP={}},
    empty:"No tiers yet. Create one for each Patreon tier, for example Friends ($3) and Royalty ($10)."};
  if(col==="memberships")return{col,title:"Memberships",server:true,intro:"Who has paid for which tier. Readers sign in on the site with the same email they use on Patreon.",
    create:()=>openMembership(null),extra:[{label:"Import from Patreon",run:openImport}],search:"Search by email",defSort:{key:"expires",dir:"asc"},
    notice:S.memReady?null:"Memberships aren't switched on yet. Run update-memberships.sql in Supabase (SQL Editor), then refresh this page.",
    filters:[{key:"status",label:"Any status",opts:[["active","Active"],["expired","Expired"],["cancelled","Cancelled"]]},
      {key:"book",label:"All novels",opts:byTitle.filter(b=>S.tiers.some(t=>t.book_id===b.id)).map(b=>[b.id,b.title])},
      {key:"tier",label:"All tiers",opts:[...S.tiers].sort((a,b)=>(a.name||"").localeCompare(b.name||"")).map(t=>[t.id,t.name+(t.book_id?" · "+bookTitle(t.book_id):" · all novels")])}],
    cols:[{key:"status",label:"Status",cell:m=>{const st=msStatus(m);return pill(st==="active"?"active":st==="expired"?"due":"cancelled",st[0].toUpperCase()+st.slice(1))}},
      {key:"email",label:"Email",cell:m=>h("button",{type:"button",class:"alink",text:m.email,onclick:()=>openMembership(m)})},
      {key:"tier",label:"Tier",nosort:true,cell:m=>{const t=tierById(m.tier_id);return h("div",{class:"tmeta"},h("span",{text:t?t.name:"Deleted tier"}),h("span",{class:"sub",text:t?(t.book_id?bookTitle(t.book_id):"All novels"):""}))}},
      {key:"expires",label:"Expires",cell:m=>h("span",{class:"num muted",text:m.expires_at?fmtDateTime(m.expires_at):"No end date"})},
      {key:"source",label:"Added by",nosort:true,cell:m=>h("span",{class:"muted",text:m.source==="patreon"?"Patreon import":"You"})}],
    async fetch(st){if(!S.memReady)return{rows:[],total:0};const now=new Date().toISOString();
      let q=sb.from("memberships").select("id,email,tier_id,status,expires_at,note,source,created_at",{count:"exact"});
      const f=st.filters;
      if(f.status==="active")q=q.eq("status","active").or("expires_at.is.null,expires_at.gt."+now);
      else if(f.status==="expired")q=q.eq("status","active").lt("expires_at",now);
      else if(f.status==="cancelled")q=q.eq("status","cancelled");
      if(f.tier)q=q.eq("tier_id",f.tier);else if(f.book){const ids=S.tiers.filter(t=>t.book_id===f.book).map(t=>t.id);q=q.in("tier_id",ids.length?ids:["00000000-0000-0000-0000-000000000000"])}
      const s=st.q.trim().toLowerCase();if(s)q=q.ilike("email","%"+s.replace(/[%_\\]/g,"")+"%");
      const key={email:"email",expires:"expires_at",status:"status"}[st.sort.key]||"expires_at";
      q=q.order(key,{ascending:st.sort.dir==="asc",nullsFirst:false});
      const r=await q.range((st.page-1)*st.per,st.page*st.per-1);if(r.error)throw r.error;return{rows:r.data||[],total:r.count??(r.data||[]).length}},
    bulk:[{label:"Extend 30 days",done:n=>n+" extended by 30 days",run:async ids=>{const r=await sb.from("memberships").select("id,expires_at").in("id",ids);if(r.error)return r;
        for(const m of r.data||[]){const base=Math.max(Date.now(),Date.parse(m.expires_at)||0);const u=await sb.from("memberships").update({expires_at:new Date(base+30*86400000).toISOString(),status:"active",updated_at:new Date().toISOString()}).eq("id",m.id);if(u.error)return u}return{}}},
      {label:"Cancel",done:n=>n+" cancelled",run:ids=>sb.from("memberships").update({status:"cancelled",updated_at:new Date().toISOString()}).in("id",ids)},
      {label:"Delete",danger:true,done:n=>n+" deleted",run:ids=>sb.from("memberships").delete().in("id",ids)}],
    empty:"No memberships yet. Add one by hand, or import your Patreon members."};
  if(col==="comments")return{col,title:"Comments",server:true,intro:"Every comment on the site, newest first. Hidden comments show as deleted to readers. Blocking stops a reader from commenting, liking or making collections, and hides their comments.",
    search:"Search comment text",defSort:{key:"date",dir:"desc"},
    notice:S.commReady?null:"Comments aren't switched on yet. Run update-community.sql in Supabase (SQL Editor), then refresh this page.",
    filters:[{key:"status",label:"Any status",opts:[["visible","Visible"],["hidden","Hidden"]]},{key:"book",label:"All novels",opts:byTitle.map(b=>[b.id,b.title])}],
    cols:[{key:"author",label:"Reader",nosort:true,cell:m=>{const n=S.nameCache?.[m.user_id]||"Reader";return h("a",{class:"tcell alink",href:"#reader/"+m.user_id,target:"_blank",rel:"noopener"},avatar(n,m.user_id,"sm"),h("span",{text:n}))}},
      {key:"body",label:"Comment",nosort:true,cell:m=>h("div",{class:"tmeta"},h("span",{class:"clamp2"+(m.deleted?" muted":""),text:(m.deleted?"[Hidden] ":"")+(m.spoiler?"[Spoiler] ":"")+(m.parent_id?"↳ ":"")+m.body}))},
      {key:"where",label:"Chapter",nosort:true,cell:m=>{const ch=S.chCache?.[m.chapter_id];return h("a",{class:"alink muted",href:"#read/"+m.chapter_id,target:"_blank",rel:"noopener"},bookTitle(m.book_id)+(ch?" · Ch. "+num(ch.number):""))}},
      {key:"date",label:"Posted",cell:m=>h("span",{class:"num muted",title:fmtDateTime(m.created_at),text:ago(m.created_at)})}],
    async fetch(st){if(!S.commReady)return{rows:[],total:0};
      let q=sb.from("comments").select("id,chapter_id,book_id,user_id,parent_id,body,spoiler,deleted,created_at",{count:"exact"});
      if(st.filters.status==="visible")q=q.eq("deleted",false);else if(st.filters.status==="hidden")q=q.eq("deleted",true);
      if(st.filters.book)q=q.eq("book_id",st.filters.book);
      const s=st.q.trim();if(s)q=q.ilike("body","%"+s.replace(/[%_\\]/g,"")+"%");
      q=q.order("created_at",{ascending:st.sort.dir==="asc"});
      const r=await q.range((st.page-1)*st.per,st.page*st.per-1);if(r.error)throw r.error;const rows=r.data||[];
      S.cmRows=Object.fromEntries(rows.map(x=>[x.id,x]));S.nameCache||={};S.chCache||={};
      const uids=[...new Set(rows.map(x=>x.user_id))].filter(u=>!S.nameCache[u]);if(uids.length){const p=await sb.from("profiles").select("user_id,display_name").in("user_id",uids);for(const x of p.data||[])S.nameCache[x.user_id]=x.display_name}
      const cids=[...new Set(rows.map(x=>x.chapter_id))].filter(c=>!S.chCache[c]);if(cids.length){const c=await sb.from("chapters").select("id,number").in("id",cids);for(const x of c.data||[])S.chCache[x.id]=x}
      return{rows,total:r.count??rows.length}},
    bulk:[{label:"Hide",done:n=>n+" hidden",run:ids=>sb.from("comments").update({deleted:true}).in("id",ids)},
      {label:"Restore",done:n=>n+" restored",run:ids=>sb.from("comments").update({deleted:false}).in("id",ids)},
      {label:"Block reader",done:n=>"Blocked the authors of "+n+" comments",run:async ids=>{const us=[...new Set(ids.map(i=>S.cmRows?.[i]?.user_id).filter(Boolean))];for(const u of us){const r=await sb.rpc("set_blocked",{p_user:u,p_blocked:true});if(r.error)return r}return{}}},
      {label:"Unblock reader",done:n=>"Unblocked the authors of "+n+" comments",run:async ids=>{const us=[...new Set(ids.map(i=>S.cmRows?.[i]?.user_id).filter(Boolean))];for(const u of us){const r=await sb.rpc("set_blocked",{p_user:u,p_blocked:false});if(r.error)return r}return{}}},
      {label:"Delete",danger:true,done:n=>n+" deleted for good",run:ids=>sb.from("comments").delete().in("id",ids)}],
    empty:"No comments yet."};
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
const ED_PAGE=$("edPage"),CFG_FORM=$("cfgForm");
function stashForms(){if(CH_PAGE.parentNode!==$("chStash"))$("chStash").append(CH_PAGE);if(ED_PAGE.parentNode!==$("edStash"))$("edStash").append(ED_PAGE);if(CFG_FORM.parentNode!==$("stash"))$("stash").append(CFG_FORM)}
function renderAdmin(col,id){stashForms();
  if(!COLS_OK.includes(col))col="novels";
  for(const a of document.querySelectorAll(".anav a"))a.dataset.col===col?a.setAttribute("aria-current","page"):a.removeAttribute("aria-current");
  if(col!=="chapter")document.title=(col==="settings"?"Settings":col==="about"?"About page":adminCfg(col).title)+" · Dashboard";
  if(col==="about"){for(const a2 of document.querySelectorAll(".anav a"))a2.dataset.col==="about"?a2.setAttribute("aria-current","page"):a2.removeAttribute("aria-current");renderAboutAdmin();return}
  if(col!=="novels"||!id)S.edOpen=false;
  if(col!=="chapter")S.chOpen=false;
  if(col==="novels"&&id){renderNovelEditor(id);return}
  if(col==="chapter"){renderChapterEditor(id||"new",S.route.book||null,S.seq);return}
  if(col==="settings"){S.list=null;fillSettings();$("amain").replaceChildren(crumbs("Settings"),h("div",{class:"ahead"},h("h1",{text:"Settings"})),patPanel(),CFG_FORM);return}
  const cfg=adminCfg(col);const st=lstate(col,{sort:cfg.defSort});
  if(col==="chapters"&&id){st.filters.book=id;st.q="";st.page=1}
  if(S.list?.cfg.col!==col||id)st.sel.clear();
  mountList(cfg,st)}
const COLS_OK=["novels","chapters","genres","members","tiers","memberships","comments","about","settings","chapter"];
function mountList(cfg,st,container){
  const E={bulk:h("div",{class:"abulk",hidden:true}),thead:h("thead"),tbody:h("tbody"),empty:h("div",{class:"aempty",hidden:true}),pager:h("div",{class:"apager"}),count:h("span",{class:"acount"})};
  S.list={cfg,st,el:E};
  const sbox=h("div",{class:"asearch"});sbox.innerHTML=ICON_SEARCH;
  sbox.append(h("input",{type:"search",id:"aq",placeholder:cfg.search,"aria-label":cfg.search,value:st.q,oninput:e=>{st.q=e.target.value;st.page=1;clearTimeout(S.aqT);S.aqT=setTimeout(refreshList,cfg.server?250:0)}}));
  const filters=cfg.filters.map(f=>h("select",{"aria-label":f.label,onchange:e=>{st.filters[f.key]=e.target.value;st.page=1;st.sel.clear();refreshList()}},
    h("option",{value:"",text:f.label}),...f.opts.map(([v,t])=>h("option",{value:v,text:t,selected:st.filters[f.key]===v?true:null}))));
  (container||$("amain")).replaceChildren(...[cfg.embedded?null:crumbs(cfg.title),
    cfg.embedded?h("div",{class:"edchhead"},h("h2",{text:cfg.title}),E.count,cfg.create?h("button",{type:"button",class:"btn sm",text:cfg.createLabel||"Create new",onclick:cfg.create}):null)
      :h("div",{class:"ahead"},h("h1",{text:cfg.title}),cfg.create?h("button",{type:"button",class:"btn sm",text:cfg.createLabel||"Create new",onclick:cfg.create}):null,...(cfg.extra||[]).map(x=>h("button",{type:"button",class:"btn sm",text:x.label,onclick:x.run})),E.count),
    cfg.intro?h("p",{class:"aintro",text:cfg.intro}):null,
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
  const filtered=!!st.q.trim()||Object.entries(st.filters).some(([k,v])=>v&&!(cfg.embedded&&k==="book"));
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
function openPrompt({title,label,value,onSave,type,maxLength}){$("pTitle").textContent=title;$("pLabel").textContent=label;$("pInput").type=type||"text";$("pInput").maxLength=maxLength||(type==="password"?72:40);$("pInput").value=value||"";$("pErr").textContent="";promptSave=onSave;$("promptDlg").showModal();$("pInput").select()}
$("promptForm").addEventListener("submit",async e=>{e.preventDefault();if(!promptSave)return;$("pSave").disabled=true;const msg=await promptSave($("pInput").value);$("pSave").disabled=false;
  if(msg){$("pErr").textContent=msg;return}$("promptDlg").close()});
function renameGenre(key,label){openPrompt({title:"Rename genre",label:"Genre name",value:label,async onSave(v){const nv=tidyGenre(v);if(!nv)return"Add a name for the genre.";
  for(const b of S.books.filter(b=>(b.genres||[]).some(g=>g.toLowerCase()===key))){const gs=[];for(const g of b.genres){const x=g.toLowerCase()===key?nv:g;if(!gs.some(y=>y.toLowerCase()===x.toLowerCase()))gs.push(x)}
    const r=await sb.from("books").update({genres:gs}).eq("id",b.id);if(r.error)return"Couldn't rename it. Check you're still logged in, then try again."}
  if(savedGenres().some(g=>g.toLowerCase()===key)){const list=[];for(const g of savedGenres()){const x=g.toLowerCase()===key?nv:g;if(!list.some(y=>y.toLowerCase()===x.toLowerCase()))list.push(x)}await saveGenreList(list)}
  toast("Genre renamed");await refresh()}})}
function addGenre(){openPrompt({title:"Add genre",label:"Genre name",value:"",async onSave(v){const nv=tidyGenre(v);if(!nv)return"Type a name for the genre.";
  if(allGenres().some(([k])=>k===nv.toLowerCase()))return"“"+nv+"” already exists.";
  const r=await saveGenreList([...savedGenres(),nv]);
  if(r.error)return/genres|column|schema/i.test(r.error.message||"")?"Run update-genres.sql in Supabase first, then try again.":"Couldn't add it. Check you're still logged in, then try again.";
  toast("“"+nv+"” added");await refresh()}})}
$("aLogout").addEventListener("click",()=>logout());

/* ---------- Tiers & memberships (dashboard) ---------- */
function msStatus(m){return m.status==="cancelled"?"cancelled":m.expires_at&&Date.parse(m.expires_at)<=Date.now()?"expired":"active"}
let editTier=null;
const TC={photo:null,stick:null};
const TC_IDS={title:"tcTitle",sub:"tcSub",story:"tcStory",fields:"tcFields",label:"tcLabel",sign:"tcSign",stamp:"tcStamp",tri:"tcTri",stick:"tcStick"};
function tcFile(kind,file){const old=TC[kind];if(old?.url&&old.file)URL.revokeObjectURL(old.url);TC[kind]=file?{file,url:URL.createObjectURL(file)}:{removed:true}}
function tierDraft(){const card={};for(const[k,id]of Object.entries(TC_IDS))card[k]=$(id).value.trim();
  const t=editTier?tierById(editTier):null;const oc=t?.card||{};
  card.photo_url=TC.photo?(TC.photo.url||""):(oc.photo_url||"");card.sticker_url=TC.stick?(TC.stick.url||""):(oc.sticker_url||"");
  return{id:editTier||"new-tier",name:$("tName").value.trim()||"Your tier",price:parseFloat($("tPrice").value)||0,book_id:$("tBook").value||null,description:$("tDesc").value.trim(),card}}
function drawTierPreview(){const t=tierDraft();const b=t.book_id?S.books.find(x=>x.id===t.book_id):null;
  $("tPrev").replaceChildren(memberCard(cardData(t,{book:b})));
  $("tcTitle").placeholder=t.name;$("tcStory").placeholder=t.description.split("\n")[0]||CARD_STORY;
  $("tcFields").placeholder=autoFields(t,b,null).map(f=>f.l+": "+f.v).join("\n");$("tcSign").placeholder=siteName().split(/\s+/).slice(0,2).join(" ");$("tcLabel").placeholder="e.g. Lya's profile";
  $("tPhotoRm").hidden=!t.card.photo_url;$("tStickRm").hidden=!t.card.sticker_url}
function fillPatSelect(t){const sel=$("tPat"),wrap=$("tPatWrap");wrap.hidden=!patSql();if(!patSql())return;const pts=patTiers();
  sel.replaceChildren(h("option",{value:"",text:pts.length?"Not linked to Patreon":"Connect Patreon in Settings first"}),...pts.map(p=>h("option",{value:p.id,text:p.title+" ("+money((p.amount_cents||0)/100)+")",selected:String(t?.patreon_tier_id||"")===p.id?true:null})));
  if(t?.patreon_tier_id&&!pts.some(p=>p.id===String(t.patreon_tier_id)))sel.append(h("option",{value:t.patreon_tier_id,selected:true,text:"Old Patreon tier (refresh the list in Settings)"}))}
function openTier(id){if(!S.memReady){toast("Run update-memberships.sql in Supabase first");return}const t=id?tierById(id):null;editTier=id||null;fillPatSelect(t);$("tAheadWrap").hidden=!autoReady();$("tAhead").value=t&&+t.chapters_ahead?+t.chapters_ahead:"";
  $("tierTitle").textContent=t?"Edit tier":"New tier";$("tName").value=t?.name||"";$("tPrice").value=t?(+t.price):"";$("tUrl").value=t?.patreon_url||"";$("tDesc").value=t?.description||"";$("tErr").textContent="";
  const f=lstate("tiers").filters.book;
  $("tBook").replaceChildren(h("option",{value:"",text:"All novels"}),...[...S.books].sort((a,b)=>(a.title||"").localeCompare(b.title||"")).map(b=>h("option",{value:b.id,text:b.title,selected:(t?t.book_id===b.id:f===b.id)?true:null})));
  const c=t?.card||{};for(const[k,fid]of Object.entries(TC_IDS))$(fid).value=c[k]||"";
  for(const k of ["photo","stick"]){if(TC[k]?.file)URL.revokeObjectURL(TC[k].url);TC[k]=null}$("tPhotoIn").value="";$("tStickIn").value="";
  drawTierPreview();$("tierDlg").showModal();$("tName").focus()}
$("tierForm").addEventListener("input",()=>drawTierPreview());
$("tierForm").addEventListener("change",e=>{if(e.target.id==="tBook")drawTierPreview()});
for(const[inp,kind]of [["tPhotoIn","photo"],["tStickIn","stick"]])$(inp).addEventListener("change",e=>{const f=e.target.files[0];if(!f)return;if(!/^image\//.test(f.type)){$("tErr").textContent="That file isn't a picture.";return}if(f.size>15*1024*1024){$("tErr").textContent="That picture is too big. Try one under 15 MB.";return}$("tErr").textContent="";tcFile(kind,f);drawTierPreview()});
$("tPhotoRm").addEventListener("click",()=>{tcFile("photo",null);$("tPhotoIn").value="";drawTierPreview()});
$("tStickRm").addEventListener("click",()=>{tcFile("stick",null);$("tStickIn").value="";drawTierPreview()});
async function tierCardRow(){const t=editTier?tierById(editTier):null;const oc=t?.card||{};const card={};
  for(const[k,id]of Object.entries(TC_IDS)){const v=$(id).value.trim();if(v)card[k]=v}
  const old=[];
  for(const[kind,u,pth,max,type]of [["photo","photo_url","photo_path",900,null],["stick","sticker_url","sticker_path",500,"image/png"]]){const st=TC[kind];
    if(st?.file){const up=await uploadImage(st.file,max,type);card[u]=up.url;card[pth]=up.path;if(oc[pth])old.push(oc[pth])}
    else if(st?.removed){if(oc[pth])old.push(oc[pth])}
    else if(oc[u]){card[u]=oc[u];if(oc[pth])card[pth]=oc[pth]}}
  return{card,old}}
$("tierForm").addEventListener("submit",async e=>{e.preventDefault();const err=$("tErr");err.textContent="";
  const name=$("tName").value.trim(),price=parseFloat($("tPrice").value),url=$("tUrl").value.trim();
  if(!name){err.textContent="Give the tier a name.";$("tName").focus();return}
  if(!Number.isFinite(price)||price<0){err.textContent="Add a price, like 3 or 9.99.";$("tPrice").focus();return}
  if(url&&!isUrl(url)){err.textContent="The Patreon link needs to start with https://";$("tUrl").focus();return}
  const row={name,price,book_id:$("tBook").value||null,patreon_url:url,description:$("tDesc").value.trim()};
  if(patSql())row.patreon_tier_id=$("tPat").value||"";
  if(autoReady()){const a=parseInt($("tAhead").value||"0",10);if(!Number.isFinite(a)||a<0||a>500){err.textContent="Chapters ahead should be a number from 0 to 500.";$("tAhead").focus();return}row.chapters_ahead=a}
  $("tSave").disabled=true;let extra;
  try{extra=await tierCardRow()}catch(x){$("tSave").disabled=false;err.textContent=x?.message==="too_big"?"That picture is too big. Try a smaller one.":"Couldn't upload the picture. Check you're still signed in, then try again.";return}
  row.card=extra.card;
  const r=editTier?await sb.from("tiers").update(row).eq("id",editTier):await sb.from("tiers").insert(row);
  $("tSave").disabled=false;
  if(r.error){err.textContent=/card|column|schema/i.test(r.error.message||"")?"Run update-tier-cards.sql in Supabase first, then save again.":"Couldn't save the tier. Check you're still signed in, then try again.";return}
  for(const pth of extra.old)removeCoverFile(pth);
  for(const k of ["photo","stick"]){if(TC[k]?.file)URL.revokeObjectURL(TC[k].url);TC[k]=null}
  $("tierDlg").close();toast(editTier?"Tier updated":"Tier created");S.tocP={};await refresh()});
let editMs=null;
function tierOptions(sel,selected){const groups=new Map();for(const t of [...S.tiers].sort((a,b)=>+a.price-+b.price)){const k=t.book_id?bookTitle(t.book_id):"All novels";if(!groups.has(k))groups.set(k,[]);groups.get(k).push(t)}
  sel.replaceChildren(...[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([g,ts])=>h("optgroup",{label:g},...ts.map(t=>h("option",{value:t.id,text:t.name+" ("+money(t.price)+")",selected:t.id===selected?true:null})))))}
function openMembership(m){if(!S.memReady){toast("Run update-memberships.sql in Supabase first");return}
  if(!S.tiers.length){toast("Create a tier first, under Tiers");return}
  editMs=m?.id||null;$("msTitle").textContent=m?"Edit membership":"New membership";$("msEmail").value=m?.email||"";tierOptions($("msTier"),m?.tier_id||lstate("memberships").filters.tier);
  $("msStatus").value=m?.status||"active";$("msExp").value=m?.expires_at?String(m.expires_at).slice(0,10):new Date(Date.now()+31*86400000).toISOString().slice(0,10);$("msNote").value=m?.note||"";$("msErr").textContent="";
  $("msDlg").showModal();$("msEmail").focus()}
$("msForm").addEventListener("submit",async e=>{e.preventDefault();const err=$("msErr");err.textContent="";
  const email=$("msEmail").value.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(email)){err.textContent="Type the reader's email address.";$("msEmail").focus();return}
  const exp=$("msExp").value;const row={email,tier_id:$("msTier").value,status:$("msStatus").value,expires_at:exp?new Date(exp+"T23:59:59").toISOString():null,note:$("msNote").value.trim(),updated_at:new Date().toISOString()};
  $("msSave").disabled=true;
  const r=editMs?await sb.from("memberships").update(row).eq("id",editMs):await sb.from("memberships").insert({...row,source:"manual"});
  $("msSave").disabled=false;
  if(r.error){err.textContent=r.error.code==="23505"?"This reader already has that tier. Edit their existing membership instead.":"Couldn't save. Check you're still signed in, then try again.";return}
  $("msDlg").close();toast(editMs?"Membership updated":"Membership added");refreshList()});
/* Patreon CSV import */
function parseCSV(text){const rows=[];let row=[],f="",q=false;text=text.replace(/^﻿/,"");
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
    else if(c==='"')q=true;else if(c===","){row.push(f);f=""}else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(f);rows.push(row);row=[];f=""}else f+=c}
  if(f!==""||row.length){row.push(f);rows.push(row)}return rows.filter(r=>r.some(x=>x.trim()))}
function patreonDate(s){s=(s||"").trim();if(!s)return null;const d=new Date(s.replace(" ","T").replace(/\.\d+$/,""));return isNaN(d)?null:d}
let imp=null;
function openImport(){if(!S.memReady){toast("Run update-memberships.sql in Supabase first");return}if(!S.tiers.length){toast("Create your tiers first, so patrons can be matched to them");return}
  imp=null;$("impBody").replaceChildren();$("impDlg").showModal()}
$("impFile").addEventListener("change",async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;const body=$("impBody");
  let rows;try{rows=parseCSV(await f.text())}catch{body.replaceChildren(h("p",{class:"err",text:"Couldn't read that file. Make sure it's the CSV export from Patreon."}));return}
  const head=(rows.shift()||[]).map(x=>x.trim().toLowerCase());const col=n=>head.findIndex(x=>x===n);
  const iE=col("email"),iT=col("tier"),iS=col("patron status"),iN=col("next charge date"),iA=col("access expiration"),iL=col("last charge date"),iName=col("name");
  if(iE<0||iT<0){body.replaceChildren(h("p",{class:"err",text:"This file is missing the Email or Tier column. Use Patreon's member export (Audience → Export CSV)."}));return}
  const people=[];let skipped=0;
  for(const r of rows){const email=(r[iE]||"").trim().toLowerCase();const tier=(r[iT]||"").trim();const st=iS>=0?(r[iS]||"").toLowerCase():"active patron";
    if(!email||!tier||!st.includes("active")){skipped++;continue}
    let exp=patreonDate(iN>=0?r[iN]:"")||patreonDate(iA>=0?r[iA]:"");if(!exp){const l=patreonDate(iL>=0?r[iL]:"");exp=new Date((l?l.getTime():Date.now())+32*86400000)}
    exp=new Date(exp.getTime()+2*86400000);
    people.push({email,tier,expires_at:exp.toISOString(),name:iName>=0?r[iName]:""})}
  const names=[...new Set(people.map(p=>p.tier))].sort();
  imp={people,map:{}};
  for(const n of names){const m=S.tiers.filter(t=>(t.name||"").trim().toLowerCase()===n.toLowerCase());imp.map[n]=m.length===1?m[0].id:""}
  const draw=()=>{const ready=people.filter(p=>imp.map[p.tier]).length;
    body.replaceChildren(
      h("p",{},h("b",{text:people.length.toLocaleString()+" active patrons found"}),skipped?h("span",{class:"muted",text:` (${skipped.toLocaleString()} rows skipped: former patrons, followers or no tier)`}):null),
      h("div",{class:"tscroll"},h("table",{class:"maptable"},h("thead",{},h("tr",{},h("th",{text:"Patreon tier"}),h("th",{text:"Patrons"}),h("th",{text:"Tier on your site"}))),
        h("tbody",{},...names.map(n=>{const sel=h("select",{"aria-label":"Site tier for "+n,onchange:e=>{imp.map[n]=e.target.value;draw()}},h("option",{value:"",text:"Skip these patrons"}));
          const tmp=h("select");tierOptions(tmp,imp.map[n]);sel.append(...tmp.childNodes);if(imp.map[n])sel.value=imp.map[n];
          return h("tr",{},h("td",{text:n}),h("td",{class:"num",text:people.filter(p=>p.tier===n).length}),h("td",{},sel))})))),
      h("p",{class:"note",text:"Each membership expires 2 days after the patron's next charge date. Run the import again after each billing cycle to extend everyone who paid."}),
      h("div",{class:"actions"},h("button",{type:"button",class:"btn primary",id:"impGo",disabled:ready?null:true,text:`Import ${ready.toLocaleString()} memberships`,onclick:runImport}),h("span",{class:"note",id:"impMsg"})))};
  draw()});
async function runImport(){const rows=imp.people.filter(p=>imp.map[p.tier]).map(p=>({email:p.email,tier_id:imp.map[p.tier],status:"active",expires_at:p.expires_at,source:"patreon",updated_at:new Date().toISOString()}));
  const seen=new Set();const uniq=rows.filter(r=>{const k=r.email+"|"+r.tier_id;if(seen.has(k))return false;seen.add(k);return true});
  $("impGo").disabled=true;let done=0;
  for(let i=0;i<uniq.length;i+=500){const r=await sb.from("memberships").upsert(uniq.slice(i,i+500),{onConflict:"email,tier_id"});
    if(r.error){$("impMsg").textContent="Stopped after "+done+": "+r.error.message;$("impGo").disabled=false;return}done+=Math.min(500,uniq.length-i);$("impMsg").textContent=`Imported ${done} of ${uniq.length}…`}
  $("impDlg").close();toast(done.toLocaleString()+" memberships imported");refreshList()}

/* ---------- Book form ---------- */
function setCover(k){S.cover=k;for(const b of $("bSwatches").children)b.setAttribute("aria-pressed",String(b.dataset.k===k));if(S.edOpen)coverPreview()}
$("bSwatches").append(...Object.entries(COVERS).map(([k,c])=>h("button",{type:"button","data-k":k,"aria-label":k+" cover","aria-pressed":"false",style:`background:${c[0]}`,onclick:()=>setCover(k)})));
function updUrlHint(){$("bUrlHint").textContent=$("bAccess").value==="members"?"Kept private: only you see this link. Readers get your membership link instead.":"Optional. Only used when the book has no chapters on this site."}
$("bAccess").addEventListener("change",updUrlHint);
async function shrink(file,max=900,type="image/jpeg"){
  try{const img=await createImageBitmap(file);const sc=Math.min(1,max/Math.max(img.width,img.height));
    const c=document.createElement("canvas");c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
    c.getContext("2d").drawImage(img,0,0,c.width,c.height);const blob=await new Promise(r=>c.toBlob(r,type,0.86));if(blob)return blob}catch(e){console.warn(e)}
  if(file.size<=3*1024*1024)return file;throw new Error("too_big")}
function coverPreview(){const old=S.editBook?S.books.find(x=>x.id===S.editBook):null;
  if(S.coverPreviewUrl){URL.revokeObjectURL(S.coverPreviewUrl);S.coverPreviewUrl=null}
  let url="";if(S.coverFile){S.coverPreviewUrl=URL.createObjectURL(S.coverFile);url=S.coverPreviewUrl}else if(!S.coverRemove&&old?.cover_url)url=old.cover_url;
  $("bCovPrev").replaceChildren(cover({title:$("bTitle").value.trim()||"Your title",author:$("bAuthor").value.trim(),genres:parseGenres($("bGenres").value),cover:S.cover,cover_url:url},true));
  $("bCoverRemove").hidden=!url;$("bSwatchField").hidden=!!url}
$("bCoverFile").addEventListener("change",e=>{const f=e.target.files[0];e.target.value="";pickCover(f)});
$("bCoverRemove").addEventListener("click",()=>{S.coverFile=null;S.coverRemove=true;coverPreview();markDirty()});
for(const id of ["bTitle","bAuthor","bGenres"])$(id).addEventListener("input",()=>{if(!$("bCovPrev").querySelector("img"))coverPreview()});
async function removeCoverFile(path){if(path)await sb.storage.from("covers").remove([path]).catch(()=>{})}
function openBookForm(id){go("admin/novels/"+(id||"new"))}
function markDirty(){if(!S.edOpen)return;S.edDirty=true;$("edDirty").hidden=false}
function clearDirty(){S.edDirty=false;$("edDirty").hidden=true}
function edGenres(){return parseGenres($("bGenres").value)}
function setEdGenres(list){$("bGenres").value=list.join(", ");drawTagBox();if(S.edOpen)coverPreview()}
function addEdGenre(v){const t=tidyGenre(v||"");if(!t)return;const l=edGenres();if(l.length>=8&&!l.some(x=>x.toLowerCase()===t.toLowerCase())){$("bErr").textContent="A novel can have up to 8 genres.";return}
  if(!l.some(x=>x.toLowerCase()===t.toLowerCase()))l.push(t);setEdGenres(l);markDirty();$("bTagIn").value=""}
function drawTagBox(){const list=edGenres();const inp=$("bTagIn");const has=k=>list.some(x=>x.toLowerCase()===k);
  $("bTagBox").replaceChildren(...list.map(g=>h("span",{class:"tchip"},h("span",{text:g}),h("button",{type:"button","aria-label":"Remove "+g,text:"×",onclick:()=>{setEdGenres(edGenres().filter(x=>x!==g));markDirty();inp.focus()}}))),inp);
  const rest=allGenres().filter(([k])=>!has(k));
  $("bTagList").replaceChildren(...rest.map(([,v])=>h("option",{value:v.label})));
  const top=[...rest].sort((a,b)=>b[1].n-a[1].n||a[1].label.localeCompare(b[1].label)).slice(0,10);
  $("bSuggest").replaceChildren(...(top.length?[h("span",{class:"hint",text:"Popular:"})]:[]),...top.map(([,v])=>h("button",{type:"button",text:"+ "+v.label,onclick:()=>addEdGenre(v.label)})))}
$("bTagIn").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();addEdGenre($("bTagIn").value)}
  else if(e.key==="Backspace"&&!$("bTagIn").value){const l=edGenres();if(l.length){l.pop();setEdGenres(l);markDirty()}}});
$("bTagIn").addEventListener("change",()=>{const v=$("bTagIn").value;if(allGenres().some(([,x])=>x.label===v))addEdGenre(v)});
$("bTagIn").addEventListener("blur",()=>{if($("bTagIn").value.trim())addEdGenre($("bTagIn").value)});
$("bTagBox").addEventListener("click",e=>{if(e.target===$("bTagBox"))$("bTagIn").focus()});
$("bookForm").addEventListener("input",e=>{if(e.target.id!=="bTagIn")markDirty();if(e.target.id==="bTitle")$("bookDlgTitle").textContent=e.target.value.trim()||"Untitled"});
$("bookForm").addEventListener("change",e=>{if(e.target.id!=="bTagIn")markDirty()});
window.addEventListener("beforeunload",e=>{if(S.edDirty||S.chDirty){e.preventDefault();e.returnValue=""}});
function pickCover(f){if(!f)return;if(!/^image\//.test(f.type)){$("bErr").textContent="That file isn't an image. Pick a JPG, PNG or WebP.";return}
  $("bErr").textContent="";S.coverFile=f;S.coverRemove=false;coverPreview();markDirty()}
$("bDrop").addEventListener("dragover",e=>{e.preventDefault();$("bDrop").classList.add("over")});
$("bDrop").addEventListener("dragleave",()=>$("bDrop").classList.remove("over"));
$("bDrop").addEventListener("drop",e=>{e.preventDefault();$("bDrop").classList.remove("over");pickCover(e.dataTransfer.files[0])});
function edMeta(b){const bits=[["Status",STATUS[b?.status]||"Ongoing"]];if(b){bits.push(["Last modified",fmtDateTime(b.updated_at||b.created_at)],["Created",fmtDateTime(b.created_at)])}else bits.push(["","Not saved yet"]);
  $("edMeta").replaceChildren(...bits.map(([k,v])=>h("span",{},k?k+": ":"",h("b",{text:v}))))}
function fmtDateTime(s){const d=new Date(s);return isNaN(d)?"—":d.toLocaleString(undefined,{day:"numeric",month:"long",year:"numeric",hour:"numeric",minute:"2-digit"})}
const ROLES=["Translator","Editor","Proofreader","Raw provider","Author","Other"];
const V2=["staff","goal","discord_url","discord_supporter_url","paypal","banner_url","banner_path"],V1=["original_title","external_url"];
function staffRow(p){const row=h("div",{class:"srow"},
    h("input",{class:"sname",maxlength:"60",placeholder:"Name","aria-label":"Staff name",value:p?.name||""}),
    h("select",{class:"srole","aria-label":"Role"},...ROLES.map(r=>h("option",{value:r,text:r,selected:(p?.role||"Translator")===r?true:null}))),
    h("button",{type:"button",class:"x sm","aria-label":"Remove person",text:"×",onclick:()=>{row.remove();markDirty()}}));return row}
function setStaff(list){$("bStaff").replaceChildren(...(Array.isArray(list)?list:[]).map(staffRow))}
function getStaff(){return[...$("bStaff").querySelectorAll(".srow")].map(r=>({name:r.querySelector(".sname").value.trim(),role:r.querySelector(".srole").value})).filter(p=>p.name)}
$("bStaffAdd").addEventListener("click",()=>{const r=staffRow(null);$("bStaff").append(r);r.querySelector("input").focus();markDirty()});
function setGoal(g){g=g||{};$("gTitle").value=g.title||"";$("gCur").value=g.current??"";$("gTarget").value=g.target||"";$("gUnit").value=g.unit??"$"}
function getGoal(){const t=parseFloat($("gTarget").value),c=parseFloat($("gCur").value);return{title:$("gTitle").value.trim(),target:Number.isFinite(t)&&t>0?t:0,current:Number.isFinite(c)&&c>0?c:0,unit:$("gUnit").value.trim()}}
function banPreview(){const old=S.editBook?S.books.find(x=>x.id===S.editBook):null;
  if(S.banPreviewUrl){URL.revokeObjectURL(S.banPreviewUrl);S.banPreviewUrl=null}
  let url="";if(S.banFile){S.banPreviewUrl=URL.createObjectURL(S.banFile);url=S.banPreviewUrl}else if(!S.banRemove&&old?.banner_url)url=old.banner_url;
  $("bBanPrev").replaceChildren(url?h("img",{src:url,alt:"Banner preview"}):h("span",{class:"hint",text:"No banner yet"}));$("bBanRemove").hidden=!url}
function pickBanner(f){if(!f)return;if(!/^image\//.test(f.type)){$("bErr").textContent="That file isn't an image. Pick a JPG, PNG or WebP.";return}$("bErr").textContent="";S.banFile=f;S.banRemove=false;banPreview();markDirty()}
$("bBanFile").addEventListener("change",e=>{const f=e.target.files[0];e.target.value="";pickBanner(f)});
$("bBanRemove").addEventListener("click",()=>{S.banFile=null;S.banRemove=true;banPreview();markDirty()});
$("bBanDrop").addEventListener("dragover",e=>{e.preventDefault();$("bBanDrop").classList.add("over")});
$("bBanDrop").addEventListener("dragleave",()=>$("bBanDrop").classList.remove("over"));
$("bBanDrop").addEventListener("drop",e=>{e.preventDefault();$("bBanDrop").classList.remove("over");pickBanner(e.dataTransfer.files[0])});
async function uploadImage(file,max,type){const png=type==="image/png";const blob=await shrink(file,max,png?"image/png":"image/jpeg");const path=(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2))+(png?".png":".jpg");
  const up=await sb.storage.from("covers").upload(path,blob,{contentType:blob.type||"image/jpeg",cacheControl:"31536000",upsert:false});if(up.error)throw up.error;
  return{path,url:sb.storage.from("covers").getPublicUrl(path).data.publicUrl}}
/* Versions */
const VLABEL={title:"Title",original_title:"Original title",synopsis:"Synopsis",author:"Author",staff:"Staff",goal:"Goal",status:"Publication",genres:"Genres",access:"Who can read",external_url:"Novel Updates link",read_url:"Reading link",chapters:"Chapter count",featured:"Featured",auto_release:"Automatic release",cover:"Cover colour",cover_url:"Cover",banner_url:"Banner",discord_url:"Discord",discord_supporter_url:"Supporter Discord",paypal:"PayPal"};
async function loadVersions(id){const r=await sb.from("book_versions").select("id,created_at,data").eq("book_id",id).order("created_at",{ascending:false}).range(0,29);if(r.error)throw r.error;return r.data||[]}
async function saveVersion(id,data){try{const r=await sb.from("book_versions").insert({book_id:id,data});if(r.error)return;
  const old=await sb.from("book_versions").select("id").eq("book_id",id).order("created_at",{ascending:false}).range(30,300);if(old.data?.length)await sb.from("book_versions").delete().in("id",old.data.map(x=>x.id))}catch(e){console.warn(e)}}
async function drawVerCount(id){$("edVerN").textContent="";if(!id)return;try{const v=await loadVersions(id);if(S.editBook===id)$("edVerN").textContent=v.length||""}catch{}}
function changedKeys(a,b){return Object.keys(VLABEL).filter(k=>JSON.stringify(a?.[k]??"")!==JSON.stringify(b?.[k]??""))}
function applyVersion(d){$("bTitle").value=d.title||"";$("bookDlgTitle").textContent=d.title||"Untitled";$("bOrig").value=d.original_title||"";$("bSyn").value=d.synopsis||"";$("bAuthor").value=d.author||"";
  $("bStatus").value=d.status||"ongoing";$("bAccess").value=d.access||"free";$("bExt").value=d.external_url||"";$("bUrl").value=d.read_url||$("bUrl").value;$("bChapters").value=d.chapters||"";$("bFeatured").checked=!!d.featured;$("bAuto").checked=!!d.auto_release;
  $("bGenres").value=(d.genres||[]).join(", ");drawTagBox();setStaff(d.staff);setGoal(d.goal);$("bDisc").value=d.discord_url||"";$("bDiscSup").value=d.discord_supporter_url||"";$("bPay").value=d.paypal||"";
  if(d.cover)setCover(d.cover);coverPreview();updUrlHint();markDirty()}
$("edVersions").addEventListener("click",async()=>{const id=S.editBook;const list=$("verList");
  if(!id){toast("Save the novel first to start keeping versions");return}
  list.replaceChildren(h("li",{class:"note",text:"Loading versions…"}));$("verDlg").showModal();
  let v;try{v=await loadVersions(id)}catch(e){list.replaceChildren(h("li",{class:"note",text:"Versions aren't switched on yet. Run update-novel-extras.sql in Supabase, then save the novel once."}));return}
  if(!v.length){list.replaceChildren(h("li",{class:"note",text:"No versions yet. One is saved every time you click Save changes."}));return}
  list.replaceChildren(...v.map((x,i)=>{const ch=i<v.length-1?changedKeys(x.data,v[i+1].data):null;
    return h("li",{class:"vitem"},h("div",{class:"vinfo"},h("b",{text:fmtDateTime(x.created_at)}),i===0?h("span",{class:"pill p-published",text:"Latest"}):null,
        h("span",{class:"vch",text:ch===null?"First saved version":ch.length?"Changed: "+ch.map(k=>VLABEL[k]).join(", "):"No changes"})),
      i===0?null:h("button",{type:"button",class:"btn sm",text:"Restore",onclick:()=>{applyVersion(x.data);$("verDlg").close();toast("Version restored. Click Save changes to keep it.")}}))}))});
function fillEditor(b){S.editBook=b?.id||null;S.edOpen=true;
  $("bookDlgTitle").textContent=b?.title||"New novel";$("bTitle").value=b?.title||"";$("bOrig").value=b?.original_title||"";$("bAuthor").value=b?.author||"";$("bChapters").value=b?.chapters||"";
  $("bGenres").value=(b?.genres||[]).join(", ");$("bSyn").value=b?.synopsis||"";$("bStatus").value=b?.status||"ongoing";$("bAccess").value=b?.access||"free";$("bExt").value=b?.external_url||"";
  $("bUrl").value=b?(b.access==="members"?(S.links[b.id]||""):(b.read_url||"")):"";$("bFeatured").checked=!!b?.featured;$("bAutoWrap").hidden=!autoReady();$("bAuto").checked=!!b?.auto_release;$("bErr").textContent="";$("bTagIn").value="";
  S.coverFile=null;S.coverRemove=false;setCover(b?.cover||Object.keys(COVERS)[S.books.length%9]);updUrlHint();coverPreview();drawTagBox();
  setStaff(b?.staff);setGoal(b?.goal);$("bDisc").value=b?.discord_url||"";$("bDiscSup").value=b?.discord_supporter_url||"";$("bPay").value=b?.paypal||"";
  S.banFile=null;S.banRemove=false;banPreview();drawVerCount(b?.id);
  $("bAuthList").replaceChildren(...authorsList().map(([,v])=>h("option",{value:v.label})));
  edMeta(b);$("edView").hidden=!b;if(b)$("edView").href="#book/"+b.id;$("edListCh").hidden=!b;if(b)$("edListCh").href="#admin/chapters/"+b.id;
  $("edCrumbs").replaceChildren(h("a",{href:"#",text:siteName()}),h("span",{"aria-hidden":"true",text:"/"}),h("a",{href:"#admin/novels",text:"Novels"}),h("span",{"aria-hidden":"true",text:"/"}),h("span",{text:b?b.title:"New"}));
  clearDirty()}
function edMenu(){const m=$("edMenu");const id=S.editBook;
  m.replaceChildren(...(id?[h("a",{class:"mi",href:"#book/"+id,target:"_blank",rel:"noopener",text:"View on site ↗"}),h("a",{class:"mi",href:"#admin/chapters/"+id,text:"Open in Chapters list"}),
    confirmBtn("Delete novel",async()=>{const r=await sb.from("books").delete().eq("id",id);if(r.error){toast("Couldn't delete it. Try again.");return}
      const b=S.books.find(x=>x.id===id);await removeCoverFile(b?.cover_path);await removeCoverFile(b?.banner_path);delete S.tocP[id];clearDirty();toast("Novel deleted");await refresh();go("admin/novels")})]
    :[h("p",{class:"note",style:"margin:4px 6px",text:"Save the novel to see more actions."})]))}
$("edMore").addEventListener("click",e=>{const p=$("edMenu");const open=p.hidden;p.hidden=!open;$("edMore").setAttribute("aria-expanded",String(open));if(open)edMenu()});
document.addEventListener("click",e=>{if(!$("edMenu").hidden&&!e.composedPath().includes($("ddEdMore"))){$("edMenu").hidden=true;$("edMore").setAttribute("aria-expanded","false")}});
function renderNovelEditor(id){const isNew=id==="new";const b=isNew?null:S.books.find(x=>x.id===id);S.list=null;
  for(const a of document.querySelectorAll(".anav a"))a.dataset.col==="novels"?a.setAttribute("aria-current","page"):a.removeAttribute("aria-current");
  if(!isNew&&!b){S.edOpen=false;$("amain").replaceChildren(crumbs("Novels"),S.loaded?emptyBox("Novel not found","It may have been deleted."):h("p",{class:"count pad",text:"Loading"}));return}
  document.title=(b?b.title:"New novel")+" · Dashboard";
  $("amain").replaceChildren(ED_PAGE);fillEditor(b);
  const ch=$("edChapters");
  if(!b){ch.replaceChildren(h("div",{class:"edchhead"},h("h2",{text:"Chapters"})),h("p",{class:"note",text:"Save the novel first, then you can add chapters here."}));if(isNew)$("bTitle").focus();return}
  const cfg=adminCfg("chapters");
  Object.assign(cfg,{col:"edch",embedded:true,title:"Chapters",create:()=>openChapterForm(b.id,null),createLabel:"Add new",
    filters:cfg.filters.filter(f=>f.key!=="book"),cols:cfg.cols.filter(c=>c.key!=="book"),defSort:{key:"number",dir:"desc"}});
  const st=lstate("edch:"+b.id,{sort:{key:"number",dir:"desc"},per:10});st.filters.book=b.id;
  mountList(cfg,st,ch)}
$("bookForm").addEventListener("submit",async e=>{e.preventDefault();const err=$("bErr");err.textContent="";
  const title=$("bTitle").value.trim(),url=$("bUrl").value.trim(),access=$("bAccess").value;
  if(!title){err.textContent="Add a title to save the novel.";$("bTitle").focus();return}
  if(url&&!isUrl(url)){err.textContent="The reading link needs to start with https://";$("bUrl").focus();return}
  const ext=$("bExt").value.trim();if(ext&&!isUrl(ext)){err.textContent="The Novel Updates link needs to start with https://";$("bExt").focus();return}
  const ch=parseInt($("bChapters").value,10);
  const row={title,author:$("bAuthor").value.trim(),genres:parseGenres($("bGenres").value),synopsis:$("bSyn").value.trim(),status:$("bStatus").value,access,
    chapters:Number.isFinite(ch)&&ch>=0?ch:0,cover:S.cover,featured:$("bFeatured").checked,...(autoReady()?{auto_release:$("bAuto").checked}:{}),read_url:access==="free"?url:"",updated_at:new Date().toISOString()};
  for(const [id2,label] of [["bDisc","Discord link"],["bDiscSup","Supporter Discord link"]]){const v=$(id2).value.trim();if(v&&!isUrl(v)){err.textContent="The "+label+" needs to start with https://";$(id2).focus();return}}
  const pay=$("bPay").value.trim();if(pay&&!isUrl(pay)&&!/^[A-Z0-9-]{4,}$/i.test(pay)){err.textContent="Use a full PayPal link (https://…) or a product ID like PROD-123.";$("bPay").focus();return}
  if(S.hasExtra!==false)Object.assign(row,{original_title:$("bOrig").value.trim(),external_url:ext});
  if(S.hasExtra2!==false)Object.assign(row,{staff:getStaff(),goal:getGoal(),discord_url:$("bDisc").value.trim(),discord_supporter_url:$("bDiscSup").value.trim(),paypal:pay});
  let newBan="",oldBan=S.editBook?S.books.find(x=>x.id===S.editBook)?.banner_path||"":"";
  const old=S.editBook?S.books.find(x=>x.id===S.editBook):null;let newPath="",oldPath=old?.cover_path||"";
  $("bSave").disabled=true;
  try{
    if(S.coverFile){$("bSave").textContent="Uploading cover…";const blob=await shrink(S.coverFile);
      newPath=(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2))+".jpg";
      const up=await sb.storage.from("covers").upload(newPath,blob,{contentType:blob.type||"image/jpeg",cacheControl:"31536000",upsert:false});if(up.error)throw up.error;
      row.cover_url=sb.storage.from("covers").getPublicUrl(newPath).data.publicUrl;row.cover_path=newPath}
    else if(S.coverRemove){row.cover_url="";row.cover_path=""}
    if(S.hasExtra2!==false){if(S.banFile){$("bSave").textContent="Uploading banner…";const up=await uploadImage(S.banFile,1800);newBan=up.path;row.banner_url=up.url;row.banner_path=up.path}
      else if(S.banRemove){row.banner_url="";row.banner_path=""}}
    $("bSave").textContent="Saving…";
    let id=S.editBook;
    const save=()=>id?sb.from("books").update(row).eq("id",id):sb.from("books").insert(row).select("id").single();
    let r=await save();
    if(r.error&&new RegExp(V2.join("|")).test(r.error.message||"")){S.hasExtra2=false;for(const k of V2)delete row[k];if(newBan){await removeCoverFile(newBan);newBan=""}r=await save();if(!r.error)S.extraNote=true}
    if(r.error&&new RegExp(V1.join("|")).test(r.error.message||"")){S.hasExtra=false;for(const k of V1)delete row[k];r=await save();if(!r.error)S.extraNote=true}
    if(r.error)throw r.error;if(!id)id=r.data.id;
    if(access==="members"&&url){const r=await sb.from("private_links").upsert({book_id:id,url});if(r.error)throw r.error}
    else if(S.links[id]){await sb.from("private_links").delete().eq("book_id",id)}
    if(oldPath&&(newPath||S.coverRemove))await removeCoverFile(oldPath);
    if(oldBan&&(newBan||(S.banRemove&&S.hasExtra2!==false)))await removeCoverFile(oldBan);
    {const snap={...row};delete snap.updated_at;delete snap.cover_path;delete snap.banner_path;snap.read_url=url;saveVersion(id,snap).then(()=>drawVerCount(id))}
    const wasNew=!S.editBook;S.coverFile=null;S.coverRemove=false;S.banFile=null;S.banRemove=false;clearDirty();
    toast(wasNew?"Novel created":"Changes saved");await refresh();
    if(S.extraNote){S.extraNote=false;err.textContent="Saved, but some fields were skipped. Run update-novel-extras.sql in Supabase to save Staff, Goal, Discord, PayPal, Banner and Original title."}
    if(wasNew)location.replace("#admin/novels/"+id);else{const nb=S.books.find(x=>x.id===id);edMeta(nb);coverPreview();banPreview()}}
  catch(x){console.error(x);if(newPath)await removeCoverFile(newPath);if(newBan)await removeCoverFile(newBan);
    err.textContent=x?.message==="too_big"?"That image is too large. Try one under 3 MB.":(x?.statusCode||x?.message||"").toString().match(/bucket|row-level|403|not found/i)?"Couldn't upload the cover. Run update-covers.sql in Supabase first.":"Couldn't save. Check you're still logged in, then try again."}
  finally{$("bSave").disabled=false;$("bSave").textContent="Save changes"}});
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

/* ---------- Accounts (readers and owner) ---------- */
let authMode="in";
function setAuthMode(m){authMode=m;const up=m==="up";
  $("authIn").setAttribute("aria-selected",String(!up));$("authIn").setAttribute("aria-pressed",String(!up));$("authUp").setAttribute("aria-selected",String(up));$("authUp").setAttribute("aria-pressed",String(up));
  $("loginTitle").textContent=up?"Create account":"Sign in";$("lBtn").textContent=up?"Create account":"Sign in";$("authForgot").hidden=up;
  $("lPass").setAttribute("autocomplete",up?"new-password":"current-password");$("lErr").textContent="";$("lOk").textContent=""}
function openAuth(mode,intent){S.authIntent=intent||null;setAuthMode(mode||"in");if(!$("loginDlg").open)$("loginDlg").showModal();$("lEmail").focus()}
function openLogin(){openAuth("in","admin")}
$("authIn").addEventListener("click",()=>setAuthMode("in"));$("authUp").addEventListener("click",()=>setAuthMode("up"));
$("ownerLogin").addEventListener("click",openLogin);
function siteUrl(){return location.origin+location.pathname}
$("authForgot").addEventListener("click",async()=>{const email=$("lEmail").value.trim();$("lErr").textContent="";$("lOk").textContent="";
  if(!/^\S+@\S+\.\S+$/.test(email)){$("lErr").textContent="Type your email above first, then click Forgot password.";$("lEmail").focus();return}
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:siteUrl()});
  if(error){$("lErr").textContent="Couldn't send the reset email: "+error.message;return}
  $("lOk").textContent="If that email has an account, a link to reset your password is on its way."});
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();const err=$("lErr"),ok=$("lOk");err.textContent="";ok.textContent="";
  const email=$("lEmail").value.trim(),password=$("lPass").value;
  if(!/^\S+@\S+\.\S+$/.test(email)){err.textContent="Type a valid email address.";$("lEmail").focus();return}
  if(password.length<6){err.textContent="Passwords need at least 6 characters.";$("lPass").focus();return}
  $("lBtn").disabled=true;
  try{
    if(authMode==="up"){const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:siteUrl()}});
      if(error){const m=(error.message||"").toLowerCase();err.textContent=m.includes("not allowed")||m.includes("disabled")?"New accounts are switched off right now. Please try again later.":m.includes("already")?"That email already has an account. Sign in instead.":"Couldn't create the account: "+error.message;return}
      if(data.session){$("lPass").value="";await afterAuth();$("loginDlg").close();toast("Welcome! You're signed in.");if(S.route.name==="read")route();return}
      ok.textContent="Almost done: check your inbox for a confirmation email, click the link, then sign in here.";setAuthMode("in");ok.textContent="Almost done: check your inbox for a confirmation email, click the link, then sign in here.";return}
    const {error}=await sb.auth.signInWithPassword({email,password});
    if(error){const m=(error.message||"").toLowerCase();err.textContent=m.includes("not confirmed")?"Please confirm your email first. Check your inbox for the link we sent.":m.includes("invalid login")?"Wrong email or password.":"Couldn't sign in: "+error.message;return}
    $("lPass").value="";await afterAuth();$("loginDlg").close();toast(S.canEdit?"Signed in as owner":"Signed in");
    if(S.canEdit&&(S.authIntent==="admin"||parseHash().name==="admin")){if(parseHash().name==="admin")route();else go("admin/novels")}else route()}
  finally{$("lBtn").disabled=false}});
async function logout(){await sb.auth.signOut();S.canEdit=false;S.mine=[];await afterAuth();if(S.route.name==="admin")go("");else route();toast("Signed out")}
function drawAcct(){const btn=$("acctBtn");const signed=!!S.email;btn.classList.toggle("on",signed);btn.setAttribute("aria-label",signed?"Your account":"Sign in");btn.title=signed?S.email:"Sign in"}
function acctMenu(){const m=$("acctMenu");const act=activeMine();
  const rows=act.map(x=>{const t=tierById(x.tier_id);const bk=t?.book_id?S.books.find(b=>b.id===t.book_id):null;
    return h("div",{class:"accmem"},h("b",{text:t?t.name:"Tier"}),h("span",{class:"note",text:(bk?bk.title:"All novels")+(x.expires_at?" · until "+fmtDate(String(x.expires_at).slice(0,10)):"")}))});
  m.replaceChildren(h("div",{class:"accwho"},h("span",{class:"note",text:"Signed in as"}),h("b",{text:S.email})),
    S.commReady?h("div",{class:"accprof"},S.profile?h("span",{},h("span",{class:"note",text:"Display name: "}),h("b",{text:S.profile.display_name})):h("span",{class:"note",text:"No display name yet"}),
      h("button",{type:"button",class:"linkbtn",text:S.profile?"Change":"Choose one",onclick:()=>{closeAcct();S.profile?renameMe():ensureProfile()}})):null,
    S.commReady?h("a",{class:"mi",href:S.uid?"#reader/"+S.uid:"#collections",onclick:closeAcct,text:"My collections"}):null,
    patBlock(),
    S.canEdit?h("a",{class:"mi",href:"#admin/novels",text:"Dashboard"}):h("div",{class:"accmems"},h("p",{class:"eyebrow",style:"margin:6px 6px 4px",text:"Your memberships"}),
      ...(rows.length?rows:[h("p",{class:"note",style:"margin:0 6px 6px",text:patOn()?"None yet. Join a tier on Patreon, then connect it above.":"None yet. Join a tier on Patreon with this same email to unlock chapters."})]),
      isUrl(S.config.join_url)?h("a",{class:"mi",href:S.config.join_url,target:"_blank",rel:"noopener",text:"Become a supporter ↗"}):null),
    h("button",{type:"button",class:"mi",text:"Sign out",onclick:()=>{closeAcct();logout()}}))}
function closeAcct(){$("acctMenu").hidden=true;$("acctBtn").setAttribute("aria-expanded","false")}
$("acctBtn").addEventListener("click",()=>{if(!S.email){openAuth("in");return}const p=$("acctMenu");const open=p.hidden;if(open){acctMenu();p.hidden=false;$("acctBtn").setAttribute("aria-expanded","true")}else closeAcct()});
document.addEventListener("click",e=>{if(!$("acctMenu").hidden&&!e.composedPath().includes($("ddAcct")))closeAcct()});
async function afterAuth(){S.canEdit=await checkOwner();$("navDash").hidden=!S.canEdit;
  $("who").replaceChildren(S.email?h("span",{},h("span",{class:"muted",text:S.email+" · "}),h("button",{type:"button",text:"Sign out",onclick:logout})):h("button",{type:"button",text:"Owner login",onclick:openLogin}));
  drawAcct();S.pat=undefined;await refresh();
  if(S.pat?.connected&&!S.canEdit&&Date.now()-(+LS.get("patSync:"+S.uid,0)||0)>6*3600e3)syncPatreon(false)}
if(sb)sb.auth.onAuthStateChange((event,session)=>{
  if(event==="PASSWORD_RECOVERY")setTimeout(()=>openPrompt({title:"Choose a new password",label:"New password",value:"",type:"password",async onSave(v){if((v||"").length<6)return"Use at least 6 characters.";const {error}=await sb.auth.updateUser({password:v});if(error)return"Couldn't update it: "+error.message;toast("Password updated. You're signed in.");await afterAuth()}}),300);
  else if(event==="SIGNED_IN"&&S.authReady&&(session?.user?.email||"").toLowerCase()!==S.email)afterAuth().then(()=>route())});

function fillEl(el,...k){el.replaceChildren(...k.flat().filter(x=>x!=null&&x!==false))}
/* ---------- Community: profiles ---------- */
function hue(s){let x=0;for(const ch of String(s||""))x=(x*31+ch.charCodeAt(0))>>>0;return x%360}
function avatar(name,uid,size){return h("span",{class:"avatar"+(size?" "+size:""),style:`--av:${hue(uid||name)}`,"aria-hidden":"true",text:(name||"?").trim().charAt(0).toUpperCase()})}
function heartIcon(on){const s=document.createElementNS("http://www.w3.org/2000/svg","svg");s.setAttribute("viewBox","0 0 24 24");s.setAttribute("width","15");s.setAttribute("height","15");s.setAttribute("aria-hidden","true");
  s.innerHTML=`<path d="M12 21s-7.5-4.6-9.5-9.2C1 8.3 3.2 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5c3.4 0 5.6 3.3 4.1 6.8C19.5 16.4 12 21 12 21z" fill="${on?"currentColor":"none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`;return s}
let profileWait=null;
function ensureProfile(){
  if(!S.email){openAuth("in");return Promise.resolve(false)}
  if(!S.commReady){toast("Comments and collections aren't switched on yet");return Promise.resolve(false)}
  if(S.profile)return Promise.resolve(true);
  return new Promise(res=>{profileWait=res;
    openPrompt({title:"Choose a display name",label:"Display name (shown with your comments and collections)",value:"",maxLength:32,async onSave(v){v=(v||"").trim().replace(/\s+/g," ");
      if(v.length<2)return"Use at least 2 characters.";if(/@/.test(v))return"Please don't use your email as your display name.";
      const r=await sb.from("profiles").insert({display_name:v});
      if(r.error)return r.error.code==="23505"?"You already have a name. Refresh the page.":"Couldn't save it: "+r.error.message;
      S.profile={user_id:S.uid,display_name:v};toast("Hi, "+v+"!");const f=profileWait;profileWait=null;f&&f(true)}})})}
$("promptDlg").addEventListener("close",()=>{if(profileWait){const f=profileWait;profileWait=null;f(!!S.profile)}});
function renameMe(){openPrompt({title:"Change display name",label:"Display name",value:S.profile?.display_name||"",maxLength:32,async onSave(v){v=(v||"").trim().replace(/\s+/g," ");
  if(v.length<2)return"Use at least 2 characters.";if(/@/.test(v))return"Please don't use your email as your display name.";
  const r=await sb.from("profiles").update({display_name:v,updated_at:new Date().toISOString()}).eq("user_id",S.uid);if(r.error)return"Couldn't save it: "+r.error.message;
  S.profile.display_name=v;toast("Name updated");route()}})}

/* ---------- Comments ---------- */
async function renderComments(c,box){
  if(!S.commReady){fillEl(box,);box.hidden=true;return}
  if(c.locked){fillEl(box,h("p",{class:"note",text:"Comments open up once you can read this chapter."}));return}
  const st={sort:LS.get("csort","top"),show:15,list:[],openReplies:new Set(),editing:null,replyTo:null};
  const load=async()=>{const r=await sb.rpc("chapter_comments",{p_chapter:c.id});st.list=r.error?[]:(r.data||[]);if(r.error)console.warn(r.error);draw();
    const n=st.list.filter(x=>!x.deleted).length;const jb=document.getElementById("jumpComments");if(jb)jb.textContent="Comments"+(n?" ("+n+")":"")};
  const composer=(parent)=>{
    if(!S.email)return h("div",{class:"cmlogin"},h("p",{class:"note",style:"margin:0",text:"Sign in to join the conversation."}),h("button",{type:"button",class:"btn sm",text:"Sign in",onclick:()=>openAuth("in")}),h("button",{type:"button",class:"linkbtn",text:"Create an account",onclick:()=>openAuth("up")}));
    const ta=h("textarea",{class:"cmta",maxlength:"2000",rows:parent?"2":"3",placeholder:parent?"Write a reply…":"Share your thoughts on this chapter…","aria-label":parent?"Reply":"Comment"});
    const cnt=h("span",{class:"mono cnt",text:"0/2000"});const sp=h("input",{type:"checkbox"});
    const btn=h("button",{type:"submit",class:"btn sm primary",text:parent?"Reply":"Post comment",disabled:true});
    const err=h("p",{class:"err",role:"alert",style:"margin:0"});
    const grow=()=>{ta.style.height="auto";ta.style.height=Math.min(ta.scrollHeight,420)+"px";cnt.textContent=ta.value.length+"/2000";btn.disabled=!ta.value.trim()};
    ta.addEventListener("input",grow);
    ta.addEventListener("keydown",e=>{if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){e.preventDefault();form.requestSubmit()}});
    const form=h("form",{class:"cmform"+(parent?" sub":""),novalidate:true,onsubmit:async e=>{e.preventDefault();err.textContent="";const body=ta.value.trim();if(!body)return;
      if(!await ensureProfile())return;btn.disabled=true;btn.textContent="Posting…";
      const r=await sb.from("comments").insert({chapter_id:c.id,book_id:c.book_id,parent_id:parent||null,body,spoiler:sp.checked});
      btn.textContent=parent?"Reply":"Post comment";
      if(r.error){btn.disabled=false;err.textContent=/slow down/i.test(r.error.message||"")?"Slow down a little: you can post 5 comments a minute.":/row-level|policy/i.test(r.error.message||"")?"You can't comment on this chapter right now.":"Couldn't post: "+r.error.message;return}
      ta.value="";grow();if(parent){st.replyTo=null;st.openReplies.add(parent)}else if(st.sort==="old"){}else st.sort=st.sort==="top"?"top":"new";
      toast(parent?"Reply posted":"Comment posted");await load()}},
      h("div",{class:"cmrow"},S.profile?avatar(S.profile.display_name,S.uid):avatar(S.email,S.uid),ta),
      h("div",{class:"cmbar"},h("label",{class:"check sm"},sp,"Contains spoilers"),cnt,parent?h("button",{type:"button",class:"btn sm",text:"Cancel",onclick:()=>{st.replyTo=null;draw()}}):null,btn),err);
    if(parent)setTimeout(()=>ta.focus(),0);return form};
  const like=async cm=>{if(!S.email){openAuth("in");return}
    const was=cm.liked;cm.liked=!was;cm.likes=+cm.likes+(was?-1:1);draw();
    const r=was?await sb.from("comment_likes").delete().eq("comment_id",cm.id).eq("user_id",S.uid):await sb.from("comment_likes").insert({comment_id:cm.id});
    if(r.error){cm.liked=was;cm.likes=+cm.likes+(was?1:-1);draw();toast("Couldn't save your like. Try again.")}};
  const item=(cm,isReply)=>{const mine=S.uid&&cm.user_id===S.uid;const editing=st.editing===cm.id;
    let body;
    if(cm.deleted)body=h("p",{class:"cmdel",text:"This comment was deleted."});
    else if(editing){const ta=h("textarea",{class:"cmta",maxlength:"2000",rows:"3"});ta.value=cm.body;const sp=h("input",{type:"checkbox",checked:cm.spoiler?true:null});
      body=h("form",{class:"cmform sub",onsubmit:async e=>{e.preventDefault();const v=ta.value.trim();if(!v)return;const r=await sb.from("comments").update({body:v,spoiler:sp.checked,edited_at:new Date().toISOString()}).eq("id",cm.id);
          if(r.error){toast("Couldn't save the edit");return}st.editing=null;toast("Comment updated");await load()}},ta,
        h("div",{class:"cmbar"},h("label",{class:"check sm"},sp,"Contains spoilers"),h("button",{type:"button",class:"btn sm",text:"Cancel",onclick:()=>{st.editing=null;draw()}}),h("button",{type:"submit",class:"btn sm primary",text:"Save"})));
      setTimeout(()=>{ta.focus();ta.style.height=Math.min(ta.scrollHeight+4,420)+"px"},0)}
    else{const t=h("p",{class:"cmtext",text:cm.body});
      if(cm.spoiler){t.classList.add("spoiler");t.setAttribute("tabindex","0");t.setAttribute("role","button");t.setAttribute("aria-label","Spoiler hidden. Press to show.");
        const reveal=()=>{t.classList.remove("spoiler");t.removeAttribute("role");t.removeAttribute("tabindex");t.removeAttribute("aria-label")};
        t.addEventListener("click",reveal);t.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();reveal()}})}
      body=h("div",{},cm.spoiler?h("span",{class:"sptag",text:"Spoiler"}):null,t)}
    const acts=cm.deleted?null:h("div",{class:"cmacts"},
      h("button",{type:"button",class:"cmlike"+(cm.liked?" on":""),"aria-pressed":String(!!cm.liked),"aria-label":(cm.liked?"Unlike":"Like")+" comment by "+cm.name,onclick:()=>like(cm)},heartIcon(cm.liked),h("span",{text:+cm.likes||""})),
      !isReply?h("button",{type:"button",class:"cmact",text:"Reply",onclick:()=>{if(!S.email){openAuth("in");return}st.replyTo=cm.id;st.openReplies.add(cm.id);draw()}}):null,
      mine&&!editing?h("button",{type:"button",class:"cmact",text:"Edit",onclick:()=>{st.editing=cm.id;draw()}}):null,
      (mine||S.canEdit)&&!editing?(()=>{const b=confirmBtn("Delete",async()=>{const r=await sb.from("comments").update({deleted:true}).eq("id",cm.id);if(r.error){toast("Couldn't delete it");return}toast("Comment deleted");await load()});b.className="cmact danger";return b})():null);
    return h("article",{class:"cm"+(isReply?" reply":""),id:"cm-"+cm.id},avatar(cm.deleted?"?":cm.name,cm.user_id),
      h("div",{class:"cmmain"},h("div",{class:"cmhead"},cm.deleted?h("span",{class:"muted",text:"Deleted"}):h("a",{class:"cmname",href:"#reader/"+cm.user_id,text:cm.name}),cm.by_owner&&!cm.deleted?h("span",{class:"badge2",text:"Translator"}):null,
        h("time",{class:"cmtime",datetime:cm.created_at,title:fmtDateTime(cm.created_at),text:ago(cm.created_at)}),cm.edited_at&&!cm.deleted?h("span",{class:"cmtime",text:"· edited"}):null),body,acts))};
  function draw(){const L=st.list;const kids=new Map();for(const x of L)if(x.parent_id){if(!kids.has(x.parent_id))kids.set(x.parent_id,[]);kids.get(x.parent_id).push(x)}
    let tops=L.filter(x=>!x.parent_id&&(!x.deleted||kids.has(x.id)));
    const t=x=>Date.parse(x.created_at)||0;
    tops.sort(st.sort==="new"?(a,b)=>t(b)-t(a):st.sort==="old"?(a,b)=>t(a)-t(b):(a,b)=>(+b.likes+(kids.get(b.id)?.length||0)*.5)-(+a.likes+(kids.get(a.id)?.length||0)*.5)||t(b)-t(a));
    const n=L.filter(x=>!x.deleted).length;
    fillEl(box,
      h("div",{class:"cmheadbar"},h("h2",{},"Comments ",h("span",{class:"mono",text:n||""})),
        h("div",{class:"seg sm",role:"group","aria-label":"Sort comments"},...[["top","Top"],["new","Newest"],["old","Oldest"]].map(([v,l])=>h("button",{type:"button","aria-pressed":String(st.sort===v),text:l,onclick:()=>{st.sort=v;LS.set("csort",v);draw()}})))),
      composer(null),
      tops.length?h("div",{class:"cmlist"},...tops.slice(0,st.show).map(cm=>{const rs=(kids.get(cm.id)||[]).sort((a,b)=>t(a)-t(b));const open=st.openReplies.has(cm.id)||rs.length<=2;
        return h("div",{class:"cmthread"},item(cm,false),
          rs.length?h("div",{class:"cmreplies"},...(open?rs:rs.slice(0,1)).map(r=>item(r,true)),!open?h("button",{type:"button",class:"linkbtn more-rep",text:"Show "+(rs.length-1)+" more "+(rs.length-1===1?"reply":"replies"),onclick:()=>{st.openReplies.add(cm.id);draw()}}):null):null,
          st.replyTo===cm.id?h("div",{class:"cmreplies"},composer(cm.id)):null)}))
        :h("p",{class:"note cmempty",text:"No comments yet. Be the first to share what you thought."}),
      tops.length>st.show?h("div",{class:"morebar"},h("button",{type:"button",class:"btn",text:"Show more comments ("+(tops.length-st.show)+")",onclick:()=>{st.show+=15;draw()}})):null)}
  fillEl(box,h("p",{class:"note",text:"Loading comments…"}));await load()}

/* ---------- Collections ---------- */
function collCard(c){const bs=(Array.isArray(c.books)?c.books:[]).slice(0,3);
  const tiles=bs.length?bs.map(b=>{const col=COVERS[b.cover]||COVERS.rose;return h("span",{class:"ctile",style:`--cv-bg:${col[0]};--cv-fg:${col[1]}`},b.cover_url?h("img",{src:b.cover_url,alt:"",loading:"lazy"}):h("span",{text:b.title}))}):[h("span",{class:"ctile empty",text:"Empty"})];
  return h("a",{class:"ccard",href:"#collection/"+c.id},h("span",{class:"collage n"+tiles.length},...tiles),
    h("span",{class:"cinfo"},h("span",{class:"ctitle"},c.title,c.is_public?null:h("span",{class:"pill p-draft",text:"Private"})),
      h("span",{class:"colmeta"},h("span",{text:"by "+c.owner_name}),h("span",{text:" · "+c.items+" "+(+c.items===1?"novel":"novels")})),
      h("span",{class:"clikes"+(c.liked?" on":"")},heartIcon(c.liked),h("span",{text:c.likes||0}))))}
async function listColls(opts){const r=await sb.rpc("list_collections",{p_sort:opts.sort||"popular",p_search:opts.search||null,p_user:opts.user||null,p_limit:opts.limit||24,p_offset:opts.offset||0});if(r.error)throw r.error;return r.data||[]}
async function renderCollections(seq){const el=$("collsPage");document.title="Reader collections · "+siteName();
  if(!S.commReady){fillEl(el,h("div",{class:"pagehead"},backLink("Home","")),emptyBox("Collections are coming soon",S.canEdit?"Run update-community.sql in Supabase to switch them on.":""));return}
  const st=S.collsSt||(S.collsSt={sort:"popular",search:"",limit:24});
  const grid=h("div",{class:"cgrid"});const more=h("div",{class:"morebar"});const mineBox=h("div");
  const load=async()=>{fillEl(grid,h("p",{class:"note",text:"Loading collections…"}));let rows=[];try{rows=await listColls({sort:st.sort,search:st.search.trim()||null,limit:st.limit})}catch(e){console.warn(e)}
    if(seq!==S.seq)return;fillEl(grid,...(rows.length?rows.map(collCard):[h("p",{class:"note",text:st.search?"No collections match that search.":"No public collections yet. Make the first one!"})]));
    fillEl(more,...(rows.length&&+rows[0].total>rows.length?[h("button",{type:"button",class:"btn",text:"Show more",onclick:()=>{st.limit+=24;load()}})]:[]))};
  let sT;const search=h("input",{type:"search",placeholder:"Search collections",value:st.search,"aria-label":"Search collections",oninput:e=>{st.search=e.target.value;clearTimeout(sT);sT=setTimeout(()=>{st.limit=24;load()},250)}});
  fillEl(el,h("div",{class:"chero"},h("div",{},h("h1",{text:"Reader collections"}),h("p",{class:"note",text:"Favourite novels picked by readers, with a note on why they love each one."})),
      h("button",{type:"button",class:"btn primary",text:"+ New collection",onclick:newCollection})),
    mineBox,
    h("div",{class:"ctools"},h("div",{class:"bsbox"},search),h("div",{class:"seg",role:"group","aria-label":"Sort collections"},...[["popular","Popular"],["new","Newest"]].map(([v,l])=>h("button",{type:"button","aria-pressed":String(st.sort===v),text:l,onclick:e=>{st.sort=v;st.limit=24;for(const b of e.target.parentNode.children)b.setAttribute("aria-pressed",String(b===e.target));load()}})))),
    grid,more);
  if(S.email){try{const mine=await listColls({user:S.uid,limit:100,sort:"new"});if(seq===S.seq&&mine.length)fillEl(mineBox,h("h2",{class:"csub",text:"Your collections"}),h("div",{class:"cgrid"},...mine.map(collCard)),h("h2",{class:"csub",text:"Everyone's collections"}))}catch{}}
  load()}
async function newCollection(bookToAdd){if(!await ensureProfile())return null;
  return new Promise(res=>{openPrompt({title:"New collection",label:"Collection name",value:"",maxLength:80,async onSave(v){v=(v||"").trim();if(!v)return"Give it a name, like Comfort reads.";
    const r=await sb.from("collections").insert({title:v}).select("id").single();if(r.error)return/row-level|policy/i.test(r.error.message||"")?"You've reached the limit of 50 collections.":"Couldn't create it: "+r.error.message;
    if(typeof bookToAdd==="string")await sb.from("collection_items").insert({collection_id:r.data.id,book_id:bookToAdd,position:0});
    toast("Collection created");res(r.data.id);if(typeof bookToAdd!=="string")go("collection/"+r.data.id)}})})}
async function renderCollection(id,seq){const el=$("collPage");fillEl(el,h("p",{class:"count pad",text:"Loading collection"}));
  if(!S.commReady){fillEl(el,h("div",{class:"pagehead"},backLink("Collections","collections")),emptyBox("Collections aren't switched on yet",""));return}
  const [cr,ir]=await Promise.all([sb.from("collections").select("*").eq("id",id).maybeSingle(),sb.from("collection_items").select("*").eq("collection_id",id).order("position",{ascending:true})]);
  if(seq!==S.seq)return;
  if(cr.error||!cr.data){fillEl(el,h("div",{class:"pagehead"},backLink("Collections","collections")),emptyBox("Collection not found","It may be private or deleted."));return}
  const c=cr.data;let items=(ir.data||[]).filter(i=>S.books.some(b=>b.id===i.book_id)).sort((a,b)=>a.position-b.position||Date.parse(a.added_at)-Date.parse(b.added_at));
  const [pr,lr]=await Promise.all([sb.from("profiles").select("user_id,display_name").eq("user_id",c.user_id).maybeSingle(),sb.rpc("collection_like_info",{p_collection:id})]);
  if(seq!==S.seq)return;
  const owner=pr.data?.display_name||"Reader";const li=(Array.isArray(lr.data)?lr.data[0]:lr.data)||{likes:0,liked:false};
  const mine=!!S.uid&&c.user_id===S.uid;let editing=false;
  document.title=c.title+" · "+siteName();
  const likeBtn=h("button",{type:"button",class:"btn likebig"+(li.liked?" on":""),"aria-pressed":String(!!li.liked)});
  const drawLike=()=>{likeBtn.replaceChildren(heartIcon(li.liked),h("span",{text:(+li.likes||0)+" "+(+li.likes===1?"like":"likes")}));likeBtn.classList.toggle("on",!!li.liked);likeBtn.setAttribute("aria-pressed",String(!!li.liked))};drawLike();
  likeBtn.onclick=async()=>{if(!S.email){openAuth("in");return}if(!c.is_public){toast("Private collections can't be liked");return}const was=li.liked;li.liked=!was;li.likes=+li.likes+(was?-1:1);drawLike();
    const r=was?await sb.from("collection_likes").delete().eq("collection_id",id).eq("user_id",S.uid):await sb.from("collection_likes").insert({collection_id:id});
    if(r.error){li.liked=was;li.likes=+li.likes+(was?1:-1);drawLike();toast("Couldn't save your like")}else if(!was)likeBtn.animate?.([{transform:"scale(1)"},{transform:"scale(1.12)"},{transform:"scale(1)"}],{duration:260})};
  const copyBtn=h("button",{type:"button",class:"btn",text:"Copy link",onclick:async()=>{const url=location.origin+location.pathname+"#collection/"+id;try{await navigator.clipboard.writeText(url);toast("Link copied")}catch{prompt("Copy this link:",url)}}});
  const head=h("header",{class:"chead"});
  const drawHead=()=>{
    if(editing){const ti=h("input",{class:"ctitle-in",maxlength:"80",value:c.title,"aria-label":"Collection name"});const de=h("textarea",{maxlength:"600",placeholder:"What ties these novels together?","aria-label":"Description"});de.value=c.description||"";
      const pub=h("input",{type:"checkbox",checked:c.is_public?true:null});const err=h("p",{class:"err",style:"margin:0"});
      fillEl(head,h("form",{class:"cedit",onsubmit:async e=>{e.preventDefault();const t=ti.value.trim();if(!t){err.textContent="Give it a name.";return}
          const r=await sb.from("collections").update({title:t,description:de.value.trim(),is_public:pub.checked,updated_at:new Date().toISOString()}).eq("id",id);if(r.error){err.textContent="Couldn't save: "+r.error.message;return}
          Object.assign(c,{title:t,description:de.value.trim(),is_public:pub.checked});editing=false;drawHead();toast("Collection saved")}},
        ti,de,h("label",{class:"check"},pub,"Public: anyone can see and like it"),err,
        h("div",{class:"actions"},h("button",{type:"submit",class:"btn primary",text:"Save"}),h("button",{type:"button",class:"btn",text:"Cancel",onclick:()=>{editing=false;drawHead()}}),
          (()=>{const b=confirmBtn("Delete collection",async()=>{const r=await sb.from("collections").delete().eq("id",id);if(r.error){toast("Couldn't delete it");return}toast("Collection deleted");go("collections")});return b})())));ti.focus();return}
    fillEl(head,h("p",{class:"eyebrow",style:"margin:0"},"Collection",c.is_public?null:h("span",{class:"pill p-draft",style:"margin-left:8px",text:"Private"})),
      h("h1",{text:c.title}),
      h("p",{class:"cby"},avatar(owner,c.user_id,"sm"),h("span",{},"by ",h("a",{href:"#reader/"+c.user_id,text:owner})),h("span",{class:"muted",text:" · "+items.length+" "+(items.length===1?"novel":"novels")+" · updated "+ago(c.updated_at)})),
      c.description?h("p",{class:"cdesc",text:c.description}):null,
      h("div",{class:"actions"},c.is_public?likeBtn:null,c.is_public?copyBtn:null,mine?h("button",{type:"button",class:"btn",text:"Edit details",onclick:()=>{editing=true;drawHead()}}):null))};
  const list=h("ol",{class:"clist"});
  const savePositions=async()=>{for(let i=0;i<items.length;i++){if(items[i].position!==i){items[i].position=i;await sb.from("collection_items").update({position:i}).eq("collection_id",id).eq("book_id",items[i].book_id)}}
    await sb.from("collections").update({updated_at:new Date().toISOString()}).eq("id",id)};
  let dragFrom=-1;
  const drawList=()=>{fillEl(list,...items.map((it,i)=>{const b=S.books.find(x=>x.id===it.book_id);
    const row=h("li",{class:"citem"+(mine?" mine":""),draggable:mine?"true":null},
      mine?h("span",{class:"grip",title:"Drag to reorder","aria-hidden":"true",text:"⋮⋮"}):null,
      h("span",{class:"cnum",text:i+1}),
      h("a",{class:"ccov",href:"#book/"+b.id,tabindex:"-1","aria-hidden":"true"},cover(b,true)),
      h("div",{class:"cbody"},h("a",{class:"ltitle",href:"#book/"+b.id,text:b.title}),
        h("div",{class:"lmeta"},h("span",{class:"st-"+(b.status||"ongoing"),text:STATUS[b.status]||"Ongoing"}),chCount(b)?h("span",{text:chCount(b)+" ch"}):null,(b.genres||[]).length?h("span",{text:(b.genres||[]).slice(0,3).join(", ")}):null),
        mine?noteEditor(it):it.note?h("blockquote",{class:"cnote"},h("p",{text:it.note}),h("footer",{},"— "+owner)):null),
      mine?h("div",{class:"cmove"},
        h("button",{type:"button",class:"iconbtn sm","aria-label":"Move up",disabled:i===0?true:null,text:"↑",onclick:async()=>{[items[i-1],items[i]]=[items[i],items[i-1]];drawList();await savePositions()}}),
        h("button",{type:"button",class:"iconbtn sm","aria-label":"Move down",disabled:i===items.length-1?true:null,text:"↓",onclick:async()=>{[items[i+1],items[i]]=[items[i],items[i+1]];drawList();await savePositions()}}),
        (()=>{const x=confirmBtn("Remove",async()=>{const r=await sb.from("collection_items").delete().eq("collection_id",id).eq("book_id",it.book_id);if(r.error){toast("Couldn't remove it");return}items=items.filter(z=>z!==it);drawList();drawHead();toast("Removed")});return x})()):null);
    if(mine){row.addEventListener("dragstart",e=>{dragFrom=i;row.classList.add("dragging");e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",String(i))});
      row.addEventListener("dragend",()=>row.classList.remove("dragging"));
      row.addEventListener("dragover",e=>{e.preventDefault();row.classList.add("dropto")});row.addEventListener("dragleave",()=>row.classList.remove("dropto"));
      row.addEventListener("drop",async e=>{e.preventDefault();row.classList.remove("dropto");if(dragFrom<0||dragFrom===i)return;const [m]=items.splice(dragFrom,1);items.splice(i,0,m);dragFrom=-1;drawList();await savePositions();toast("Order saved")})}
    return row}));
    if(!items.length)fillEl(list,h("li",{class:"note cempty",text:mine?"No novels yet. Add some below, or use the Add to collection button on any book page.":"This collection is empty."}))};
  function noteEditor(it){const ta=h("textarea",{class:"cnote-in",maxlength:"500",rows:"2",placeholder:"Why do you love it? (shown to everyone who sees this collection)","aria-label":"Your note"});ta.value=it.note||"";
    const stt=h("span",{class:"mono savest",role:"status"});let t;
    ta.addEventListener("input",()=>{stt.textContent="…";clearTimeout(t);t=setTimeout(async()=>{const v=ta.value.trim();const r=await sb.from("collection_items").update({note:v}).eq("collection_id",id).eq("book_id",it.book_id);
      if(r.error){stt.textContent="Not saved";return}it.note=v;stt.textContent="Saved ✓";setTimeout(()=>{if(stt.textContent==="Saved ✓")stt.textContent=""},1800)},700)});
    return h("div",{class:"cnotewrap"},ta,stt)}
  let adder=null;
  if(mine){const res=h("div",{class:"hresults addres",hidden:true});const inp=h("input",{type:"search",placeholder:"Add a novel: start typing a title","aria-label":"Add a novel"});
    inp.addEventListener("input",()=>{const q=inp.value;const found=matches(q).filter(b=>!items.some(i=>i.book_id===b.id)).slice(0,6);
      res.replaceChildren(...found.map(b=>h("button",{type:"button",class:"hres",onclick:async()=>{const r=await sb.from("collection_items").insert({collection_id:id,book_id:b.id,position:items.length});
        if(r.error){toast("Couldn't add it");return}items.push({collection_id:id,book_id:b.id,note:"",position:items.length,added_at:new Date().toISOString()});inp.value="";res.hidden=true;drawList();drawHead();toast("Added "+b.title)}},
        thumb(b),h("span",{class:"rb"},h("span",{class:"rt",text:b.title}),h("span",{class:"rs",text:b.author||""})))));res.hidden=!q.trim()||!found.length});
    adder=h("div",{class:"cadd"},h("h2",{class:"csub",text:"Add novels"}),h("div",{class:"hsearch",style:"max-width:none"},inp,res))}
  drawHead();drawList();
  fillEl(el,h("div",{class:"pagehead"},backLink("Collections","collections")),head,list,adder)}
async function renderUser(uid,seq){const el=$("userPage");fillEl(el,h("p",{class:"count pad",text:"Loading"}));
  if(!S.commReady){fillEl(el,emptyBox("Profiles aren't switched on yet",""));return}
  const [pr,cl]=await Promise.all([sb.from("profiles").select("user_id,display_name,created_at").eq("user_id",uid).maybeSingle(),listColls({user:uid,limit:100,sort:"new"}).catch(()=>[])]);
  if(seq!==S.seq)return;const name=pr.data?.display_name||"Reader";const me=S.uid===uid;
  document.title=name+" · "+siteName();
  fillEl(el,h("div",{class:"pagehead"},backLink("Collections","collections")),
    h("header",{class:"uhead"},avatar(name,uid,"lg"),h("div",{},h("h1",{text:name}),h("p",{class:"note",style:"margin:4px 0 0",text:pr.data?.created_at?"Reader since "+fmtDate(String(pr.data.created_at).slice(0,10)):""}),
      me?h("div",{class:"actions",style:"margin-top:10px"},h("button",{type:"button",class:"btn sm",text:"Change display name",onclick:renameMe}),h("button",{type:"button",class:"btn sm primary",text:"+ New collection",onclick:newCollection})):null)),
    h("h2",{class:"csub",text:me?"Your collections":"Collections"}),
    cl.length?h("div",{class:"cgrid"},...cl.map(collCard)):h("p",{class:"note",text:me?"You haven't made a collection yet.":"No public collections yet."}))}
/* Add to collection (from a book page) */
async function openAddToCollection(book){if(!await ensureProfile())return;
  $("acBook").textContent=book.title;$("acErr").textContent="";$("acNewTitle").value="";const list=$("acList");fillEl(list,h("p",{class:"note",text:"Loading your collections…"}));
  if(!$("addCollDlg").open)$("addCollDlg").showModal();
  let mine=[];try{mine=await listColls({user:S.uid,limit:100,sort:"new"})}catch{}
  const ids=mine.map(c=>c.id);let inSet=new Map();
  if(ids.length){const r=await sb.from("collection_items").select("collection_id,note").eq("book_id",book.id).in("collection_id",ids);for(const x of r.data||[])inSet.set(x.collection_id,x)}
  const draw=()=>{fillEl(list,...(mine.length?mine.map(c=>{const on=inSet.has(c.id);
    const row=h("div",{class:"acrow"+(on?" on":"")},
      h("label",{class:"check"},h("input",{type:"checkbox",checked:on?true:null,onchange:async e=>{const want=e.target.checked;e.target.disabled=true;
        const r=want?await sb.from("collection_items").insert({collection_id:c.id,book_id:book.id,position:+c.items||0}):await sb.from("collection_items").delete().eq("collection_id",c.id).eq("book_id",book.id);
        e.target.disabled=false;if(r.error){e.target.checked=!want;$("acErr").textContent="Couldn't update that collection.";return}
        if(want){inSet.set(c.id,{collection_id:c.id,note:""});c.items=+c.items+1;toast("Added to "+c.title)}else{inSet.delete(c.id);c.items=Math.max(0,+c.items-1);toast("Removed from "+c.title)}draw()}}),
        h("span",{},h("b",{text:c.title}),h("span",{class:"note",text:" · "+c.items+" "+(+c.items===1?"novel":"novels")+(c.is_public?"":" · private")}))),
      on?(()=>{const ta=h("textarea",{class:"cnote-in",maxlength:"500",rows:"2",placeholder:"Why do you love it? (optional)","aria-label":"Note for "+c.title});ta.value=inSet.get(c.id).note||"";const stt=h("span",{class:"mono savest"});let t;
        ta.addEventListener("input",()=>{stt.textContent="…";clearTimeout(t);t=setTimeout(async()=>{const r=await sb.from("collection_items").update({note:ta.value.trim()}).eq("collection_id",c.id).eq("book_id",book.id);stt.textContent=r.error?"Not saved":"Saved ✓";if(!r.error)inSet.get(c.id).note=ta.value.trim()},600)});
        return h("div",{class:"cnotewrap"},ta,stt)})():null);return row})
      :[h("p",{class:"note",text:"You don't have any collections yet. Create one below."})]))};
  draw();
  $("acNew").onsubmit=async e=>{e.preventDefault();const v=$("acNewTitle").value.trim();if(!v){$("acErr").textContent="Type a name for the new collection.";return}
    const r=await sb.from("collections").insert({title:v}).select("id").single();if(r.error){$("acErr").textContent="Couldn't create it: "+r.error.message;return}
    await sb.from("collection_items").insert({collection_id:r.data.id,book_id:book.id,position:0});
    mine.unshift({id:r.data.id,title:v,items:1,is_public:true});inSet.set(r.data.id,{collection_id:r.data.id,note:""});$("acNewTitle").value="";$("acErr").textContent="";draw();toast("Created "+v)}}
async function bookCollectionsSection(bookId,seq){if(!S.commReady)return null;const r=await sb.rpc("book_collections",{p_book:bookId});if(r.error||!r.data?.length||seq!==S.seq)return null;
  return h("section",{class:"bcolls"},h("div",{class:"tochead"},h("h2",{},"In readers' collections")),
    h("div",{class:"bcgrid"},...r.data.map(x=>h("a",{class:"bccard",href:"#collection/"+x.id},
      x.note?h("p",{class:"bcnote",text:"“"+x.note+"”"}):null,
      h("span",{class:"bcfoot"},avatar(x.owner_name,x.user_id,"sm"),h("span",{},h("b",{text:x.title}),h("span",{class:"note",text:" by "+x.owner_name})),h("span",{class:"clikes"},heartIcon(false),h("span",{text:x.likes||0})))))))}

/* ---------- About page ---------- */
const ABOUT_DEFAULT={kicker:"meet the",headline:"translators",
  intro:"Starry Nights Translation is a small team of readers who fell in love with stories that hadn't been translated into English yet.\n\nWe translate web novels by hand, one careful chapter at a time, keeping the jokes, the idioms and the feelings that make them worth reading.",
  team:[{name:"Storm",role:"Founder & translator",bio:"Reads too many romance novels and argues with dictionaries for fun.",photo_url:"",photo_path:""}],
  doTitle:"what we do",
  cards:[{title:"Translation",text:"Every chapter is translated by a person, not dumped through a machine. Names, honorifics and wordplay are handled with care."},
    {title:"Editing",text:"A second pair of eyes checks each chapter for flow, typos and consistency with our glossary before it goes up."},
    {title:"Releases",text:"Regular chapters for everyone, advance chapters for supporters on Patreon, and a Discord to scream about cliffhangers with us."}],
  workTitle:"our novels",workNote:"Pick a cover and start reading. New chapters land every week.",
  contactTitle:"say hello",contactText:"Want to join the team, suggest a novel or just say hi? We'd love to hear from you.",email:"",discord:""};
function aboutData(){const a=S.config.about&&typeof S.config.about==="object"?S.config.about:{};return Object.assign({},ABOUT_DEFAULT,a,{team:Array.isArray(a.team)&&a.team.length?a.team:ABOUT_DEFAULT.team,cards:Array.isArray(a.cards)&&a.cards.length?a.cards:ABOUT_DEFAULT.cards})}
function paras(t){return String(t||"").split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean).map(x=>h("p",{text:x}))}
function bowSvg(){const s=document.createElementNS("http://www.w3.org/2000/svg","svg");s.setAttribute("viewBox","0 0 120 80");s.setAttribute("class","bow");s.setAttribute("aria-hidden","true");
  s.innerHTML='<path d="M60 38 C40 10 8 6 10 30 C12 50 40 46 60 40Z" fill="var(--ab-ribbon)"/><path d="M60 38 C80 10 112 6 110 30 C108 50 80 46 60 40Z" fill="var(--ab-ribbon)"/><path d="M58 40 L40 78 L50 74 L56 80 L62 42Z" fill="var(--ab-ribbon-d)"/><path d="M62 40 L80 78 L70 74 L64 80 L58 42Z" fill="var(--ab-ribbon-d)"/><ellipse cx="60" cy="39" rx="9" ry="8" fill="var(--ab-ribbon-d)"/><path d="M22 26 C30 20 44 24 54 34" stroke="rgba(255,255,255,.35)" stroke-width="2" fill="none"/><path d="M98 26 C90 20 76 24 66 34" stroke="rgba(255,255,255,.35)" stroke-width="2" fill="none"/>';return s}
function starSvg(cls){const s=document.createElementNS("http://www.w3.org/2000/svg","svg");s.setAttribute("viewBox","0 0 24 24");s.setAttribute("class",cls||"abstar");s.setAttribute("aria-hidden","true");
  s.innerHTML='<path d="M12 1.5l2.7 7.1 7.6.4-5.9 4.8 2 7.4L12 17l-6.4 4.2 2-7.4L1.7 9l7.6-.4z" fill="currentColor"/>';return s}
function renderAbout(){const el=$("aboutPage");const a=aboutData();document.title="About us · "+siteName();
  const nm=siteName().trim().split(/\s+/);const caps=nm.length>=3?nm.pop():"";
  const team=a.team.filter(t=>t&&t.name);
  const tilt=i=>[-4,3,-2,5,-3][i%5];
  const pol=(t,i)=>h("figure",{class:"pol tape",style:`--r:${tilt(i)}deg`},
    t.photo_url?h("img",{src:t.photo_url,alt:t.name,loading:"lazy"}):h("span",{class:"polph",style:`--av:${hue(t.name)}`,"aria-hidden":"true",text:t.name.trim().charAt(0).toUpperCase()}),
    h("figcaption",{},h("b",{text:t.name}),t.role?h("span",{text:t.role}):null));
  const works=[...S.books].sort((x,y)=>(y.featured?1:0)-(x.featured?1:0)||chCount(y)-chCount(x)).slice(0,5);
  const contact=[isUrl(S.config.join_url)?h("a",{class:"abbtn",href:S.config.join_url,target:"_blank",rel:"noopener",text:"Support us on Patreon ↗"}):null,
    isUrl(a.discord)?h("a",{class:"abbtn alt",href:a.discord,target:"_blank",rel:"noopener",text:"Join our Discord ↗"}):null,
    a.email?h("span",{class:"abmail"},h("span",{text:"Email: "}),h("b",{text:a.email}),h("button",{type:"button",class:"abcopy",text:"Copy",onclick:async e=>{try{await navigator.clipboard.writeText(a.email);e.target.textContent="Copied"}catch{e.target.textContent="Select it above"}}})):null];
  fillEl(el,
    /* band 1: meet the team */
    h("section",{class:"abband b1","aria-labelledby":"abH1"},
      h("div",{class:"abmeet"},
        h("h1",{id:"abH1",class:"abh"},h("span",{class:"k",text:a.kicker}),h("span",{class:"big",text:a.headline})),
        h("div",{class:"abintro"},...paras(a.intro))),
      h("div",{class:"abplate"},h("div",{class:"lace"},h("div",{class:"plate"},starSvg("pstar"),h("span",{class:"pscript",text:nm.join(" ").toLowerCase()}),caps?h("span",{class:"pcaps",text:caps}):null,
        h("span",{class:"psince",text:"est. "+(S.books.length?new Date(Math.min(...S.books.map(b=>Date.parse(b.created_at)||Date.now()))).getFullYear():new Date().getFullYear())}))),
        h("span",{class:"charm","aria-hidden":"true"})),
      h("div",{class:"abstrip"},...team.slice(0,4).map(pol))),
    team.some(t=>t.bio)?h("section",{class:"abteam"},...team.filter(t=>t.bio).map((t,i)=>h("article",{class:"tnote",style:`--r:${[1.5,-1.2,1,-1.6][i%4]}deg`},h("p",{class:"tname"},h("span",{class:"scr",text:t.name}),t.role?h("span",{class:"trole",text:t.role}):null),h("p",{text:t.bio})))):null,
    /* band 2: what we do */
    h("section",{class:"abband b2","aria-labelledby":"abH2"},
      h("div",{class:"abcards"},...a.cards.filter(c=>c&&c.title).map(c=>h("article",{class:"abcard"},h("h3",{class:"scr",text:c.title}),h("p",{text:c.text||""})))),
      h("div",{class:"abstack"},h("span",{class:"paper p1"}),h("span",{class:"paper p2"}),
        h("div",{class:"notebook"},bowSvg(),h("h2",{id:"abH2",text:a.doTitle}),h("p",{class:"nbsub",text:S.books.length+" "+(S.books.length===1?"novel":"novels")+" · "+Object.values(S.counts).reduce((x,y)=>x+y,0).toLocaleString()+" chapters on the site"})))),
    /* band 3: our work */
    h("section",{class:"abband b3","aria-labelledby":"abH3"},
      h("div",{class:"abwork"},
        h("div",{class:"torn"},h("h2",{id:"abH3"},h("span",{class:"k",text:"some of"}),h("span",{class:"big",text:a.workTitle})),h("p",{text:a.workNote})),
        works.length?h("div",{class:"abcovers"},...works.map((b,i)=>h("a",{class:"pol cov",href:"#book/"+b.id,style:`--r:${[-6,4,-2,7,-4][i%5]}deg`},cover(b,true),h("span",{class:"pcap",text:b.title})))):h("p",{class:"note",text:"Novels you add will show up here."}),
        h("span",{class:"stamp","aria-hidden":"true"},starSvg("sstar"),h("span",{text:"translated with love"})))),
    /* band 4: say hello */
    h("section",{class:"abband b4","aria-labelledby":"abH4"},
      h("div",{class:"hello tape"},h("h2",{id:"abH4",class:"scr",text:a.contactTitle}),...paras(a.contactText),
        contact.some(Boolean)?h("div",{class:"abacts"},...contact):null,
        h("p",{class:"abhome"},h("a",{href:"#browse",text:"Browse all novels →"})))))}

/* About page editor (dashboard) */
function renderAboutAdmin(){S.list=null;const a=JSON.parse(JSON.stringify(aboutData()));
  const err=h("p",{class:"err",role:"alert",style:"margin:0"});let dirty=false;const mark=()=>{dirty=true;dot.hidden=false};
  const dot=h("span",{class:"dirty",hidden:true},"Unsaved changes");
  const fld=(label,val,set,opts={})=>{const id="ab_"+Math.random().toString(36).slice(2,8);const inp=opts.area?h("textarea",{id,maxlength:opts.max||"2000",style:opts.tall?"min-height:150px":"min-height:80px"}):h("input",{id,maxlength:opts.max||"120",placeholder:opts.ph||""});
    inp.value=val||"";inp.addEventListener("input",()=>{set(inp.value);mark()});return h("div",{class:"field"+(opts.full?" full":"")},h("label",{for:id,text:label}),inp,opts.hint?h("span",{class:"hint",text:opts.hint}):null)};
  const teamBox=h("div",{class:"abteamed"});
  const drawTeam=()=>{fillEl(teamBox,...a.team.map((t,i)=>{const ph=h("div",{class:"abph"},t.photo_url?h("img",{src:t.photo_url,alt:""}):h("span",{class:"polph",style:`--av:${hue(t.name||"?")}`,text:(t.name||"?").charAt(0).toUpperCase()}));
      const file=h("input",{type:"file",accept:"image/*",hidden:true,onchange:async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;if(!/^image\//.test(f.type)){err.textContent="That file isn't an image.";return}
        err.textContent="Uploading photo…";try{const up=await uploadImage(f,700);if(t.photo_path)await removeCoverFile(t.photo_path);t.photo_url=up.url;t.photo_path=up.path;err.textContent="";mark();drawTeam()}catch(x){err.textContent="Couldn't upload the photo. Check you're signed in."}}});
      return h("div",{class:"abmem"},ph,h("div",{class:"form",style:"flex:1;min-width:0"},
          fld("Name",t.name,v=>t.name=v,{max:"40"}),fld("Role",t.role,v=>t.role=v,{max:"60",ph:"Translator, Editor…"}),
          fld("Short bio",t.bio,v=>t.bio=v,{area:true,max:"300",full:true})),
        h("div",{class:"abmemacts"},h("label",{class:"btn sm"},file,t.photo_url?"Change photo":"Add photo"),t.photo_url?h("button",{type:"button",class:"btn sm",text:"Remove photo",onclick:()=>{t.photo_url="";mark();drawTeam()}}):null,
          a.team.length>1?h("button",{type:"button",class:"btn sm danger",text:"Remove person",onclick:()=>{a.team.splice(i,1);mark();drawTeam()}}):null))}),
      a.team.length<6?h("button",{type:"button",class:"btn sm addrow",text:"+ Add person",onclick:()=>{a.team.push({name:"",role:"",bio:"",photo_url:"",photo_path:""});mark();drawTeam()}}):null)};
  const cardsBox=h("div",{class:"form"});
  const drawCards=()=>{fillEl(cardsBox,...a.cards.map((c,i)=>h("div",{class:"field full abcarded"},
      h("div",{class:"form"},fld("Card "+(i+1)+" title",c.title,v=>c.title=v,{max:"40"}),fld("Text",c.text,v=>c.text=v,{area:true,max:"400",full:true})),
      a.cards.length>1?h("button",{type:"button",class:"btn sm danger",text:"Remove card",onclick:()=>{a.cards.splice(i,1);mark();drawCards()}}):null)),
    a.cards.length<4?h("button",{type:"button",class:"btn sm addrow",text:"+ Add card",onclick:()=>{a.cards.push({title:"",text:""});mark();drawCards()}}):null)};
  drawTeam();drawCards();
  const save=async()=>{err.textContent="";if(!S.aboutReady&&S.config.about===undefined){}
    const clean={...a,team:a.team.filter(t=>t.name&&t.name.trim()).map(t=>({name:t.name.trim(),role:(t.role||"").trim(),bio:(t.bio||"").trim(),photo_url:t.photo_url||"",photo_path:t.photo_path||""})),cards:a.cards.filter(c=>c.title&&c.title.trim())};
    if(clean.discord&&!isUrl(clean.discord)){err.textContent="The Discord link needs to start with https://";return}
    if(clean.email&&!/^\S+@\S+\.\S+$/.test(clean.email)){err.textContent="That email address doesn't look right.";return}
    const r=await sb.from("site_config").update({about:clean}).eq("id",1);
    if(r.error){err.textContent=/about/.test(r.error.message||"")?"Run update-about.sql in Supabase first, then save again.":"Couldn't save: "+r.error.message;return}
    S.config.about=clean;dirty=false;dot.hidden=true;toast("About page saved")};
  fillEl($("amain"),crumbs("About page"),
    h("div",{class:"ahead"},h("h1",{text:"About page"}),h("a",{class:"btn sm",href:"#about",target:"_blank",rel:"noopener",text:"View page ↗"}),dot,h("button",{type:"button",class:"btn primary",style:"margin-left:auto",text:"Save changes",onclick:save})),
    h("p",{class:"aintro",text:"Everything on your About us page. Leave a field as it is to keep the starter text, and change anything that doesn't fit."}),err,
    h("div",{class:"apanel abed"},
      h("h2",{class:"edsec",text:"Top: meet the team"}),
      h("div",{class:"form"},fld("Small heading",a.kicker,v=>a.kicker=v,{max:"30",ph:"meet the"}),fld("Big heading",a.headline,v=>a.headline=v,{max:"30",ph:"translators"}),
        fld("Introduction",a.intro,v=>a.intro=v,{area:true,tall:true,max:"1500",full:true,hint:"Leave a blank line between paragraphs."})),
      h("h3",{class:"edsub",text:"Team members"}),h("p",{class:"hint",style:"margin:-6px 0 4px",text:"Up to 4 appear as photos at the top. People with a bio also get a note card."}),teamBox,
      h("h2",{class:"edsec",text:"Middle: what we do"}),
      h("div",{class:"form"},fld("Title on the notebook",a.doTitle,v=>a.doTitle=v,{max:"30"})),cardsBox,
      h("h2",{class:"edsec",text:"Bottom: your novels and contact"}),
      h("div",{class:"form"},fld("Novels heading",a.workTitle,v=>a.workTitle=v,{max:"30",ph:"our novels"}),fld("Line under it",a.workNote,v=>a.workNote=v,{max:"160"}),
        fld("Contact heading",a.contactTitle,v=>a.contactTitle=v,{max:"30"}),fld("Email to show",a.email,v=>a.email=v,{max:"120",ph:"hello@…"}),
        fld("Contact text",a.contactText,v=>a.contactText=v,{area:true,max:"600",full:true}),
        fld("Discord invite link",a.discord,v=>a.discord=v,{max:"200",ph:"https://discord.gg/…",full:true,hint:"Your Patreon button uses the membership link from Settings."})),
      h("div",{class:"actions",style:"margin-top:8px"},h("button",{type:"button",class:"btn primary",text:"Save changes",onclick:save}))));
  S.aboutDirty=()=>dirty}

/* ---------- Routing ---------- */
function parseHash(){const raw=decodeURIComponent(location.hash.replace(/^#\/?/,""));if(/access_token=|error_description=|type=recovery/.test(raw))return{name:"home"};const [name,id,sub]=raw.split("/");
  if((name==="book"||name==="read")&&id)return{name,id};
  if(name==="admin"){if(id==="chapter"){const parts=raw.split("/");return{name,col:"chapter",id:parts[2]||"new",book:parts[3]||null}}return{name,col:COLS_OK.includes(id)?id:"novels",id:sub||null}}
  if(name==="manage"&&id)return{name:"admin",col:"chapters",id};
  if(name==="dashboard")return{name:"admin",col:"novels"};
  if((name==="collection"||name==="reader")&&id)return{name,id};
  if(name==="browse"||name==="collections"||name==="about")return{name};return{name:"home"}}
function go(hash){if(location.hash.replace(/^#/,"")===hash)route();else location.hash=hash}
const VIEWS={home:"home",browse:"library",book:"bookPage",read:"reader",admin:"admin",collections:"collsPage",collection:"collPage",reader:"userPage",about:"aboutPage"};
function route(){
  const prev=S.route;let r=parseHash();
  const same=(a,b)=>a.name===b.name&&a.col===b.col&&a.id===b.id;
  if(S.edDirty&&prev.name==="admin"&&prev.col==="novels"&&prev.id&&!(r.name==="admin"&&r.col==="novels"&&r.id===prev.id)){
    if(!confirm("You have unsaved changes to this novel. Leave without saving?")){history.replaceState(null,"","#admin/novels/"+prev.id);return}clearDirty()}
  if(prev.col==="about"&&S.aboutDirty?.()&&!same(prev,r)){if(!confirm("You have unsaved changes to the About page. Leave without saving?")){history.replaceState(null,"","#admin/about");return}S.aboutDirty=null}
  if(S.chDirty&&prev.col==="chapter"&&!same(prev,r)){
    if(!confirm("You have unsaved changes to this chapter. Leave without saving? (A copy stays saved on this device.)")){history.replaceState(null,"","#admin/chapter/"+(prev.id||"new")+(prev.book&&prev.id==="new"?"/"+prev.book:""));return}chClearDirty()}
  if(prev.name==="admin"&&prev.col==="novels"&&prev.id&&!(r.name==="admin"&&r.col==="novels"&&r.id===prev.id))S.edOpen=false;
  if(r.name==="admin"&&!S.canEdit){if(S.authReady)openLogin();r={name:"home"}}
  const keep=n=>n==="home"||n==="browse";
  if(keep(prev.name)&&prev.name!==r.name)(S.scroll||={})[prev.name]=window.scrollY;
  S.route=r;const seq=++S.seq;
  for(const [k,id] of Object.entries(VIEWS))$(id).hidden=k!==r.name;
  document.body.classList.toggle("reading",r.name==="read");document.body.classList.toggle("browsing",r.name==="browse");document.body.classList.toggle("is-admin",r.name==="admin");
  const cur={navHome:r.name==="home",navBrowse:r.name==="browse",navColls:/^(collections|collection|reader)$/.test(r.name),navAbout:r.name==="about",navDash:r.name==="admin"};
  for(const [id,on] of Object.entries(cur))on?$(id).setAttribute("aria-current","page"):$(id).removeAttribute("aria-current");
  closeResults();if(r.name==="browse"&&$("hq").value!==S.q)$("hq").value=S.q;
  applyReaderPrefs(r.name==="read");
  if(!/^(book|read|admin|collections|collection|reader|about)$/.test(r.name))document.title=siteName();
  if(keep(r.name)){r.name==="home"?renderHome(seq):renderLibrary();if(prev.name!==r.name)requestAnimationFrame(()=>window.scrollTo(0,(S.scroll||{})[r.name]||0))}
  else{window.scrollTo(0,0);
    if(r.name==="admin")renderAdmin(r.col,r.id);
    else if(r.name==="book")renderBook(r.id,seq);
    else if(r.name==="collections")renderCollections(seq);
    else if(r.name==="about")renderAbout();
    else if(r.name==="collection")renderCollection(r.id,seq);
    else if(r.name==="reader")renderUser(r.id,seq);
    else if(r.name==="read"){if(sb)renderReader(r.id,seq)}}
}
function rerender(){const r=S.route,seq=S.seq;
  if(r.name==="browse")renderLibrary();else if(r.name==="home")renderHome(seq);else if(r.name==="admin"){if((r.col==="chapter"&&S.chOpen)||r.col==="about"){}else if(r.col==="novels"&&r.id&&S.edOpen&&(r.id==="new"||S.books.some(b=>b.id===r.id))){if(r.id!=="new"&&!S.edDirty)edMeta(S.books.find(b=>b.id===r.id));refreshList()}else renderAdmin(r.col,(r.col==="novels"||r.col==="chapter")?r.id:null)}
  else if(r.name==="book")renderBook(r.id,seq);else if(r.name==="collections")renderCollections(seq);else if(r.name==="about")renderAbout()}
window.addEventListener("hashchange",route);

/* ---------- Wiring ---------- */
for(const d of document.querySelectorAll("dialog")){d.addEventListener("click",e=>{if((e.target===d&&d.id!=="impDlg")||e.target.closest("[data-close]"))d.close()})}
function setLogo(n){const w=n.trim().split(/\s+/);const caps=w.length>=3?w.pop():"";$("logoScript").textContent=w.join(" ").toLowerCase();$("logoCaps").textContent=caps;$("logoCaps").hidden=!caps;$("brandLink").setAttribute("aria-label",n+", home")}
function applyConfig(){const n=siteName();$("siteName").textContent=n;setLogo(n);if(!/^(book|read|admin)$/.test(S.route.name))document.title=n;$("hq").placeholder="Search "+(S.books.length?S.books.length+" titles":"titles")+", authors or genres";$("tagline").textContent=S.config.tagline||DEFAULT_TAG;$("footName").textContent="© "+new Date().getFullYear()+" "+n}

S.hotWin=LS.get("hotWin",7);
route();
(async()=>{
  if(!sb){S.loaded=true;$("count").textContent="0 books";showNotice("This site isn't connected to its database yet. Add the Supabase details in config.js.");renderLibrary();return}
  const ah=location.hash;
  await afterAuth();S.authReady=true;
  await finishPatreon();
  if(/error_description=/.test(ah)){toast(/expired/i.test(ah)?"That link has expired. Sign in, or ask for a new reset email.":"That link didn't work. Try signing in.");history.replaceState(null,"",location.pathname)}
  else if(/access_token=|type=/.test(ah))history.replaceState(null,"",location.pathname);
  route();
})();
