// ============================================================
// data.jsx — 素材目录 / 弹幕池 / 默认人设 / 主题 / 随机观众 / 默认状态
// ============================================================

const uid = (p = "id") => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- 像素画渲染：grid(等宽字符串数组) + 调色板 → SVG dataURL ----------
function pixelDataURL(grid, palette, pixel = 8) {
  const h = grid.length, w = grid[0].length;
  let rects = "";
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = grid[y][x];
      if (ch === "." || ch === " ") continue;
      const c = palette[ch] || "#000";
      rects += `<rect x='${x}' y='${y}' width='1.02' height='1.02' fill='${c}'/>`;
    }
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w * pixel}' height='${h * pixel}' viewBox='0 0 ${w} ${h}' shape-rendering='crispEdges'>${rects}</svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

// ---------- 像素小物件（无 emoji，全部 CSS 像素画）----------
const PIXEL_ITEMS = [
  { id: "px-heart", name: "爱心", pal: { R: "#ff5e8a", D: "#d63a66" }, grid: [
    ".RRR.RRR.", "RRRRRRRRR", "RRRRRRRRR", "DRRRRRRRD", ".DRRRRRD.", "..DRRRD..", "...DRD...", "....D...." ] },
  { id: "px-star", name: "星星", pal: { Y: "#ffd24d", O: "#e0a020" }, grid: [
    "....Y....", "....Y....", "...YYY...", "YYYYYYYYY", ".YYYYYYY.", "..YYYYY..", ".YYO.OYY.", "YY.....YY" ] },
  { id: "px-crown", name: "皇冠", pal: { Y: "#ffd24d", O: "#e0a020", R: "#ff5e8a" }, grid: [
    "Y...Y...Y", "YY.YYY.YY", "YYYYYYYYY", "YYRYRYRYY", "YYYYYYYYY", "OOOOOOOOO" ] },
  { id: "px-cake", name: "蛋糕", pal: { Y: "#ffd24d", R: "#ff5e8a", C: "#fff3e0", P: "#ff9ec4" }, grid: [
    "....Y....", "....R....", "...CCC...", "..CCCCC..", ".CCCCCCC.", "PPPPPPPPP", "PPPPPPPPP", "PPPPPPPPP" ] },
  { id: "px-music", name: "音符", pal: { B: "#4dd2ff", D: "#2a8fb8" }, grid: [
    "......BB.", "....BBBB.", "....BB...", "....BB...", "....BB...", ".BBBB....", "BBBBB....", ".BBB....." ] },
  { id: "px-flower", name: "小花", pal: { P: "#ff7eb6", Y: "#ffd24d", G: "#6ed66e" }, grid: [
    ".P.....P.", "PPP...PPP", ".PP.Y.PP.", "..PYYYP..", ".PP.Y.PP.", "PPP.G.PPP", ".P..G..P.", "....G...." ] },
  { id: "px-diamond", name: "钻石", pal: { C: "#6effd6", c: "#36c8a0" }, grid: [
    "..CCCCC..", ".CcCcCcC.", "CCCCCCCCC", ".CCCCCCC.", "..CCCCC..", "...CcC...", "....C...." ] },
  { id: "px-leek", name: "大葱", pal: { G: "#9bd84a", g: "#6ea82e", W: "#eef7d0" }, grid: [
    "....GG...", "...GgG...", "...GG....", "..GgG....", "..WW.....", "..Wg.....", "..WW.....", ".WWg.....", ".WWW.....", "WWWg....." ] },
  { id: "px-bread", name: "面包", pal: { B: "#d8a05a", b: "#b87a32", L: "#f0c98a" }, grid: [
    ".LBBBBBL.", "LBBBBBBBL", "BBbBBBbBB", "BBBBBBBBB", "BBBbBBBBB", "BBBBBBBbB", "LBBBBBBBL", ".LBBBBBL." ] },
  { id: "px-cassette", name: "磁带", pal: { K: "#2a2030", W: "#e9cee6", P: "#ee5ec0" }, grid: [
    "KKKKKKKKK", "KWWWWWWWK", "KW.....WK", "KW.PPP.WK", "KWP...PWK", "KW.....WK", "KWWWWWWWK", "K.K...K.K" ] },
  { id: "px-cam", name: "相机", pal: { K: "#2a2030", W: "#e9cee6", B: "#4dd2ff" }, grid: [
    "...KKK...", "KKKKKKKKK", "KWWWWWWWK", "KWWBBBWWK", "KWB...BWK", "KWB...BWK", "KWWBBBWWK", "KKKKKKKKK" ] },
  { id: "px-ribbon", name: "蝴蝶结", pal: { P: "#ff5e8a", D: "#d63a66" }, grid: [
    "PP.....PP", "PPPP.PPPP", "PPPPPPPPP", ".PPPDPPP.", "PPPPPPPPP", "PPPP.PPPP", "PP.....PP" ] },
];

