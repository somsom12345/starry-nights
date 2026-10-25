"use strict";
const COVERS={rose:["#8E1F4B","#FBE4EE"],plum:["#3E2459","#EADCF7"],ink:["#1F2A44","#E3E8F5"],teal:["#0F5257","#D6F1EE"],forest:["#2F4A2A","#E2EFD9"],gold:["#C4912F","#2A1C05"],coral:["#D9634B","#2B0E07"],sky:["#9CC3E6","#102033"],blush:["#F2C6D3","#4A1428"]};
const STATUS={ongoing:"Ongoing",completed:"Completed",hiatus:"On hiatus"};
const MSTATUS={active:"Active",paused:"Paused",cancelled:"Cancelled"};
const DEFAULT_TIERS=["Bronze","Silver","Gold"];
const DEFAULT_NAME="Starry Nights Translation";
const DEFAULT_TAG="Romance, fantasy and everything in between.";
const S={books:[],members:[],links:{},config:{},q:"",genres:new Set(),status:"all",access:"all",sort:"new",canEdit:false,view:"library",loaded:false,editBook:null,editMember:null,cover:"rose"};
const $=id=>document.getElementById(id);

function h(tag,attrs,...kids){const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(v==null||v===false)continue;if(k==="text")e.textContent=v;else if(k==="class")e.className=v;else if(k==="style")e.setAttribute("style",v);else if(k.startsWith("on"))e.addEventListener(k.slice(2),v);else e.setAttribute(k,v===true?"":v)}for(const c of kids.flat()){if(c==null||c===false)continue;e.append(c.nodeType?c:document.createTextNode(String(c)))}return e}
function toast(msg){const t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,2400)}
function tidyGenre(g){return g.trim().replace(/\s+/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
function parseGenres(s){const seen=new Map();for(const g of s.split(",")){const t=tidyGenre(g);if(t&&!seen.has(t.toLowerCase()))seen.set(t.toLowerCase(),t)}return[...seen.values()].slice(0,8)}
function today(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function fmtDate(s){if(!s)return"";const d=new Date(s+"T00:00:00");return isNaN(d)?s:d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}
function isUrl(s){return/^https?:\/\/\S+$/i.test(s||"")}
function tiers(){return Array.isArray(S.config.tiers)&&S.config.tiers.length?S.config.tiers:DEFAULT_TIERS}
function time(b){return Date.parse(b.created_at)||0}

/* ---------- Supabase ---------- */
const CFG=window.SN_CONFIG||{};
const configured=isUrl(CFG.url)&&CFG.key&&!/PASTE_/.test(CFG.key);
const sb=configured&&window.supabase?window.supabase.createClient(CFG.url,CFG.key):null;

async function loadPublic(){
  const [b,c]=await Promise.all([sb.from("books").select("*").order("created_at",{ascending:false}),sb.from("site_config").select("*").eq("id",1).maybeSingle()]);
  if(b.error)throw b.error;
  S.books=b.data||[];S.config=c.data||{};S.loaded=true;applyConfig();
}
async function loadPrivate(){
  if(!S.canEdit){S.members=[];S.links={};return}
  const [m,l]=await Promise.all([sb.from("members").select("*"),sb.from("private_links").select("*")]);
  S.members=m.data||[];S.links=Object.fromEntries((l.data||[]).map(r=>[r.book_id,r.url]));
}
async function refresh(){try{await loadPublic();await loadPrivate()}catch(e){console.error(e);showNotice("Couldn't load the library. Refresh the page to try again.")}rerender()}
async function checkOwner(){const {data:{session}}=await sb.auth.getSession();if(!session)return false;const {data,error}=await sb.rpc("is_owner");return !error&&data===true}

function showNotice(text){$("notice").replaceChildren(h("div",{class:"banner",text}))}

/* ---------- Covers & bits ---------- */
function cover(b,big){const c=COVERS[b.cover]||COVERS.rose;const box=h("div",{class:"covbox"});
  const el=b.cover_url?h("div",{class:"cover has-img",style:`--cv-bg:${c[0]};--cv-fg:${c[1]}`},h("img",{src:b.cover_url,alt:"Cover of "+(b.title||"this book"),loading:"lazy",decoding:"async"}))
   :h("div",{class:"cover",style:`--cv-bg:${c[0]};--cv-fg:${c[1]}`},
    h("span",{class:"cg",text:(b.genres||[]).slice(0,2).join(" · ")||"Novel"}),
    h("span",{class:"ct",text:b.title||"Untitled"}),
    h("span",{class:"ca",text:b.author||" "}));
  if(b.access==="members")el.append(h("span",{class:"lock",text:"Members"}));
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
  const by={new:(a,b)=>time(b)-time(a),az:(a,b)=>(a.title||"").localeCompare(b.title||""),chapters:(a,b)=>(b.chapters||0)-(a.chapters||0)}[S.sort];
  return list.sort(by)}
function genreCounts(){const m=new Map();for(const b of S.books)for(const g of b.genres||[]){const k=g.toLowerCase();const e=m.get(k)||{label:g,n:0};e.n++;m.set(k,e)}return[...m.entries()].sort((a,b)=>b[1].n-a[1].n||a[1].label.localeCompare(b[1].label))}
function card(b){return h("button",{type:"button",class:"card",onclick:()=>openDetail(b.id),"aria-label":`${b.title}${b.author?" by "+b.author:""}`},
  cover(b),h("span",{class:"t",text:b.title}),b.author?h("span",{class:"a",text:b.author}):null,
  h("span",{class:"meta"},pill(b.status||"ongoing",STATUS[b.status]||"Ongoing"),b.chapters?h("span",{class:"mono",text:b.chapters+" ch"}):null))}
function renderLibrary(){
  $("rail").replaceChildren(h("button",{type:"button",class:"chip","aria-pressed":String(S.genres.size===0),onclick:()=>{S.genres.clear();renderLibrary()}},"All genres"),
    ...genreCounts().map(([k,v])=>h("button",{type:"button",class:"chip","aria-pressed":String(S.genres.has(k)),onclick:()=>{S.genres.has(k)?S.genres.delete(k):S.genres.add(k);renderLibrary()}},v.label,h("span",{class:"n",text:v.n}))));
  const active=!!(S.q.trim()||S.genres.size||S.status!=="all"||S.access!=="all");
  $("clear").hidden=!active;
  const feat=S.books.filter(b=>b.featured);$("featured").hidden=active||!feat.length||!S.loaded;
  $("strip").replaceChildren(...feat.map(card));
  const list=filtered();$("grid").replaceChildren(...list.map(card));
  $("count").textContent=!S.loaded?"Loading the shelf":`${list.length} ${list.length===1?"book":"books"}${active?" match":""}`;
  const em=$("libEmpty");em.hidden=!(S.loaded&&!list.length);
  if(!em.hidden)em.replaceChildren(h("div",{class:"empty"},h("h3",{text:S.books.length?"Nothing matches yet":"The shelf is empty"}),
    h("p",{text:S.books.length?"Try fewer genres or a shorter search.":(S.canEdit?"Open the Dashboard and add your first book.":"New books are on the way. Check back soon.")})));
}
function openDetail(id){const b=S.books.find(x=>x.id===id);if(!b)return;const join=S.config.join_url;
  const acts=h("div",{class:"actions"});
  if(b.access==="members"){
    if(isUrl(join))acts.append(h("a",{class:"btn primary",href:join,target:"_blank",rel:"noopener",text:"Join to read"}));
    acts.append(h("span",{class:"note",text:"This book is for paid members."}));
    if(S.canEdit&&S.links[b.id])acts.append(h("a",{class:"btn",href:S.links[b.id],target:"_blank",rel:"noopener",text:"Open member link"}));
  }else if(isUrl(b.read_url))acts.append(h("a",{class:"btn primary",href:b.read_url,target:"_blank",rel:"noopener",text:"Start reading"}));
  else acts.append(h("span",{class:"note",text:"Reading link coming soon."}));
  if(S.canEdit)acts.append(h("button",{type:"button",class:"btn",text:"Edit",onclick:()=>{$("detailDlg").close();openBookForm(b.id)}}));
  $("detailBody").replaceChildren(h("div",{class:"dlg-head"},h("span",{class:"eyebrow",text:"Book"}),h("button",{type:"button",class:"x","aria-label":"Close",text:"×",onclick:()=>$("detailDlg").close()})),
    h("div",{class:"detail"},cover(b,true),h("div",{style:"min-width:0"},h("h2",{text:b.title}),b.author?h("p",{class:"by",text:"by "+b.author}):null,
      h("div",{class:"tags"},...(b.genres||[]).map(g=>h("span",{class:"tag",text:g}))),
      h("dl",{class:"facts"},h("div",{},h("dt",{text:"Status"}),h("dd",{},pill(b.status||"ongoing",STATUS[b.status]||"Ongoing"))),h("div",{},h("dt",{text:"Chapters"}),h("dd",{class:"mono",style:"color:var(--ink);font-size:15px",text:b.chapters||"–"})),h("div",{},h("dt",{text:"Access"}),h("dd",{text:b.access==="members"?"Members only":"Free"}))),
      b.synopsis?h("p",{class:"syn",text:b.synopsis}):h("p",{class:"syn note",text:"No synopsis yet."}),acts)));
  $("detailDlg").showModal()}

/* ---------- Dashboard ---------- */
function confirmBtn(label,fn){const b=h("button",{type:"button",class:"btn sm danger",text:label});let armed=false,t;
  b.addEventListener("click",()=>{if(!armed){armed=true;b.textContent="Confirm";b.classList.add("armed");t=setTimeout(()=>{armed=false;b.textContent=label;b.classList.remove("armed")},4000)}else{clearTimeout(t);b.disabled=true;fn()}});return b}
function renderDash(){
  const active=S.members.filter(m=>m.status==="active");const due=active.filter(m=>m.renew_on&&m.renew_on<today());
  const byTier=tiers().map(t=>`${t} ${active.filter(m=>m.tier===t).length}`).join(" · ");
  const tile=(k,v,s)=>h("div",{class:"tile"},h("div",{class:"k",text:k}),h("div",{class:"v",text:v}),h("div",{class:"s",text:s}));
  $("tiles").replaceChildren(tile("Books",S.books.length,`${S.books.filter(b=>b.status==="completed").length} completed`),
    tile("Members only",S.books.filter(b=>b.access==="members").length,"books behind membership"),
    tile("Active members",active.length,byTier),tile("Renewals due",due.length,due.length?"past their renewal date":"all up to date"));
  const q=$("dbq").value.trim().toLowerCase();
  const books=S.books.filter(b=>!q||(b.title+" "+(b.author||"")+" "+(b.genres||[]).join(" ")).toLowerCase().includes(q)).sort((a,b)=>time(b)-time(a));
  $("bookRows").replaceChildren(...books.map(b=>{const c=COVERS[b.cover]||COVERS.rose;return h("tr",{},
    h("td",{},h("div",{class:"tcell"},(b.cover_url?h("img",{class:"mini",src:b.cover_url,alt:"",loading:"lazy"}):h("span",{class:"mini",style:`background:${c[0]}`})),h("div",{},h("div",{style:"font-weight:600"},b.title,b.featured?" ★":""),h("div",{class:"sub",text:b.author||""})))),
    h("td",{class:"sub",text:(b.genres||[]).join(", ")}),h("td",{},pill(b.status||"ongoing",STATUS[b.status]||"Ongoing")),
    h("td",{text:b.access==="members"?"Members":"Free"}),h("td",{class:"num",text:b.chapters||0}),
    h("td",{},h("div",{class:"rowact"},h("button",{type:"button",class:"btn sm",text:"Edit",onclick:()=>openBookForm(b.id)}),confirmBtn("Delete",()=>deleteBook(b.id)))))}));
  $("bookEmpty").hidden=books.length>0;
  const mq=$("mq").value.trim().toLowerCase(),ms=$("mStatus").value;const order={active:0,paused:1,cancelled:2};
  const mem=S.members.filter(m=>(ms==="all"||m.status===ms)&&(!mq||((m.name||"")+" "+(m.contact||"")+" "+(m.tier||"")).toLowerCase().includes(mq))).sort((a,b)=>(order[a.status]??3)-(order[b.status]??3)||(a.name||"").localeCompare(b.name||""));
  $("memberRows").replaceChildren(...mem.map(m=>{const late=m.status==="active"&&m.renew_on&&m.renew_on<today();return h("tr",{},
    h("td",{},h("div",{style:"font-weight:600",text:m.name}),h("div",{class:"sub",text:m.contact||""})),
    h("td",{text:m.tier||"–"}),h("td",{},pill(m.status,MSTATUS[m.status]||m.status)),h("td",{class:"num",text:fmtDate(m.since)||"–"}),
    h("td",{},late?pill("due","Due "+fmtDate(m.renew_on)):h("span",{class:"num",text:fmtDate(m.renew_on)||"–"})),
    h("td",{class:"sub",style:"max-width:240px",text:m.notes||""}),
    h("td",{},h("div",{class:"rowact"},h("button",{type:"button",class:"btn sm",text:"Edit",onclick:()=>openMemberForm(m.id)}),confirmBtn("Delete",()=>deleteMember(m.id)))))}));
  $("memberEmpty").hidden=mem.length>0;
  if(!document.activeElement?.closest?.("#cfgForm")){$("cName").value=S.config.site_name||"";$("cTag").value=S.config.tagline||"";$("cJoin").value=S.config.join_url||"";$("cTiers").value=tiers().join(", ")}
}

/* ---------- Book form ---------- */
function setCover(k){S.cover=k;for(const b of $("bSwatches").children)b.setAttribute("aria-pressed",String(b.dataset.k===k));if($("bookDlg").open)coverPreview()}
$("bSwatches").append(...Object.entries(COVERS).map(([k,c])=>h("button",{type:"button","data-k":k,"aria-label":k+" cover","aria-pressed":"false",style:`background:${c[0]}`,onclick:()=>setCover(k)})));
function updUrlHint(){$("bUrlHint").textContent=$("bAccess").value==="members"?"Kept private: only you see this link. Readers get your membership link instead.":"Where the \"Start reading\" button goes."}
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
  $("bookDlgTitle").textContent=b?"Edit book":"Add book";$("bTitle").value=b?.title||"";$("bAuthor").value=b?.author||"";$("bChapters").value=b?.chapters??"";
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
async function deleteBook(id){const b=S.books.find(x=>x.id===id);const r=await sb.from("books").delete().eq("id",id);if(!r.error)await removeCoverFile(b?.cover_path);toast(r.error?"Couldn't delete that book":"Book deleted");await refresh()}

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
  const r=await sb.from("site_config").upsert({id:1,site_name:$("cName").value.trim(),tagline:$("cTag").value.trim(),join_url:join,tiers:t.length?t:DEFAULT_TIERS});
  if(r.error){err.textContent="Couldn't save settings. Try again.";return}
  document.activeElement?.blur();toast("Settings saved");await refresh()});

/* ---------- Login ---------- */
$("ownerLogin").addEventListener("click",()=>{$("lErr").textContent="";$("loginDlg").showModal();$("lEmail").focus()});
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();const err=$("lErr");err.textContent="";$("lBtn").disabled=true;
  const {error}=await sb.auth.signInWithPassword({email:$("lEmail").value.trim(),password:$("lPass").value});
  $("lBtn").disabled=false;
  if(error){const m=(error.message||"").toLowerCase();err.textContent=m.includes("not confirmed")?"This email isn't confirmed. In Supabase, delete the user and add it again with Auto Confirm ticked.":m.includes("invalid login")?"Wrong email or password (Supabase says: "+error.message+")":"Login failed: "+error.message;return}
  $("lPass").value="";await afterAuth();
  if(!S.canEdit){err.textContent="This account isn't set up as the site owner.";await sb.auth.signOut();return}
  $("loginDlg").close();toast("Logged in");setView("dashboard")});
