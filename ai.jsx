// ============================================================
// ai.jsx — AI 层
// 三级降级：① 用户自填的 OpenAI 兼容 API（真·看图）
//          ② 内置 Claude（预览里可用，文本为主）
//          ③ 本地语料池兜底（永远有反应，离线可用）
// ============================================================

// 把模型返回的文本解析成字符串数组
function parseLines(text) {
  if (!text) return [];
  let raw = String(text).trim();
  raw = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  // 先尝试 JSON 数组
  const m = raw.match(/\[[\s\S]*\]/);
  if (m) {
    try {
      const arr = JSON.parse(m[0]);
      if (Array.isArray(arr)) return arr.map((s) => String(s).trim()).filter(Boolean);
    } catch (e) {}
  }
  // 退化：按行拆，去掉序号/引号/项目符号
  return raw.split(/\n+/)
    .map((s) => s.replace(/^[\s\d.、)\-*"'「」•]+/, "").replace(/["'」]+$/, "").trim())
    .filter(Boolean);
}

// 规范化 baseURL → 完整 chat/completions 端点
function resolveEndpoint(baseURL) {
  let b = (baseURL || "").trim().replace(/\/+$/, "");
  if (!b) return "";
  if (/chat\/completions$/.test(b)) return b;
  if (/\/v\d+$/.test(b)) return b + "/chat/completions";
  return b + "/v1/chat/completions";
}

// 规范化 baseURL → 模型列表端点
function resolveModelsEndpoint(baseURL) {
  let b = (baseURL || "").trim().replace(/\/+$/, "");
  if (!b) return "";
  b = b.replace(/\/chat\/completions$/, "");
  if (/\/v\d+$/.test(b)) return b + "/models";
  return b + "/v1/models";
}

// 拉取可用模型列表（验证连接是否真的通）
async function fetchModels(api) {
  const endpoint = resolveModelsEndpoint(api.baseURL);
  if (!endpoint) throw new Error("先填 Base URL");
  const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${api.key}` } });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${t.slice(0, 140)}`);
  }
  const data = await res.json();
  const list = (data?.data || data?.models || []).map(m => (typeof m === "string" ? m : (m.id || m.name))).filter(Boolean);
  if (!list.length) throw new Error("接口返回空列表");
  return list;
}

// 是否配好了自定义 API
function hasCustomAPI(api) {
  return !!(api && api.baseURL && api.key && (api.model || api.visionModel));
}

// 这一次调用是否该"看图"：
// · 自定义 API：只有配了看图模型才发图（避免给纯文本模型发图报错）
// · 内置 Claude：支持看图，有图就发（失败会在业务层退回纯文字）
function wantVision(api, image) {
  if (!image) return false;
  if (hasCustomAPI(api)) return !!api.visionModel;
  return true;
}

// 调自定义 OpenAI 兼容 API
async function callCustomAPI(api, { system, user, image, mimeType, maxTokens = 400, vision = false, temperature = 0.85 }) {
  const endpoint = resolveEndpoint(api.baseURL);
  const model = (vision && api.visionModel) ? api.visionModel : (api.model || api.visionModel);
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  if (image) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: user },
        { type: "image_url", image_url: { url: image } },
      ],
    });
  } else {
    messages.push({ role: "user", content: user });
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.key}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${t.slice(0, 160)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

// 调内置 Claude（仅预览环境有；图片能力不确定，做兜底）
async function callBuiltinClaude({ system, user, image, mimeType }) {
  if (!(window.claude && window.claude.complete)) throw new Error("no-claude");
  const sys = system ? system + "\n\n" : "";
  if (image) {
    // 试着用 Anthropic 风格图文消息；不支持就抛错，由上层降级
    try {
      const b64 = image.split(",")[1];
      const mt = mimeType || (image.substring(5, image.indexOf(";")) || "image/jpeg");
      const txt = await window.claude.complete({
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mt, data: b64 } },
            { type: "text", text: sys + user },
          ],
        }],
      });
      if (txt) return txt;
      throw new Error("empty");
    } catch (e) {
      throw new Error("claude-vision-unavailable");
    }
  }
  return await window.claude.complete({ messages: [{ role: "user", content: sys + user }] });
}