// 内置贴纸（转成像素画 src，沿用 img 渲染路径）
const STICKERS = PIXEL_ITEMS.map((it) => ({ id: it.id, name: it.name, src: pixelDataURL(it.grid, it.pal, 8) }));

// ---------- 弹幕兜底池 ----------
const DANMAKU_POOL = [
  "下饭操作", "笑死我了", "DNA动了", "爷青回", "前方高能", "考古成功",
  "这张必须截图", "awsl", "时间是把杀猪刀", "泪目了家人们", "好家伙",
  "这就叫神仙友谊", "我哭死", "整整十年啊", "在？为什么这么好笑",
  "这构图绝了", "回忆杀来了", "建议进相册封面", "嗑到了", "梦回那一天",
  "十年之约达成", "细糠啊这是", "破防了", "这就是双向奔赴吗",
  "含金量还在上升", "我嘞个豆", "典中典", "已老实", "可爱捏", "好温柔",
];

const SUPERCHAT_POOL = [
  "十年了，谢谢你一直在。", "这对友情我嗑到了，打钱！", "下一个十年也要一起啊",
  "为这份神仙友谊充值", "替我给你们的青春点个赞", "这波回忆杀值这个价",
];
const SC_AMOUNTS = [6, 9.9, 30, 66, 88, 188, 520];

// ---------- 随机路人观众（让观众不固定）----------
const NICK_A = ["路过的", "隔壁", "摸鱼的", "暴躁", "柠檬", "奶油", "快乐", "熬夜", "干饭", "碳水",
  "上头", "下饭", "考古", "课代表", "端水", "退堂鼓", "显微镜", "emo", "躺平", "尊嘟假嘟", "正能量", "嗦粉"];
const NICK_B = ["小水獭", "柴犬", "布丁", "奶黄包", "螺蛳粉", "奶茶", "柠檬精", "打工人", "土拨鼠",
  "可颂", "贝果", "咸鱼", "仓鼠", "海绵", "葡萄", "西瓜", "桃子", "团子", "麻薯", "小笼包", "栗子"];
const NICK_C = ["", "", "", "本人", "酱", "233", "在线", "_鸭", "ya", "捏", "啊"];
const VIEWER_VIBES = [
  "爱玩谐音梗，话痨", "特别容易感动会哭", "理性吐槽但其实很爱", "满嘴彩虹屁夸夸怪",
  "东北话大碴子味", "文艺青年爱抒情", "摆烂躺平嘴替", "亢奋激动狂刷屏",
  "细节控爱考据", "嘴硬心软傲娇", "网络烂梗十级选手", "温柔姐姐口吻",
];
function randomViewer() {
  const name = pick(NICK_A) + pick(NICK_B) + pick(NICK_C);
  return { name, color: pick(AVATAR_COLORS), prompt: "你是直播间一个普通路人观众，" + pick(VIEWER_VIBES) + "。" };
}

// ---------- 默认常驻人设（偶尔出场）----------
const DEFAULT_PERSONAS = [
  { id: "p-dushe", name: "毒舌老粉", color: "#ff6ec7", paidChance: 0.05,
    prompt: "嘴毒心软的老粉，说话犀利吐槽但其实很在乎，爱用网络烂梗，关键时刻会突然破防说真心话。" },
  { id: "p-leishi", name: "泪失禁观众", color: "#7ec8ff", paidChance: 0.12,
    prompt: "超级容易感动落泪，看到温馨画面就泪目，爱刷'呜呜呜''破防了''泪失禁体质'。" },
  { id: "p-kaogu", name: "考古课代表", color: "#ffd24d", paidChance: 0.04,
    prompt: "专门挖细节考据时间线，爱说'考古成功''这是XX年的吧'，理性又好笑。" },
];

