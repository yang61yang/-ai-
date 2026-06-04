// ============================================================
// sim.jsx — 主播模拟器内核
// 人气涨落 / 心情·压力·好感·粉丝 仪表 / 事件总线（AI 读取主播动作做反应）
// 随机事件卡（黑粉空降·上热门·冷场·榜一空降）/ 礼物雨·涨粉特效
// ============================================================
const { useState: useStateS, useRef: useRefS, useEffect: useEffectS, useCallback: useCallbackS } = React;

const simRnd = (a, b) => a + Math.random() * (b - a);
const simClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 主播动作 → 数值影响表
const EVENT_CARD_TEXT = {
  trend: "直播间突然冲上了热门，大批路人涌进来看热闹",
  hater: "一群黑粉/酸民突然涌进直播间开始阴阳怪气、找茶",
  cold: "直播间突然冷场了，弹幕安静了下来",
  raid: "榜一大哥空降，刷了一大波礼物，全场汸腾",
};

const EVENT_META = {
  golive:    { mood: 6, stress: -5 },
  offline:   { mood: 2 },
  speak:     { mood: 3, affection: 2 },
  rename:    { mood: 1 },
  upload:    { mood: 4, affection: 2, fans: 2, viewers: [10, 32] },
  switch:    { mood: 1 },
  superchat: { mood: 6, affection: 4, fans: 1, stress: -2, viewers: [4, 16] },
};