// 统一入口：返回文本，或抛错（上层用本地池兜底）
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label || "AI 请求"}超时（${Math.round(ms / 1000)}秒无响应），请重试或检查网络/接口`)), ms)),
  ]);
}

// 看图前把照片压到小尺寸 JPEG —— 整张高清 base64 会让视觉模型极慢甚至超时
const __imgCache = new Map();
async function downscaleImage(dataURL, maxDim = 768, quality = 0.82) {
  if (!dataURL || typeof dataURL !== "string" || !dataURL.startsWith("data:image")) return dataURL;
  if (__imgCache.has(dataURL)) return __imgCache.get(dataURL);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataURL; });
    let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    if (scale >= 1 && dataURL.length < 180000) { __imgCache.set(dataURL, dataURL); return dataURL; }
    w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    const out = c.toDataURL("image/jpeg", quality);
    __imgCache.set(dataURL, out);
    return out;
  } catch (e) { return dataURL; }
}

async function aiComplete(api, opts) {
  if (opts && opts.image) opts = { ...opts, image: await downscaleImage(opts.image) };
  // 超时放到 120 秒：有些慢模型（尤其出图/推理类）单次要 1-2 分钟，别误杀也别重复计费
  if (hasCustomAPI(api)) {
    return await withTimeout(callCustomAPI(api, opts), 120000, "接口调用");
  }
  return await withTimeout(callBuiltinClaude(opts), 120000, "内置 AI 调用");
}

// ---------- 业务函数 ----------

// 看图生成弹幕
async function aiImageDanmaku(api, { image, context, n = 6 }) {
  const system = `你是一个 B 站风格的弹幕生成器。${context || ""}`;
  const user = `请你"看图说话"，根据这张照片里的人物、动作、场景、氛围，生成 ${n} 条又短又有梗、温馨又搞笑的中文弹幕。
要求：每条不超过 12 个字；像真实网友刷的弹幕；可以玩梗、可以煽情。
只返回一个 JSON 字符串数组，不要任何解释、不要 markdown。例如：["爷青回","这构图绝了","泪目了家人们"]`;
  const txt = await aiComplete(api, { system, user, image, vision: true, maxTokens: 300 });
  return parseLines(txt).slice(0, n);
}

// 某个观众实时刷弹幕（in-character，可带图真看）
async function aiAudienceLines(api, { persona, context, caption, recent = [], n = 2, image }) {
  const useVision = !!(image && api && api.visionModel);
  const system = `你在一个怀旧相册直播间里扮演一名观众，发弹幕。${context || ""}
你的人设：${persona.name}——${persona.prompt}
规则：①只评论画面里真实看得到的东西或当下氛围，绝不编造照片里没有的内容；②不要自问自答、不要复述配文原话、不要 @ 任何人；③像真网友刷弹幕一样短促口语，可玩梗可煽情。`;
  const user = `${useVision ? "看这张照片" : `画面配文：「${caption || "（无）"}」`}。
最近弹幕：${recent.slice(-6).join(" / ") || "（暂无）"}。
用你的口吻发 ${n} 条弹幕，每条≤14字，彼此不重复。只返回 JSON 字符串数组，别加解释。`;
  const txt = await aiComplete(api, { system, user, image: useVision ? image : undefined, vision: useVision, maxTokens: 200 });
  return parseLines(txt).slice(0, n);
}

// 回应「主播/观众刚发的弹幕」——制造互动感
async function aiReplyToUser(api, { context, caption, userName, userText, n = 2, image }) {
  const useVision = !!(image && api && api.visionModel);
  const viewer = window.randomViewer();
  const system = `你在怀旧相册直播间里扮演观众「${viewer.name}」，${viewer.prompt}${context || ""}
规则：自然地接住刚才那条弹幕，像真观众一样起哄/共鸣/调侃，短促口语，别复读对方原话，别编造画面里没有的东西。`;
  const user = `${useVision ? "看这张照片。" : caption ? `画面配文：「${caption}」。` : ""}刚刚「${userName}」发了一条弹幕：「${userText}」。
请发 ${n} 条接话的弹幕，每条≤14字。只返回 JSON 字符串数组。`;
  const txt = await aiComplete(api, { system, user, image: useVision ? image : undefined, vision: useVision, maxTokens: 160 });
  return { lines: parseLines(txt).slice(0, n), viewer };
}

// 主播做了某个动作 → 一群观众对"这件事"做出反应
function describeEvent(kind, detail) {
  switch (kind) {
    case "golive": return "主播刚刚开播了，直播间瞬间热闹起来";
    case "offline": return "主播说要下播了，准备和大家道别";
    case "speak": return `主播开麦说了句：「${detail}」`;
    case "rename": return `主播把直播间名字改成了「${detail}」`;
    case "upload": return `主播上传了 ${detail} 张新照片到放送相册`;
    case "switch": return detail ? `主播切到了一张新照片，配文是「${detail}」` : "主播切到了一张新照片";
    case "superchat": return `主播自己也发了条付费留言：「${detail}」`;
    default: return "主播刚刚有了新动作";
  }
}

async function aiReactToEvent(api, { kind, detail, context, room, n = 3 }) {
  const what = describeEvent(kind, detail);
  const system = `你在一个怀旧相册直播间里扮演一群各式各样的观众发弹幕。${context || ""}