// ---------- 边框 ----------
const FRAMES = [
  { id: "frame-pink", name: "粉像素", css: { border: "6px solid #ee5ec0", boxShadow: "inset 0 0 0 3px #1e1531, 0 0 0 3px #000" } },
  { id: "frame-miku", name: "初音青", css: { border: "6px solid #39c5bb", boxShadow: "inset 0 0 0 3px #16323a, 0 0 14px #39c5bb" } },
  { id: "frame-cream", name: "奶油棕", css: { border: "7px solid #d8a05a", boxShadow: "inset 0 0 0 3px #6b4a25, 0 0 0 3px #3a2a16" } },
  { id: "frame-mono", name: "黑白", css: { border: "6px solid #f5f5f5", boxShadow: "inset 0 0 0 3px #000, 0 0 0 3px #f5f5f5" } },
  { id: "frame-gold", name: "土豪金", css: { border: "6px solid #ffcf4d", boxShadow: "inset 0 0 0 3px #4a2c00, 0 0 0 3px #000" } },
  { id: "frame-tv", name: "复古电视", css: { border: "10px solid #2a2030", borderRadius: "18px", boxShadow: "inset 0 0 0 4px #000, inset 0 0 40px rgba(0,0,0,.6)" } },
  { id: "frame-tape", name: "胶带封边", css: { border: "4px dashed #e9cee6", boxShadow: "0 0 0 6px #5e3c88" } },
  { id: "frame-none", name: "无边框", css: { border: "3px solid #000" } },
];

// ---------- 背景 ----------
const BACKGROUNDS = [
  { id: "bg-checker", name: "紫格子", style: { backgroundColor: "#181124", backgroundImage: "linear-gradient(45deg,#261b38 25%,transparent 25%,transparent 75%,#261b38 75%,#261b38),linear-gradient(45deg,#261b38 25%,transparent 25%,transparent 75%,#261b38 75%,#261b38)", backgroundSize: "40px 40px", backgroundPosition: "0 0,20px 20px" } },
  { id: "bg-miku", name: "初音青空", style: { backgroundColor: "#0c2a30", backgroundImage: "linear-gradient(180deg,#0c2a30,#103d44 60%,#1d5560),linear-gradient(#1c4a52 1px,transparent 1px),linear-gradient(90deg,#1c4a52 1px,transparent 1px)", backgroundSize: "100% 100%,30px 30px,30px 30px" } },
  { id: "bg-bakery", name: "面包烘焙", style: { backgroundColor: "#f3e2c7", backgroundImage: "radial-gradient(#d8a05a 2px,transparent 2px),radial-gradient(#e9c89a 2px,transparent 2px)", backgroundSize: "34px 34px,34px 34px", backgroundPosition: "0 0,17px 17px" } },
  { id: "bg-mono", name: "黑白格", style: { backgroundColor: "#0d0d0d", backgroundImage: "linear-gradient(45deg,#1a1a1a 25%,transparent 25%,transparent 75%,#1a1a1a 75%,#1a1a1a),linear-gradient(45deg,#1a1a1a 25%,transparent 25%,transparent 75%,#1a1a1a 75%,#1a1a1a)", backgroundSize: "40px 40px", backgroundPosition: "0 0,20px 20px" } },
  { id: "bg-sunset", name: "黄昏渐变", style: { background: "linear-gradient(180deg,#3a1c5e 0%,#7d3b86 45%,#e85d8a 80%,#ffb15e 100%)" } },
  { id: "bg-star", name: "星空", style: { backgroundColor: "#0c0a1f", backgroundImage: "radial-gradient(2px 2px at 20px 30px,#fff,transparent),radial-gradient(2px 2px at 120px 80px,#ffd2f3,transparent),radial-gradient(1px 1px at 200px 50px,#fff,transparent),radial-gradient(2px 2px at 80px 160px,#bcd6ff,transparent),radial-gradient(1px 1px at 250px 180px,#fff,transparent)", backgroundSize: "300px 220px" } },
  { id: "bg-plain", name: "纯黑", style: { background: "#0a0710" } },
  { id: "bg-white", name: "纯白", style: { background: "#f5f5f5" } },
];

// ---------- 字体（主播女孩重度依赖同款上传字体；中文自动回退黑体）----------
const FONTS = [
  { id: "font-crt", name: "CRT 像素", css: "'BestTen CRT','Noto Sans SC',monospace" },
  { id: "font-dot", name: "点阵", css: "'BestTen DOT','Noto Sans SC',monospace" },
  { id: "font-silver", name: "Silver", css: "'Silver','Noto Sans SC',sans-serif" },
  { id: "font-marudo", name: "魔导圆体", css: "'MadouMaru','Noto Sans SC',sans-serif" },
];

