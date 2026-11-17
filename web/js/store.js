(function(Z){
  const KEY='zhijing.course.studio.v2';
  const defaults={view:'reader',subject:'physics',chapterOpen:true,sidebarTab:'outline',readingTab:'lab',selectedBlock:'concept',outlineStatus:'all',speed:8,height:2,gravity:9.8,mathA:1,mathB:0,mathC:-1,chemAngle:10,historyPeriod:'han',politicsStep:0,englishRole:0,chat:[],notes:[],taskChecks:[],quizSelections:{},quizSubmitted:{},generatedLessons:{},outlineAdditions:[],backend:false,modal:null,authoringStatus:'draft',editorTitle:'',editorBody:'',labRecords:[],labPaused:true,labTime:0,outlineFilter:'',lastSaved:0};
  let initial={};try{initial=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){initial={}};
  const state={...defaults,...initial,labPaused:true,labTime:0,backend:false,modal:null};
  function save(){try{const copy={...state};delete copy.backend;delete copy.modal;delete copy.labPaused;delete copy.labTime;localStorage.setItem(KEY,JSON.stringify(copy))}catch(e){}}
  function set(patch){Object.assign(state,patch);if(!Object.keys(patch).every(k=>k==='labTime'||k==='labPaused')){state.lastSaved=Date.now();save()}return state}
  function get(){return state}
  function lesson(id){return state.generatedLessons[id]||Z.data.lessons[id]}
  function rememberChat(subject,q,a){const list=[...(state.chat||[]),{subject,q,a,remote:true,time:new Date().toISOString()}];set({chat:list.slice(-18)});return list[list.length-1]}
  function reset(){Object.assign(state,defaults);localStorage.removeItem(KEY)}
  function cloneLesson(source,target){const l=JSON.parse(JSON.stringify(source));l.version='1.0.1-draft';state.generatedLessons[target]=l;save();return l}
  function exportJson(data,name){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}
  function exportText(data,name){const blob=new Blob([data],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}
  function outlineFromText(text){const lines=text.split(/\r?\n/).filter(x=>x.trim());const roots=[];const stack=[];lines.forEach((raw,i)=>{const m=raw.match(/^(#{1,6})\s+(.+)/);const l=m?m[1].length:Math.min(6,Math.floor((raw.match(/^\s*/)||[''])[0].length/2)+1);const title=(m?m[2]:raw).trim();if(!title)return;const node={id:'import-'+i,title,level:l,children:[]};while(stack.length&&stack[stack.length-1].level>=l)stack.pop();if(stack.length)stack[stack.length-1].children.push(node);else roots.push(node);stack.push(node)});return roots}
  Z.store={get,set,save,lesson,rememberChat,reset,cloneLesson,exportJson,exportText,outlineFromText,defaults};
})(window.ZJ);