直播间名「${room?.name || "十周年放送"}」，主播是「${room?.streamerName || "房主"}」。
规则：像真实网友刷弹幕一样短促口语，可玩梗可起哄可煽情，绝不复读、不 @ 人、不编造画面外的事。`;
  const user = `直播间里刚刚发生了这件事：${what}。
请用 ${n} 个不同观众的口吻，发 ${n} 条针对这件事的弹幕来回应，每条≤14字，彼此都不一样。只返回一个 JSON 字符串数组，别加解释。`;
  const txt = await aiComplete(api, { system, user, maxTokens: 220, temperature: 0.95 });
  return parseLines(txt).slice(0, n);
}

// AI 发一条付费留言（SuperChat）
async function aiSuperchat(api, { persona, context, caption }) {
  const system = `你正在扮演直播间观众发"付费留言/SuperChat"。${context || ""}
你的人设：${persona.name}。${persona.prompt}`;
  const user = `请发一条真挚或搞笑的付费留言，针对这场十周年放送${caption ? `和这张照片（"${caption}"）` : ""}。
不超过 20 个字。只返回这一句话本身，不要引号不要解释。`;
  const txt = await aiComplete(api, { system, user, maxTokens: 80 });
  return (txt || "").trim().replace(/^["'「]+|["'」]+$/g, "").slice(0, 40);
}

// 给整本相册起标题（备用能力）
async function aiAlbumTitle(api, { context, captions = [] }) {
  const system = `你是文案高手。${context || ""}`;
  const user = `这是一本十周年纪念相册，里面照片的配文有：${captions.join("；") || "（暂无）"}。