// ---------- 一键主题（背景+边框+字体一起换）----------
const THEMES = [
  { id: "th-nso", name: "泥头车次元", background: "bg-checker", frame: "frame-pink", font: "font-crt", primary: "#ee5ec0", secondary: "#5e3c88" },
  { id: "th-miku", name: "初音未来", background: "bg-miku", frame: "frame-miku", font: "font-dot", primary: "#39c5bb", secondary: "#e12885" },
  { id: "th-bakery", name: "面包烘焙", background: "bg-bakery", frame: "frame-cream", font: "font-marudo", primary: "#c8852f", secondary: "#8a5a22" },
  { id: "th-mono", name: "黑白胶片", background: "bg-mono", frame: "frame-mono", font: "font-silver", primary: "#f5f5f5", secondary: "#777" },
];

const AVATAR_COLORS = ["#ee5ec0", "#7ec8ff", "#ffd24d", "#9bffb0", "#ff9b6e", "#c08bff", "#6effd6", "#ff6e8e", "#39c5bb", "#ffb15e"];

// ============================================================
// 主播模拟器：问候 / 事件 / NPC 直播大厅
// ============================================================

// 开播 / 下播 / 冷场 / 黑粉 / 热门 本地语料
const GREET_ON = ["主播来啦！", "蹲了好久了", "上号上号", "熟悉的开场", "来咯来咯", "准时蹲守", "签到！", "主播今天也好看", "开冲！", "等到你开播", "第一个进来的是我", "蹲一个回忆杀"];
const GREET_OFF = ["下次再来呀", "晚安主播", "舍不得下播", "意犹未尽", "今天也很开心", "记得再开！", "梦里见", "下次早点开", "抱抱主播", "这就完了？", "余韵悠长", "明天还来"];
const COLD_LINES = ["人呢？", "怎么没声音了", "主播发呆中", "空气突然安静", "？", "在的扣个1", "冷场了哈哈", "主播睡着了？", "弹幕停了", "有点安静"];
const HATER_LINES = ["就这？", "好无聊", "蹭十年情怀", "尬", "审美堪忧", "这也能播", "下播吧", "不好看", "一般般", "没活了", "无聊到家"];
const TREND_LINES = ["卧槽上热门了！", "推荐来的举手", "刚刷到就进来", "宝藏直播间啊", "人气爆炸", "首页爬过来的", "破防了好温馨", "这也太好嗑", "榜一我先冲", "首页第一眼就是你"];

// 事件卡：随机触发，带数值影响 + 本地语料标签
const EVENT_CARDS = [
  { id: "ev-trend", kind: "trend", title: "🔥 冲上热门！", desc: "直播间被推荐到首页，路人疯狂涌入！", color: "#ff3b6b", dV: [160, 380], dFans: [18, 55], dMood: 12, dStress: -4, pool: TREND_LINES },
  { id: "ev-hater", kind: "hater", title: "💢 黑粉空降", desc: "一群键盘侠冲进来阴阳怪气，顶住别破防～", color: "#8a5cff", dV: [20, 70], dFans: [-8, 2], dMood: -10, dStress: 15, pool: HATER_LINES },
  { id: "ev-cold", kind: "cold", title: "🫥 突然冷场", desc: "弹幕安静下来…说点什么活跃气氛吧！", color: "#4a4566", dV: [-150, -50], dFans: [-5, 0], dMood: -8, dStress: 8, pool: COLD_LINES },
  { id: "ev-raid", kind: "raid", title: "🎁 榜一大哥空降", desc: "神秘大佬进场，刷了一大波礼物！", color: "#ffcf4d", dV: [70, 180], dFans: [10, 28], dMood: 10, dStress: -3, pool: TREND_LINES },
];

