// ============================================================
// liveroom.jsx — 直播间舞台 + 弹幕引擎 + 付费留言 + 输入栏
// 竖屏/横屏自适配；装扮（框/背景/字体/贴纸）实时渲染
// ============================================================
const { useState, useRef, useEffect, useMemo, useCallback } = React;

// 单条飞行弹幕（memo + Web Animations API：动画在挂载时一次性启动，彻底脱离 React 重渲染，
// 主播模拟器每 850ms 的人气/仪表刷新不会再重置它）
const DanmakuItem = React.memo(function DanmakuItem({ d, stageW, onDone }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dur = Math.max(6, Math.min(16, stageW / 120 + d.text.length * 0.28)) * 1000;
    const anim = el.animate(
      [{ transform: `translateX(${stageW}px)` }, { transform: "translateX(-100%)" }],
      { duration: dur, easing: "linear", fill: "forwards" }
    );
    anim.onfinish = () => onDone(d.id);
    return () => { try { anim.cancel(); } catch (e) {} };
    // eslint-disable-next-line
  }, [d.id]);
  return (
    <div
      ref={ref}
      className="dm-item"
      style={{
        position: "absolute", top: d.top, left: 0, whiteSpace: "nowrap",
        transform: `translateX(${stageW}px)`,
        fontWeight: 700, fontSize: d.size || 22, zIndex: d.paid ? 7 : 4,
        color: d.color || "#fff",
        textShadow: "2px 2px 0 rgba(0,0,0,.85), -1px -1px 0 rgba(0,0,0,.6)",
        pointerEvents: "none",
      }}
    >
      {d.name ? <span style={{ opacity: .9, fontSize: "0.78em", marginRight: 6, padding: "0 5px", background: "rgba(0,0,0,.4)", borderRadius: 3 }}>{d.name}</span> : null}
      {d.text}
    </div>
  );
});

// 飞行弹幕层：整层 memo，使主播模拟器每 850ms 的人气/仪表更新不会重渲染（从而不会重置）飞行动画
const DanmakuLayer = React.memo(function DanmakuLayer({ danmaku, stageW, onDone }) {
  return danmaku.map(d => <DanmakuItem key={d.id} d={d} stageW={stageW} onDone={onDone} />);
});

// 付费留言卡（同样 memo，避免动画被父级重渲染打断）
const SuperChatCard = React.memo(function SuperChatCard({ sc }) {
  return (
    <div className="sc-card" style={{ animation: "nso-pop .3s ease both" }}>
      <div className="sc-top" style={{ background: sc.color || "#ffcf4d" }}>
        <span className="sc-name">{sc.name}</span>
        <span className="sc-amount">{sc.currency || "¥"}{sc.amount}</span>
      </div>
      <div className="sc-body">{sc.text}</div>
    </div>
  );
});