请起 1 个又文艺又有梗的相册标题，不超过 12 个字。只返回标题本身。`;
  const txt = await aiComplete(api, { system, user, maxTokens: 40 });
  return (txt || "").trim().replace(/^["'「]+|["'」]+$/g, "");
}

// ============================================================
// 直播弹幕批量生成（核心）—— 按"弹幕容器格式"产出 10-15 条
// 真·AI 互动；解析成 {kind:'normal'|'super'|'system', name, currency, amount, text}
// ============================================================

// 解析 <弹幕|观看人数> 容器 + 每行格式
function parseDanmakuBatch(text) {
  const out = { viewers: null, items: [] };
  if (!text) return out;
  let raw = String(text).trim().replace(/^```(?:\w+)?/i, "").replace(/```$/, "").trim();
  const wrap = raw.match(/<\s*弹幕\s*\|\s*([^>]+?)\s*>/);
  if (wrap) out.viewers = wrap[1].trim();
  raw = raw.replace(/<\s*弹幕[^>]*>/g, "").replace(/<\s*\/\s*弹幕\s*>/g, "");
  for (let line of raw.split(/\n+/)) {
    line = line.trim();
    if (!line) continue;
    const m = line.match(/^\[([^\]]+)\]\s*[:：]\s*([\s\S]+)$/);
    if (!m) { out.items.push({ kind: "normal", name: null, text: line.slice(0, 40) }); continue; }
    const meta = m[1].trim();
    const content = m[2].trim();
    if (/^(系统通知|系统|系统消息)$/.test(meta)) { out.items.push({ kind: "system", text: content.slice(0, 60) }); continue; }
    if (meta.includes("|")) {
      const i = meta.indexOf("|");
      const left = meta.slice(0, i).trim();
      const name = meta.slice(i + 1).trim();
      const cm = left.match(/^([￥$¥€]|RMB|USD)?\s*([\d.]+\s*[wW万kK]?\+?)$/);
      if (cm && name) { out.items.push({ kind: "super", currency: cm[1] || "￥", amount: cm[2].replace(/\s/g, ""), name, text: content.slice(0, 60) }); continue; }
    }
    out.items.push({ kind: "normal", name: meta, text: content.slice(0, 40) });
  }
  return out;
}

async function aiDanmakuBatch(api, { room, context, caption, recent = [], viewers, event, n = 12, image }) {
  const streamer = room?.streamerName || "主播";
  const useVision = wantVision(api, image);
  const system = `你是一个高度拟真的"直播弹幕流"生成引擎，为一个怀旧相册直播间产出实时滚动弹幕。
直播间名「${room?.name || "十周年放送"}」，主播是「${streamer}」。${context || ""}

【氛围与人设一致性】
· 这是"两个相识十周年的好朋友"的纪念相册直播间，底色温情、怀旧、有梗；同时要体现真实网络生态。
· 观众构成：大多数是普通观众（老观众/颜粉/事业粉/妈粉式宠溺），少量路人、梦女梦男粉、抽象怪，以及个别黑子/酸民来阴阳。
· 网名千奇百怪，像滚筒洗衣机滚出来的随机组合：中英数字颜文字emoji空耳梗混搭，别都很正经。
· 直播流速快：以短句、短词、单字、颜文字为主；观众会复读、会怪叫、会互相之间闲聊接话、会顺着前面的弹幕玩下去。
· 可以偶尔玩点烂梗，但别一直刷"绝了/yyds/xswl"这类无营养词；多写具体、鲜活、带情绪的内容。
· 黑子的话要像真酸民（"就这？""粉丝滤镜真厚""尬住了"），但占比小。

【输出格式——必须严格遵守，只输出容器本身】
<弹幕|观看人数>
（这里是 ${n} 行弹幕，每行一条，从下面三种里选）
</弹幕>
· 观看人数：一个动态数字，可带 w / +（参考当前约 ${viewers || "随机几千到几万"} 人）。
· 普通弹幕：    [网名]: 内容
· 高亮付费留言：[￥金额|网名]: 内容   （金额如 30 / 66 / 520 / 1000）
· 系统通知：    [系统通知]: 内容   （如"欢迎 XX 成为本直播间的舰长！""XX 送出 1 个火箭"，最多 1-2 条，可没有）
不要输出任何解释、不要 markdown 代码块，只输出 <弹幕|...> ... </弹幕>。`;

  const evLine = event ? `\n【此刻刚刚发生】${event}。让这一波弹幕自然地围绕它来反应（起哄/共鸣/调侃/刷屏）。` : "";
  const user = `${useVision ? "看这张正在直播展示的照片。" : (caption ? `当前画面配文：「${caption}」。` : "")}
最近滚过的弹幕：${recent.slice(-10).join(" / ") || "（直播刚开始）"}。${evLine}
现在生成最新的 ${n} 条弹幕。`;

  let txt;
  try {
    txt = await aiComplete(api, { system, user, image: useVision ? image : undefined, vision: useVision, maxTokens: 760, temperature: 1.0 });
  } catch (e) {
    // 内置 Claude 看图可能不支持 → 退回纯文字（用配文）；自定义接口的失败直接抛出，让用户看到报错
    if (useVision && !hasCustomAPI(api)) {
      txt = await aiComplete(api, { system, user, maxTokens: 760, temperature: 1.0 });
    } else { throw e; }
  }
  return parseDanmakuBatch(txt);
}

// ---------- 本地兜底（无 AI 时）----------
function localDanmaku(n = 5) {
  const s = [...window.DANMAKU_POOL].sort(() => Math.random() - 0.5);
  return s.slice(0, n);
}
function localSuperchat() {
  const p = window.SUPERCHAT_POOL;
  return p[Math.floor(Math.random() * p.length)];
}

// 看图给这张照片建议一句配文
async function aiSuggestCaption(api, { image, context }) {
  const useVision = wantVision(api, image);
  const system = `你是怀旧相册的文案助手。${context || ""}`;
  const user = `${useVision ? "看这张照片，" : ""}为它写一句又短又有记忆点的中文配文（像相册下面的小字），
可以点出时间感/地点/心情/友情，不超过 14 个字。只返回这句话本身，不要引号、不要解释。`;
  let txt;
  try { txt = await aiComplete(api, { system, user, image: useVision ? image : undefined, vision: useVision, maxTokens: 50 }); }
  catch (e) { if (useVision && !hasCustomAPI(api)) { txt = await aiComplete(api, { system, user, maxTokens: 50 }); } else { throw e; } }
  return (txt || "").trim().replace(/^["'「]+|["'」]+$/g, "").split(/\n/)[0].slice(0, 24);
}

Object.assign(window, {
  parseLines, parseDanmakuBatch, hasCustomAPI, wantVision, resolveEndpoint, fetchModels,
  aiImageDanmaku, aiAudienceLines, aiReplyToUser, aiSuperchat, aiAlbumTitle, aiSuggestCaption,
  aiReactToEvent, aiDanmakuBatch, describeEvent,
  localDanmaku, localSuperchat,
});