// NPC 直播间（大厅里能逛的别人）—— 封面用主题色块 + 分类图标占位
const NPC_STREAMERS = [
  { id: "npc-night", name: "深夜唠嗑电台", streamer: "夜猫子", tag: "聊天", icon: "🌙", viewers: 23100, color: "#7ec8ff", bg: BACKGROUNDS[5].style, vibe: "深夜陪聊，声音很温柔，爱跟弹幕碎碎念。",
    pool: ["晚上好哇", "今天也失眠了", "声音治愈", "电台ASMR", "陪我到天亮", "嗯嗯在听", "好温柔啊", "蹲一首歌"] },
  { id: "npc-cook", name: "像素厨房·今天做啥", streamer: "面包君", tag: "美食", icon: "🍞", viewers: 8800, color: "#d8a05a", bg: BACKGROUNDS[2].style, vibe: "做饭直播，香气扑鼻，弹幕都在喊饿。",
    pool: ["饿了饿了", "看着就香", "求菜谱", "深夜放毒", "咽口水", "教程救命", "这刀工", "我也想吃"] },
  { id: "npc-miku", name: "初音歌回 ing", streamer: "葱娘", tag: "唱见", icon: "🎤", viewers: 45600, color: "#39c5bb", bg: BACKGROUNDS[1].style, vibe: "唱见歌回，气氛热烈，全是应援。",
    pool: ["awsl", "声控福利", "点歌！", "这转音绝了", "嗑死我了", "再来一首", "听哭了", "葱娘最棒"] },
  { id: "npc-study", name: "考研陪学自习室", streamer: "课代表", tag: "学习", icon: "📚", viewers: 5200, color: "#9bffb0", bg: BACKGROUNDS[0].style, vibe: "安静自习室，大家一起卷，偶尔互相打气。",
    pool: ["一起卷", "番茄钟开始", "好困但要学", "互相监督", "进度+1", "坚持住", "云自习真香", "加油呀"] },
  { id: "npc-cat", name: "猫猫看板娘 24h", streamer: "三花", tag: "萌宠", icon: "🐱", viewers: 31900, color: "#ffb15e", bg: BACKGROUNDS[4].style, vibe: "猫咪直播间，全是吸猫的，狂刷可爱。",
    pool: ["可爱捏", "肉垫！", "猫主子驾到", "吸猫一时爽", "好软的样子", "喵呜", "想rua", "看一天不腻"] },
  { id: "npc-game", name: "复古游戏速通", streamer: "手柄侠", tag: "游戏", icon: "🎮", viewers: 17400, color: "#f5f5f5", bg: BACKGROUNDS[3].style, vibe: "像素游戏速通，弹幕指点江山。",
    pool: ["这操作", "手速起飞", "下一关！", "童年回忆", "速通大神", "差一点", "稳住", "记录又破了"] },
];

const STREAMER_TIPS = [
  { sel: "prep", text: "先给今晚的放送起个标题、传张封面，再点「开播」～" },
  { sel: "live", text: "右下「主播麦克风」开麦说话，观众会接你的话！" },
  { sel: "rename", text: "点直播间名字可以随时改名，观众会立刻吐槽。" },
  { sel: "mood", text: "做得好涨粉、心情升；冷场或黑粉会让压力上涨。" },
];

// ---------- 默认状态 ----------
function makeDefaultState() {
  const meId = "me";
  return {
    version: 2,
    room: { name: "十周年放送间", number: "100010", streamerName: "房主" },
    profiles: [{ id: meId, name: "我", roomNo: "100010", color: "#ee5ec0", isMe: true }],
    currentProfileId: meId,
    photos: [],
    selectedPhotoId: null,
    deco: {
      theme: "th-nso",
      frame: "frame-pink", background: "bg-checker", bgImage: null, font: "font-crt",
      pageBg: "bg-checker", pageBgImage: null,
      stickers: [], customFrames: [], customStickers: [],
    },
    ai: {
      enabled: true,
      autoAudience: true,        // 路人/常驻观众随机闲聊
      autoRefresh: false,        // 定时读图刷新弹幕
      refreshSec: 25,            // 自动读图间隔（秒）
      context: "这是两个相识十年的好朋友的纪念相册。她们一起走过青春，互怼又互相在乎，是双向奔赴的神仙友谊。直播间在庆祝十周年。",
      personas: DEFAULT_PERSONAS,
      api: { provider: "openai", baseURL: "", key: "", model: "", visionModel: "", remember: true },
    },
    stream: { phase: "offline", title: "", cover: null, startedAt: 0 },
    sim: { fans: 1314, mood: 72, stress: 18, affection: 50, peakViewers: 0, onboarded: false, activity: 6 },
    history: [],
  };
}

Object.assign(window, {
  uid, pick, pixelDataURL, PIXEL_ITEMS, STICKERS,
  DANMAKU_POOL, SUPERCHAT_POOL, SC_AMOUNTS, DEFAULT_PERSONAS,
  NICK_A, NICK_B, NICK_C, VIEWER_VIBES, randomViewer,
  FRAMES, BACKGROUNDS, FONTS, THEMES, AVATAR_COLORS, makeDefaultState,
  GREET_ON, GREET_OFF, COLD_LINES, HATER_LINES, TREND_LINES,
  EVENT_CARDS, NPC_STREAMERS, STREAMER_TIPS,
});