// 侧边弹幕列表（主播女孩重度依赖那种聊天滚动显示）— 独立面板，不挡照片
function ChatFeed({ items, portrait }) {
  const listRef = useRef(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length]);
  return (
    <div className={`feed-panel ${portrait ? "portrait" : ""}`}>
      <div className="feed-head"><span>💬 弹幕墙</span><span className="feed-count">{items.length}</span></div>
      <div className="feed-list nso-scroll" ref={listRef}>
        {items.length === 0 ? <div className="feed-empty">弹幕会实时出现在这里~</div> : null}
        {items.map(c => c.type === "super" ? (
          <div key={c.id} className="chat-super" style={{ borderColor: c.color || "#ffcf4d" }}>
            <div className="chat-super-top" style={{ background: c.color || "#ffcf4d" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
              <span>{c.currency || "¥"}{c.amount}</span>
            </div>
            <div className="chat-super-body">{c.text}</div>
          </div>
        ) : c.type === "system" ? (
          <div key={c.id} className="chat-sys">🔔 {c.text}</div>
        ) : (
          <div key={c.id} className="chat-row">
            {c.host ? <span className="chat-host">🎤主播</span> : (c.name ? <span className="chat-name" style={{ color: c.color || "#ffd24d" }}>{c.name}</span> : null)}
            <span className="chat-text" style={c.host ? { color: "#fff", fontWeight: 700 } : (c.paid ? { color: "#ffd24d", fontWeight: 700 } : null)}>{c.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 下播状态 / 开播准备 屏幕 —— 主播视角的"控制台"
function OfflineScreen({ state, onGoPrep, goLobby, goStudio }) {
  const cover = state.stream.cover || (state.photos[0] && state.photos[0].url) || null;
  const bg = (window.BACKGROUNDS.find(b => b.id === state.deco.pageBg) || window.BACKGROUNDS[0]).style;
  const tip = !state.sim.onboarded;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "calc(10px + var(--safe-top)) 12px calc(12px + var(--safe-bottom))", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
        <button className="nso-btn sm" onClick={goLobby}>◀ 大厅</button>
        <span className="latin" style={{ fontSize: 16, color: "var(--secondary)" }}>OFF AIR</span>
        <button className="nso-btn sm ghost" style={{ marginLeft: "auto" }} onClick={goStudio}>⚙ 后台</button>
      </div>

      <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
        <div style={{ position: "relative", width: "min(420px,86%)", aspectRatio: "16/9", border: "5px solid var(--secondary)", boxShadow: "inset 0 0 0 3px #000", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, ...bg, filter: "grayscale(.6) brightness(.6)" }} />
          {cover && <img src={cover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(.5) brightness(.65)" }} />}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <div className="latin" style={{ fontSize: 22, color: "#fff", letterSpacing: 3, textShadow: "2px 2px 0 #000" }}>OFF AIR</div>
            <div style={{ fontSize: 15, color: "#fff", opacity: .8 }}>直播未开始</div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{state.stream.title || state.room.name}</div>
          <div style={{ fontSize: 14, opacity: .72, marginTop: 4, fontFamily: "'Noto Sans SC',sans-serif" }}>
            主播 {state.room.streamerName} · 💗 {window.fmtNum(state.sim.fans || 0)} 粉丝 · {state.photos.length} 张回忆
          </div>
        </div>

        {tip && (
          <div style={{ maxWidth: 360, fontSize: 13, opacity: .8, fontFamily: "'Noto Sans SC',sans-serif", lineHeight: 1.6, border: "2px dashed var(--secondary)", padding: "8px 12px" }}>
            👋 第一次开播：点下面的「开播准备」给今晚起个标题、选张封面，观众就会涌进来啦～
          </div>
        )}

        <button className="nso-btn gold" style={{ fontSize: 22, padding: "12px 26px" }} disabled={!state.photos.length} onClick={onGoPrep}>
          {state.photos.length ? "🔴 开播准备" : "先去后台上传照片"}
        </button>
      </div>
    </div>
  );
}

function PrepScreen({ state, onStart, onCancel }) {
  const [title, setTitle] = useState(state.stream.title || state.room.name);
  const [cover, setCover] = useState(state.stream.cover || (state.photos[0] && state.photos[0].url) || null);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "calc(10px + var(--safe-top)) 12px calc(12px + var(--safe-bottom))", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
        <button className="nso-btn sm ghost" onClick={onCancel}>◀ 返回</button>
        <span style={{ fontSize: 20, fontWeight: 700 }}>开播准备</span>
      </div>
      <div className="nso-scroll" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ fontSize: 15, marginBottom: 6, opacity: .85 }}>① 今晚的放送标题</div>
          <input className="nso-input" style={{ width: "100%" }} value={title} maxLength={40} onChange={e => setTitle(e.target.value)} placeholder="例：十周年特别放送·一起看老照片" />
        </div>
        <div>
          <div style={{ fontSize: 15, marginBottom: 6, opacity: .85 }}>② 选张封面</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: 8 }}>
            {state.photos.map(p => (
              <div key={p.id} onClick={() => setCover(p.url)} style={{
                position: "relative", aspectRatio: "1", overflow: "hidden", cursor: "pointer",
                border: cover === p.url ? "4px solid var(--gold)" : "3px solid #000",
                boxShadow: cover === p.url ? "0 0 0 2px var(--gold)" : "none",
              }}>
                <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                {cover === p.url && <span style={{ position: "absolute", top: 2, right: 4, fontSize: 16 }}>✓</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <button className="nso-btn gold" style={{ fontSize: 22, padding: "12px", flex: "0 0 auto" }} onClick={() => onStart(title.trim() || state.room.name, cover)}>
        ▶ 开始直播
      </button>
    </div>
  );
}

function LiveRoom({ state, dispatch, goStudio, goLobby, aiBusyRef, portrait }) {
  const photos = state.photos;
  const [idx, setIdx] = useState(0);
  const [danmaku, setDanmaku] = useState([]);     // 飞行中的弹幕
  const [chatLog, setChatLog] = useState([]);      // 侧边弹幕列表
  const [supers, setSupers] = useState([]);        // 付费留言卡
  const [sysNotes, setSysNotes] = useState([]);    // 系统通知横幅
  const [aiError, setAiError] = useState(null);    // AI 调用失败提示
  const [aiNote, setAiNote] = useState(null);      // 临时状态提示（刷新中/已刷新…）
  const [paused, setPaused] = useState(false);
  const [showName, setShowName] = useState(true);
  const [showFeed, setShowFeed] = useState(true);  // 侧边弹幕开关
  const [closing, setClosing] = useState(false);    // 下播过渡中
  const [micDraft, setMicDraft] = useState("");      // 主播麦克风输入
  const [streamerSay, setStreamerSay] = useState(null); // 主播说话气泡
  const stageRef = useRef(null);
  const [stageW, setStageW] = useState(800);
  const [stageH, setStageH] = useState(450);

  const cur = photos[idx] || null;
  const curRef = useRef(cur); curRef.current = cur;
  const stateRef = useRef(state); stateRef.current = state;

  const deco = state.deco;
  const frame = [...window.FRAMES, ...(deco.customFrames || []).map(f => ({ id: f.id, name: f.name, css: { border: "5px solid transparent" } }))].find(f => f.id === deco.frame) || window.FRAMES[0];
  const bg = window.BACKGROUNDS.find(b => b.id === deco.background) || window.BACKGROUNDS[0];
  const font = (window.FONTS.find(f => f.id === deco.font) || window.FONTS[0]).css;
  const customFrame = (deco.customFrames || []).find(f => f.id === deco.frame);

  // 测量舞台尺寸
  useEffect(() => {
    const measure = () => {
      if (!stageRef.current) return;
      const r = stageRef.current.getBoundingClientRect();
      setStageW(r.width); setStageH(r.height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  // 轨道
  const tracks = Math.max(3, Math.floor((stageH * 0.82) / 42));
  const trackRef = useRef(0);
  const nextTop = useCallback(() => {
    const t = trackRef.current % tracks;
    trackRef.current = (trackRef.current + 1) % tracks;
    return `${6 + t * 42}px`;
  }, [tracks]);

  const removeDm = useCallback((id) => setDanmaku(prev => prev.filter(d => d.id !== id)), []);

  // 往侧边列表推一条
  const pushChat = useCallback((entry) => {
    setChatLog(prev => {
      const next = [...prev, { id: window.uid("c"), ...entry }];
      return next.length > 46 ? next.slice(-40) : next;
    });
  }, []);

  const emit = useCallback((item) => {
    if (paused) return;
    const d = { id: window.uid("dm"), top: nextTop(), ...item };
    setDanmaku(prev => (prev.length > 70 ? [...prev.slice(-60), d] : [...prev, d]));
    if (!item._noFeed) pushChat({ name: item.name, color: item.color, text: item.text, paid: item.paid });
  }, [paused, nextTop, pushChat]);

  const emitSuper = useCallback((sc) => {
    const card = { id: window.uid("sc"), ...sc };
    setSupers(prev => [...prev, card]);
    setTimeout(() => setSupers(prev => prev.filter(s => s.id !== card.id)), 9000);
    // 付费留言也飞一条
    emit({ text: `💰 ${sc.text}`, color: "#4a2c00", paid: true, size: 24, name: sc.name, _noFeed: true });
    // 侧边列表里以付费卡样式出现
    pushChat({ type: "super", name: sc.name, color: sc.color, amount: sc.amount, currency: sc.currency, text: sc.text });
  }, [emit, pushChat]);

  // 系统通知：舞台顶部横幅 + 侧栏一条
  const emitSystem = useCallback((text) => {
    const id = window.uid("sys");
    setSysNotes(prev => [...prev, { id, text }]);
    setTimeout(() => setSysNotes(prev => prev.filter(s => s.id !== id)), 5200);
    pushChat({ type: "system", text });
  }, [pushChat]);

  // 颜色：按网名稳定取色（AI 生成的随机网名也能有固定颜色）
  const colorForName = useCallback((name) => {
    const pal = window.AVATAR_COLORS;
    const s = String(name || "路人");
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return pal[h % pal.length];
  }, []);

  const recentRef = useRef([]);          // 最近滚过的弹幕（喂给 AI 保持连贯）
  const queueRef = useRef([]);           // 待播放的解析后弹幕条目
  const fetchingRef = useRef(false);     // 正在请求一批
  const lastBatchRef = useRef(0);        // 上次自动补给时间
  const simViewersRef = useRef(0);       // 当前人气（喂给 AI 当作观看人数参考）

  // 播放一条解析后的弹幕条目（普通 / 付费 / 系统通知）
  const playItem = useCallback((it) => {
    if (!it || !it.text) return;
    if (it.kind === "system") { emitSystem(it.text); return; }
    if (it.kind === "super") {
      emitSuper({ name: it.name, color: colorForName(it.name), amount: it.amount, currency: it.currency, text: it.text });
      recentRef.current = [...recentRef.current, it.text].slice(-12);
      return;
    }
    emit({ text: it.text, color: colorForName(it.name), name: showName ? it.name : null });
    recentRef.current = [...recentRef.current, it.text].slice(-12);
  }, [emit, emitSuper, emitSystem, showName, colorForName]);
  const playItemRef = useRef(playItem); playItemRef.current = playItem;

  // ===== 真·AI 弹幕引擎 =====
  // 调 aiDanmakuBatch 拉一批「<弹幕|观看人数> …」，解析成条目入队，由滚动播放器滴出。
  // 没有任何本地语料兜底——弹幕完全来自 AI 互动。
  const requestBatch = useCallback(async (opts = {}) => {
    const { event = null, fresh = false, auto = false, force = false } = opts;
    const st = stateRef.current;
    if (!st.ai.enabled) { if (force) setAiError("AI 已关闭：去「⚙ 后台 → 🤖AI」打开「AI 总开关」即可。"); return { error: "disabled" }; }
    if (auto && !st.ai.autoAudience) return { skipped: true };   // 自动补给受「路人自动刷弹幕」开关控制
    if (fetchingRef.current || aiBusyRef.current) {
      if (!force) return { dropped: true };
      // 强制刷新：等当前这批跑完再上（最多等 15 秒），避免静默丢弃
      const t0 = Date.now();
      while ((fetchingRef.current || aiBusyRef.current) && Date.now() - t0 < 15000) {
        await new Promise(r => setTimeout(r, 250));
      }
      if (fetchingRef.current || aiBusyRef.current) return { dropped: true };
    }
    const now = Date.now();
    if (auto && now - lastBatchRef.current < 2000) return { skipped: true };
    fetchingRef.current = true; aiBusyRef.current = true; lastBatchRef.current = now;
    const photo = curRef.current;
    try {
      const res = await window.aiDanmakuBatch(st.ai.api, {
        room: st.room, context: st.ai.context, caption: photo && photo.caption,
        recent: recentRef.current, viewers: simViewersRef.current, event,
        n: 10 + Math.floor(Math.random() * 2), image: photo && photo.url,
      });
      const items = (res && res.items) || [];
      if (items.length) {
        if (fresh) queueRef.current = [];
        queueRef.current = queueRef.current.concat(items);
        setAiError(null);   // 成功一次就清掉旧报错
      }
      return { ok: items.length };
    } catch (e) {
      const msg = String((e && e.message) || e).slice(0, 200);
      setAiError("AI 调用失败：" + msg);
      return { error: msg };
    }
    finally { fetchingRef.current = false; aiBusyRef.current = false; }
  }, [aiBusyRef]);

  // 滚动播放器：从队列滴出弹幕（直播流速：积压多时更快），见底自动补给
  useEffect(() => {
    if (state.stream.phase !== "live" || paused) return;
    let timer;
    const tick = () => {
      const q = queueRef.current;
      if (q.length) playItemRef.current(q.shift());
      if (queueRef.current.length < 10) requestBatch({ auto: true });
      // 自适应节奏：队列少时放慢滴出、把一批弹幕摊开盖住慢模型的拉取间隙；积压多时加速追上
      const n = queueRef.current.length;
      const gap = n > 16 ? 360 + Math.random() * 300 : n > 6 ? 1000 + Math.random() * 900 : 1700 + Math.random() * 1500;
      timer = setTimeout(tick, gap);
    };
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, [state.stream.phase, paused, requestBatch]);

  // 切照片：让 AI 围绕新照片追加一波反应（不清空队列，保持弹幕连续滚动）
  const lastSwitchKey = useRef(null);
  useEffect(() => {
    if (state.stream.phase !== "live") { lastSwitchKey.current = null; return; }
    const key = cur && cur.id;
    if (lastSwitchKey.current === null) { lastSwitchKey.current = key; return; }
    if (lastSwitchKey.current === key) return;
    lastSwitchKey.current = key;
    requestBatch({ event: cur && cur.caption ? `主播切到了新照片，配文「${cur.caption}」` : "主播切到了一张新照片" });
    // eslint-disable-next-line
  }, [idx, cur && cur.id, state.stream.phase]);

  // 手动「刷弹幕」：让 AI 重新看这张图、刷新一批（强制：忙时排队不丢弃，并给出可见反馈）
  const [refreshing, setRefreshing] = useState(false);
  const doImageRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true); setAiError(null); setAiNote("🤖 AI 正在看这张照片…（慢模型可能要等 1-2 分钟）");
    let r;
    try { r = await requestBatch({ event: "（弹幕刷新）大家又认真看了看这张照片", fresh: true, force: true }); }
    finally { setTimeout(() => setRefreshing(false), 500); }
    if (r && r.ok) setAiNote(`✅ 刷出 ${r.ok} 条新弹幕`);
    else if (r && r.dropped) setAiNote("⏳ AI 还在忙，请稍候再点");
    else if (r && r.error) setAiNote(null);   // 错误已在 aiError 横幅里显示
    else setAiNote(null);
    setTimeout(() => setAiNote(n => (n && n.startsWith("✅") || n && n.startsWith("⏳") ? null : n)), 2600);
  }, [requestBatch, refreshing]);

  // 定时读图刷新
  useEffect(() => {
    if (state.stream.phase !== "live" || paused || !state.ai.enabled || !state.ai.autoRefresh) return;
    const sec = Math.max(8, state.ai.refreshSec || 25);
    const t = setInterval(() => requestBatch({ event: "大家又认真看了看这张照片", fresh: true }), sec * 1000);
    return () => clearInterval(t);
  }, [state.stream.phase, paused, state.ai.enabled, state.ai.autoRefresh, state.ai.refreshSec, requestBatch]);

  const me = state.profiles.find(p => p.id === state.currentProfileId) || state.profiles[0];

  // ===== 主播模拟器整合 =====
  const phase = state.stream.phase;
  const live = phase === "live";
  const sim = window.useStreamerSim({ state, dispatch, onEvent: (eventText) => requestBatch({ event: eventText }), paused });
  simViewersRef.current = sim.viewers;

  // 上传新照片 → 直播中触发观众反应
  const prevCount = useRef(photos.length);
  useEffect(() => {
    const prev = prevCount.current;
    if (live && photos.length > prev) sim.fireEvent("upload", photos.length - prev);
    prevCount.current = photos.length;
  }, [photos.length, live]);

  const startLive = useCallback((title, cover) => {
    dispatch({ type: "GO_LIVE", title, cover });
    setIdx(0);
    setTimeout(() => sim.fireEvent("golive"), 450);
  }, [dispatch, sim]);

  const endLive = useCallback(() => {
    if (closing) return;
    sim.fireEvent("offline");
    setClosing(true);
    setTimeout(() => { dispatch({ type: "GO_OFFLINE" }); setClosing(false); setStreamerSay(null); }, 3400);
  }, [closing, dispatch, sim]);

  const speak = useCallback(() => {
    const t = micDraft.trim();
    if (!t) return;
    const id = window.uid("say");
    setStreamerSay({ id, text: t });
    setTimeout(() => setStreamerSay(s => (s && s.id === id ? null : s)), 4200);
    pushChat({ host: true, text: t, color: "#fff" });
    setMicDraft("");
    sim.fireEvent("speak", t);
  }, [micDraft, pushChat, sim]);

  const sendSuperFromMic = useCallback(() => {
    const t = micDraft.trim();
    if (!t) return;
    const amount = window.SC_AMOUNTS[Math.floor(Math.random() * window.SC_AMOUNTS.length)];
    emitSuper({ name: me.name, color: me.color, amount, text: t });
    setMicDraft("");
    sim.fireEvent("superchat", t);
  }, [micDraft, emitSuper, me, sim]);

  const renameRoom = useCallback(() => {
    const next = window.prompt("给直播间起个新名字～观众会立刻有反应", state.room.name);
    if (next == null) return;
    const name = next.trim();
    if (!name || name === state.room.name) return;
    dispatch({ type: "SET_ROOM", patch: { name } });
    if (live) sim.fireEvent("rename", name);
  }, [state.room.name, dispatch, live, sim]);

  const navTo = useCallback((i) => { setIdx(i); }, []);

  if (phase === "offline") return <OfflineScreen state={state} onGoPrep={() => dispatch({ type: "SET_STREAM", patch: { phase: "prep" } })} goLobby={goLobby} goStudio={goStudio} />;
  if (phase === "prep") return <PrepScreen state={state} onStart={startLive} onCancel={() => dispatch({ type: "SET_STREAM", patch: { phase: "offline" } })} />;

  return (
    <div className="live-wrap" style={{ fontFamily: font }}>
      <style>{`
        .live-wrap { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;
          padding: calc(8px + var(--safe-top)) 8px calc(8px + var(--safe-bottom)); gap: 8px; }
        .live-topbar { display:flex; align-items:center; justify-content:space-between; gap:8px; flex:0 0 auto; }
        .live-room-tag { display:flex; align-items:center; gap:8px; min-width:0; }
        .live-stage-box { position: relative; flex: 1 1 auto; min-height: 0; display:flex; gap:8px; }
        .live-stage-box.portrait { flex-direction: column; }
        .live-stage { position: relative; flex:1; overflow: hidden; background:#000; }
        .live-stage > img { position:absolute; inset:0; width:100%; height:100%; object-fit: contain; background:#000; }
        .stage-scan::after { content:""; position:absolute; inset:0; pointer-events:none; z-index:8;
          background: linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,.10) 50%); background-size:100% 4px; }
        .badge-live { position:absolute; top:8px; left:8px; z-index:9; background: var(--live); color:#fff;
          padding:3px 9px; font-weight:700; font-size:15px; letter-spacing:2px; display:flex; align-items:center; gap:6px;
          border:2px solid #000; animation: nso-pulse 1s infinite; }
        .badge-live .dot { width:8px; height:8px; background:#fff; border-radius:50%; }
        .badge-viewers { position:absolute; top:8px; right:8px; z-index:9; background: rgba(0,0,0,.65); color:#fff;
          padding:3px 9px; font-size:15px; border:2px solid var(--secondary); }
        .stage-empty { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:10px; text-align:center; color: var(--primary); padding:16px;
          background: repeating-linear-gradient(45deg,#2a1a44,#2a1a44 14px,#34204f 14px,#34204f 28px); }
        .sc-stack { position:absolute; top:40px; left:8px; right:8px; z-index:9; display:flex; flex-direction:column; gap:6px; pointer-events:none; }
        .sc-card { border:2px solid #000; box-shadow:3px 3px 0 rgba(0,0,0,.5); max-width: 360px; }
        .sc-top { display:flex; justify-content:space-between; align-items:center; padding:3px 8px; color:#4a2c00; font-weight:700; font-size:15px; }
        .sc-body { background:#fff7e0; color:#3a2a00; padding:5px 8px; font-size:16px; font-family:'Noto Sans SC',sans-serif; }
        .caption-bar { position:absolute; bottom:0; left:0; right:0; z-index:9; padding:6px 10px;
          background: linear-gradient(transparent, rgba(0,0,0,.7)); color:#fff; font-size:18px; }
        .sticker { position:absolute; z-index:8; cursor:default; user-select:none; filter: drop-shadow(2px 2px 0 rgba(0,0,0,.4)); }
        .feed-panel { flex:0 0 270px; min-width:0; display:flex; flex-direction:column; overflow:hidden;
          background:var(--window-bg); border:3px solid #000; box-shadow:inset 0 0 0 2px var(--secondary); }
        .feed-panel.portrait { flex:0 0 30%; min-height:108px; }
        .feed-head { flex:0 0 auto; background:var(--secondary); color:#fff; padding:5px 9px; font-size:16px; font-weight:700;
          letter-spacing:1px; display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #000; }
        .feed-count { font-size:13px; opacity:.85; }
        .feed-list { flex:1 1 auto; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:5px; padding:8px; }
        .feed-empty { opacity:.5; font-size:15px; }
        .chat-row { font-size:17px; line-height:1.3; color:var(--window-text); word-break:break-word; opacity:1; }
        .chat-name { font-weight:700; margin-right:5px; }
        .chat-super { border:2px solid #ffcf4d; box-shadow:2px 2px 0 rgba(0,0,0,.4); opacity:1; }
        .chat-super-top { display:flex; justify-content:space-between; gap:6px; padding:2px 7px; color:#4a2c00; font-weight:700; font-size:14px; }
        .chat-super-body { background:#fff7e0; color:#3a2a00; padding:3px 7px; font-size:15px; font-family:'Noto Sans SC',sans-serif; word-break:break-word; }
        .chat-sys { font-size:14px; color:#5a3a00; background:linear-gradient(#fff0c2,#ffd24d); border:2px solid #000; padding:2px 7px; font-weight:700; word-break:break-word; font-family:'Noto Sans SC',sans-serif; }
        .sys-stack { position:absolute; top:8px; left:0; right:0; z-index:10; display:flex; flex-direction:column; align-items:center; gap:5px; pointer-events:none; padding:0 70px; }
        .sys-note { background:linear-gradient(#fff0c2,#ffd24d); color:#5a3a00; border:2px solid #000; box-shadow:3px 3px 0 rgba(0,0,0,.45);
          padding:4px 14px; font-weight:700; font-size:15px; font-family:'Noto Sans SC',sans-serif; max-width:100%; text-align:center; animation:nso-pop .3s ease both; }
        @keyframes nso-chat-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .input-bar { flex:0 0 auto; display:flex; gap:6px; align-items:center; }
        .nav-dot { width:10px; height:10px; border:2px solid #000; background: var(--window-bg); cursor:pointer; }
        .nav-dot.on { background: var(--primary); }
        .mini-ctrl { display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
        .chat-host { background:var(--live); color:#fff; font-weight:700; font-size:12px; padding:0 5px; margin-right:5px; }
        .streamer-say { position:absolute; left:50%; bottom:14px; transform:translateX(-50%); z-index:10; max-width:80%;
          background:#fff; color:#1e1531; border:3px solid #000; box-shadow:4px 4px 0 rgba(0,0,0,.5);
          padding:7px 14px 9px; font-family:'Noto Sans SC',sans-serif; font-weight:700; font-size:17px; text-align:center;
          animation:nso-pop .3s ease both; }
        .streamer-say::after { content:""; position:absolute; bottom:-12px; left:50%; transform:translateX(-50%);
          border:7px solid transparent; border-top-color:#000; }
        .streamer-say .who { display:block; font-size:12px; color:var(--live); letter-spacing:1px; margin-bottom:1px; }
        .room-name-btn { background:none; border:none; padding:0; cursor:pointer; text-align:left; color:inherit; font:inherit;
          display:flex; align-items:center; gap:5px; }
        .room-name-btn .pen { font-size:13px; opacity:.5; }
        .mic-bar { flex:0 0 auto; display:flex; gap:6px; align-items:center;
          background:var(--window-bg); border:3px solid var(--live); box-shadow:inset 0 0 0 2px #000; padding:6px; }
        .mic-bar .mic-tag { flex:0 0 auto; background:var(--live); color:#fff; font-weight:700; font-size:13px; padding:5px 8px; letter-spacing:1px; }
        .ai-error-bar { flex:0 0 auto; display:flex; align-items:center; gap:8px; background:#3a0f1a; border:3px solid var(--live);
          box-shadow:inset 0 0 0 2px #000; color:#ffd2dc; padding:6px 10px; font-size:13px; font-family:'Noto Sans SC',sans-serif;
          line-height:1.4; word-break:break-word; }
        .ai-note { position:absolute; left:50%; top:34px; transform:translateX(-50%); z-index:10; pointer-events:none;
          background:rgba(0,0,0,.78); color:#fff; border:2px solid var(--secondary); padding:4px 12px; font-size:14px;
          font-family:'Noto Sans SC',sans-serif; white-space:nowrap; animation:nso-pop .25s ease both; }
      `}</style>

      {/* 顶栏 */}
      <div className="live-topbar">
        <div className="live-room-tag">
          <span className="badge-live" style={{ position: "static" }}><span className="dot" />LIVE</span>
          <div style={{ minWidth: 0 }}>
            <button className="room-name-btn" onClick={renameRoom} title="点这里改直播间名字">
              <span style={{ fontSize: 19, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{state.room.name}</span>
              <span className="pen">✎</span>
            </button>
            <div style={{ fontSize: 13, opacity: .7 }}>房间号 {state.room.number} · 主播 {state.room.streamerName}</div>
          </div>
        </div>
        <div className="mini-ctrl">
          <button className="nso-btn sm ghost" onClick={() => setShowName(s => !s)} title="显示/隐藏昵称">{showName ? "🏷️名" : "🏷️"}</button>
          <button className={`nso-btn sm ${showFeed ? "" : "ghost"}`} onClick={() => setShowFeed(s => !s)} title="侧边弹幕列表">💬</button>
          <button className="nso-btn sm ai" disabled={!cur || refreshing} onClick={doImageRefresh} title="让 AI 重新读这张图，刷一批新弹幕">{refreshing ? "刷新中…" : "🔄 刷弹幕"}</button>
          <button className={`nso-btn sm ${state.ai.autoRefresh ? "gold" : "ghost"}`} onClick={() => dispatch({ type: "SET_AI", patch: { autoRefresh: !state.ai.autoRefresh } })} title={`自动读图刷新（每${state.ai.refreshSec||25}秒）`}>{state.ai.autoRefresh ? `⏱${state.ai.refreshSec||25}s` : "⏱关"}</button>
          <button className="nso-btn sm ghost" onClick={() => setPaused(p => !p)}>{paused ? "▶" : "⏸"}</button>
          <button className="nso-btn sm ghost" onClick={goLobby}>🏠 大厅</button>
          <button className="nso-btn sm" onClick={goStudio}>⚙ 后台</button>
          <button className="nso-btn sm gold" disabled={closing} onClick={endLive}>{closing ? "下播中…" : "⏹ 下播"}</button>
        </div>
      </div>

      {/* 状态仪表 */}
      <window.MetersBar viewers={sim.viewers} peak={sim.peak} sim={state.sim} />

      {/* AI 调用失败反馈条 */}
      {aiError && (
        <div className="ai-error-bar">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>⚠️ {aiError}</div>
            {/超时|看图|vision|timeout/i.test(aiError) && (
              <div style={{ opacity: .8, marginTop: 2 }}>提示：看图模型偏慢时，可去「后台 → 🤖AI」把<b>「看图模型」留空</b>，改用配文模式（只读配文、更快更稳）。</div>
            )}
          </div>
          <button className="nso-btn sm ghost" style={{ flex: "0 0 auto" }} onClick={goStudio}>去 AI 设置</button>
          <button className="nso-btn sm" style={{ flex: "0 0 auto" }} onClick={() => setAiError(null)}>✕</button>
        </div>
      )}

      {/* 舞台 */}
      <div className={`live-stage-box ${portrait ? "portrait" : ""}`}>
        <div ref={stageRef} className="live-stage stage-scan" style={{ ...(customFrame ? {} : frame.css) }}>
          {/* 背景 */}
          <div style={{ position: "absolute", inset: 0, zIndex: 0, ...(deco.bgImage ? { backgroundImage: `url(${deco.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : bg.style) }} />
          {cur ? (
            <img src={cur.url} alt="" style={{ zIndex: 1 }} />
          ) : (
            <div className="stage-empty" style={{ zIndex: 1 }}>
              <div className="latin" style={{ fontSize: 20 }}>NO SIGNAL</div>
              <div style={{ fontSize: 20 }}>还没上传照片<br />点「⚙ 后台」上传你们的回忆吧</div>
              <button className="nso-btn" onClick={goStudio}>＋ 去上传</button>
            </div>
          )}

          {/* 贴纸 */}
          {(deco.stickers || []).map((s) => (
            <div key={s.id} className="sticker" style={{ left: `${s.x}%`, top: `${s.y}%`, fontSize: (s.scale || 1) * 38 }}>
              {s.src ? <img src={s.src} style={{ width: (s.scale || 1) * 48, imageRendering: "pixelated" }} alt="" /> : s.emoji}
            </div>
          ))}

          {/* 边框（自定义图框覆盖层）*/}
          {customFrame && <img src={customFrame.src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 7, pointerEvents: "none", imageRendering: "pixelated" }} />}

          <div className="badge-live"><span className="dot" />LIVE</div>
          <div className="badge-viewers">👀 {window.fmtNum(sim.viewers)}</div>

          {/* 刷弹幕状态提示 */}
          {aiNote && <div className="ai-note">{aiNote}</div>}

          {/* 付费留言堆叠 */}
          <div className="sc-stack">
            {supers.map(sc => <SuperChatCard key={sc.id} sc={sc} />)}
          </div>

          {/* 系统通知横幅 */}
          {sysNotes.length > 0 && (
            <div className="sys-stack">
              {sysNotes.map(s => <div key={s.id} className="sys-note">🔔 {s.text}</div>)}
            </div>
          )}

          {/* 飞行弹幕（整层 memo，隔离仪表每秒更新）*/}
          <DanmakuLayer danmaku={danmaku} stageW={stageW} onDone={removeDm} />

          {/* 主播说话气泡 */}
          {streamerSay && <div className="streamer-say"><span className="who">🎤 {state.room.streamerName}</span>{streamerSay.text}</div>}

          {/* 礼物雨 / 涨粉飘字 */}
          <window.FxLayer scRain={sim.scRain} fansToasts={sim.fansToasts} />

          {/* 随机事件卡 */}
          <window.EventCard card={sim.eventCard} onClose={sim.dismissEventCard} />

          {/* 配文 */}
          {cur && cur.caption ? <div className="caption-bar">{cur.caption}</div> : null}
        </div>

        {/* 侧边弹幕墙（NSO 同款滚动显示）— 独立面板，不挡照片 */}
        {showFeed && cur && <ChatFeed items={chatLog} portrait={portrait} />}
      </div>

      {/* 轮播指示 */}
      {photos.length > 1 && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flex: "0 0 auto", flexWrap: "wrap" }}>
          <button className="nso-btn sm ghost" onClick={() => navTo((idx - 1 + photos.length) % photos.length)}>◀</button>
          {photos.slice(0, 14).map((p, i) => <span key={p.id} className={`nav-dot ${i === idx ? "on" : ""}`} onClick={() => navTo(i)} />)}
          <button className="nso-btn sm ghost" onClick={() => navTo((idx + 1) % photos.length)}>▶</button>
        </div>
      )}

      {/* 主播麦克风 */}
      <div className="mic-bar">
        <span className="mic-tag">🎤 主播麦克风</span>
        <input
          className="nso-input"
          style={{ flex: 1, border: "none", boxShadow: "none" }}
          placeholder={`以主播「${state.room.streamerName}」的身份说点什么…`}
          value={micDraft}
          onChange={e => setMicDraft(e.target.value)}
          onKeyDown={e => e.key === "Enter" && speak()}
        />
        <button className="nso-btn" disabled={!micDraft.trim()} onClick={speak}>说</button>
        <button className="nso-btn gold" disabled={!micDraft.trim()} title="发一条付费留言（投喂）" onClick={sendSuperFromMic}>💰投喂</button>
      </div>
    </div>
  );
}

Object.assign(window, { LiveRoom });
