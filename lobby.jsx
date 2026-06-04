// ============================================================
// lobby.jsx — 直播大厅
// 逛别人的直播间（NPC 主播），再进入「我的直播间」开播
// 云端看好友真·开播需要服务器，单文件做不到；这里用鲜活的 NPC 房间 + 可接入好友存档
// ============================================================
const { useState: useStateL, useRef: useRefL, useEffect: useEffectL, useCallback: useCallbackL } = React;

function fmtViewers(n) {
  if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "万";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(n));
}

// 逛某个 NPC 直播间
function NpcRoom({ npc, onBack }) {
  const [dm, setDm] = useStateL([]);
  const [draft, setDraft] = useStateL("");
  const [liveViewers, setLiveViewers] = useStateL(npc.viewers);
  const boxRef = useRefL(null);
  const [w, setW] = useStateL(600);
  const trackRef = useRefL(0);

  useEffectL(() => {
    const measure = () => { if (boxRef.current) setW(boxRef.current.getBoundingClientRect().width); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const fly = useCallbackL((text, color, name) => {
    const id = window.uid("ndm");
    const top = 10 + (trackRef.current % 7) * 38; trackRef.current++;
    setDm(prev => [...prev.slice(-36), { id, text, color, top, name }]);
    setTimeout(() => setDm(prev => prev.filter(d => d.id !== id)), 9000);
  }, []);

  useEffectL(() => {
    npc.pool.slice(0, 5).forEach((t, i) => setTimeout(() => { const v = window.randomViewer(); fly(t, v.color, v.name); }, i * 380));
    const t = setInterval(() => { const v = window.randomViewer(); fly(window.pick(npc.pool), v.color, v.name); }, 1100);
    const vt = setInterval(() => setLiveViewers(n => Math.max(0, Math.round(n + (Math.random() - 0.45) * Math.max(8, npc.viewers * 0.01)))), 1500);
    return () => { clearInterval(t); clearInterval(vt); };
  }, [npc, fly]);

  function send() { const t = draft.trim(); if (!t) return; fly(t, "#fff", "我"); setDraft(""); }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "calc(8px + var(--safe-top)) 8px calc(8px + var(--safe-bottom))", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button className="nso-btn sm" onClick={onBack}>◀ 返回大厅</button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{npc.name}</div>
          <div style={{ fontSize: 13, opacity: .7 }}>主播 {npc.streamer} · {npc.tag}</div>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 14, background: "rgba(0,0,0,.5)", border: "2px solid var(--secondary)", padding: "3px 9px" }}>👀 {fmtViewers(liveViewers)}</span>
      </div>

      <div ref={boxRef} className="stage-scan" style={{ position: "relative", flex: "1 1 auto", minHeight: 0, overflow: "hidden", border: `5px solid ${npc.color}`, boxShadow: "inset 0 0 0 3px #000" }}>
        <div style={{ position: "absolute", inset: 0, ...npc.bg }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <div style={{ fontSize: "clamp(60px,16vw,120px)", filter: "drop-shadow(3px 3px 0 rgba(0,0,0,.4))" }}>{npc.icon}</div>
          <div style={{ background: "rgba(0,0,0,.45)", color: "#fff", padding: "4px 12px", fontSize: 15, fontFamily: "'Noto Sans SC',sans-serif", maxWidth: "80%", textAlign: "center" }}>{npc.vibe}</div>
        </div>
        <div className="badge-live" style={{ position: "absolute", top: 8, left: 8 }}><span className="dot" />LIVE</div>
        {dm.map(d => {
          const dur = Math.max(6, Math.min(15, w / 120 + d.text.length * 0.28));
          return (
            <div key={d.id} style={{
              position: "absolute", top: d.top, left: 0, whiteSpace: "nowrap", fontWeight: 700, fontSize: 21,
              color: d.color, textShadow: "2px 2px 0 rgba(0,0,0,.85)", pointerEvents: "none",
              "--dm-from": w + "px", animation: `nso-dm-fly ${dur}s linear forwards`,
            }}>
              {d.name ? <span style={{ opacity: .9, fontSize: "0.78em", marginRight: 6, padding: "0 5px", background: "rgba(0,0,0,.4)" }}>{d.name}</span> : null}{d.text}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        <input className="nso-input" style={{ flex: 1 }} placeholder={`在「${npc.streamer}」的直播间发条弹幕…`} value={draft}
          onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} />
        <button className="nso-btn" disabled={!draft.trim()} onClick={send}>发送</button>
      </div>
    </div>
  );
}

function MyRoomCard({ state, onEnter, portrait }) {
  const myLive = state.stream.phase === "live";
  const cover = state.stream.cover || (state.photos[0] && state.photos[0].url) || null;
  const bg = (window.BACKGROUNDS.find(b => b.id === state.deco.pageBg) || window.BACKGROUNDS[0]).style;
  return (
    <div className="nso-border" style={{ marginBottom: 16, cursor: "pointer" }} onClick={onEnter}>
      <div className="nso-header"><span>★ 我的直播间</span><span style={{ fontSize: 14 }}>{myLive ? "🔴 直播中" : "未开播"}</span></div>
      <div style={{ display: "flex", gap: 12, padding: 12, alignItems: "center", flexDirection: portrait ? "column" : "row" }}>
        <div style={{ position: "relative", width: portrait ? "100%" : 220, aspectRatio: "16/9", flex: "0 0 auto", overflow: "hidden", border: "3px solid #000" }}>
          <div style={{ position: "absolute", inset: 0, ...bg }} />
          {cover ? <img src={cover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 54 }}>📸</div>}
          {myLive && <div className="badge-live" style={{ position: "absolute", top: 6, left: 6 }}><span className="dot" />LIVE</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{state.stream.title || state.room.name}</div>
          <div style={{ fontSize: 14, opacity: .75, marginBottom: 10, fontFamily: "'Noto Sans SC',sans-serif" }}>
            主播 {state.room.streamerName} · 房间号 {state.room.number} · 💗 {fmtViewers(state.sim.fans || 0)} 粉丝 · {state.photos.length} 张回忆
          </div>
          <button className="nso-btn gold" onClick={(e) => { e.stopPropagation(); onEnter(); }}>{myLive ? "▶ 进入直播间" : "🔴 去开播"}</button>
        </div>
      </div>
    </div>
  );
}

function Lobby({ state, dispatch, enterMyRoom, goStudio, portrait }) {
  const [browse, setBrowse] = useStateL(null);
  const me = state.profiles.find(p => p.id === state.currentProfileId) || state.profiles[0];

  if (browse) return <NpcRoom npc={browse} onBack={() => setBrowse(null)} />;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "calc(8px + var(--safe-top)) 0 var(--safe-bottom)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 12px 10px", flex: "0 0 auto" }}>
        <span className="latin" style={{ fontSize: 20, color: "var(--primary)" }}>LIVE HALL</span>
        <div style={{ fontSize: 22, fontWeight: 700 }}>直播大厅</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, opacity: .8 }}>
            <span style={{ width: 26, height: 26, borderRadius: "50%", background: me?.color, border: "2px solid #000", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#1e1531", fontWeight: 700, fontSize: 13 }}>{(me?.name || "?").slice(0, 1)}</span>
            {me?.name}
          </span>
          <button className="nso-btn sm" onClick={goStudio}>⚙ 后台</button>
        </div>
      </div>

      <div className="nso-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 12px 24px" }}>
        <MyRoomCard state={state} onEnter={enterMyRoom} portrait={portrait} />

        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 12px" }}>
          <span style={{ width: 9, height: 9, background: "var(--live)", borderRadius: "50%", animation: "nso-pulse 1s infinite" }} />
          <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>正在直播 · 逛逛别人</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: portrait ? "1fr 1fr" : "repeat(auto-fill,minmax(190px,1fr))", gap: 12 }}>
          {window.NPC_STREAMERS.map(npc => (
            <div key={npc.id} className="nso-border-sm" style={{ cursor: "pointer", overflow: "hidden" }} onClick={() => setBrowse(npc)}>
              <div style={{ position: "relative", aspectRatio: "16/10", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, ...npc.bg }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 46, filter: "drop-shadow(2px 2px 0 rgba(0,0,0,.4))" }}>{npc.icon}</div>
                <div className="badge-live" style={{ position: "absolute", top: 6, left: 6, fontSize: 12, padding: "2px 6px" }}><span className="dot" />LIVE</div>
                <span style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 12, padding: "1px 7px", border: "1px solid var(--secondary)" }}>👀 {fmtViewers(npc.viewers)}</span>
              </div>
              <div style={{ padding: "6px 8px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{npc.name}</div>
                <div style={{ fontSize: 12, opacity: .7, marginTop: 2 }}>{npc.streamer} · <span style={{ color: npc.color }}>{npc.tag}</span></div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 18, padding: "10px 12px", border: "2px dashed var(--secondary)", fontSize: 13, opacity: .7, fontFamily: "'Noto Sans SC',sans-serif", lineHeight: 1.6 }}>
          ☁️ 云端联机·看好友真·开播 需要服务器，单个分享文件暂时做不到。<br />
          现在可以：在「⚙ 后台 → 存档」<b>导入好友的存档</b>，把 ta 的放送当成一个房间来逛。
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Lobby, NpcRoom });