async function logout(){await sb.auth.signOut();S.canEdit=false;await afterAuth();setView("library");toast("Logged out")}
async function afterAuth(){S.canEdit=await checkOwner();$("tabs").hidden=!S.canEdit;
  $("who").replaceChildren(S.canEdit?h("button",{type:"button",text:"Log out",onclick:logout}):h("button",{type:"button",text:"Owner login",onclick:()=>{$("lErr").textContent="";$("loginDlg").showModal();$("lEmail").focus()}}));
  await refresh()}

/* ---------- Wiring ---------- */
for(const d of document.querySelectorAll("dialog")){d.addEventListener("click",e=>{if(e.target===d||e.target.closest("[data-close]"))d.close()})}
$("q").addEventListener("input",e=>{S.q=e.target.value;renderLibrary()});
$("fStatus").addEventListener("change",e=>{S.status=e.target.value;renderLibrary()});
$("fAccess").addEventListener("change",e=>{S.access=e.target.value;renderLibrary()});
$("fSort").addEventListener("change",e=>{S.sort=e.target.value;renderLibrary()});
$("clear").addEventListener("click",()=>{S.q="";S.genres.clear();S.status="all";S.access="all";$("q").value="";$("fStatus").value="all";$("fAccess").value="all";renderLibrary()});
$("dbq").addEventListener("input",renderDash);$("mq").addEventListener("input",renderDash);$("mStatus").addEventListener("change",renderDash);
$("addBook").addEventListener("click",()=>openBookForm(null));$("addMember").addEventListener("click",()=>openMemberForm(null));
function setView(v){S.view=v==="dashboard"&&S.canEdit?"dashboard":"library";
  $("library").hidden=S.view!=="library";$("dashboard").hidden=S.view!=="dashboard";$("searchRow").hidden=$("rail").hidden=S.view!=="library";
  $("tabLibrary").setAttribute("aria-selected",String(S.view==="library"));$("tabDash").setAttribute("aria-selected",String(S.view==="dashboard"));
  history.replaceState(null,"",S.view==="dashboard"?"#dashboard":location.pathname);
  rerender()}
$("tabLibrary").addEventListener("click",()=>setView("library"));$("tabDash").addEventListener("click",()=>setView("dashboard"));
function applyConfig(){const n=S.config.site_name||DEFAULT_NAME;$("siteName").textContent=n;document.title=n;$("tagline").textContent=S.config.tagline||DEFAULT_TAG;$("footName").textContent="© "+new Date().getFullYear()+" "+n}
function rerender(){S.view==="dashboard"?renderDash():renderLibrary()}

renderLibrary();
(async()=>{
  if(!sb){S.loaded=true;$("count").textContent="0 books";showNotice("This site isn't connected to its database yet. Add the Supabase details in config.js.");renderLibrary();return}
  await afterAuth();
  if(location.hash==="#dashboard"){if(S.canEdit)setView("dashboard");else{$("loginDlg").showModal()}}
})();