function useStreamerSim({ state, dispatch, onEvent, paused }) {
  const live = state.stream.phase === "live";
  const stateRef = useRefS(state); stateRef.current = state;
  const pausedRef = useRefS(paused); pausedRef.current = paused;

  const [viewers, setViewers] = useStateS(0);
  const viewersRef = useRefS(0);
  const targetRef = useRefS(0);
  const peakRef = useRefS(state.sim.peakViewers || 0);

  const [scRain, setScRain] = useStateS([]);       // 礼物雨
  const [fansToasts, setFansToasts] = useStateS([]); // 涨粉飘字
  const [eventCard, setEventCard] = useStateS(null); // 当前随机事件卡
  const lastEventRef = useRefS(Date.now());

  const baseViewers = useCallbackS(() => {
    const fans = stateRef.current.sim.fans || 0;
    return Math.round(40 + fans * 0.32 + simRnd(-12, 28));
  }, []);

  // 开播 / 下播 → 设定目标人气
  useEffectS(() => {
    targetRef.current = live ? baseViewers() : 0;
  }, [live, baseViewers]);

  // 人气缓动 + 自然抖动
  useEffectS(() => {
    const t = setInterval(() => {
      const tgt = targetRef.current;
      let v = viewersRef.current;
      v += (tgt - v) * 0.13;
      if (live && !pausedRef.current) v += simRnd(-3, 3.6);
      v = Math.max(0, v);
      viewersRef.current = v;
      const r = Math.round(v);
      setViewers(r);
      if (r > peakRef.current) peakRef.current = r;
      // 人气缓慢回落到底盘，避免无限膨胀
      if (live && tgt > baseViewers() * 1.04) targetRef.current += (baseViewers() - tgt) * 0.04;
    }, 850);
    return () => clearInterval(t);
  }, [live, baseViewers]);

  // ---- 特效 ----
  const pushFansToast = useCallbackS((n) => {
    if (!n) return;
    const id = window.uid("ft");
    setFansToasts(prev => [...prev, { id, n }]);
    setTimeout(() => setFansToasts(prev => prev.filter(f => f.id !== id)), 1900);
  }, []);

  const triggerSCRain = useCallbackS((count = 14) => {
    const coins = Array.from({ length: count }, () => ({
      id: window.uid("co"),
      left: simRnd(2, 93),
      delay: simRnd(0, 0.7),
      dur: simRnd(1.7, 2.9),
      sym: window.pick(["¥", "🪙", "💰", "🎁", "💝", "✨"]),
      size: Math.round(simRnd(18, 32)),
    }));
    setScRain(prev => [...prev, ...coins]);
    setTimeout(() => {
      const ids = new Set(coins.map(c => c.id));
      setScRain(prev => prev.filter(c => !ids.has(c.id)));
    }, 3400);
  }, []);

  // ---- 仪表数值 ----
  const bumpMeters = useCallbackS(({ fans = 0, mood = 0, stress = 0, affection = 0 }) => {
    const s = stateRef.current.sim;
    dispatch({ type: "BUMP_SIM", patch: {
      fans: Math.max(0, Math.round((s.fans || 0) + fans)),
      mood: simClamp(Math.round((s.mood || 0) + mood), 0, 100),
      stress: simClamp(Math.round((s.stress || 0) + stress), 0, 100),
      affection: simClamp(Math.round((s.affection || 0) + affection), 0, 100),
    } });
    if (fans > 0) pushFansToast(Math.round(fans));
  }, [dispatch, pushFansToast]);

  const bumpViewers = useCallbackS((d) => {
    const delta = Array.isArray(d) ? simRnd(d[0], d[1]) : d;
    targetRef.current = Math.max(0, targetRef.current + delta);
  }, []);

  // ---- 事件总线：主播做了什么 → 观众反应 ----
  const fireEvent = useCallbackS(async (kind, detail) => {
    const st = stateRef.current;
    const META = EVENT_META[kind] || {};
    let fans = META.fans || 0;
    if (kind === "speak" && Math.random() < 0.5) fans += 1;
    if (kind === "rename" && Math.random() < 0.4) fans += 1;
    bumpMeters({ fans, mood: META.mood || 0, stress: META.stress || 0, affection: META.affection || 0 });
    if (META.viewers) bumpViewers(META.viewers);
    if (kind === "superchat") triggerSCRain(16);

    if (kind === "offline") {
      const pk = Math.max(st.sim.peakViewers || 0, peakRef.current);
      dispatch({ type: "BUMP_SIM", patch: { peakViewers: pk } });
    }

    // 真·AI：把"刚刚发生的事"交给统一弹幕引擎，让观众围绕它实时反应
    if (onEvent) onEvent(window.describeEvent(kind, detail));
  }, [bumpMeters, bumpViewers, triggerSCRain, onEvent, dispatch]);

  // ---- 随机事件卡 ----
  const triggerEventCard = useCallbackS((card) => {
    setEventCard(card);
    bumpMeters({
      fans: Math.round(simRnd(card.dFans[0], card.dFans[1])),
      mood: card.dMood, stress: card.dStress,
    });
    bumpViewers(card.dV);
    if (card.kind === "raid") triggerSCRain(22);
    else if (card.kind === "trend") triggerSCRain(10);
    if (onEvent) onEvent(EVENT_CARD_TEXT[card.kind] || card.desc);
    setTimeout(() => setEventCard(c => (c && c.id === card.id ? null : c)), 7200);
  }, [bumpMeters, bumpViewers, triggerSCRain, onEvent]);

  const dismissEventCard = useCallbackS(() => setEventCard(null), []);

  // 自动随机事件
  useEffectS(() => {
    if (!live || paused) return;
    const tick = setInterval(() => {
      const now = Date.now();
      if (now - lastEventRef.current < 22000) return;
      const act = (stateRef.current.sim.activity || 6) / 10;
      if (Math.random() < 0.10 + act * 0.13) {
        lastEventRef.current = now;
        const card = window.EVENT_CARDS[Math.floor(Math.random() * window.EVENT_CARDS.length)];
        triggerEventCard(card);
      }
    }, 9000);
    return () => clearInterval(tick);
  }, [live, paused, triggerEventCard]);

  // 压力缓慢自愈
  useEffectS(() => {
    if (!live || paused) return;
    const t = setInterval(() => {
      const s = stateRef.current.sim;
      if ((s.stress || 0) > 0) dispatch({ type: "BUMP_SIM", patch: { stress: simClamp((s.stress || 0) - 1, 0, 100) } });
    }, 13000);
    return () => clearInterval(t);
  }, [live, paused, dispatch]);

  const peak = Math.max(peakRef.current, viewers, state.sim.peakViewers || 0);

  return { viewers, peak, scRain, fansToasts, eventCard, dismissEventCard, fireEvent, triggerEventCard, triggerSCRain };
}

