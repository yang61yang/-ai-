// ============================================================
// app.jsx — 根组件 / 状态机 / 持久化 / 导出打包
// ============================================================
const { useReducer, useEffect: useEffectApp, useState: useStateApp, useRef: useRefApp } = React;

const LS_KEY = "nso-album-v1";

function logEntry(text) { return { id: window.uid("h"), ts: Date.now(), text }; }

function reducer(state, action) {
  switch (action.type) {
    case "ADD_PHOTOS": {
      const photos = [...state.photos, ...action.photos];
      return { ...state, photos, selectedPhotoId: state.selectedPhotoId || action.photos[0]?.id || null,
        history: [...state.history, logEntry(`上传了 ${action.photos.length} 张照片`)] };
    }
    case "REMOVE_PHOTO": {
      const photos = state.photos.filter(p => p.id !== action.id);
      let sel = state.selectedPhotoId;
      if (sel === action.id) sel = photos[0]?.id || null;
      return { ...state, photos, selectedPhotoId: sel, history: [...state.history, logEntry("删除了一张照片")] };
    }
    case "SELECT_PHOTO": return { ...state, selectedPhotoId: action.id };
    case "SET_CAPTION":
      return { ...state, photos: state.photos.map(p => p.id === action.id ? { ...p, caption: action.caption } : p) };
    case "ADD_DANMAKU":
      return { ...state, photos: state.photos.map(p => p.id === action.photoId ? { ...p, danmaku: [...p.danmaku, action.danmaku] } : p) };
    case "ADD_DANMAKU_BATCH":
      return { ...state, photos: state.photos.map(p => p.id === action.photoId ? { ...p, danmaku: [...p.danmaku, ...action.list] } : p),
        history: [...state.history, logEntry(`AI 为一张图生成了 ${action.list.length} 条弹幕`)] };
    case "REMOVE_DANMAKU":
      return { ...state, photos: state.photos.map(p => p.id === action.photoId ? { ...p, danmaku: p.danmaku.filter(d => d.id !== action.dmId) } : p) };

    case "SET_DECO": return { ...state, deco: { ...state.deco, ...action.patch } };
    case "APPLY_THEME": {
      const t = action.theme;
      return { ...state, deco: { ...state.deco, theme: t.id, background: t.background, frame: t.frame, font: t.font, bgImage: null, pageBg: t.background, pageBgImage: null } };
    }
    case "ADD_STICKER": return { ...state, deco: { ...state.deco, stickers: [...(state.deco.stickers || []), action.sticker] } };
    case "UPDATE_STICKER": return { ...state, deco: { ...state.deco, stickers: state.deco.stickers.map(s => s.id === action.id ? { ...s, ...action.patch } : s) } };
    case "REMOVE_STICKER": return { ...state, deco: { ...state.deco, stickers: state.deco.stickers.filter(s => s.id !== action.id) } };
    case "ADD_CUSTOM_FRAME": return { ...state, deco: { ...state.deco, customFrames: [...(state.deco.customFrames || []), action.frame] } };
    case "ADD_CUSTOM_STICKER": return { ...state, deco: { ...state.deco, customStickers: [...(state.deco.customStickers || []), action.sticker] } };

    case "SET_ROOM": return { ...state, room: { ...state.room, ...action.patch } };

    case "SET_STREAM": return { ...state, stream: { ...state.stream, ...action.patch } };
    case "GO_LIVE": return { ...state, stream: { ...state.stream, phase: "live", startedAt: Date.now(),
        title: action.title != null ? action.title : state.stream.title,
        cover: action.cover !== undefined ? action.cover : state.stream.cover },
      sim: { ...state.sim, onboarded: true },
      history: [...state.history, logEntry("\uD83D\uDD34 开播了")] };
    case "GO_OFFLINE": return { ...state, stream: { ...state.stream, phase: "offline" },
      history: [...state.history, logEntry("下播了")] };
    case "BUMP_SIM": return { ...state, sim: { ...state.sim, ...action.patch } };
    case "SET_SIM": return { ...state, sim: { ...state.sim, ...action.patch } };

    case "ADD_PROFILE": return { ...state, profiles: [...state.profiles, action.profile], history: [...state.history, logEntry(`新增身份「${action.profile.name}」`)] };
    case "UPDATE_PROFILE": return { ...state, profiles: state.profiles.map(p => p.id === action.id ? { ...p, ...action.patch } : p) };
    case "REMOVE_PROFILE": {
      const profiles = state.profiles.filter(p => p.id !== action.id);
      let cur = state.currentProfileId;
      if (cur === action.id) cur = profiles[0]?.id;
      return { ...state, profiles, currentProfileId: cur };
    }
    case "SET_CURRENT_PROFILE": return { ...state, currentProfileId: action.id };

    case "SET_AI": return { ...state, ai: { ...state.ai, ...action.patch } };
    case "ADD_PERSONA": return { ...state, ai: { ...state.ai, personas: [...state.ai.personas, action.persona] } };
    case "SET_PERSONA": return { ...state, ai: { ...state.ai, personas: state.ai.personas.map(p => p.id === action.id ? { ...p, ...action.patch } : p) } };
    case "REMOVE_PERSONA": return { ...state, ai: { ...state.ai, personas: state.ai.personas.filter(p => p.id !== action.id) } };

    case "CLEAR_HISTORY": return { ...state, history: [] };
    case "IMPORT_STATE": return action.state;
    case "RESET": return window.makeDefaultState();
    default: return state;
  }
}

