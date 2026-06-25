// ============ Config ============
const BASE_URLS = { global: 'https://grsaiapi.com', china: 'https://grsai.dakka.com.cn' };
const SIZE_MAP = {
  '1:1':   { '1K': '1024x1024', '2K': '2048x2048', '4K': '2880x2880' },
  '16:9':  { '1K': '1774x887',  '2K': '2048x1152', '4K': '3840x2160' },
  '9:16':  { '1K': '887x1774',  '2K': '1152x2048', '4K': '2160x3840' },
  '3:2':   { '1K': '1536x1024', '2K': '2048x1360', '4K': '3504x2336' },
  '2:3':   { '1K': '1024x1536', '2K': '1360x2048', '4K': '2336x3504' },
  '21:9':  { '1K': '2048x880',  '2K': '3840x1648' },
  '9:21':  { '1K': '880x2048',  '2K': '1648x3840' },
  '1:3':   { '1K': '688x2048',  '2K': '1280x3840' },
  '3:1':   { '1K': '2048x688',  '2K': '3840x1280' },
  '2:1':   { '1K': '2048x1024', '2K': '3840x1920' },
  '1:2':   { '1K': '1024x2048', '2K': '1920x3840' }
};
const POLL_INTERVAL = 2000;

const DS_BASE_URL = 'https://api.deepseek.com/v1/chat/completions';

const ERROR_ZH = {
  'generate failed':'生成失败','content policy violation':'内容违规','violation':'内容违规',
  'rate limit exceeded':'请求过于频繁，请稍后再试','invalid api key':'API Key 无效',
  'unauthorized':'未授权，请检查 API Key','model not found':'模型不存在',
  'invalid request':'请求参数无效','internal server error':'服务器内部错误',
  'service unavailable':'服务暂不可用','timeout':'请求超时','bad request':'请求格式错误',
  'forbidden':'访问被拒绝','not found':'资源不存在','too many requests':'请求过多，请稍后再试',
  'server error':'服务器错误','connection error':'网络连接错误','network error':'网络错误',
  'failed to generate':'生成失败','image generation failed':'图片生成失败',
  'prompt too long':'提示词过长','invalid image':'参考图片格式无效',
  'image too large':'参考图片过大','nsfw content detected':'检测到不当内容',
  'safety filter triggered':'安全过滤触发','blocked by safety system':'被安全系统拦截',
  'content filtered':'内容被过滤'
};
function translateError(msg) {
  if (!msg) return '';
  const l = msg.toLowerCase();
  if (ERROR_ZH[l]) return ERROR_ZH[l];
  let best='', tr='';
  for (const [k,v] of Object.entries(ERROR_ZH)) { if (l.includes(k) && k.length>best.length) { best=k; tr=v; } }
  return tr || msg;
}

// ============ State ============
let state = {
  node:'global', model:'gpt-image-2', selectedSize:'1024x1024',
  selectedRatio:'1:1', selectedQuality:'1K',
  refImages:[], tasks:[], history:[], favorites:new Set(),
  pollingTimers:{},
  errorLog:[], currentViewerUrl:'', currentViewerList:[], currentViewerIdx:-1,
  theme:'dark',
  // Filter
  searchQuery:'', filterModel:'gpt-image-2', activeTab:'all',
  // Failed records
  failedRecords:[]
};


// ============ Error Log ============
function logError(message, source = '', details = null) {
  state.errorLog.push({
    timestamp: new Date().toISOString(),
    message: String(message),
    source: String(source),
    details: details
  });
  if (state.errorLog.length > 100) state.errorLog = state.errorLog.slice(-100);
}
const $=id=>document.getElementById(id);
// ===== 安全包装器 v2（不拦截已存在元素） =====
(function() {
  var _orig$ = $;
  $ = function(id) {
    var el = _orig$(id);
    if (el) return el;  // 元素存在，直接返回
    // 元素不存在时，返回无害的 mock 对象
    console.warn('[绘漪] DOM 缺失:', id, '- 已用 mock 对象代替，功能可能不完整');
    return {
      addEventListener: function() {},
      removeEventListener: function() {},
      classList: { add: function(){}, remove: function(){}, toggle: function(){}, contains: function(){return false} },
      style: { setProperty: function(){}, removeProperty: function(){} },
      value: '',
      type: 'text',
      textContent: '',
      innerHTML: '',
      innerText: '',
      disabled: false,
      checked: false,
      files: null,
      closest: function() { return null; },
      querySelector: function() { return null; },
      querySelectorAll: function() { return []; },
      appendChild: function() {},
      removeChild: function() {},
      insertBefore: function() {},
      replaceWith: function() {},
      setAttribute: function() {},
      getAttribute: function() { return null; },
      removeAttribute: function() {},
      contains: function() { return false; },
      focus: function() {},
      blur: function() {},
      click: function() {}
    };
  };
})();

const apiKeyInput=$('apiKey'), keyToggle=$('keyToggle'), modelSelect=$('model');
const sizeGrid=$('sizeGrid'), refImagesDiv=$('refImages'), refInput=$('refInput');
const refDropZone=$('refDropZone'), promptArea=$('prompt'), generateBtn=$('generateBtn');
const charCount=$('charCount'), enhanceBtn=$('enhanceBtn'), batchCount=$('batchCount');
const tasksSection=$('tasksSection'), tasksGrid=$('tasksGrid'), taskCount=$('taskCount');
const historyGrid=$('historyGrid'), viewer=$('viewer'), viewerImg=$('viewerImg');
const viewerClose=$('viewerClose'), viewerDownload=$('viewerDownload');
const viewerPrev=$('viewerPrev'), viewerNext=$('viewerNext');
const clearHistoryBtn=$('clearHistory'), searchInput=$('searchInput');
// ============ Init ============
function init(){ loadSettings();
  const vipHint=$('sizeVipHint');if(vipHint)vipHint.classList.toggle('show',state.model!=='gpt-image-2-vip'); renderSizeGrid(); renderRefImages(); renderHistory(); renderFailed(); bindEvents(); applyTheme(); }

