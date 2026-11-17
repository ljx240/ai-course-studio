window.ZJ=window.ZJ||{};
(function(Z){
  const subjects=[
    {id:'math',name:'数学',symbol:'∑',level:'九年级·上册',chapter:'第22章 二次函数',lesson:'22.1 二次函数图像与性质',engine:'math.quadratic',status:'可交互',color:'#5982d6'},
    {id:'physics',name:'物理',symbol:'⚛',level:'高中物理·必修二',chapter:'第3章 抛体运动',lesson:'3.2 平抛运动',engine:'physics.projectile2d',status:'可交互',color:'#6474d4'},
    {id:'chemistry',name:'化学',symbol:'⚗',level:'高中化学·必修一',chapter:'第2章 物质的结构',lesson:'2.1 水分子的结构',engine:'chemistry.molecule',status:'基础演示',color:'#2c9fa5'},
    {id:'chinese',name:'语文',symbol:'文',level:'七年级·上册',chapter:'第3单元 古代诗歌',lesson:'《静夜思》诗词赏析',engine:'chinese.poetry',status:'基础演示',color:'#bd875a'},
    {id:'english',name:'英语',symbol:'Aa',level:'七年级·上册',chapter:'Unit 4 Daily Life',lesson:'At the Restaurant',engine:'english.dialogue',status:'基础演示',color:'#b47cbb'},
    {id:'history',name:'历史',symbol:'史',level:'七年级·下册',chapter:'第8课 对外交流',lesson:'丝绸之路与文化交流',engine:'history.timeline',status:'基础演示',color:'#b38a52'},
    {id:'politics',name:'政治',symbol:'律',level:'九年级·上册',chapter:'第2单元 民主与法治',lesson:'公共决策的基本流程',engine:'politics.flow',status:'基础演示',color:'#6885aa'}
  ];
  const physics={
    id:'physics',version:'1.0.0',title:'平抛运动',number:'3.2',grade:'高中物理·必修二',subject:'physics',chapter:'第3章 抛体运动',theme:'physics.scientific',
    objectives:['理解平抛运动的概念与特点','掌握平抛运动的分解及运动学公式','能够运用模型解释生活中的运动现象'],
    blocks:[
      {id:'goals',type:'objectives',title:'学习目标'},
      {id:'concept',type:'concept',title:'平抛运动的概念',body:'将物体以一定的初速度沿水平方向抛出，若物体只受重力作用，其运动称为平抛运动。平抛运动是曲线运动，可以分解为水平方向的匀速直线运动和竖直方向的自由落体运动。'},
      {id:'law',type:'formula',title:'平抛运动的规律',body:'取抛出点为原点，x 轴水平向前，y 轴竖直向下。忽略空气阻力，设初速度为 v₀，重力加速度为 g。',formula:'x = v₀ t ; y = ½ g t² ; v = √(v₀² + (gt)²)'},
      {id:'lab',type:'interactive',title:'互动实验：平抛运动的仿真探索',engine:'physics.projectile2d',template:'projectile-horizontal',params:{speed:8,height:2,gravity:9.8}},
      {id:'example',type:'example',title:'例题精讲',body:'物体从距地面 2.0 m 的平台以 8.0 m/s 的初速度水平抛出。忽略空气阻力，取 g=9.8 m/s²。求落地时间、水平射程以及落地瞬间的速度大小。'},
      {id:'practice',type:'assessment',title:'随堂练习',question:'对于理想平抛运动，下列说法正确的是？',options:['物体的水平速度逐渐减小','物体的水平方向加速度为零','物体的竖直速度保持不变','物体的运动轨迹是直线'],answer:1,explanation:'不计空气阻力，水平方向不受力，因此水平加速度为零，水平速度保持不变。'},
      {id:'summary',type:'summary',title:'本节小结',body:'平抛运动具有“水平匀速、竖直自由落体”的特征；研究时可先分解、分别求解，再合成。'}
    ]
  };
  const math={
    id:'math',version:'1.0.0',title:'二次函数图像与性质',number:'22.1',grade:'九年级·上册',subject:'math',chapter:'第22章 二次函数',theme:'math.editorial',
    objectives:['识别二次函数与抛物线','通过图像理解 a、b、c 的作用','能够求出抛物线顶点及对称轴'],
    blocks:[
      {id:'goals',type:'objectives',title:'学习目标'},
      {id:'concept',type:'concept',title:'二次函数的图像',body:'一般地，形如 y=ax²+bx+c（a≠0）的函数叫做二次函数，其图像是一条抛物线。图像由开口方向、顶点和对称轴等要素决定。'},
      {id:'law',type:'formula',title:'系数与图像性质',body:'通过配方法可以将函数写成顶点式。系数 a 的正负决定开口方向；|a| 越大，图像在相同坐标尺度下越窄。',formula:'y = a(x + b/2a)² + (4ac−b²)/4a'},
      {id:'lab',type:'interactive',title:'交互探索：拖动系数观察抛物线',engine:'math.quadratic',template:'quadratic-explorer',params:{a:1,b:0,c:-1}},
      {id:'example',type:'example',title:'例题精讲',body:'求函数 y=x²−2x−3 的顶点坐标、对称轴和零点。提示：将函数配方，或利用求根公式。'},
      {id:'practice',type:'assessment',title:'随堂练习',question:'当二次函数 y=ax²（a≠0）中 a<0 时，抛物线的开口方向是？',options:['向上','向下','向左','向右'],answer:1,explanation:'二次项系数 a<0 时，抛物线开口向下。'},
      {id:'summary',type:'summary',title:'本节小结',body:'利用动态几何观察变量变化，结合代数推导，建立图像、公式和几何性质的联系。'}
    ]
  };
  const generic={
    chemistry:{title:'水分子的结构',number:'2.1',chapter:'第2章 物质的结构',objectives:['了解水分子的空间结构','认识共价键与分子模型','根据模型理解宏观性质与微观结构的关系'],concept:'一个水分子由一个氧原子和两个氢原子组成，分子呈弯曲结构。点击原子查看元素信息，调整观察角度，比较不同空间视角。',theme:'chemistry.molecular',blocks:[{id:'molecule',type:'interactive',engine:'chemistry.molecule',title:'三维结构探索'},{id:'task',type:'assessment',title:'模型观察',question:'一个水分子含有几个氢原子？',options:['1个','2个','3个','4个'],answer:1,explanation:'水的分子式为 H₂O，每个分子包含两个氢原子。'}]},
    chinese:{title:'《静夜思》诗词赏析',number:'3.1',chapter:'第3单元 古代诗歌',objectives:['理解诗句字面含义','感受古诗意境','辨析诗歌中的意象与情感'],concept:'床前明月光，疑是地上霜。举头望明月，低头思故乡。点击诗句中的意象，查看注释和情绪线索。',theme:'chinese.literature',blocks:[{id:'poem',type:'interactive',engine:'chinese.poetry',title:'诗词意境探索'}]},
    english:{title:'At the Restaurant',number:'4.2',chapter:'Unit 4 Daily Life',objectives:['掌握常见点餐表达','听懂基础对话','尝试进行角色扮演'],concept:'Listen and practice a short conversation. Select a role to hear a sample line and respond. Speech playback depends on available browser speech synthesis voices.',theme:'english.conversation',blocks:[{id:'dialogue',type:'interactive',engine:'english.dialogue',title:'Restaurant Role-play'}]},
    history:{title:'丝绸之路与文化交流',number:'8.1',chapter:'第8课 对外交流',objectives:['识别古代丝路的主要交流节点','理解商品与文化交流的双向性','学会区别历史证据和示意图'],concept:'丝绸之路不是一条固定不变的单一路线，而是随时代、政治和自然条件变化的交流网络。下方是教学概念示意图，并非精确历史疆域地图。',theme:'history.atlas',blocks:[{id:'timeline',type:'interactive',engine:'history.timeline',title:'时空演变时间轴'}]},
    politics:{title:'公共决策的基本流程',number:'2.2',chapter:'第2单元 民主与法治',objectives:['了解公共议题的基本决策步骤','理解信息公开与公众参与的重要性','分辨事实、观点和规则'],concept:'公共决策通常涉及发现问题、收集事实、方案讨论、依法决策、实施与反馈等环节。点击步骤查看说明；实际程序须以当地现行法律法规为准。',theme:'politics.civic',blocks:[{id:'process',type:'interactive',engine:'politics.flow',title:'公共议题情景推演'}]}
  };
  const lessons={physics,math};
  for(const s of subjects){if(generic[s.id]){const d=generic[s.id];lessons[s.id]={id:s.id,version:'1.0.0',subject:s.id,title:d.title,number:d.number,grade:s.level,chapter:d.chapter,theme:d.theme,objectives:d.objectives,blocks:[{id:'goals',type:'objectives',title:'学习目标'},{id:'concept',type:'concept',title:'知识导入',body:d.concept},...d.blocks,{id:'summary',type:'summary',title:'学习总结',body:'完成互动任务后，回顾本节关键知识，向 AI 教学助手继续提出问题。'}]}}}
  Z.data={subjects,lessons,iconPaths:{
    book:'<path d="M12 7v14m0-14C9 4 5 4 2 5v14c3-1 7-1 10 2m0-14c3-3 7-3 10-2v14c-3-1-7-1-10 2"/>',
    layers:'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
    pen:'<path d="m12 19-8 2 2-8L17 2l5 5-10 12Z"/>',
    flask:'<path d="M9 3h6m-5 0v7l-5.5 9a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3l-5.5-9V3m-7 11h10"/>',
    chart:'<path d="M4 20V12m6 8V4m6 16v-9m6 9V7"/>',
    folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3V7Z"/>',
    spark:'<path d="m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2Zm7 15 .8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
    chevron:'<path d="m9 18 6-6-6-6"/>',
    down:'<path d="m6 9 6 6 6-6"/>',
    play:'<path d="m8 5 12 7-12 7V5Z"/>',
    pause:'<path d="M8 5v14m8-14v14"/>',
    reset:'<path d="M3 12a9 9 0 1 0 2-5M3 3v6h6"/>',
    check:'<path d="m4 12 5 5L20 6"/>',
    arrow:'<path d="M5 12h14m-7-7 7 7-7 7"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M5 21h14"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    expand:'<path d="M9 3H3v6M15 3h6v6M3 15v6h6m12-6v6h-6"/>',
    send:'<path d="m22 2-7 20-4-9-9-4 20-7Z"/>',
    note:'<path d="M4 3h16v18H4zM8 8h8m-8 4h8m-8 4h5"/>',
    info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10v1"/>',
    settings:'<path d="M12 2v4m0 12v4M4.9 4.9l2.8 2.8m8.6 8.6 2.8 2.8M2 12h4m12 0h4M4.9 19.1l2.8-2.8m8.6-8.6 2.8-2.8"/><circle cx="12" cy="12" r="4"/>',
    message:'<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5Z"/>',
    upload:'<path d="M12 16V3m-5 5 5-5 5 5M3 17v4h18v-4"/>',
    code:'<path d="m8 8-4 4 4 4m8-8 4 4-4 4"/>',
    trash:'<path d="M3 6h18m-15 0 1 15h10l1-15M9 6V4h6v2"/>',
    link:'<path d="M10 13a5 5 0 0 0 8 0l3-3a5 5 0 0 0-7-7l-2 2m2 6a5 5 0 0 0-8 0l-3 3a5 5 0 0 0 7 7l2-2"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>',
    star:'<path d="m12 2 3 7 7 .6-5.4 4.6L18.5 22 12 18l-6.5 4 1.9-7.8L2 9.6 9 9 12 2Z"/>'
  }};
})(window.ZJ);