function loadInitialState() {
  try {
    if (window.__ALBUM_STATE__) {
      const s = window.__ALBUM_STATE__;
      const def = window.makeDefaultState();
      return { ...def, ...s, deco: { ...def.deco, ...s.deco }, ai: { ...def.ai, ...s.ai }, stream: { ...def.stream, ...s.stream }, sim: { ...def.sim, ...s.sim } };
    }
  } catch (e) {}
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const def = window.makeDefaultState();
      return { ...def, ...s, deco: { ...def.deco, ...s.deco }, ai: { ...def.ai, ...s.ai }, stream: { ...def.stream, ...s.stream }, sim: { ...def.sim, ...s.sim } };
    }
  } catch (e) {}
  return window.makeDefaultState();
}

// 注入 state 到 HTML 文本
function injectState(html, stateStr) {
  html = html.replace(/<script>window\.__ALBUM_STATE__=[\s\S]*?<\/script>/g, "");
  const tag = `<script>window.__ALBUM_STATE__=${stateStr};<\/script>`;
  const slot = "<!-- __ALBUM_STATE_SLOT__ -->";
  if (html.indexOf(slot) >= 0) return html.replace(slot, slot + "\n" + tag);
  return html.replace("</head>", tag + "\n</head>");
}

async function buildSelfContainedHTML() {
  // 在线/编辑环境：把外壳 + 各 jsx 内联成单文件
  const shell = await (await fetch("index.html")).text();
  const files = ["data.jsx", "ai.jsx", "sim.jsx", "liveroom.jsx", "lobby.jsx", "studio.jsx", "app.jsx"];
  let out = shell;
  for (const f of files) {
    const code = await (await fetch(f)).text();
    const safe = code.replace(/<\/script>/g, "<\\/script>");
    const inline = `<script type="text/babel">\n${safe}\n<\/script>`;
    out = out.replace(`<script type="text/babel" src="${f}"></script>`, () => inline);
  }
  return out;
}

function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);
  const [mode, setMode] = useStateApp(() => (loadInitialState().photos.length ? "lobby" : "studio"));
  const [exportBusy, setExportBusy] = useStateApp(false);
  const [portrait, setPortrait] = useStateApp(window.innerHeight >= window.innerWidth);
  const aiBusyRef = useRefApp(false);
  const quotaWarned = useRefApp(false);

  // 持久化
  useEffectApp(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
    catch (e) {
      if (!quotaWarned.current) { quotaWarned.current = true; console.warn("localStorage 写入失败（可能照片太多超出容量），但当前会话仍可用、可导出文件。", e); }
    }
  }, [state]);

  useEffectApp(() => {
    const h = () => setPortrait(window.innerHeight >= window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  // 主题色 → 全局 CSS 变量（整套 UI 跟着换色）
  useEffectApp(() => {
    const t = (window.THEMES || []).find(x => x.id === state.deco.theme);
    if (t) {
      document.documentElement.style.setProperty("--primary", t.primary);
      document.documentElement.style.setProperty("--secondary", t.secondary);
    }
  }, [state.deco.theme]);

  async function onExport(includeKey) {
    setExportBusy(true);
    try {
      let html;
      try { html = await buildSelfContainedHTML(); }
      catch (e) { html = "<!DOCTYPE html>\n" + document.documentElement.outerHTML; }
      const toSave = JSON.parse(JSON.stringify(state));
      if (!includeKey && toSave.ai && toSave.ai.api) toSave.ai.api.key = "";
      const stateStr = JSON.stringify(toSave).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
      html = injectState(html, stateStr);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${state.room.name || "十周年放送"}.html`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {
      alert("导出失败：" + (e.message || e));
    } finally { setExportBusy(false); }
  }

  function onImport(e) {
    const file = (e.target.files || [])[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const s = JSON.parse(r.result);
        const def = window.makeDefaultState();
        dispatch({ type: "IMPORT_STATE", state: { ...def, ...s, deco: { ...def.deco, ...s.deco }, ai: { ...def.ai, ...s.ai }, stream: { ...def.stream, ...s.stream }, sim: { ...def.sim, ...s.sim } } });
        alert("导入成功！");
      } catch (err) { alert("导入失败：不是合法的存档文件"); }
    };
    r.readAsText(file);
    e.target.value = "";
  }

  // 整页背景（网页可替换背景）
  const pageBgStyle = state.deco.pageBgImage
    ? { backgroundImage: `url(${state.deco.pageBgImage})`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }
    : ((window.BACKGROUNDS.find(b => b.id === state.deco.pageBg) || window.BACKGROUNDS[0]).style);

  return (
    <React.Fragment>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, ...pageBgStyle }} />
      <div style={{ position: "relative", zIndex: 1, height: "100%", maxWidth: portrait ? "100%" : 1100, margin: "0 auto" }}>
        {mode === "lobby"
          ? <window.Lobby state={state} dispatch={dispatch} enterMyRoom={() => setMode("live")} goStudio={() => setMode("studio")} portrait={portrait} />
          : mode === "live"
          ? <window.LiveRoom state={state} dispatch={dispatch} goStudio={() => setMode("studio")} goLobby={() => setMode("lobby")} aiBusyRef={aiBusyRef} portrait={portrait} />
          : <window.Studio state={state} dispatch={dispatch} goLive={() => setMode(state.photos.length ? "lobby" : "studio")} onExport={onExport} onImport={onImport} exportBusy={exportBusy} />}
      </div>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