function loadSettings(){
  const s=localStorage.getItem('gis2_settings');
  if(s){const d=JSON.parse(s);apiKeyInput.value=d.apiKey||'';state.node=d.node||'global';state.model=d.model||'gpt-image-2';state.selectedRatio=d.selectedRatio||'1:1';state.selectedQuality=d.selectedQuality||'1K';state.theme=d.theme||'dark';state.favorites=new Set(d.favorites||[]);}
  const h=localStorage.getItem('gis2_history');
  if(h) state.history=JSON.parse(h);
  const f=localStorage.getItem('gis2_failed');
  if(f) state.failedRecords=JSON.parse(f);
  modelSelect.value=state.model;
  document.querySelectorAll('.node-btn').forEach(b=>b.classList.toggle('active',b.dataset.node===state.node));
  if(SIZE_MAP[state.selectedRatio]&&SIZE_MAP[state.selectedRatio][state.selectedQuality]) state.selectedSize=SIZE_MAP[state.selectedRatio][state.selectedQuality];
}
function saveSettings(){
  localStorage.setItem('gis2_settings',JSON.stringify({
    apiKey:apiKeyInput.value,node:state.node,model:state.model,
    selectedRatio:state.selectedRatio,selectedQuality:state.selectedQuality,
    theme:state.theme,favorites:[...state.favorites]
  }));
}
function saveHistory(){
  if(state.history.length>200) state.history=state.history.slice(0,200);
  localStorage.setItem('gis2_history',JSON.stringify(state.history));
}
function saveFailed(){
  localStorage.setItem('gis2_failed',JSON.stringify(state.failedRecords));
}

// ============ Theme ============
function applyTheme(){
  document.documentElement.setAttribute('data-theme',state.theme);
  const icons={dark:'🌓',light:'☀️',sakura:'🌸'};
  $('themeBtn').textContent=icons[state.theme]||'🌓';
}
const THEMES=['dark','light','sakura'];
function toggleTheme(){
  const idx=THEMES.indexOf(state.theme);
  state.theme=THEMES[(idx+1)%THEMES.length];
  applyTheme();saveSettings();
}

// ============ Size Grid ============
function renderSizeGrid(){
  const isVip=state.model==='gpt-image-2-vip';
  let html='';
  for(const[ratio,qualities]of Object.entries(SIZE_MAP)){
    for(const[quality,px]of Object.entries(qualities)){
      if(!isVip&&quality!=='1K') continue;
      const isActive=state.selectedRatio===ratio&&state.selectedQuality===quality;
      html+=`<button class="size-btn${isActive?' active':''}" data-ratio="${ratio}" data-quality="${quality}" data-px="${px}"><div class="ratio">${ratio}</div><div class="px">${px}</div></button>`;
    }
  }
  sizeGrid.innerHTML=html;
}