// 礼物雨 + 涨粉飘字 渲染层
function FxLayer({ scRain, fansToasts }) {
  return (
    <React.Fragment>
      {scRain.length > 0 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 11, pointerEvents: "none", overflow: "hidden" }}>
          {scRain.map(c => (
            <span key={c.id} style={{
              position: "absolute", left: c.left + "%", top: "-8%", fontSize: c.size,
              animation: `nso-coinfall ${c.dur}s linear ${c.delay}s both`,
            }}>{c.sym}</span>
          ))}
        </div>
      )}
      {fansToasts.length > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 44, zIndex: 12, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {fansToasts.map(f => (
            <div key={f.id} style={{
              background: "linear-gradient(#ffe680,#ffcf4d)", color: "#7a4a00", fontWeight: 700,
              border: "2px solid #000", padding: "2px 12px", fontSize: 17, boxShadow: "2px 2px 0 rgba(0,0,0,.4)",
              animation: "nso-fanstoast 1.9s ease both",
            }}>＋{f.n} 关注 💗</div>
          ))}
        </div>
      )}
    </React.Fragment>
  );
}

// 随机事件卡
function EventCard({ card, onClose }) {
  if (!card) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 13, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{
        pointerEvents: "auto", maxWidth: "82%", textAlign: "center",
        background: "var(--window-bg)", border: `4px solid ${card.color}`,
        boxShadow: `0 0 0 3px #000, 0 0 26px ${card.color}, 8px 8px 0 rgba(0,0,0,.5)`,
        padding: "16px 20px", animation: "nso-evcard .35s cubic-bezier(.2,1.4,.4,1) both",
      }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: card.color, marginBottom: 6 }}>{card.title}</div>
        <div style={{ fontSize: 16, fontFamily: "'Noto Sans SC',sans-serif", lineHeight: 1.5, opacity: .92 }}>{card.desc}</div>
        <button className="nso-btn sm" style={{ marginTop: 12 }} onClick={onClose}>知道啦</button>
      </div>
    </div>
  );
}

function fmtNum(n) {
  if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "万";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}

// 仪表条：人气 / 粉丝 / 心情 / 压力 / 好感
function MetersBar({ viewers, peak, sim }) {
  const Meter = ({ label, v, color }) => (
    <div style={{ flex: "1 1 86px", minWidth: 78 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: .85, marginBottom: 2 }}><span>{label}</span><span>{Math.round(v)}</span></div>
      <div style={{ height: 9, background: "var(--bg-2)", border: "2px solid #000" }}>
        <div style={{ width: simClamp(v, 0, 100) + "%", height: "100%", background: color, transition: "width .5s ease" }} />
      </div>
    </div>
  );
  const Stat = ({ icon, label, value, sub, color }) => (
    <div style={{ flex: "0 0 auto", minWidth: 66 }}>
      <div style={{ fontSize: 12, opacity: .85 }}>{icon} {label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: color || "var(--window-text)", lineHeight: 1.05 }}>{fmtNum(value)}</div>
      {sub ? <div style={{ fontSize: 11, opacity: .55 }}>{sub}</div> : null}
    </div>
  );
  return (
    <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      background: "var(--window-bg)", border: "3px solid #000", boxShadow: "inset 0 0 0 2px var(--secondary)", padding: "7px 12px" }}>
      <Stat icon="👀" label="人气" value={viewers} sub={`峰值 ${fmtNum(peak)}`} color="#7ec8ff" />
      <Stat icon="💗" label="粉丝" value={sim.fans || 0} color="#ee5ec0" />
      <Meter label="心情" v={sim.mood || 0} color="#9bffb0" />
      <Meter label="压力" v={sim.stress || 0} color="#ff6e8e" />
      <Meter label="好感" v={sim.affection || 0} color="#ffcf4d" />
    </div>
  );
}

Object.assign(window, { useStreamerSim, FxLayer, EventCard, MetersBar, fmtNum });