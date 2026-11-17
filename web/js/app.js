(function(Z){
 const $=sel=>document.querySelector(sel),S=()=>Z.store.get(),T=(msg)=>{let x=$('.toast');if(x)x.remove();x=document.createElement('div');x.className='toast';x.textContent=msg;document.body.appendChild(x);setTimeout(()=>x.remove(),3600)};
 const goto=(view)=>{Z.store.set({view,modal:null,readingTab:view==='lab'?'实验探索':S().readingTab});Z.ui.render()};
 async function request(path,body){
  const response=await fetch('/api/'+path,body?{
   method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  }:undefined);
  const data=await response.json();
  if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:`请求失败（${response.status}）`);
  return data;
 }
 async function chat(question){
  const q=question.trim();
  if(!q)return;
  if(!S().backend||!S().modelConfigured){T('请先在工程版配置 AI 服务');return}
  const {subject,speed,height,gravity,mathA,mathB,mathC}=S();
  const current=Z.store.lesson(subject);
  try{
   const data=await request('chat',{subject,lesson_id:current.id,current,question:q,
    scene_state:{speed,height,gravity,mathA,mathB,mathC}});
   Z.store.rememberChat(subject,q,data.answer);
   Z.ui.render();
  }catch(e){T('模型问答失败：'+e.message)}
 }
 const copyLesson=()=>JSON.parse(JSON.stringify(Z.store.lesson(S().subject)));
 const validateLesson=(l)=>{if(!l||!l.title||!Array.isArray(l.objectives)||!Array.isArray(l.blocks)||l.blocks.length===0)throw new Error('教材结构不完整');const allowed=['objectives','concept','formula','interactive','example','assessment','summary','diagram','note'];const engines=['physics.projectile2d','math.quadratic','chemistry.molecule','english.dialogue','chinese.poetry','history.timeline','politics.flow'];for(const b of l.blocks){if(!b.id||!b.type||!allowed.includes(b.type))throw new Error(`不允许的教材块类型 ${b.type}`);if(b.type==='interactive'&&(!b.engine||!engines.includes(b.engine)))throw new Error('互动组件未在学科注册表中')}return l};
 function saveBlock(){const l=copyLesson(),b=l.blocks.find(x=>x.id===S().selectedBlock);if(!b){T('请先选择内容块');return}const ti=$('#edit-title'),bd=$('#edit-body');if(!ti||!bd)return;b.title=ti.value.trim()||b.title;if(b.type==='assessment')b.question=bd.value.trim();else b.body=bd.value.trim();validateLesson(l);l.version='1.0.1-draft';Z.store.set({generatedLessons:{...S().generatedLessons,[S().subject]:l}});Z.ui.render();T('教材块已保存在本地草稿')}
 function addBlock(){const l=copyLesson();const id='custom-'+Date.now();l.blocks.push({id,type:'concept',title:'新知识讲解',body:'请输入本段内容。'});l.version='1.0.1-draft';Z.store.set({generatedLessons:{...S().generatedLessons,[S().subject]:l},selectedBlock:id});Z.ui.render();T('已添加内容块，可在编辑器修改')}
 function quality(){const l=copyLesson();try{validateLesson(l);const warnings=[];if(!l.blocks.some(b=>b.type==='assessment'))warnings.push('当前课程没有可评分的练习块');if(!l.blocks.some(b=>b.type==='interactive'))warnings.push('当前课程没有注册的互动组件');if(l.subject==='physics'&&!(l.blocks.some(b=>b.type==='formula')))warnings.push('物理教材缺少推导公式块');T(warnings.length?'基础结构通过；待完善：'+warnings.join('、'):'基础结构检查通过：合法块类型、互动引擎与教学目标齐备；仍需教师审核专业准确性')}catch(e){T('教材结构检查失败：'+e.message)}}
 async function modelDraft(options){
  const {id}=await request('generation/jobs',options);
  T('正在生成教材草稿');
  // 整节生成可发起两次模型请求，每次最多等待 600 秒。
  const deadline=Date.now()+21*60_000;
  while(Date.now()<deadline){
   const job=await request('generation/jobs/'+id);
   if(job.status==='review')return job.lesson;
   if(job.status==='failed')throw Error(job.error);
   await new Promise(resolve=>setTimeout(resolve,700));
  }
  throw Error('等待生成超时');
 }
 async function generate(form){
  const {subject}=S(),mode=form.mode.value,chapter=form.chapter.value.trim(),grade=form.grade.value,
   style=form.style.value,requirements=form.requirements.value.trim();
  let result;
  if(mode==='model'){
   const submit=form.querySelector('[type="submit"]');
   submit.disabled=true;
   try{
    result=await modelDraft({subject,lesson_id:subject,chapter,grade,style,requirements});
   }catch(e){T('模型生成失败：'+e.message);return}
   finally{submit.disabled=false}
  }else{
   result=copyLesson();
   result.title=(chapter||result.title).replace(/^\d+(\.\d+)*\s*/,'');
   result.version='1.0.1-template-draft';
   result.generation={mode:'template',requirements,grade,style,generatedAt:new Date().toISOString()};
  }
  Z.store.set({generatedLessons:{...S().generatedLessons,[subject]:result},selectedBlock:'concept',modal:null,view:'editor',selectedOutline:null});
  Z.ui.render();
  T(mode==='model'?'已生成模型教材草稿，请审核':'已复制模板草稿');
 }
 async function generateBlock(refine){
  if(!S().backend||!S().modelConfigured){T('请先在工程版配置 AI 服务');return}
  const {subject,selectedBlock:block_id}=S(),original=Z.store.lesson(subject),current=copyLesson();
  const block=current.blocks.find(item=>item.id===block_id);
  if(!block){T('请先选择内容块');return}
  if(refine){
   block.title=$('#edit-title').value.trim();
   block[block.type==='assessment'?'question':'body']=$('#edit-body').value.trim();
  }
  try{
   const lesson=await modelDraft({subject,lesson_id:current.id,chapter:current.title,
    grade:current.grade,current,block_id,requirements:refine?'优化措辞和段落结构，保持原有教学目标和知识事实。':''});
   if(original!==Z.store.lesson(subject)){T('教材已修改，请重新生成教材块');return}
   Z.store.set({generatedLessons:{...S().generatedLessons,[subject]:lesson}});
   Z.ui.render();
   T('已生成教材块，请审核');
  }catch(e){T('模型生成失败：'+e.message)}
 }
 async function checkBackend(){if(location.protocol==='file:')return;try{const ctl=new AbortController();const tim=setTimeout(()=>ctl.abort(),1500);const res=await fetch('/api/health',{signal:ctl.signal});clearTimeout(tim);if(res.ok){const x=await res.json();Z.store.set({backend:true,modelConfigured:!!x.model_configured});Z.ui.render()}}catch(e){}}
 document.addEventListener('click',async ev=>{
  const el=ev.target.closest('[data-view],[data-subject],[data-side-tab],[data-block],[data-ask],[data-answer],[data-speak],[data-period],[data-poetry],[data-politics-step],[data-import-node],[data-action]');if(!el)return;
  if(el.hasAttribute('data-import-node')){const find=(list,id)=>{for(const n of list||[]){if(n.id===id)return n;const match=find(n.children,id);if(match)return match}return null};const node=find(S().importedOutline,el.dataset.importNode);if(node){Z.store.set({selectedOutline:{id:node.id,title:node.title}});Z.ui.render();T('已选定大纲节点：'+node.title)}return}
  if(el.hasAttribute('data-subject')){const id=el.dataset.subject;Z.store.set({subject:id,view:S().view==='outline'?'outline':'reader',selectedBlock:'concept',labTime:0,labPaused:true,taskChecks:[]});Z.ui.render();return}
  if(el.hasAttribute('data-view')){const view=el.dataset.view;if(el.dataset.readingTab)Z.store.set({readingTab:el.dataset.readingTab});if(view==='lab'&&!['physics','math'].includes(S().subject)){goto('reader');T('本学科已提供教材内互动组件，独立实验室后续扩展');return}goto(view);return}
  if(el.hasAttribute('data-side-tab')){Z.store.set({sidebarTab:el.dataset.sideTab});Z.ui.render();return}
  if(el.hasAttribute('data-block')){Z.store.set({selectedBlock:el.dataset.block});Z.ui.render();return}
  if(el.hasAttribute('data-ask')){await chat(el.dataset.ask);return}
  if(el.hasAttribute('data-answer')){if(S().quizSubmitted[S().subject])return;Z.store.set({quizSelections:{...S().quizSelections,[S().subject]:+el.dataset.answer}});Z.ui.render();return}
  if(el.hasAttribute('data-speak')){if(!('speechSynthesis'in window)){T('当前浏览器不支持语音合成');return}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(el.dataset.speak);u.lang='en-US';u.rate=.92;speechSynthesis.speak(u);T('使用浏览器语音合成播放示例');return}
  if(el.hasAttribute('data-period')){Z.store.set({historyPeriod:el.dataset.period});Z.ui.render();return}
  if(el.hasAttribute('data-politics-step')){Z.store.set({politicsStep:+el.dataset.politicsStep});Z.ui.render();return}
  if(el.hasAttribute('data-poetry')){const notes={bed:'“床前”可理解为诗人的起居空间，引出夜间静思的情景。',frost:'“疑是地上霜”借霜的视觉联想表现月光的清冷。',moon:'“举头望明月”借望月的动作转入情感表达。',home:'“低头思故乡”直抒思乡之情，是全诗情感的落点。'};$('#poetry-detail').textContent=notes[el.dataset.poetry];return}
  const action=el.dataset.action;
  if(action==='close-modal'){Z.store.set({modal:null});Z.ui.render()}
  else if(action==='import'){Z.store.set({modal:'import'});Z.ui.render()}
  else if(action==='generate-modal'){Z.store.set({modal:'generate'});Z.ui.render()}
  else if(action==='add-note'){Z.store.set({modal:'note'});Z.ui.render()}
  else if(action==='outline-add'){Z.store.set({modal:'addchapter'});Z.ui.render()}
  else if(action==='add-block'){addBlock()}
  else if(action==='save-block'){saveBlock()}
  else if(action==='export-lesson'){Z.store.exportJson(Z.store.lesson(S().subject),`知境-${S().subject}-lesson.json`);T('已导出结构化教材 JSON')}
  else if(action==='export-outline'){const obj={subject:S().subject,grade:Z.data.subjects.find(x=>x.id===S().subject)?.level,lesson:Z.store.lesson(S().subject).title,outlineAdditions:S().outlineAdditions,importedOutline:S().importedOutline||[]};Z.store.exportJson(obj,'知境-教学大纲.json');T('已导出大纲 JSON')}
  else if(action==='generate' || action==='regenerate' || action==='refine'){await generateBlock(action==='refine')}
  else if(action==='quality'){quality()}
  else if(action==='physics-play'){const stage=$('[data-physics-stage]');if(stage){const playing=Z.engines.physics.toggle(stage);T(playing?'实验开始，可观察实时轨迹':'实验已暂停')}}
  else if(action==='physics-reset'){Z.engines.physics.stop();Z.store.set({labTime:0});document.querySelectorAll('[data-physics-stage]').forEach(el=>Z.engines.physics.update(el,0));const tl=$('[data-lab-timeline]');if(tl)tl.value='0';T('实验已重置')}
  else if(action==='record'){const a=Z.engines.physics.calc(S().speed,S().height,S().gravity);const row={speed:S().speed,height:S().height,gravity:S().gravity,range:a.range.toFixed(2),flight:a.flight.toFixed(2),createdAt:new Date().toISOString()};Z.store.set({labRecords:[...S().labRecords,row]});Z.ui.render();T('已记录一组实验参数')}
  else if(action==='submit-answer'){const b=Z.store.lesson(S().subject).blocks.find(b=>b.type==='assessment');const picked=S().quizSelections[S().subject];if(picked===undefined){T('请选择一个答案');return}Z.store.set({quizSubmitted:{...S().quizSubmitted,[S().subject]:{choice:picked,correct:picked===b.answer,date:new Date().toISOString()}}});Z.ui.render()}
  else if(action==='clear-answer'){const a={...S().quizSelections},q={...S().quizSubmitted};delete a[S().subject];delete q[S().subject];Z.store.set({quizSelections:a,quizSubmitted:q});Z.ui.render()}
  else if(action==='choose-outline'||action==='open-lesson'||action==='quiz-pick'){const idx=+el.dataset.index||+el.dataset.choice||0;if(action==='quiz-pick'&&idx!==0){T('其余题目为待扩展功能位，当前只有一题完整示例');return}if(action==='open-lesson'){goto('reader');return}if(idx===1||S().subject!=='physics'){goto('reader')}else T('当前只内置已完成的示范知识点，其他章节可通过教材生成流程建立')}
 });
 document.addEventListener('input',ev=>{
  const el=ev.target;
  if(el.matches('[data-physics-control]')){const key=el.dataset.physicsControl,ZP={speed:'m/s',height:'m',gravity:'m/s²'},v=parseFloat(el.value);Z.engines.physics.stop();Z.store.set({[key]:v,labTime:0});document.querySelectorAll(`[data-value="${key}"]`).forEach(q=>q.textContent=v.toFixed(1)+' '+ZP[key]);document.querySelectorAll('[data-physics-stage]').forEach(q=>Z.engines.physics.update(q,0));const tl=$('[data-lab-timeline]');if(tl){tl.max=Z.engines.physics.calc(S().speed,S().height,S().gravity).flight;tl.value=0}return}
  if(el.matches('[data-math-control]')){const key=el.dataset.mathControl,v=parseFloat(el.value);Z.store.set({[key]:v});document.querySelectorAll(`[data-value="${key}"]`).forEach(q=>q.textContent=v.toFixed(2));document.querySelectorAll('[data-math-stage]').forEach(q=>Z.engines.math.update(q));return}
  if(el.matches('[data-chem-angle]')){const v=+el.value;Z.store.set({chemAngle:v});const g=el.closest('.subject-art').querySelector('svg g[transform]');if(g)g.setAttribute('transform',`translate(325,135) rotate(${v})`);const label=el.closest('.subject-art').querySelector('[data-chem-label]');if(label)label.textContent=v+'°';return}
  if(el.matches('[data-lab-timeline]')){Z.engines.physics.stop();Z.store.set({labTime:+el.value});document.querySelectorAll('[data-physics-stage]').forEach(q=>Z.engines.physics.update(q,+el.value));return}
  if(el.matches('#edit-body')){const p=$('#edit-live-preview');if(p)p.textContent=el.value}
 });
 document.addEventListener('change',ev=>{const el=ev.target;if(el.matches('[data-task-check]')){const key=S().subject+'-'+el.dataset.taskCheck;const v=new Set(S().taskChecks);if(el.checked)v.add(key);else v.delete(key);Z.store.set({taskChecks:[...v]})}});
 document.addEventListener('submit',async ev=>{
  const form=ev.target;ev.preventDefault();if(form.id==='assistant-form'){const q=new FormData(form).get('question');await chat(String(q));return}
  if(form.id==='note-form'){const t=String(new FormData(form).get('note')).trim();if(!t)return;Z.store.set({notes:[...S().notes,{subject:S().subject,text:t,date:new Date().toISOString()}],modal:null});Z.ui.render();T('学习笔记已保存');return}
  if(form.id==='generate-form'){await generate(form);return}
  if(form.id==='outline-import-form'){const text=String(new FormData(form).get('outline'));const nodes=Z.store.outlineFromText(text);if(!nodes.length){T('未解析出大纲节点');return}Z.store.set({importedOutline:nodes,modal:null,selectedOutline:null});Z.ui.render();Z.store.exportJson(nodes,'知境-解析后的大纲.json');T(`已解析 ${nodes.length} 个顶层节点，并下载大纲 JSON`);return}
  if(form.id==='add-chapter-form'){const name=String(new FormData(form).get('title')).trim();Z.store.set({outlineAdditions:[...S().outlineAdditions,{title:name,id:'custom-'+Date.now()}],modal:null});Z.ui.render();T('章节已加入本地大纲');return}
 });
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&S().modal){Z.store.set({modal:null});Z.ui.render()}if(ev.key==='Enter'&&ev.target.id==='global-search'){const txt=ev.target.value.trim();if(!txt)return;const match=Z.data.subjects.find(s=>txt.includes(s.name)||s.name.includes(txt)||s.lesson.includes(txt));if(match){Z.store.set({subject:match.id,view:'reader'});Z.ui.render();T(`已定位到${match.name}课程`)}else T('演示搜索仅支持匹配七个学科及示例课程')}});
 Z.ui.render();checkBackend();
})(window.ZJ);