// ============ Reference Images ============
function renderRefImages(){
  let html='';
  state.refImages.forEach((b64,i)=>{
    html+=`<div class="ref-img-slot" data-index="${i}"><img src="${b64}" alt="参考图${i+1}"><button class="remove-btn" data-index="${i}">✕</button></div>`;
  });
  if(state.refImages.length<4) html+=`<div class="ref-img-slot" data-index="add" title="点击添加"><span class="add-icon">+</span></div>`;
  refImagesDiv.innerHTML=html;
}
function fileToBase64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);})}
function addRefImageFromUrl(url){
  if(state.refImages.length>=4){showToast('最多4张参考图','error');return;}
  if(!/^https?:\/\//i.test(url)){showToast('请输入有效的图片 URL','error');return;}
  state.refImages.push(url);
  renderRefImages();showToast('已添加参考图链接','success');
}
function addRefImageFromBlob(blob){
  if(state.refImages.length>=4){showToast('最多4张参考图','error');return;}
  fileToBase64(blob).then(b64=>{state.refImages.push(b64);renderRefImages();showToast('已添加参考图','success');});
}
function addRefImagesFromFiles(files){
  const remaining=4-state.refImages.length;
  Array.from(files).slice(0,remaining).forEach(f=>{
    fileToBase64(f).then(b64=>{state.refImages.push(b64);renderRefImages();});
  });
}

// ============ API ============
function getBaseUrl(){return BASE_URLS[state.node];}
function getHeaders(){return{'Content-Type':'application/json','Authorization':`Bearer ${apiKeyInput.value.trim()}`};}
async function submitGeneration(prompt,images){
  const body={model:state.model,prompt,aspectRatio:state.selectedSize,replyType:'async'};
  if(images&&images.length>0) body.images=images;
  const resp=await fetch(`${getBaseUrl()}/v1/api/generate`,{method:'POST',headers:getHeaders(),body:JSON.stringify(body)});
  if(!resp.ok){
    try{
      const errData=await resp.json();
      if(errData.status==='violation') throw new Error('内容违规，请修改提示词');
      if(errData.status==='failed') throw new Error(errData.error||'生成失败');
      throw new Error(errData.error||`HTTP ${resp.status}`);
    }catch(jsonErr){
      if(jsonErr.message&&jsonErr.message!=='Unexpected token') throw jsonErr;
      const t=await resp.text();throw new Error(`HTTP ${resp.status}: ${t}`);
    }
  }
  return resp.json();
}
async function pollResult(taskId){
  const resp=await fetch(`${getBaseUrl()}/v1/api/result?id=${encodeURIComponent(taskId)}`,{headers:getHeaders()});
  if(!resp.ok) throw new Error(`Poll HTTP ${resp.status}`);
  return resp.json();
}

// ============ Tasks ============
function addTask(taskId,prompt){
  state.tasks.unshift({id:taskId,prompt,model:state.model,size:state.selectedSize,status:'running',progress:0,results:[],error:null,createdAt:Date.now()});
  renderTasks();startPolling(taskId);
}
function updateTask(taskId,data){
  const task=state.tasks.find(t=>t.id===taskId);if(!task)return;
  Object.assign(task,data);renderTasks();
  if(task.status==='succeeded'){
    stopPolling(taskId);
    if(task.results&&task.results.length>0){
      task.results.forEach(r=>{state.history.unshift({url:r.url,prompt:task.prompt,model:task.model,size:task.size,timestamp:task.createdAt,id:Date.now()+'_'+Math.random().toString(36).slice(2,8)});});
      saveHistory();renderHistory();
    }
    setTimeout(()=>removeTask(taskId),2000);
    showToast('图片生成成功！','success');
  }else if(task.status==='failed'||task.status==='violation'){
    stopPolling(taskId);
    // Add to failed records instead of auto-removing
    state.failedRecords.unshift({prompt:task.prompt,model:task.model,size:task.size,error:task.error,status:task.status,timestamp:Date.now(),id:task.id});
    saveFailed();renderFailed();
    showToast(`生成失败: ${translateError(task.error)}`,'error');
    setTimeout(()=>removeTask(taskId),3000);
  }
}
function removeTask(taskId){state.tasks=state.tasks.filter(t=>t.id!==taskId);renderTasks();}
function startPolling(taskId){
  if(state.pollingTimers[taskId])return;
  state.pollingTimers[taskId]=setInterval(async()=>{
    try{const d=await pollResult(taskId);updateTask(taskId,{status:d.status,progress:d.progress||0,results:d.results||[],error:d.error||null});}
    catch(e){console.error('Poll error:',e);}
  },POLL_INTERVAL);
}
function stopPolling(taskId){if(state.pollingTimers[taskId]){clearInterval(state.pollingTimers[taskId]);delete state.pollingTimers[taskId];}}
function escapeHtml(str){const d=document.createElement('div');d.textContent=str;return d.innerHTML;}

function renderTasks(){
  const active=state.tasks.filter(t=>t.status==='running');
  if(active.length===0&&state.tasks.length===0){tasksSection.style.display='none';return;}
  tasksSection.style.display='block';taskCount.textContent=active.length;
  tasksGrid.innerHTML=state.tasks.map(task=>{
    const sc=task.status;
    const st={running:'生成中...',succeeded:'完成',failed:'生成失败',violation:'内容违规'}[task.status]||translateError(task.status);
    let imgC='';
    const imgUrl = (task.results&&task.results.length>0&&task.results[0].url) ? task.results[0].url : "";
    if(imgUrl){imgC=`<img src="${imgUrl}" alt="生成结果" loading="lazy" data-action="view" data-url="${encodeURIComponent(imgUrl)}">`;}
    else imgC=`<div style="color:var(--text2);font-size:28px">🎨</div>`;
    const errH=task.error?`<div style="font-size:11px;color:var(--error);margin-top:6px">❌ ${escapeHtml(translateError(task.error))}</div>`:'';
    const actH=(task.status==='succeeded'&&imgUrl)?`<div class="card-actions"><button data-action="download" data-url="${encodeURIComponent(imgUrl)}">⬇ 下载</button><button data-action="view" data-url="${encodeURIComponent(imgUrl)}">🔍 查看</button></div>`:'';
    return`<div class="task-card ${sc}"><div class="card-img">${imgC}</div><div class="card-body"><div class="card-prompt">${escapeHtml(task.prompt)}</div>${task.status==='running'?`<div class="progress-bar"><div class="fill" style="width:${task.progress}%"></div></div>`:''}<div class="card-meta"><span class="status-badge ${sc}"><span class="dot"></span>${st}${task.status==='running'&&task.progress?' '+task.progress+'%':''}</span><span class="model-tag">${task.model}</span></div>${actH}${errH}</div></div>`;
  }).join('');
}

// ============ Failed Records ============
function renderFailed(){
  const sec=$('failedSection'),list=$('failedList'),cnt=$('failedCount');
  if(state.failedRecords.length===0){sec.style.display='none';return;}
  sec.style.display='block';
  cnt.textContent=state.failedRecords.length;
  list.innerHTML=state.failedRecords.map((rec,i)=>{
    const date=new Date(rec.timestamp);
    const ts=`${date.getMonth()+1}/${date.getDate()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}:${date.getSeconds().toString().padStart(2,'0')}`;
    const statusLabel=rec.status==='violation'?'内容违规':'生成失败';
    return`<div class="failed-item"><div class="failed-top"><div class="failed-prompt">${escapeHtml(rec.prompt)}</div><button class="failed-remove" data-idx="${i}" title="删除">✕</button></div><div class="failed-reason"><span class="ri">⚠</span><span>${statusLabel}：${escapeHtml(translateError(rec.error))}</span></div><div class="failed-meta"><span>${ts}</span><span class="mt">${rec.model}</span><span class="mt">${rec.size}</span></div><div class="failed-actions"><button data-idx="${i}" class="retry-btn">♻ 重新生成</button><button data-idx="${i}" class="reuse-prompt-btn">📝 复用提示词</button><button data-idx="${i}" class="polish-btn${rec.status==='violation'?' show':''}" title="润色提示词以规避内容审查">✨ 润色提示词</button></div></div>`;
  }).join('');
}

// ============ History ============
function getFilteredHistory(){
  let list=state.history;
  // Tab filter
  if(state.activeTab==='favs') list=list.filter(item=>state.favorites.has(item.id));
  // Model filter
  if(state.filterModel!=='all') list=list.filter(item=>item.model===state.filterModel);
  // Search
  if(state.searchQuery){const q=state.searchQuery.toLowerCase();list=list.filter(item=>item.prompt&&item.prompt.toLowerCase().includes(q));}
  return list;
}
function renderHistory(){
  const list=getFilteredHistory();
  if(list.length===0){
    historyGrid.innerHTML=`<div class="empty-state"><div class="icon">🎨</div><p>${state.activeTab==='favs'?'还没有收藏的图片':'没有匹配的记录'}</p></div>`;
    return;
  }
  historyGrid.innerHTML=list.map((item,i)=>{
    const date=new Date(item.timestamp);
    const timeStr=`${date.getMonth()+1}/${date.getDate()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
    const encUrlVal = encodeURIComponent(item.url);
    const isFav=state.favorites.has(item.id);
return`<div class="task-card succeeded"><button class="card-fav ${isFav?'faved':''}" data-id="${item.id}">${isFav?'★':'☆'}</button><div class="card-img"><img src="${item.url}" alt="${escapeHtml(item.prompt)}" loading="lazy" data-idx="${i}" data-action="view-history"></div><div class="card-body"><div class="card-prompt">${escapeHtml(item.prompt)}</div><div class="card-meta"><span>${timeStr}</span><span class="model-tag">${item.model} · ${item.size}</span></div><div class="card-actions"><button data-action="download" data-url="${encUrlVal}">⬇ 下载</button><button data-idx="${state.history.indexOf(item)}" data-action="reuse">♻ 重用</button></div></div></div>`;
  }).join('');
}

// ============ Enhance ============
function enhancePrompt(){
  const p=promptArea.value.trim();if(!p){showToast('请先输入提示词','error');return;}
  // Smart enhancement: add detail keywords based on existing prompt
  const enhancements=[
    {check:['人','女孩','woman','girl','boy','man','角色'],add:'highly detailed face, beautiful eyes, sharp focus, '},
    {check:['景','风景','landscape','山','海','天空','sunset','sunrise'],add:'golden hour lighting, atmospheric perspective, vivid colors, '},
    {check:['动物','cat','dog','猫咪','小狗','pet'],add:'fluffy fur texture, expressive eyes, natural pose, '},
    {check:['建筑','building','城市','city','street'],add:'architectural details, dramatic perspective, urban atmosphere, '},
    {check:['食物','food','cake','pizza','sushi'],add:'appetizing presentation, food photography, shallow depth of field, '},
  ];
  let suffix='';
  const pl=p.toLowerCase();
  for(const e of enhancements){if(e.check.some(k=>pl.includes(k))){suffix+=e.add;break;}}
  // Check if prompt already has quality boosters
  const hasQuality=/(ultra detailed|high quality|masterpiece|8k|4k|high resolution)/i.test(p);
  if(!hasQuality) suffix+='ultra detailed, high quality, 8K resolution, ';
  if(suffix){
    // Remove trailing comma+space
    suffix=suffix.replace(/,\s*$/,'');
    promptArea.value=p+', '+suffix;
    updateCharCount();
    showToast('提示词已增强 ✓','success');
  }else{
    promptArea.value=p+', ultra detailed, high quality, 8K resolution, professional';
    updateCharCount();
    showToast('提示词已增强 ✓','success');
  }
}

// ============ Actions ============
async function handleGenerate(){
  let prompt=promptArea.value.trim();
  if(!prompt){showToast('请输入提示词','error');return;}
  if(!apiKeyInput.value.trim()){showToast('请输入 API Key','error');return;}
  // Append negative prompt
  const neg=$('negativePrompt').value.trim();
  if(neg) prompt+=' 不要包含：'+neg;
  const count=Math.min(Math.max(parseInt(batchCount.value)||1,1),10);
  generateBtn.disabled=true;generateBtn.textContent=`⏳ 提交${count>1?count+'个任务':'中'}...`;
  let submitted=0;
  try {
    for(let i=0;i<count;i++){
      try {
        // 批量生成时为每张图添加变体标识
        const variedPrompt = count > 1 ? prompt + ` [variation ${i + 1}]` : prompt;
        const data=await submitGeneration(variedPrompt,state.refImages);
      if(data.id){addTask(data.id,prompt);submitted++;}
      else if(data.status==='succeeded'&&data.results){
        data.results.forEach(r=>{state.history.unshift({url:r.url,prompt,model:state.model,size:state.selectedSize,timestamp:Date.now(),id:Date.now()+'_'+Math.random().toString(36).slice(2,8)});});
        submitted++;
      }else if(data.status==='failed'||data.status==='violation'){
        showToast(`第${i+1}张失败: ${translateError(data.error||'')}`,'error');
      }
    }catch(e){logError(e.message||String(e),'handleGenerate',e.stack);showToast(`第${i+1}张请求失败: ${translateError(e.message)}`,'error');}
  }
    if(submitted>0){saveHistory();renderHistory();showToast(`已提交 ${submitted} 个任务`,'info');}
  } finally {
    generateBtn.disabled=false;generateBtn.textContent='🎨 生成图片';
  }
}

async function downloadImage(url,btnEl){
  if(btnEl){btnEl.classList.add('downloading');btnEl.textContent='⏳ 下载中...';}
  try{
    const resp=await fetch(url);if(!resp.ok)throw new Error(`HTTP ${resp.status}`);
    const blob=await resp.blob();
    const ct=blob.type||'';let ext='png';
    if(ct.includes('jpeg')||ct.includes('jpg'))ext='jpg';else if(ct.includes('webp'))ext='webp';else if(ct.includes('gif'))ext='gif';
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`gpt-image2-${Date.now()}.${ext}`;a.click();URL.revokeObjectURL(a.href);
    showToast('图片已开始下载','success');
  }catch(e){
    // 跨域降级：直接在新标签页打开
    const a=document.createElement('a');
    a.href=url;a.target='_blank';a.download=`gpt-image2-${Date.now()}.png`;
    a.click();
    showToast('已在新标签页打开，请右键保存图片','info');
  }
  finally{if(btnEl){btnEl.classList.remove('downloading');btnEl.textContent='⬇ 下载';}}
}

// ============ Viewer with nav ============
function viewImage(url){state.currentViewerList=[url];state.currentViewerIdx=0;showViewer(url);}
function viewImageList(filteredIdx){
  const list=getFilteredHistory();
  state.currentViewerList=list.map(i=>i.url);
  state.currentViewerIdx=filteredIdx;
  showViewer(list[filteredIdx].url);
}
function showViewer(url){
  viewerImg.src=url;state.currentViewerUrl=url;viewer.classList.add('active');
  viewerPrev.style.display=state.currentViewerList.length>1?'flex':'none';
  viewerNext.style.display=state.currentViewerList.length>1?'flex':'none';
}
function closeViewer(){viewer.classList.remove('active');setTimeout(()=>{viewerImg.src='';state.currentViewerUrl='';},300);}
function viewerNavDir(dir){
  const newIdx=state.currentViewerIdx+dir;
  if(newIdx<0||newIdx>=state.currentViewerList.length)return;
  state.currentViewerIdx=newIdx;viewerImg.src=state.currentViewerList[newIdx];state.currentViewerUrl=state.currentViewerList[newIdx];
}

function reusePrompt(index){
  const item=state.history[index];if(!item)return;
  promptArea.value=item.prompt;updateCharCount();promptArea.focus();showToast('已填入提示词','info');
}
function toggleFavorite(id){
  if(state.favorites.has(id))state.favorites.delete(id);else state.favorites.add(id);
  saveSettings();renderHistory();
  showToast(state.favorites.has(id)?'已收藏':'已取消收藏','info');
}
function showToast(msg,type='info'){
  const t=document.createElement('div');t.className=`toast ${type}`;t.textContent=msg;$('toasts').appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(50px)';t.style.transition='all .3s';setTimeout(()=>t.remove(),300);},3000);
}
function updateCharCount(){charCount.textContent=`${promptArea.value.length} 字`;promptArea.style.height='auto';promptArea.style.height=promptArea.scrollHeight+'px';}

// ============ Event Bindings ============
function bindEvents(){
  // Generate
  if(generateBtn)generateBtn.addEventListener('click',handleGenerate);
  if(enhanceBtn)enhanceBtn.addEventListener('click',enhancePrompt);
  promptArea.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&!generateBtn.disabled){e.preventDefault();handleGenerate();}});
  promptArea.addEventListener('input',()=>{updateCharCount();promptArea.style.height='auto';promptArea.style.height=promptArea.scrollHeight+'px';});


  // API key
  keyToggle.addEventListener('click',()=>{const isP=apiKeyInput.type==='password';apiKeyInput.type=isP?'text':'password';keyToggle.textContent=isP?'🔒':'👁';});
  apiKeyInput.addEventListener('input',saveSettings);

  // Node
  document.querySelectorAll('.node-btn').forEach(btn=>{btn.addEventListener('click',()=>{document.querySelectorAll('.node-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');state.node=btn.dataset.node;saveSettings();});});

  // Model
  if(modelSelect)modelSelect.addEventListener('change',()=>{
    state.model=modelSelect.value;
    if(state.model!=='gpt-image-2-vip'&&state.selectedQuality!=='1K')state.selectedQuality='1K';
    const vipHint=$('sizeVipHint');if(vipHint)vipHint.classList.toggle('show',state.model!=='gpt-image-2-vip');
    if(SIZE_MAP[state.selectedRatio]&&SIZE_MAP[state.selectedRatio][state.selectedQuality])state.selectedSize=SIZE_MAP[state.selectedRatio][state.selectedQuality];
    renderSizeGrid();saveSettings();
  });

  // Size
  if(sizeGrid)sizeGrid.addEventListener('click',e=>{const btn=e.target.closest('.size-btn');if(!btn)return;state.selectedRatio=btn.dataset.ratio;state.selectedQuality=btn.dataset.quality;state.selectedSize=btn.dataset.px;renderSizeGrid();saveSettings();});

  // Reference images - click
  refImagesDiv.addEventListener('click',async e=>{
    if(e.target.closest('.remove-btn')){e.stopPropagation();state.refImages.splice(parseInt(e.target.closest('.remove-btn').dataset.index),1);renderRefImages();return;}
    const slot=e.target.closest('.ref-img-slot');if(slot&&slot.dataset.index==='add')refInput.click();
  });
  $('refUrlAdd').addEventListener('click',()=>{const inp=$('refUrlInput');const url=inp.value.trim();if(url){addRefImageFromUrl(url);inp.value='';}});
refInput.addEventListener('change',()=>{addRefImagesFromFiles(refInput.files);refInput.value='';});
  const refUploadBtn=document.getElementById('refUploadBtn');if(refUploadBtn){refUploadBtn.addEventListener('click',()=>{if(/iPhone|iPad|Android/i.test(navigator.userAgent)){refInput.setAttribute('capture','environment');}refInput.click();});}

  // Drag & drop on ref zone
  ['dragenter','dragover'].forEach(ev=>{if(refDropZone)refDropZone.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();refDropZone.classList.add('active');});});
  ['dragleave','drop'].forEach(ev=>{if(refDropZone)refDropZone.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();refDropZone.classList.remove('active');});});
  if(refDropZone)refDropZone.addEventListener('drop',e=>{const files=e.dataTransfer.files;if(files.length)addRefImagesFromFiles(files);});
  // Also allow drop on ref images area
  ['dragenter','dragover'].forEach(ev=>{refImagesDiv.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();refDropZone.classList.add('active');});});
  ['dragleave','drop'].forEach(ev=>{refImagesDiv.addEventListener(ev,e=>{e.preventDefault();e.stopPropagation();refDropZone.classList.remove('active');});});
  refImagesDiv.addEventListener('drop',e=>{const files=e.dataTransfer.files;if(files.length)addRefImagesFromFiles(files);});

  // Paste (clipboard) - listen on whole document
  document.addEventListener('paste',e=>{
    const items=e.clipboardData?.items;
    if(!items)return;
    for(const item of items){
      if(item.type.startsWith('image/')){
        e.preventDefault();
        const blob=item.getAsFile();
        if(blob)addRefImageFromBlob(blob);
        return;
      }
    }
  });

  // Viewer
  viewer.addEventListener('click',e=>{if(e.target===viewer||e.target===viewerClose)closeViewer();});
  viewerClose.addEventListener('click',closeViewer);
  viewerPrev.addEventListener('click',e=>{e.stopPropagation();viewerNavDir(-1);});
  viewerNext.addEventListener('click',e=>{e.stopPropagation();viewerNavDir(1);});
  viewerDownload.addEventListener('click',async e=>{e.stopPropagation();if(state.currentViewerUrl)await downloadImage(state.currentViewerUrl,null);});

  // History tabs
  document.querySelectorAll('.history-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{document.querySelectorAll('.history-tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');state.activeTab=tab.dataset.tab;renderHistory();});
  });

  // Search (防抖)
  let searchTimer;
  searchInput.addEventListener('input',()=>{
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>{state.searchQuery=searchInput.value.trim();renderHistory();},300);
  });

  // Filter chips (model)
  document.querySelectorAll('.filter-chip[data-model]').forEach(chip=>{
    chip.addEventListener('click',()=>{
      document.querySelectorAll('.filter-chip[data-model]').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');state.filterModel=chip.dataset.model;renderHistory();
    });
  });

  // ============ 统一事件委托 (替代行内 onclick) ============
  // 处理生成中任务卡片
  tasksGrid.addEventListener('click',e=>{
    const btn=e.target.closest('[data-action]');
    if(!btn)return;
    const action=btn.dataset.action;
    const url=decodeURIComponent(btn.dataset.url||'');
    if(action==='view'&&url)viewImage(url);
    if(action==='download'&&url)downloadImage(url,btn);
  });

  // 处理历史记录卡片 (收藏、查看、下载、重用)
  historyGrid.addEventListener('click',e=>{
    // 收藏按钮
    const favBtn=e.target.closest('.card-fav');
    if(favBtn){e.stopPropagation();toggleFavorite(favBtn.dataset.id);return;}
    // 查看图片
    const imgEl=e.target.closest('[data-action="view-history"]');
    if(imgEl){const idx=parseInt(imgEl.dataset.idx);if(!isNaN(idx))viewImageList(idx);return;}
    // 下载 & 重用
    const btn=e.target.closest('[data-action]');
    if(btn){
      const action=btn.dataset.action;
      if(action==='download'){const url=decodeURIComponent(btn.dataset.url||'');if(url)downloadImage(url,btn);return;}
      if(action==='reuse'){const idx=parseInt(btn.dataset.idx);if(!isNaN(idx))reusePrompt(idx);return;}
    }
  });

  // Clear history
  clearHistoryBtn.addEventListener('click',()=>{
    if(state.history.length===0)return;
    if(confirm('确定要清空所有历史记录吗？')){state.history=[];state.favorites.clear();saveHistory();saveSettings();renderHistory();showToast('历史已清空','info');}
  });

  // Failed records events
  $('clearFailed').addEventListener('click',()=>{
    if(state.failedRecords.length===0)return;
    if(confirm('确定要清空所有失败记录吗？')){state.failedRecords=[];saveFailed();renderFailed();showToast('失败记录已清空','info');}
  });
  $('failedList').addEventListener('click',e=>{
    const removeBtn=e.target.closest('.failed-remove');
    if(removeBtn){state.failedRecords.splice(parseInt(removeBtn.dataset.idx),1);saveFailed();renderFailed();return;}
    const retryBtn=e.target.closest('.retry-btn');
    if(retryBtn){const rec=state.failedRecords[parseInt(retryBtn.dataset.idx)];if(rec){promptArea.value=rec.prompt;updateCharCount();handleGenerate();}return;}
    const reuseBtn=e.target.closest('.reuse-prompt-btn');
    if(reuseBtn){const rec=state.failedRecords[parseInt(reuseBtn.dataset.idx)];if(rec){promptArea.value=rec.prompt;updateCharCount();promptArea.focus();showToast('已填入提示词','info');}return;}
    const polishBtn=e.target.closest('.polish-btn');
    if(polishBtn){dsPolishPrompt(parseInt(polishBtn.dataset.idx));return;}
  });

  // DeepSeek toggle
  $('dsToggle').addEventListener('click',()=>{
    const body=$('dsBody'),arrow=$('dsArrow');
    body.classList.toggle('open');arrow.classList.toggle('open');
  });
  var _btn=$("dsKeyToggle");if(_btn)$('dsKeyToggle').addEventListener('click',()=>{
    const inp=$('dsApiKey');
    inp.type=inp.type==='password'?'text':'password';
  });
  // Load/save DeepSeek key
  const savedDsKey=localStorage.getItem('gis2_dskey');
  if(savedDsKey) $('dsApiKey').value=savedDsKey;
  $('dsApiKey').addEventListener('input',()=>{localStorage.setItem('gis2_dskey',$('dsApiKey').value);});

  // DeepSeek buttons
  $('dsTranslateBtn').addEventListener('click',dsTranslate);
  $('dsEnhanceBtn').addEventListener('click',dsEnhance);
  $('dsAutoBtn').addEventListener('click',dsAutoGenerate);

  // Negative prompt - auto-resize textarea
  const negTa=$('negativePrompt');
  function autoResizeNeg(){
    negTa.style.height='auto';
    negTa.style.height=Math.min(negTa.scrollHeight,160)+'px';
  }
  negTa.addEventListener('input',autoResizeNeg);
  autoResizeNeg(); // init

  // Negative presets panel toggle
  $('negPresetsBtn').addEventListener('click',e=>{
    e.stopPropagation();
    const panel=$('negPresetsPanel');
    const btn=$('negPresetsBtn');
    panel.classList.toggle('open');
    btn.classList.toggle('open');
    btn.textContent=panel.classList.contains('open')?'✕ 关闭':'▾ 预设';
  });

  // Negative presets - chip selection
  $('negPresetsPanel').addEventListener('click',e=>{
    const chip=e.target.closest('.neg-chip');
    if(chip){chip.classList.toggle('selected');updateNegApplyBtn();return;}
    if(e.target.id==='negClearBtn'){
      negTa.value='';
      autoResizeNeg();
      document.querySelectorAll('.neg-chip').forEach(c=>c.classList.remove('selected'));
      updateNegApplyBtn();
      return;
    }
    if(e.target.id==='negApplyBtn'){
      const selected=Array.from(document.querySelectorAll('.neg-chip.selected')).map(c=>c.dataset.neg);
      if(!selected.length)return;
      const newNeg=selected.join(', ');
      if(negTa.value.trim()){
        // Append with comma
        negTa.value=(negTa.value.trim().replace(/,+\s*$/,''))+', '+newNeg;
      }else{
        negTa.value=newNeg;
      }
      autoResizeNeg();
      document.querySelectorAll('.neg-chip').forEach(c=>c.classList.remove('selected'));
      $('negPresetsPanel').classList.remove('open');
      $('negPresetsBtn').classList.remove('open');
      $('negPresetsBtn').textContent='▾ 预设';
      showToast('已添加 '+selected.length+' 个预设','success');
    }
  });

  function updateNegApplyBtn(){
    const count=document.querySelectorAll('.neg-chip.selected').length;
    const btn=$('negApplyBtn');
    btn.textContent=count>0?'应用 ×'+count:'应用 ×';
    btn.disabled=count===0;
  }
  updateNegApplyBtn();

  // ============ 全局键盘快捷键 ============
  document.addEventListener('keydown',e=>{
    // Ctrl+G 生成
    if((e.metaKey||e.ctrlKey)&&e.key==='g'&&!generateBtn.disabled){e.preventDefault();handleGenerate();}
    // Esc 关闭查看器
    if(e.key==='Escape'){if(viewer.classList.contains('active'))closeViewer();}
    // 查看器中左右导航
    if(viewer.classList.contains('active')){
      if(e.key==='ArrowLeft')viewerNavDir(-1);
      if(e.key==='ArrowRight')viewerNavDir(1);
    }
  });

  // ============ 页面卸载清理 (防内存泄漏) ============
  window.addEventListener('beforeunload',()=>{
    Object.values(state.pollingTimers).forEach(clearInterval);
    state.pollingTimers={};
  });

  // 页面隐藏时暂停轮询，重新可见时恢复
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      Object.values(state.pollingTimers).forEach(clearInterval);
    }else{
      state.tasks.filter(t=>t.status==='running').forEach(t=>startPolling(t.id));
    }
  });

  // Close presets when clicking outside
  document.addEventListener('click',e=>{
    const panel=$('negPresetsPanel');
    const btn=$('negPresetsBtn');
    if(panel.classList.contains('open')&&!panel.contains(e.target)&&e.target!==btn&&!btn.contains(e.target)){
      panel.classList.remove('open');
      btn.classList.remove('open');
      btn.textContent='▾ 预设';
    }
  });

}

// ============ DeepSeek API ============
async function dsCall(messages,showLoading=true){
  const dsKey=$('dsApiKey').value.trim();
  if(!dsKey){showToast('请先输入 DeepSeek API Key','error');return null;}
  const btns=['dsTranslateBtn','dsEnhanceBtn','dsAutoBtn'];
  if(showLoading) btns.forEach(id=>{const b=$(id);if(b)b.disabled=true;});
  try{
    const r=await fetch(DS_BASE_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+dsKey},
      body:JSON.stringify({model:'deepseek-chat',messages,max_tokens:2048,temperature:0.7})
    });
    const d=await r.json();
    if(d.error){showToast('DeepSeek: '+d.error.message,'error');return null;}
    return d.choices[0].message.content.trim();
  }catch(e){showToast('DeepSeek 请求失败: '+e.message,'error');return null;}
  finally{if(showLoading) btns.forEach(id=>{const b=$(id);if(b)b.disabled=false;});}
}

async function dsTranslate(){
  const txt=promptArea.value.trim();
  if(!txt){showToast('请先输入提示词','error');return;}
  showToast('正在翻译...','info');
  const result=await dsCall([
    {role:'system',content:'You are a professional AI image prompt translator. Translate the following Chinese text into an optimized English prompt for GPT-Image-2. Output ONLY the English prompt, no explanation.'},
    {role:'user',content:txt}
  ]);
  if(result){promptArea.value=result;updateCharCount();showToast('翻译完成！','success');}
}

async function dsEnhance(){
  const txt=promptArea.value.trim();
  if(!txt){showToast('请先输入提示词','error');return;}
  showToast('正在增强提示词...','info');
  const result=await dsCall([
    {role:'system',content:'You are an expert AI image prompt engineer. Enhance and expand the following prompt to create more detailed, visually stunning images. Add specific details about lighting, composition, style, color, and quality. Output ONLY the enhanced English prompt, no explanation.'},
    {role:'user',content:txt}
  ]);
  if(result){promptArea.value=result;updateCharCount();showToast('增强完成！','success');}
}

async function dsAutoGenerate(){
  const txt=promptArea.value.trim();
  if(!txt){showToast('请先输入简短描述','error');return;}
  showToast('正在生成完整提示词...','info');
  const result=await dsCall([
    {role:'system',content:'You are an expert AI image prompt engineer. The user will give you a short description or idea. Generate a complete, detailed, professional English prompt for GPT-Image-2. Include specific visual details: subject, style, lighting, composition, color palette, and quality keywords. Output ONLY the prompt, no explanation.'},
    {role:'user',content:txt}
  ]);
  if(result){promptArea.value=result;updateCharCount();showToast('提示词生成完成！','success');}
}

async function dsPolishPrompt(idx){
  const rec=state.failedRecords[idx];
  if(!rec){return;}
  const dsKey=$('dsApiKey').value.trim();
  if(!dsKey){showToast('润色需要 DeepSeek API Key，请先填写','error');return;}
  const polishBtn=document.querySelector(`.polish-btn[data-idx="${idx}"]`);
  if(polishBtn) polishBtn.disabled=true;
  showToast('正在润色提示词...','info');
  try{
    const r=await fetch(DS_BASE_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+dsKey},
      body:JSON.stringify({model:'deepseek-chat',messages:[
        {role:'system',content:'You are an expert at rewriting AI image generation prompts to comply with content policies while preserving the original creative intent. The user\'s prompt was flagged for a content policy violation. Rewrite it to: 1) Remove or rephrase any potentially problematic content 2) Use safe, artistic alternatives (e.g., "revealing" → "elegant", "nude" → "artistic figure study", "violent" → "dramatic") 3) Keep the same visual concept, composition, and style 4) Make it more descriptive with safe, detailed visual language Output ONLY the rewritten English prompt, no explanation, no notes.'},
        {role:'user',content:'Original prompt that was flagged:\n'+rec.prompt+'\n\nError message: '+rec.error}
      ],max_tokens:2048,temperature:0.7})
    });
    const d=await r.json();
    if(d.error){showToast('DeepSeek: '+d.error.message,'error');return;}
    const result=d.choices[0].message.content.trim();
    if(result){
      promptArea.value=result;
      updateCharCount();
      promptArea.focus();
      showToast('润色完成，已填入提示词！','success');
    }
  }catch(e){showToast('润色请求失败: '+e.message,'error');}
  finally{if(polishBtn) polishBtn.disabled=false;}
}

// ============ Start ============
init();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('✅ Service Worker 已注册:', reg.scope);
      
      // 监听更新
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            // 有新版本可用
            if (confirm('有新版本可用，是否刷新？')) {
              window.location.reload();
            }
          }
        });
      });
    }).catch((err) => {
      console.log('⚠️ Service Worker 注册失败:', err);
    });
  });
}

// iOS Safari 添加到主屏幕提示
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // 3 秒后显示安装提示
  setTimeout(() => {
    const installBanner = document.createElement('div');
    installBanner.style.cssText = `
      position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
      background:linear-gradient(135deg,#7c5cfc,#5a3ed8);color:#fff;
      padding:14px 24px;border-radius:28px;font-size:14px;font-weight:600;
      z-index:2001;cursor:pointer;box-shadow:0 4px 20px rgba(124,92,252,.4);
      animation:slideUp .4s ease;white-space:nowrap;
    `;
    installBanner.textContent = '📲 添加到主屏幕，随时使用';
    installBanner.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        deferredPrompt = null;
        installBanner.remove();
      }
    });
    document.body.appendChild(installBanner);
    setTimeout(() => { if (installBanner.parentNode) installBanner.remove(); }, 10000);
  }, 3000);
});

// CSS 动画补充
const style = document.createElement('style');
style.textContent = '@keyframes slideUp{from{transform:translateX(-50%) translateY(100px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}';
document.head.appendChild(style);