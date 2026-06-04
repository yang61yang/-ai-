// ============================================================
// studio.jsx — 后台编辑器（标签页）
// 照片胶卷 / 配弹幕 / 装扮DIY / 房间&身份 / AI酒馆 / 历史&存档
// ============================================================

function readFilesAsDataURL(files) {
  return Promise.all(Array.from(files).map(file => new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve({ url: r.result, name: file.name });
    r.readAsDataURL(file);
  })));
}

function Section({ title, children, right }) {
  return (
    <div className="nso-border" style={{ marginBottom: 14 }}>
      <div className="nso-header"><span>{title}</span>{right}</div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

// ---------------- 标签：照片 ----------------
function TabPhotos({ state, dispatch }) {
  const fileRef = useRef(null);
  const sel = state.photos.find(p => p.id === state.selectedPhotoId) || null;
  const [previewing, setPreviewing] = useState(false);
  const [capLoading, setCapLoading] = useState(false);
  const [preview, setPreview] = useState(null);   // {viewers, items} 只读预览
  const [aiErr, setAiErr] = useState("");

  async function onUpload(e) {
    const items = await readFilesAsDataURL(e.target.files || []);
    const photos = items.map(it => ({ id: window.uid("ph"), url: it.url, caption: "", danmaku: [] }));
    dispatch({ type: "ADD_PHOTOS", photos });
    e.target.value = "";
  }
  // 试刷：让 AI 看这张图、生成一批弹幕（只读预览，不入库），同时验证看图是否真的通
  async function doPreview() {
    if (!sel) return;
    setPreviewing(true); setAiErr(""); setPreview(null);
    try {
      const res = await window.aiDanmakuBatch(state.ai.api, {
        room: state.room, context: state.ai.context, caption: sel.caption,
        recent: [], viewers: state.sim.fans || 1000, n: 12, image: sel.url,
      });
      if (!res.items.length) throw new Error("AI 返回为空（检查模型 / 额度）");
      setPreview(res);
    } catch (err) {
      setAiErr("预览失败：" + String(err.message || err).slice(0, 180));
    } finally { setPreviewing(false); }
  }
  // 让 AI 看图给这张照片建议一句配文
  async function suggestCaption() {
    if (!sel) return;
    setCapLoading(true); setAiErr("");
    try {
      const c = await window.aiSuggestCaption(state.ai.api, { image: sel.url, context: state.ai.context });
      if (!c) throw new Error("AI 没给出配文");
      dispatch({ type: "SET_CAPTION", id: sel.id, caption: c });
    } catch (err) {
      setAiErr("AI 配文失败：" + String(err.message || err).slice(0, 180));
    } finally { setCapLoading(false); }
  }

  return (
    <div>
      <Section title="① 照片胶卷" right={<span style={{ fontSize: 14, whiteSpace: "nowrap" }}>{state.photos.length} 张</span>}>
        <button className="nso-btn" onClick={() => fileRef.current?.click()}>＋ 上传照片</button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onUpload} />
        <div className="nso-scroll" style={{ display: "flex", gap: 8, marginTop: 12, overflowX: "auto", paddingBottom: 6 }}>
          {state.photos.length === 0 && <span style={{ opacity: .6, fontSize: 16 }}>（还没有照片，点上面上传）</span>}
          {state.photos.map(p => (
            <div key={p.id} onClick={() => { dispatch({ type: "SELECT_PHOTO", id: p.id }); setPreview(null); setAiErr(""); }}
              style={{ position: "relative", width: 72, height: 72, flex: "0 0 auto", border: p.id === state.selectedPhotoId ? "3px solid var(--primary)" : "3px solid #000", cursor: "pointer", boxShadow: p.id === state.selectedPhotoId ? "0 0 0 2px var(--primary)" : "none" }}>
              <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {p.caption ? <span style={{ position: "absolute", bottom: 0, left: 0, background: "rgba(0,0,0,.7)", color: "#fff", fontSize: 11, padding: "0 4px" }}>✎</span> : null}
              <span onClick={(e) => { e.stopPropagation(); dispatch({ type: "REMOVE_PHOTO", id: p.id }); }}
                style={{ position: "absolute", top: 0, right: 0, background: "#000", color: "#fff", width: 20, height: 20, fontSize: 13, lineHeight: "20px", textAlign: "center" }}>×</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="② 配文 & AI 弹幕预览" right={sel ? <span style={{ fontSize: 13, opacity: .65 }}>选中第 {state.photos.indexOf(sel) + 1} 张</span> : null}>
        {!sel ? <div style={{ opacity: .6, fontSize: 16 }}>先选中一张照片~</div> : (
          <>
            <div style={{ fontSize: 13, opacity: .65, marginBottom: 10, fontFamily: "'Noto Sans SC',sans-serif", lineHeight: 1.55 }}>
              直播间的弹幕现在 <b>全部由 AI 实时生成</b>，不再用预存弹幕。这里负责两件事：给每张图写好<b>配文</b>（AI 看图的重要线索），并随时<b>试刷</b>看看这张图会刷出什么弹幕。
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 14, opacity: .7, marginBottom: 4, fontFamily: "'Noto Sans SC',sans-serif" }}>配文（显示在照片下方，也帮 AI 理解画面）</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="nso-input" style={{ flex: 1 }} placeholder="例如：2016 第一次一起看海"
                  value={sel.caption} onChange={e => dispatch({ type: "SET_CAPTION", id: sel.id, caption: e.target.value })} />
                <button className="nso-btn ai" disabled={capLoading} onClick={suggestCaption} title="让 AI 看图建议一句配文">{capLoading ? "看图中…" : "✨配文"}</button>
              </div>
            </div>
            <button className="nso-btn" disabled={previewing} onClick={doPreview} style={{ marginBottom: 10 }}>
              {previewing ? "🤖 AI 正在看这张图…" : "🔮 试刷这张图的弹幕（预览）"}
            </button>
            {aiErr && <div style={{ fontSize: 13, color: "#ff9b6e", marginBottom: 8, fontFamily: "'Noto Sans SC',sans-serif", lineHeight: 1.45, border: "2px solid #ff9b6e", padding: "6px 8px" }}>⚠️ {aiErr}</div>}
            {preview && (
              <div style={{ border: "2px solid var(--secondary)", padding: 8 }}>
                <div style={{ fontSize: 13, opacity: .7, marginBottom: 6, fontFamily: "'Noto Sans SC',sans-serif" }}>👀 观看人数：{preview.viewers || "—"} · 共 {preview.items.length} 条（仅预览，不保存）</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {preview.items.map((it, i) => it.kind === "system" ? (
                    <div key={i} style={{ fontSize: 13, fontWeight: 700, color: "#5a3a00", background: "linear-gradient(#fff0c2,#ffd24d)", border: "2px solid #000", padding: "2px 7px", fontFamily: "'Noto Sans SC',sans-serif" }}>🔔 {it.text}</div>
                  ) : it.kind === "super" ? (
                    <div key={i} style={{ fontSize: 14, color: "#3a2a00", background: "#fff7e0", border: "2px solid #ffcf4d", padding: "3px 7px", fontFamily: "'Noto Sans SC',sans-serif" }}><b>{it.currency || "¥"}{it.amount} · {it.name}</b>：{it.text}</div>
                  ) : (
                    <div key={i} style={{ fontSize: 15, fontFamily: "'Noto Sans SC',sans-serif", wordBreak: "break-word" }}><b style={{ color: "var(--primary)", fontSize: 13 }}>{it.name}：</b>{it.text}</div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Section>
    </div>
  );
}

// ---------------- 标签：装扮 ----------------
function TabDeco({ state, dispatch }) {
  const deco = state.deco;
  const bgRef = useRef(null), frameRef = useRef(null), stRef = useRef(null), pageBgRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const sel = state.photos.find(p => p.id === state.selectedPhotoId) || state.photos[0] || null;

  async function uploadBg(e) {
    const [it] = await readFilesAsDataURL(e.target.files || []); if (!it) return;
    dispatch({ type: "SET_DECO", patch: { bgImage: it.url } }); e.target.value = "";
  }
  async function uploadPageBg(e) {
    const [it] = await readFilesAsDataURL(e.target.files || []); if (!it) return;
    dispatch({ type: "SET_DECO", patch: { pageBgImage: it.url } }); e.target.value = "";
  }
  async function uploadFrame(e) {
    const [it] = await readFilesAsDataURL(e.target.files || []); if (!it) return;
    const f = { id: window.uid("cf"), name: it.name.slice(0, 8) || "自定义框", src: it.url };
    dispatch({ type: "ADD_CUSTOM_FRAME", frame: f }); dispatch({ type: "SET_DECO", patch: { frame: f.id } }); e.target.value = "";
  }
  async function uploadSticker(e) {
    const items = await readFilesAsDataURL(e.target.files || []);
    items.forEach(it => dispatch({ type: "ADD_CUSTOM_STICKER", sticker: { id: window.uid("cs"), src: it.url } }));
    e.target.value = "";
  }
  function addSticker(s) {
    dispatch({ type: "ADD_STICKER", sticker: { id: window.uid("st"), src: s.src, x: 40, y: 40, scale: 1 } });
  }
  function onPointerDown(e, st) {
    e.preventDefault();
    dragRef.current = { id: st.id, rect: stageRef.current.getBoundingClientRect() };
  }
  function onPointerMove(e) {
    const d = dragRef.current; if (!d) return;
    const r = d.rect;
    const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    dispatch({ type: "UPDATE_STICKER", id: d.id, patch: { x, y } });
  }
  function onPointerUp() { dragRef.current = null; }

  const allFrames = [...window.FRAMES, ...(deco.customFrames || [])];
  const allStickers = [...window.STICKERS, ...(deco.customStickers || [])];
  const bg = window.BACKGROUNDS.find(b => b.id === deco.background) || window.BACKGROUNDS[0];
  const customFrame = (deco.customFrames || []).find(f => f.id === deco.frame);
  const frame = window.FRAMES.find(f => f.id === deco.frame) || window.FRAMES[0];

  return (
    <div>
      <Section title="✦ 一键主题（背景+边框+字体一起换）">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {window.THEMES.map(t => (
            <button key={t.id} onClick={() => dispatch({ type: "APPLY_THEME", theme: t })}
              className={`nso-btn sm ${deco.theme === t.id ? "" : "ghost"}`}
              style={{ borderColor: t.primary, boxShadow: deco.theme === t.id ? `3px 3px 0 ${t.secondary}` : undefined }}>
              <span style={{ display: "inline-block", width: 10, height: 10, background: t.primary, marginRight: 6, border: "1px solid #000" }} />{t.name}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 13, opacity: .6, marginTop: 8, fontFamily: "'Noto Sans SC',sans-serif" }}>选主题后，下面还能单独再微调边框/背景/字体。</div>
      </Section>

      <Section title="✦ 装扮预览（拖动贴纸摆位置）">
        <div ref={stageRef} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          style={{ position: "relative", width: "100%", aspectRatio: "16/9", overflow: "hidden", touchAction: "none", ...(customFrame ? { border: "3px solid #000" } : frame.css) }}>
          <div style={{ position: "absolute", inset: 0, ...(deco.bgImage ? { backgroundImage: `url(${deco.bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : bg.style) }} />
          {sel ? <img src={sel.url} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} /> :
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>上传照片后预览</div>}
          {(deco.stickers || []).map(s => (
            <div key={s.id} onPointerDown={(e) => onPointerDown(e, s)}
              style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, fontSize: (s.scale || 1) * 34, cursor: "grab", touchAction: "none", zIndex: 5, filter: "drop-shadow(2px 2px 0 rgba(0,0,0,.4))" }}>
              {s.src ? <img src={s.src} style={{ width: (s.scale || 1) * 44, imageRendering: "pixelated", pointerEvents: "none" }} alt="" /> : s.emoji}
            </div>
          ))}
          {customFrame && <img src={customFrame.src} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 6, pointerEvents: "none" }} />}
        </div>
        {/* 已放置贴纸的缩放/删除 */}
        {(deco.stickers || []).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {deco.stickers.map(s => (
              <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "2px solid var(--secondary)", padding: "2px 6px" }}>
                <span style={{ fontSize: 18, width: 22, height: 22, display: "inline-flex" }}>{s.src ? <img src={s.src} style={{ width: 22, height: 22, objectFit: "contain", imageRendering: "pixelated" }} alt="" /> : null}</span>
                <button className="nso-btn sm" onClick={() => dispatch({ type: "UPDATE_STICKER", id: s.id, patch: { scale: Math.max(0.4, (s.scale || 1) - 0.2) } })}>－</button>
                <button className="nso-btn sm" onClick={() => dispatch({ type: "UPDATE_STICKER", id: s.id, patch: { scale: Math.min(3, (s.scale || 1) + 0.2) } })}>＋</button>
                <button className="nso-btn sm ghost" onClick={() => dispatch({ type: "REMOVE_STICKER", id: s.id })}>×</button>
              </span>
            ))}
          </div>
        )}
      </Section>

      <Section title="① 直播间边框" right={<button className="nso-btn sm ghost" onClick={() => frameRef.current?.click()}>＋上传框</button>}>
        <input ref={frameRef} type="file" accept="image/*" hidden onChange={uploadFrame} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allFrames.map(f => (
            <button key={f.id} onClick={() => dispatch({ type: "SET_DECO", patch: { frame: f.id } })}
              className={`nso-btn sm ${deco.frame === f.id ? "" : "ghost"}`}>{f.name}</button>
          ))}
        </div>
      </Section>

      <Section title="② 背景" right={<span style={{ display: "flex", gap: 6 }}>
        <button className="nso-btn sm ghost" onClick={() => bgRef.current?.click()}>＋上传背景</button>
        {deco.bgImage && <button className="nso-btn sm ghost" onClick={() => dispatch({ type: "SET_DECO", patch: { bgImage: null } })}>清除</button>}
      </span>}>
        <input ref={bgRef} type="file" accept="image/*" hidden onChange={uploadBg} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {window.BACKGROUNDS.map(b => (
            <button key={b.id} onClick={() => dispatch({ type: "SET_DECO", patch: { background: b.id, bgImage: null } })}
              className={`nso-btn sm ${deco.background === b.id && !deco.bgImage ? "" : "ghost"}`}>{b.name}</button>
          ))}
        </div>
      </Section>

      <Section title="③ 字体">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {window.FONTS.map(f => (
            <button key={f.id} onClick={() => dispatch({ type: "SET_DECO", patch: { font: f.id } })}
              className={`nso-btn sm ${deco.font === f.id ? "" : "ghost"}`} style={{ fontFamily: f.css }}>{f.name}</button>
          ))}
        </div>
      </Section>

      <Section title="④ 整个网页背景" right={<span style={{ display: "flex", gap: 6 }}>
        <button className="nso-btn sm ghost" onClick={() => pageBgRef.current?.click()}>＋传图</button>
        {deco.pageBgImage && <button className="nso-btn sm ghost" onClick={() => dispatch({ type: "SET_DECO", patch: { pageBgImage: null } })}>清除</button>}
      </span>}>
        <div style={{ fontSize: 13, opacity: .6, marginBottom: 8, fontFamily: "'Noto Sans SC',sans-serif" }}>这是直播间外面、整个网页的背景（不是舞台的背景）。</div>
        <input ref={pageBgRef} type="file" accept="image/*" hidden onChange={uploadPageBg} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {window.BACKGROUNDS.map(b => (
            <button key={b.id} onClick={() => dispatch({ type: "SET_DECO", patch: { pageBg: b.id, pageBgImage: null } })}
              className={`nso-btn sm ${deco.pageBg === b.id && !deco.pageBgImage ? "" : "ghost"}`}>{b.name}</button>
          ))}
        </div>
      </Section>

      <Section title="④ 像素贴纸（点一下加到画面，再拖动摆位）" right={<button className="nso-btn sm ghost" onClick={() => stRef.current?.click()}>＋上传贴纸</button>}>
        <input ref={stRef} type="file" accept="image/*" multiple hidden onChange={uploadSticker} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allStickers.map(s => (
            <button key={s.id} onClick={() => addSticker(s)} className="nso-btn sm ghost" style={{ padding: "5px 7px" }} title={s.name || ""}>
              <img src={s.src} style={{ width: 28, height: 28, objectFit: "contain", imageRendering: "pixelated", display: "block" }} alt="" />
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ---------------- 标签：房间 & 身份 ----------------
function TabRoom({ state, dispatch }) {
  const [name, setName] = useState("");
  return (
    <div>
      <Section title="直播间设置">
        <Row label="直播间名称"><input className="nso-input" style={{ width: "100%" }} value={state.room.name} onChange={e => dispatch({ type: "SET_ROOM", patch: { name: e.target.value } })} /></Row>
        <Row label="房间号"><input className="nso-input" style={{ width: "100%" }} value={state.room.number} onChange={e => dispatch({ type: "SET_ROOM", patch: { number: e.target.value } })} /></Row>
        <Row label="主播昵称"><input className="nso-input" style={{ width: "100%" }} value={state.room.streamerName} onChange={e => dispatch({ type: "SET_ROOM", patch: { streamerName: e.target.value } })} /></Row>
      </Section>

      <Section title="身份 / 好友（每人固定昵称+房间号）" right={
        <div style={{ display: "flex", gap: 6 }}>
          <input className="nso-input" style={{ width: 90, fontSize: 15, padding: "4px 6px" }} placeholder="新昵称" value={name} onChange={e => setName(e.target.value)} />
          <button className="nso-btn sm" onClick={() => { if (!name.trim()) return; const c = window.AVATAR_COLORS[state.profiles.length % window.AVATAR_COLORS.length]; dispatch({ type: "ADD_PROFILE", profile: { id: window.uid("u"), name: name.trim(), roomNo: String(100010 + state.profiles.length), color: c } }); setName(""); }}>＋加好友</button>
        </div>}>
        <div style={{ fontSize: 13, opacity: .65, marginBottom: 10, fontFamily: "'Noto Sans SC',sans-serif", lineHeight: 1.5 }}>
          当前身份决定你发的弹幕署名。把存档文件发给朋友，朋友切到自己的身份发弹幕、再导出回传，就能"接力"共创。
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {state.profiles.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, border: p.id === state.currentProfileId ? "2px solid var(--primary)" : "2px solid var(--secondary)", padding: "6px 8px" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: p.color, border: "2px solid #000", flex: "0 0 auto" }} />
              <input className="nso-input" style={{ width: 110, fontSize: 16, padding: "4px 6px" }} value={p.name} onChange={e => dispatch({ type: "UPDATE_PROFILE", id: p.id, patch: { name: e.target.value } })} />
              <span style={{ fontSize: 14, opacity: .7 }}>房 {p.roomNo}</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                {p.id === state.currentProfileId ? <span className="nso-btn sm gold" style={{ cursor: "default" }}>当前</span> :
                  <button className="nso-btn sm ghost" onClick={() => dispatch({ type: "SET_CURRENT_PROFILE", id: p.id })}>切换</button>}
                {!p.isMe && <button className="nso-btn sm ghost" onClick={() => dispatch({ type: "REMOVE_PROFILE", id: p.id })}>×</button>}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 14, opacity: .7, marginBottom: 4, fontFamily: "'Noto Sans SC',sans-serif" }}>{label}</div>
      {children}
    </div>
  );
}

// ---------------- 标签：AI 酒馆 ----------------
function TabAI({ state, dispatch }) {
  const ai = state.ai;
  const [testing, setTesting] = useState(false);
  const [testOut, setTestOut] = useState(null);   // {ok, text}
  const [saved, setSaved] = useState(false);
  const [models, setModels] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [modelMsg, setModelMsg] = useState(null); // {ok, text}

  async function test() {
    setTesting(true); setTestOut(null);
    const custom = window.hasCustomAPI(ai.api);
    try {
      let prefix = "";
      if (custom) {
        try { const list = await window.fetchModels(ai.api); prefix = `接口可达（${list.length} 个模型）、`; }
        catch (e) { /* 部分中转不支持 /models，忽略 */ }
      }
      const r = await window.aiDanmakuBatch(ai.api, { room: state.room, context: ai.context, caption: "一起吃饭的合影", recent: [], viewers: 1000, n: 4 });
      if (r.items.length) {
        const sample = r.items.filter(i => i.text).slice(0, 3).map(i => i.text).join(" / ");
        setTestOut({ ok: true, text: (custom ? `✅ 连接成功！${prefix}` : "✅ 内置 AI 可用（仅本预览环境；导出分享文件后需自己填 API）。") + "AI 刷出：" + sample });
      } else {
        setTestOut({ ok: false, text: "⚠️ 接口通了但返回为空，换个模型再试试。" });
      }
    } catch (e) {
      setTestOut({ ok: false, text: "❌ 连接失败：" + String((e && e.message) || e).slice(0, 200) });
    } finally { setTesting(false); }
  }
  function saveAPI() {
    dispatch({ type: "SET_AI", patch: { api: { ...ai.api } } });   // 状态会自动写入本机，这里给个明确确认
    setSaved(true); setTimeout(() => setSaved(false), 2400);
  }
  async function pull() {
    setFetching(true); setModelMsg(null);
    try {
      const list = await window.fetchModels(ai.api);
      setModels(list);
      setModelMsg({ ok: true, text: `✅ 已连接 · 拉到 ${list.length} 个模型，点下面任意一个即可选用` });
    } catch (e) {
      setModels([]);
      setModelMsg({ ok: false, text: "❌ 拉取失败：" + String(e.message || e).slice(0, 140) });
    } finally { setFetching(false); }
  }
  function setAPI(patch) { dispatch({ type: "SET_AI", patch: { api: { ...ai.api, ...patch } } }); }

  return (
    <div>
      <Section title="AI 总开关">
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer", fontSize: 17 }}>
          <input type="checkbox" checked={ai.enabled} onChange={e => dispatch({ type: "SET_AI", patch: { enabled: e.target.checked } })} style={{ width: 18, height: 18 }} /> 启用 AI
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer", fontSize: 17 }}>
          <input type="checkbox" checked={ai.autoAudience} onChange={e => dispatch({ type: "SET_AI", patch: { autoAudience: e.target.checked } })} style={{ width: 18, height: 18 }} /> 路人观众自动闲聊刷弹幕
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 17, flexWrap: "wrap" }}>
          <input type="checkbox" checked={ai.autoRefresh} onChange={e => dispatch({ type: "SET_AI", patch: { autoRefresh: e.target.checked } })} style={{ width: 18, height: 18 }} /> 定时读图刷新弹幕
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, opacity: ai.autoRefresh ? 1 : .5 }}>
            每
            <input type="range" min="8" max="90" step="1" value={ai.refreshSec} disabled={!ai.autoRefresh}
              onChange={e => dispatch({ type: "SET_AI", patch: { refreshSec: parseInt(e.target.value) } })} style={{ width: 120 }} />
            {ai.refreshSec}秒
          </span>
        </label>
        <div style={{ fontSize: 12, opacity: .6, marginTop: 6, fontFamily: "'Noto Sans SC',sans-serif", lineHeight: 1.5 }}>
          「定时读图刷新」会每隔几秒让 AI 重新看当前照片、生成一批贴合画面的新弹幕（直播间右上角也有 🔄 手动刷 / ⏱ 开关）。开启越频繁越费 token。
        </div>
      </Section>

      <Section title="① 世界观 / 总预设（喂给所有 AI 观众）">
        <textarea className="nso-textarea" style={{ width: "100%", minHeight: 80 }} value={ai.context}
          onChange={e => dispatch({ type: "SET_AI", patch: { context: e.target.value } })}
          placeholder="描述你们的关系、调性、梗、希望 AI 怎么互动…" />
      </Section>

      <Section title="② AI 观众人设（类酒馆，可增删改）" right={
        <button className="nso-btn sm" onClick={() => dispatch({ type: "ADD_PERSONA", persona: { id: window.uid("p"), name: "新观众", color: window.AVATAR_COLORS[(ai.personas.length + 1) % window.AVATAR_COLORS.length], paidChance: 0.06, prompt: "" } })}>＋新人设</button>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ai.personas.map(p => (
            <div key={p.id} style={{ border: "2px solid var(--secondary)", padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <input type="color" value={p.color} onChange={e => dispatch({ type: "SET_PERSONA", id: p.id, patch: { color: e.target.value } })} style={{ width: 32, height: 28, border: "2px solid #000", background: "none", padding: 0 }} />
                <input className="nso-input" style={{ flex: 1, fontSize: 16, padding: "4px 6px" }} value={p.name} onChange={e => dispatch({ type: "SET_PERSONA", id: p.id, patch: { name: e.target.value } })} />
                <button className="nso-btn sm ghost" onClick={() => dispatch({ type: "REMOVE_PERSONA", id: p.id })}>删</button>
              </div>
              <textarea className="nso-textarea" style={{ width: "100%", minHeight: 56 }} value={p.prompt}
                onChange={e => dispatch({ type: "SET_PERSONA", id: p.id, patch: { prompt: e.target.value } })}
                placeholder="这个观众的性格、说话风格、口癖…" />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 14, fontFamily: "'Noto Sans SC',sans-serif" }}>
                <span>发付费留言概率</span>
                <input type="range" min="0" max="0.5" step="0.01" value={p.paidChance} onChange={e => dispatch({ type: "SET_PERSONA", id: p.id, patch: { paidChance: parseFloat(e.target.value) } })} style={{ flex: 1 }} />
                <span>{Math.round((p.paidChance || 0) * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="③ API 设置（填了才能真·看图 / 导出后也能用）">
        <div style={{ fontSize: 13, opacity: .7, marginBottom: 10, fontFamily: "'Noto Sans SC',sans-serif", lineHeight: 1.55 }}>
          支持 OpenAI 兼容接口（OpenAI / 各类中转 / 本地）。弹幕<b>全部由 AI 实时生成</b>，所以必须填好接口；Key 只存在本地/存档里。<br />
          ⚡ <b>选快模型</b>：弹幕要的是「快」。出图/推理类模型（如 <code>*-image-preview</code>、各种 pro/思考模型）单次可能要 1-2 分钟，弹幕会很卡。建议「文本模型」用 <b>flash / mini / turbo</b> 这类快模型；「看图模型」也尽量选快的，或<b>留空</b>＝只读配文（最快最稳）。
        </div>
        <Row label="Base URL（如 https://api.openai.com 或中转地址）"><input className="nso-input" style={{ width: "100%" }} value={ai.api.baseURL} onChange={e => setAPI({ baseURL: e.target.value })} placeholder="https://api.openai.com" /></Row>
        <Row label="API Key"><input className="nso-input" type="password" style={{ width: "100%" }} value={ai.api.key} onChange={e => setAPI({ key: e.target.value })} placeholder="sk-..." /></Row>

        {/* 拉取模型：验证连接是不是真的通 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 8px", flexWrap: "wrap" }}>
          <button className="nso-btn sm" disabled={fetching || !ai.api.baseURL} onClick={pull}>{fetching ? "拉取中…" : "🔌 拉取模型列表"}</button>
          {modelMsg && <span style={{ fontSize: 14, fontFamily: "'Noto Sans SC',sans-serif", color: modelMsg.ok ? "#9bffb0" : "#ff9b6e", flex: "1 1 180px", wordBreak: "break-all" }}>{modelMsg.text}</span>}
        </div>
        {models.length > 0 && (
          <div className="nso-scroll" style={{ maxHeight: 168, overflowY: "auto", border: "2px solid var(--secondary)", padding: 8, marginBottom: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {models.map(m => {
              const isText = ai.api.model === m, isVis = ai.api.visionModel === m;
              return (
                <div key={m} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ flex: 1, fontSize: 14, fontFamily: "ui-monospace,monospace", wordBreak: "break-all", color: (isText || isVis) ? "#fff" : "var(--window-text)" }}>{m}</span>
                  <button className={`nso-btn sm ${isText ? "" : "ghost"}`} title="设为文本模型" onClick={() => setAPI({ model: m })}>文{isText ? "✓" : ""}</button>
                  <button className={`nso-btn sm ${isVis ? "" : "ghost"}`} title="设为看图模型" onClick={() => setAPI({ visionModel: m })}>图{isVis ? "✓" : ""}</button>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}><Row label="文本模型"><input className="nso-input" style={{ width: "100%" }} value={ai.api.model} onChange={e => setAPI({ model: e.target.value })} placeholder="gpt-4o-mini" /></Row></div>
          <div style={{ flex: 1 }}><Row label="看图模型（可同上）"><input className="nso-input" style={{ width: "100%" }} value={ai.api.visionModel} onChange={e => setAPI({ visionModel: e.target.value })} placeholder="gpt-4o" /></Row></div>
        </div>

        {/* 保存 + 测试反馈 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <button className="nso-btn gold" onClick={saveAPI}>💾 保存 API 设置</button>
          <button className="nso-btn ai" disabled={testing} onClick={test}>{testing ? "测试中…" : "🔌 测试连接"}</button>
          {saved && <span style={{ fontSize: 14, color: "#9bffb0", fontFamily: "'Noto Sans SC',sans-serif" }}>✅ 已保存到本机（密钥只存在你的浏览器/存档里）</span>}
        </div>
        <div style={{ fontSize: 12, opacity: .55, marginTop: 6, fontFamily: "'Noto Sans SC',sans-serif", lineHeight: 1.5 }}>
          填完自动保存、刷新不丢；点「保存」只是给你个确认。测试连接会真的调一次 AI 并把结果显示在下面。
        </div>
        {testOut && (
          <div style={{ marginTop: 10, padding: "8px 10px", fontSize: 14, fontFamily: "'Noto Sans SC',sans-serif", lineHeight: 1.5, wordBreak: "break-word",
            color: testOut.ok ? "#bdf7c8" : "#ffd2d2", background: testOut.ok ? "#10301a" : "#3a0f1a", border: `2px solid ${testOut.ok ? "#3ec46a" : "#ff6e8e"}` }}>
            {testOut.text}
          </div>
        )}
      </Section>
    </div>
  );
}

// ---------------- 标签：存档 / 历史 ----------------
function TabSave({ state, dispatch, onExport, onImport, busy }) {
  const impRef = useRef(null);
  return (
    <div>
      <Section title="打包分享（把照片+弹幕+装扮塞进一个文件发给朋友）">
        <div style={{ fontSize: 14, opacity: .8, marginBottom: 12, fontFamily: "'Noto Sans SC',sans-serif", lineHeight: 1.6 }}>
          点下面会下载一个 <b>完整 HTML 文件</b>，朋友手机/电脑用浏览器打开就能看到你编辑好的全部内容，也能自己加弹幕。<br />
          ⚠️ 照片会以 base64 打包进去，照片多时文件会比较大。<br />
          ⚠️ 默认<b>不打包 API Key</b>（更安全），朋友想用 AI 自己填即可。
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="nso-btn gold" disabled={busy} onClick={() => onExport(false)}>{busy ? "打包中…" : "📦 导出分享文件（不含Key）"}</button>
          <button className="nso-btn ghost" disabled={busy} onClick={() => onExport(true)}>含 Key 导出</button>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="nso-btn ghost" onClick={() => impRef.current?.click()}>📂 导入存档（.json）</button>
          <button className="nso-btn ghost" onClick={() => { const blob = new Blob([JSON.stringify(state)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "十周年放送-存档.json"; a.click(); }}>💾 导出存档(.json)</button>
          <input ref={impRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
        </div>
      </Section>

      <Section title="历史记录" right={<button className="nso-btn sm ghost" onClick={() => dispatch({ type: "CLEAR_HISTORY" })}>清空</button>}>
        {(!state.history || state.history.length === 0) ? <div style={{ opacity: .6, fontSize: 16 }}>（暂无记录）</div> :
          <div className="nso-scroll" style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {[...state.history].reverse().map(h => (
              <div key={h.id} style={{ fontSize: 14, fontFamily: "'Noto Sans SC',sans-serif", opacity: .85, borderBottom: "1px solid var(--bg-2)", padding: "3px 0" }}>
                <span style={{ opacity: .5 }}>{new Date(h.ts).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span> · {h.text}
              </div>
            ))}
          </div>}
      </Section>

      <Section title="危险区">
        <button className="nso-btn ghost" onClick={() => { if (confirm("确定清空所有内容、恢复到初始状态吗？")) dispatch({ type: "RESET" }); }}>🗑 重置全部</button>
      </Section>
    </div>
  );
}

// ---------------- Studio 外壳 ----------------
const STUDIO_TABS = [
  { id: "photos", label: "📷 照片" },
  { id: "deco", label: "🎨 装扮" },
  { id: "room", label: "🏠 房间" },
  { id: "ai", label: "🤖 AI" },
  { id: "save", label: "💾 存档" },
];

function Studio({ state, dispatch, goLive, onExport, onImport, exportBusy }) {
  const [tab, setTab] = useState("photos");
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "calc(8px + var(--safe-top)) 0 var(--safe-bottom)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 10px 8px", flex: "0 0 auto" }}>
        <button className="nso-btn" onClick={goLive}>▶ 回直播间</button>
        <div style={{ marginLeft: "auto", fontSize: 15, opacity: .7 }}>后台编辑</div>
      </div>
      <div className="nso-scroll" style={{ display: "flex", gap: 6, padding: "0 10px 8px", overflowX: "auto", flex: "0 0 auto" }}>
        {STUDIO_TABS.map(t => (
          <button key={t.id} className={`nso-btn sm ${tab === t.id ? "" : "ghost"}`} style={{ whiteSpace: "nowrap" }} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="nso-scroll" style={{ flex: 1, overflowY: "auto", padding: "0 10px 20px" }}>
        {tab === "photos" && <TabPhotos state={state} dispatch={dispatch} />}
        {tab === "deco" && <TabDeco state={state} dispatch={dispatch} />}
        {tab === "room" && <TabRoom state={state} dispatch={dispatch} />}
        {tab === "ai" && <TabAI state={state} dispatch={dispatch} />}
        {tab === "save" && <TabSave state={state} dispatch={dispatch} onExport={onExport} onImport={onImport} busy={exportBusy} />}
      </div>
    </div>
  );
}

Object.assign(window, { Studio });
