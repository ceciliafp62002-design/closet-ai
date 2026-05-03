import { useState, useRef, useEffect } from "react";

/* ─── THEME ─────────────────────────── */
const T = {
  bg:"#08080A", surface:"#111116", high:"#1C1C23", border:"#26262E",
  accent:"#C9F04E", aLow:"rgba(201,240,78,0.13)", aMid:"rgba(201,240,78,0.26)",
  text:"#EFEFEF", muted:"#55555F", dim:"#888896", ok:"#4DFFB4", err:"#FF4D6D",
};

const CATS     = ["Todos","top","bottom","dress","outerwear","shoes","bag","accessory"];
const CAT_LBL  = { Todos:"Todos",top:"Tops",bottom:"Pantalones",dress:"Vestidos",outerwear:"Abrigos",shoes:"Zapatos",bag:"Bolsos",accessory:"Accesorios" };
const SZN_LBL  = { spring:"🌸 Primavera",summer:"☀️ Verano",autumn:"🍂 Otoño",winter:"❄️ Invierno",all_season:"🌍 Todo año" };
const OCC_LBL  = { casual:"Casual",formal:"Formal",business:"Business",sport:"Sport",party:"Party",beach:"Beach",home:"Casa",outdoor:"Outdoor" };
const OCC_KEYS = ["casual","formal","business","sport","party","beach","home","outdoor"];
const SZN_KEYS = ["spring","summer","autumn","winter","all_season"];
const CAT_KEYS = ["top","bottom","dress","outerwear","shoes","bag","accessory"];
const EMOJI_MAP= { top:"👕",bottom:"👖",dress:"👗",outerwear:"🧥",shoes:"👟",bag:"👜",accessory:"💍" };

const COLOR_HEX = {
  "negro":"#1a1a1a","blanco":"#f0f0f0","gris":"#888","azul":"#1a3a6c","marino":"#0a1a3a",
  "celeste":"#7ec8e3","rojo":"#8b1a1a","rosa":"#d4687a","morado":"#5a2a7a","lila":"#9a7ac8",
  "verde":"#1a5a2a","oliva":"#6b7a2a","naranja":"#c86a1a","amarillo":"#c8b41a",
  "marrón":"#6a3a1a","marron":"#6a3a1a","beige":"#d4c4a0","camel":"#c4a060",
  "crema":"#f0e8d0","nude":"#d4b090","burdeos":"#6a1a2a","tostado":"#a07040",
  "white":"#f0f0f0","black":"#1a1a1a","blue":"#1a3a6c","red":"#8b1a1a",
  "green":"#1a5a2a","pink":"#d4687a","gray":"#888","grey":"#888","brown":"#6a3a1a",
};

function toHex(name) {
  if (!name) return "#2a2a2a";
  const k = name.toLowerCase().trim().split(" ")[0];
  return COLOR_HEX[k] || "#2a2a2a";
}

/* ─── JSON PARSE ROBUSTO ─────────────── */
function safeParseJSON(text) {
  if (!text) throw new Error("Respuesta vacía de la IA");
  let cleaned = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(cleaned); } catch (_) {}
  const objMatch = cleaned.match(/(\{[\s\S]*\})/);
  if (objMatch) { try { return JSON.parse(objMatch[1]); } catch (_) {} }
  const arrMatch = cleaned.match(/(\[[\s\S]*\])/);
  if (arrMatch) { try { return JSON.parse(arrMatch[1]); } catch (_) {} }
  try { return JSON.parse(cleaned + "]}"); } catch (_) {}
  throw new Error("Respuesta inválida de la IA. Intenta de nuevo.");
}

/* ─── SESIÓN PERSISTENTE ─────────────── */
function restoreSession() {
  try {
    const raw = localStorage.getItem("cai_session");
    if (!raw) return null;
    const session = JSON.parse(raw);
    const users = JSON.parse(localStorage.getItem("cai_users") || "{}");
    if (!users[session.email]) { localStorage.removeItem("cai_session"); return null; }
    return session;
  } catch { localStorage.removeItem("cai_session"); return null; }
}

/* ─── CONTADOR DE USOS API ───────────── */
const API_LIMITS = { photoroom: 500, removebg: 50 };

function getApiUsage(provider) {
  const key = `cai_${provider}_usage`;
  const limit = API_LIMITS[provider] || 500;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { count: 0, remaining: limit };
    const { count, month } = JSON.parse(raw);
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (month !== currentMonth) {
      localStorage.setItem(key, JSON.stringify({ count: 0, month: currentMonth }));
      return { count: 0, remaining: limit };
    }
    return { count, remaining: Math.max(0, limit - count) };
  } catch { return { count: 0, remaining: limit }; }
}

function incrementApiUsage(provider) {
  const key = `cai_${provider}_usage`;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const { count } = getApiUsage(provider);
  localStorage.setItem(key, JSON.stringify({ count: count + 1, month: currentMonth }));
}

function daysUntilReset() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.ceil((next - now) / (1000 * 60 * 60 * 24));
}

/* ─── COMPONENTE CONTADOR ────────────── */
function ApiUsageCounter({ provider = "photoroom" }) {
  const limit = API_LIMITS[provider] || 500;
  const label = provider === "photoroom" ? "PhotoRoom" : "Remove.bg";
  const [usage, setUsage] = useState({ count: 0, remaining: limit });
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    setUsage(getApiUsage(provider));
    const t = setTimeout(() => setAnimated(true), 120);
    return () => clearTimeout(t);
  }, [provider]);
  const percent = (usage.count / limit) * 100;
  const days = daysUntilReset();
  const isEmpty = usage.remaining === 0;
  const isWarning = !isEmpty && usage.remaining <= Math.round(limit * 0.2);
  const color = isEmpty ? "#FF4D6D" : isWarning ? "#FF9F0A" : "#C9F04E";
  const bgColor = isEmpty ? "rgba(255,77,109,0.07)" : isWarning ? "rgba(255,159,10,0.07)" : "rgba(201,240,78,0.05)";
  const borderCol = isEmpty ? "rgba(255,77,109,0.3)" : isWarning ? "rgba(255,159,10,0.3)" : "rgba(201,240,78,0.2)";
  const statusTxt = isEmpty ? "Límite alcanzado" : isWarning ? "Pocos usos" : "Activo";
  return (
    <div style={{ background: bgColor, border: `1px solid ${borderCol}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -30, right: -30, width: 90, height: 90, borderRadius: "50%", background: color, opacity: 0.05, filter: "blur(24px)", pointerEvents: "none" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 14 }}>{provider === "photoroom" ? "✂️" : "🎭"}</span>
          <div>
            <p style={{ color: T.text, fontSize: 12, fontWeight: 700, margin: 0 }}>{label}</p>
            <p style={{ color: T.muted, fontSize: 10, margin: 0 }}>Recorte de fondo</p>
          </div>
        </div>
        <div style={{ background: `${color}18`, border: `1px solid ${color}35`, borderRadius: 20, padding: "2px 9px" }}>
          <span style={{ color, fontSize: 10, fontWeight: 700 }}>{statusTxt}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
        <span style={{ color, fontSize: 28, fontWeight: 800, letterSpacing: "-1px", fontFamily: "'Cormorant Garamond',serif" }}>{usage.remaining}</span>
        <span style={{ color: T.muted, fontSize: 12 }}>/ {limit} restantes</span>
      </div>
      <div style={{ background: T.high, borderRadius: 4, height: 5, overflow: "hidden", marginBottom: 7 }}>
        <div style={{ width: animated ? `${percent}%` : "0%", height: "100%", background: `linear-gradient(90deg, ${color}, ${isEmpty ? "#ff8080" : isWarning ? "#ffcc44" : "#a8e63d"})`, borderRadius: 4, transition: "width 0.9s cubic-bezier(0.16,1,0.3,1)", boxShadow: `0 0 6px ${color}50` }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: T.muted, fontSize: 10 }}>{usage.count} uso{usage.count !== 1 ? "s" : ""} este mes</span>
        <span style={{ color: T.muted, fontSize: 10 }}>Reset en {days} día{days !== 1 ? "s" : ""}</span>
      </div>
      {isEmpty && (
        <div style={{ marginTop: 8, padding: "7px 10px", background: "rgba(255,77,109,0.08)", borderRadius: 8, border: "1px solid rgba(255,77,109,0.2)" }}>
          <p style={{ color: "#ff6b6b", fontSize: 10, margin: 0, lineHeight: 1.5 }}>⚠️ Se usará la foto completa hasta el próximo mes.</p>
        </div>
      )}
    </div>
  );
}

/* ─── PERSISTENCE ────────────────────── */
const DB = {
  getUsers:        () => { try { return JSON.parse(localStorage.getItem("cai_users")||"{}"); } catch { return {}; }},
  saveUsers:       (u) => localStorage.setItem("cai_users", JSON.stringify(u)),
  getGarments:     (uid) => { try { return JSON.parse(localStorage.getItem(`cai_garments_${uid}`)||"[]"); } catch { return []; }},
  saveGarments:    (uid,g) => localStorage.setItem(`cai_garments_${uid}`, JSON.stringify(g)),
  getOutfits:      (uid) => { try { return JSON.parse(localStorage.getItem(`cai_outfits_${uid}`)||"[]"); } catch { return []; }},
  saveOutfits:     (uid,o) => localStorage.setItem(`cai_outfits_${uid}`, JSON.stringify(o)),
  getApiKey:       () => localStorage.getItem("cai_gemini_key")||"",
  saveApiKey:      (k) => localStorage.setItem("cai_gemini_key", k),
  getPhotoRoomKey: () => localStorage.getItem("cai_photoroom_key")||"",
  savePhotoRoomKey:(k) => localStorage.setItem("cai_photoroom_key", k),
  getSession:      () => { try { return JSON.parse(localStorage.getItem("cai_session")||"null"); } catch { return null; }},
  saveSession:     (u) => localStorage.setItem("cai_session", JSON.stringify(u)),
  clearSession:    () => localStorage.removeItem("cai_session"),
};

/* ─── PROMPT ─────────────────────────── */
const AI_PROMPT = `You are a fashion expert and textile analyst with 20 years of experience.

Analyze the image and identify ALL visible garments. IGNORE: phone cases, technology, hands, faces, furniture.

For each garment estimate its bounding box as fractions of image size (0.0 to 1.0):
bbox_x=left, bbox_y=top, bbox_w=width, bbox_h=height

Only include garments with confidence >= 0.6.

Respond ONLY with pure JSON, no markdown, no code blocks:

{"prendas":[{"nombre":"name in Spanish","categoria":"top|bottom|dress|outerwear|shoes|bag|accessory","subcategoria":"type","color_principal":"color","colores":["c1"],"marca_detectada":null,"marca_posible":null,"razon_marca":null,"material_estimado":"material","patron":"solid|stripes|plaid|floral|geometric|denim|knit","fit":"slim|regular|oversized|fitted|cropped","temporadas":["all_season"],"ocasiones":["casual"],"detalles":"details","estado_visible":"nuevo|excelente|bueno|usado","precio_estimado":"price in euros","confianza":0.95,"bbox_x":0.1,"bbox_y":0.1,"bbox_w":0.8,"bbox_h":0.6}],"conjunto_analisis":"overall analysis","estilo_general":"casual|smart_casual|formal|sporty|bohemian|streetwear|elegante|otro"}`;

/* ─── ★ FIXED callClaude ─────────────
   El archivo anterior tenía "body: body:JSON.stringify..."
   y mezclaba el modelo de test con el de producción.
   Aquí está corregido.
─────────────────────────────────────── */
async function callClaude(b64, mtype, apiKey) {
  if (!apiKey) throw new Error("No hay API key. Ve a ⚙️ Configuración.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mtype, data: b64 } },
          { type: "text", text: AI_PROMPT },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${res.status}`;
    if (res.status === 401) throw new Error("API key inválida. Verifica en console.anthropic.com");
    if (res.status === 429) throw new Error("Límite de peticiones. Espera un momento.");
    throw new Error("Error Claude: " + msg);
  }

  const d = await res.json();
  const rawText = d.content?.find(b => b.type === "text")?.text || "";
  const parsed = safeParseJSON(rawText);
  if (!parsed.prendas?.length) throw new Error("No se detectaron prendas. Intenta con otra foto.");
  parsed.prendas = parsed.prendas.filter(p => (p.confianza ?? 1) >= 0.6);
  return parsed;
}

/* ─── PHOTOROOM ──────────────────────── */
async function removeBackgroundPhotoRoom(base64Image, apiKey) {
  const { remaining } = getApiUsage("photoroom");
  if (remaining <= 0) return null;
  const byteCharacters = atob(base64Image);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i);
  const blob = new Blob([byteArray], { type: "image/jpeg" });
  const formData = new FormData();
  formData.append("image_file", blob, "prenda.jpg");
  const res = await fetch("https://sdk.photoroom.com/v1/segment", {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: formData,
  });
  if (!res.ok) return null;
  incrementApiUsage("photoroom");
  return await res.blob();
}

function placeOnWhiteBackground(blobOrDataUrl, maxDim = 700) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.onerror = reject;
    img.src = typeof blobOrDataUrl === "string" ? blobOrDataUrl : URL.createObjectURL(blobOrDataUrl);
  });
}

function garmentImageSingle(dataUrl) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const SIZE = 600;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, SIZE, SIZE);
      const ratio = Math.min(SIZE / img.width, SIZE / img.height) * 0.82;
      const w = img.width * ratio, h = img.height * ratio;
      ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.93));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function garmentImageCrop(dataUrl, bbox) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const SIZE = 600, PAD = 0.08;
      const bx = Math.max(0, (bbox.x || 0) - PAD);
      const by = Math.max(0, (bbox.y || 0) - PAD);
      const bw = Math.min(1, (bbox.w || 1) + PAD * 2);
      const bh = Math.min(1, (bbox.h || 1) + PAD * 2);
      const sx = Math.max(0, bx * img.width);
      const sy = Math.max(0, by * img.height);
      const sw = Math.min(img.width - sx, bw * img.width);
      const sh = Math.min(img.height - sy, bh * img.height);
      const canvas = document.createElement("canvas");
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, SIZE, SIZE);
      const ratio = Math.min(SIZE / sw, SIZE / sh) * 0.85;
      ctx.drawImage(img, sx, sy, sw, sh, (SIZE - sw * ratio) / 2, (SIZE - sh * ratio) / 2, sw * ratio, sh * ratio);
      resolve(canvas.toDataURL("image/jpeg", 0.93));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function buildGarmentImages(dataUrl, base64, prendas, photoRoomKey) {
  return Promise.all(prendas.map(async (p) => {
    if (photoRoomKey && getApiUsage("photoroom").remaining > 0) {
      try {
        const blob = await removeBackgroundPhotoRoom(base64, photoRoomKey);
        if (blob) return await placeOnWhiteBackground(blob, 700);
      } catch (_) {}
    }
    const bbox = { x: p.bbox_x ?? 0, y: p.bbox_y ?? 0, w: p.bbox_w ?? 1, h: p.bbox_h ?? 1 };
    if (prendas.length === 1 || (bbox.w > 0.9 && bbox.h > 0.9)) return garmentImageSingle(dataUrl);
    return garmentImageCrop(dataUrl, bbox);
  }));
}

/* ─── CSS ────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Sora:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%;height:100dvh;overflow:hidden;background:#08080A}
::-webkit-scrollbar{display:none}
:root{--sat:env(safe-area-inset-top,0px);--sab:env(safe-area-inset-bottom,0px)}
input,button,select,textarea{font-family:'Sora',system-ui,sans-serif}
input::placeholder,textarea::placeholder{color:#44444E}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes risefast{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes bar{from{width:0}to{width:100%}}
@keyframes glow{0%,100%{box-shadow:0 0 18px rgba(201,240,78,0.15)}50%{box-shadow:0 0 36px rgba(201,240,78,0.4)}}
@keyframes fadein{from{opacity:0}to{opacity:1}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
`;

/* ─── PRIMITIVES ─────────────────────── */
function Logo({ size = 22 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: size + 10, height: size + 10, background: T.accent, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.65, fontWeight: 900 }}>✦</div>
      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: size + 2, fontWeight: 700, color: T.text, letterSpacing: "-0.5px" }}>Closet<span style={{ color: T.accent }}>AI</span></span>
    </div>
  );
}

function Field({ label, type = "text", value, onChange, placeholder, icon, autoComplete }) {
  const [f, sf] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 5 }}>{label}</label>}
      <div style={{ display: "flex", alignItems: "center", background: T.high, borderRadius: 11, padding: "0 13px", border: `1px solid ${f ? T.accent : T.border}`, boxShadow: f ? `0 0 0 3px ${T.aLow}` : "none", transition: "all 0.2s" }}>
        {icon && <span style={{ color: f ? T.accent : T.muted, marginRight: 8, fontSize: 13, flexShrink: 0 }}>{icon}</span>}
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete}
          onFocus={() => sf(true)} onBlur={() => sf(false)}
          style={{ background: "none", border: "none", outline: "none", color: T.text, fontSize: 13, padding: "11px 0", width: "100%" }} />
      </div>
    </div>
  );
}

function Btn({ children, onClick, v = "primary", disabled = false, icon, full = true, sm = false, danger = false }) {
  const [p, sp] = useState(false);
  const base = danger
    ? { background: "rgba(255,77,109,0.15)", color: T.err, border: "1px solid rgba(255,77,109,0.4)" }
    : v === "primary"
      ? { background: T.accent, color: "#08080A", border: "none", boxShadow: p ? "none" : `0 4px 18px ${T.aLow}` }
      : { background: "transparent", color: T.text, border: `1px solid ${T.border}` };
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseDown={() => sp(true)} onMouseUp={() => sp(false)} onMouseLeave={() => sp(false)}
      style={{ width: full ? "100%" : "auto", padding: sm ? "7px 12px" : "12px 16px", borderRadius: 11, cursor: disabled ? "not-allowed" : "pointer", fontSize: sm ? 11 : 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transform: p ? "scale(0.97)" : "scale(1)", opacity: disabled ? 0.38 : 1, transition: "all 0.15s", ...base }}>
      {icon && <span>{icon}</span>}{children}
    </button>
  );
}

function Pill({ label, active, onClick }) {
  return <button onClick={onClick} style={{ padding: "6px 13px", borderRadius: 20, border: "none", background: active ? T.accent : T.high, color: active ? "#08080A" : T.dim, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.2s" }}>{label}</button>;
}

function Tag({ children, hi = false }) {
  return <span style={{ background: hi ? T.aLow : T.high, border: `1px solid ${hi ? T.accent : T.border}`, color: hi ? T.accent : T.dim, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 6, display: "inline-block" }}>{children}</span>;
}

function SField({ label, value, onChange, options, lmap }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 5 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", background: T.high, border: `1px solid ${T.border}`, borderRadius: 11, padding: "11px 13px", color: T.text, fontSize: 13, outline: "none", appearance: "none" }}>
        {options.map(o => <option key={o} value={o} style={{ background: "#111" }}>{lmap[o] || o}</option>)}
      </select>
    </div>
  );
}

function MSelect({ label, options, selected, onToggle, lmap }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 6 }}>{label}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {options.map(o => <button key={o} onClick={() => onToggle(o)} style={{ padding: "5px 11px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, transition: "all 0.15s", background: selected.includes(o) ? T.accent : T.high, color: selected.includes(o) ? "#08080A" : T.dim }}>{lmap[o] || o}</button>)}
      </div>
    </div>
  );
}

function Sheet({ children, zIndex = 200 }) {
  return <div style={{ position: "absolute", inset: 0, zIndex, display: "flex", flexDirection: "column", background: T.bg, animation: "rise 0.22s ease" }}>{children}</div>;
}

function Toast({ msg, type = "ok" }) {
  const color = type === "ok" ? T.ok : T.err;
  return (
    <div style={{ position: "absolute", bottom: 75, left: 14, right: 14, zIndex: 999, background: T.surface, border: `1px solid ${color}`, borderRadius: 12, padding: "11px 14px", display: "flex", alignItems: "center", gap: 9, animation: "risefast 0.2s ease", boxShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>
      <span style={{ fontSize: 15 }}>{type === "ok" ? "✓" : "✕"}</span>
      <p style={{ color: T.text, fontSize: 12, fontWeight: 600, margin: 0 }}>{msg}</p>
    </div>
  );
}

function GarmentCard({ g, onClick }) {
  const [hov, sh] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => sh(true)} onMouseLeave={() => sh(false)}
      style={{ background: T.surface, border: `1px solid ${hov ? T.dim : T.border}`, borderRadius: 16, overflow: "hidden", cursor: "pointer", transform: hov ? "scale(1.02)" : "scale(1)", transition: "all 0.18s" }}>
      <div style={{ height: 148, background: "#0d0d0d", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {g.imageUrl ? <img src={g.imageUrl} alt={g.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <span style={{ fontSize: 50 }}>{g.emoji || EMOJI_MAP[g.category] || "👗"}</span>}
        {g.imageUrl && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(8,8,10,0.6) 0%,transparent 55%)", pointerEvents: "none" }} />}
        {g.brand && <div style={{ position: "absolute", top: 7, right: 7, background: "rgba(0,0,0,0.8)", border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 6px" }}><span style={{ color: T.text, fontSize: 9, fontWeight: 700 }}>{g.brand}</span></div>}
        {g.is_favorite && <span style={{ position: "absolute", top: 6, left: 7, fontSize: 13 }}>⭐</span>}
      </div>
      <div style={{ padding: "9px 11px 11px" }}>
        <p style={{ color: T.text, fontSize: 12, fontWeight: 600, margin: "0 0 5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Tag hi>{g.occasion}</Tag>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: g.color || "#444", border: `1.5px solid ${T.border}` }} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   AUTH SCREEN
═══════════════════════════════════════ */
function AuthScreen({ onLogin }) {
  const [mode, sm] = useState("login");
  const [email, se] = useState(""); const [pass, sp] = useState(""); const [name, sn] = useState("");
  const [load, sl] = useState(false); const [err, ser] = useState(""); const [shake, ssh] = useState(false);
  function doShake() { ssh(true); setTimeout(() => ssh(false), 500); }
  function submit() {
    ser("");
    if (!email.trim()) { ser("El email es obligatorio"); doShake(); return; }
    if (!email.includes("@")) { ser("Email no válido"); doShake(); return; }
    if (pass.length < 4) { ser("Contraseña mínimo 4 caracteres"); doShake(); return; }
    sl(true);
    const users = DB.getUsers();
    if (mode === "login") {
      if (!users[email]) { ser("Email no registrado"); sl(false); doShake(); return; }
      if (users[email].pass !== pass) { ser("Contraseña incorrecta"); sl(false); doShake(); return; }
      const u = { id: users[email].id, email, name: users[email].name };
      DB.saveSession(u);
      setTimeout(() => { sl(false); onLogin(u); }, 600);
    } else {
      if (!name.trim()) { ser("El nombre es obligatorio"); sl(false); doShake(); return; }
      if (users[email]) { ser("Este email ya tiene cuenta"); sl(false); doShake(); return; }
      const u = { id: `u_${Date.now()}`, email, name: name.trim() };
      users[email] = { ...u, pass }; DB.saveUsers(users); DB.saveSession(u);
      setTimeout(() => { sl(false); onLogin(u); }, 600);
    }
  }
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "26px 22px", background: T.bg, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -80, right: -80, width: 260, height: 260, background: "rgba(201,240,78,0.05)", borderRadius: "50%", filter: "blur(70px)", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 1, animation: "rise 0.4s ease" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}><Logo size={26} /><p style={{ color: T.muted, fontSize: 12, marginTop: 8, fontStyle: "italic" }}>Tu armario, inteligente.</p></div>
        <div style={{ display: "flex", background: T.high, border: `1px solid ${T.border}`, borderRadius: 12, padding: 4, marginBottom: 18 }}>
          {["login", "register"].map(m => <button key={m} onClick={() => { sm(m); ser(""); }} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "none", background: mode === m ? T.accent : "transparent", color: mode === m ? "#08080A" : T.dim, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}>{m === "login" ? "Iniciar sesión" : "Crear cuenta"}</button>)}
        </div>
        <div style={{ animation: shake ? "shake 0.4s ease" : "none" }}>
          {mode === "register" && <Field label="Nombre" value={name} onChange={sn} placeholder="Tu nombre" icon="✦" autoComplete="name" />}
          <Field label="Email" type="email" value={email} onChange={se} placeholder="tu@email.com" icon="@" autoComplete="email" />
          <Field label="Contraseña" type="password" value={pass} onChange={sp} placeholder="••••••••" icon="🔒" autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </div>
        {err && <p style={{ color: T.err, fontSize: 11, marginBottom: 9, textAlign: "center", animation: "fadein 0.2s ease" }}>{err}</p>}
        <div style={{ height: 4 }} />
        <Btn onClick={submit} disabled={load} icon={load ? "⟳" : "→"}>{load ? "Entrando..." : mode === "login" ? "Entrar al armario" : "Crear cuenta"}</Btn>
        {mode === "login" && <p style={{ color: T.muted, fontSize: 10, textAlign: "center", marginTop: 12 }}>¿Primera vez?{" "}<button onClick={() => { sm("register"); ser(""); }} style={{ background: "none", border: "none", color: T.accent, fontSize: 10, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>Crea tu cuenta gratis</button></p>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   API KEY SCREEN
   ★ FIXED: testAndSave usa claude-sonnet-4-5
     con body correcto (sin duplicados)
═══════════════════════════════════════ */
function ApiKeyScreen({ onSave, onBack, current, currentPhotoRoom, onSavePhotoRoom }) {
  const [key, sk] = useState(current || "");
  const [prKey, sprk] = useState(currentPhotoRoom || "");
  const [show, ss] = useState(false);
  const [err, se] = useState("");
  const [testing, st] = useState(false);
  const [prSaved, sprs] = useState(false);

  async function testAndSave() {
    const trimmed = key.trim();
    if (!trimmed) { se("Pega tu API key"); return; }
    if (!trimmed.startsWith("sk-ant-")) { se("La key debe empezar por sk-ant-"); return; }
    st(true); se("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": trimmed,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 10,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error.message);
      DB.saveApiKey(trimmed);
      onSave(trimmed);
    } catch (e) {
      se("Error: " + e.message);
    } finally { st(false); }
  }

  function savePhotoRoom() {
    if (!prKey.trim()) return;
    DB.savePhotoRoomKey(prKey.trim());
    onSavePhotoRoom(prKey.trim());
    sprs(true); setTimeout(() => sprs(false), 2000);
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.bg, overflow: "hidden" }}>
      <div style={{ padding: "12px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>← Volver</button>
        <Logo size={15} />
        <div style={{ width: 55 }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔑</div>
          <p style={{ color: T.text, fontSize: 16, fontWeight: 700, fontFamily: "'Cormorant Garamond',serif", marginBottom: 4 }}>Configuración de APIs</p>
          <p style={{ color: T.muted, fontSize: 12, lineHeight: 1.7 }}>Las keys se guardan solo en este navegador.</p>
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
          <p style={{ color: T.dim, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: "1.2px" }}>Claude API (análisis de imagen)</p>
          {[["1","Ve a console.anthropic.com"],["2","API Keys → Create Key"],["3","Copia la key (sk-ant-...)"],["4","Pégala aquí abajo"]].map(([n,t]) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: T.accent, color: "#08080A", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
              <span style={{ color: T.dim, fontSize: 12 }}>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 5 }}>Claude API Key</label>
          <div style={{ display: "flex", alignItems: "center", background: T.high, borderRadius: 11, padding: "0 13px", border: `1px solid ${T.border}` }}>
            <input type={show ? "text" : "password"} value={key} onChange={e => sk(e.target.value)} placeholder="sk-ant-api03-..."
              style={{ background: "none", border: "none", outline: "none", color: T.text, fontSize: 12, padding: "12px 0", width: "100%", fontFamily: "monospace" }} />
            <button onClick={() => ss(!show)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14, padding: "0 0 0 8px" }}>{show ? "🙈" : "👁"}</button>
          </div>
        </div>
        {err && <p style={{ color: T.err, fontSize: 11, marginBottom: 10, textAlign: "center" }}>{err}</p>}
        <Btn onClick={testAndSave} icon={testing ? "⟳" : "✓"} disabled={!key || testing}>
          {testing ? "Verificando..." : "Verificar y guardar Claude key"}
        </Btn>
        <div style={{ marginTop: 22, marginBottom: 10, borderTop: `1px solid ${T.border}`, paddingTop: 18 }}>
          <p style={{ color: T.dim, fontSize: 11, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "1.2px" }}>✂️ PhotoRoom (recorte de fondo)</p>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", marginBottom: 12 }}>
            <p style={{ color: T.muted, fontSize: 11, lineHeight: 1.6, margin: 0 }}>
              Gratis en <a href="https://www.photoroom.com/api" target="_blank" rel="noopener noreferrer" style={{ color: T.accent }}>photoroom.com/api</a> — <strong style={{ color: T.dim }}>500 recortes/mes</strong>
            </p>
          </div>
          <ApiUsageCounter provider="photoroom" />
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 5 }}>PhotoRoom API Key</label>
            <input type="text" value={prKey} onChange={e => sprk(e.target.value)} placeholder="sk_pr_..."
              style={{ width: "100%", background: T.high, border: `1px solid ${T.border}`, borderRadius: 11, padding: "11px 13px", color: T.text, fontSize: 12, outline: "none", fontFamily: "monospace" }} />
          </div>
          <Btn onClick={savePhotoRoom} disabled={!prKey.trim()} icon={prSaved ? "✓" : "💾"} v={prSaved ? "ghost" : "primary"}>
            {prSaved ? "¡Guardada!" : "Guardar PhotoRoom key"}
          </Btn>
        </div>
        <div style={{ marginTop: 11, padding: "10px 13px", background: "rgba(201,240,78,0.05)", border: `1px solid ${T.aLow}`, borderRadius: 10 }}>
          <p style={{ color: T.muted, fontSize: 10, lineHeight: 1.7, margin: 0 }}>🔒 Keys guardadas en <strong style={{ color: T.dim }}>localStorage</strong>. Nadie externo puede acceder.</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   SCANNER SCREEN
═══════════════════════════════════════ */
function ScannerScreen({ onSave, onBack, apiKey, photoRoomKey, onNeedKey }) {
  const [phase, sp] = useState("upload");
  const [imgUrl, siu] = useState(null); const [imgB64, sib] = useState(null); const [mtype, smt] = useState("image/jpeg");
  const [result, sr] = useState(null); const [apiErr, sae] = useState(null); const [step, ss] = useState(0);
  const [countdown, scd] = useState(null); const [saving, ssv] = useState(false); const [savedAll, ssa] = useState(false);
  const [garmentImgs, sgi] = useState([]); const [selected, ssel] = useState({}); const [editNames, sen] = useState({});
  const [usingPR, supr] = useState(false);
  const fileRef = useRef(null); const timerRef = useRef(null);
  useEffect(() => () => clearInterval(timerRef.current), []);

  function readFile(file) {
    if (!file || !file.type.startsWith("image/")) { sae("Solo imágenes JPG, PNG, WEBP"); return; }
    smt("image/jpeg");
    const reader = new FileReader();
    reader.onload = ev => {
      const img2 = new Image();
      img2.onload = () => {
        const MAX = 1600; let w = img2.width, h = img2.height;
        if (w > MAX || h > MAX) { if (w > h) { h = Math.round(h * MAX / w); w = MAX; } else { w = Math.round(w * MAX / h); h = MAX; } }
        const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img2, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.82);
        siu(compressed); sib(compressed.split(",")[1]); sae(null);
      };
      img2.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function analyze() {
    if (!imgB64) return;
    if (!apiKey) { onNeedKey(); return; }
    sae(null); sp("analyzing"); ss(0); scd(30);
    timerRef.current = setInterval(() => scd(prev => { if (prev <= 1) { clearInterval(timerRef.current); return 0; } return prev - 1; }), 1000);
    [300, 900, 1600, 2400].forEach((ms, i) => setTimeout(() => ss(i + 1), ms));
    try {
      const data = await callClaude(imgB64, mtype, apiKey);
      clearInterval(timerRef.current);
      const hasPR = photoRoomKey && getApiUsage("photoroom").remaining > 0;
      supr(hasPR);
      const imgs = await buildGarmentImages(imgUrl, imgB64, data.prendas, photoRoomKey);
      sgi(imgs);
      const initSel = {}, initNames = {};
      data.prendas.forEach((p, i) => { initSel[i] = true; initNames[i] = p.nombre; });
      ssel(initSel); sen(initNames); sr(data); sp("results");
    } catch (e) { clearInterval(timerRef.current); sae(e.message); sp("upload"); }
  }

  async function saveAll() {
    const prendas = result.prendas;
    const toSave = prendas.filter((_, i) => selected[i]);
    if (!toSave.length) return;
    ssv(true);
    const garments = toSave.map(p => {
      const i = prendas.indexOf(p);
      return { name: editNames[i] || p.nombre, category: p.categoria, color: toHex(p.color_principal), emoji: EMOJI_MAP[p.categoria] || "👗", brand: p.marca_detectada || p.marca_posible || null, brand_detected: p.marca_detectada, brand_possible: p.marca_posible, brand_reason: p.razon_marca, occasion: (p.ocasiones || [])[0] || "casual", occasions_list: p.ocasiones || [], seasons: p.temporadas || [], material: p.material_estimado, pattern: p.patron, fit: p.fit, details: p.detalles, subcategory: p.subcategoria, price_range: p.precio_estimado, imageUrl: garmentImgs[i] || imgUrl, times_worn: 0, is_favorite: false, confidence: p.confianza, added_at: new Date().toISOString() };
    });
    for (let i = 0; i < garments.length; i++) { await new Promise(r => setTimeout(r, 300)); onSave(garments[i], i < garments.length - 1); }
    ssa(true);
  }

  function reset() { sp("upload"); siu(null); sib(null); sr(null); sae(null); scd(null); ssa(false); ssv(false); }
  function toggleSel(i) { ssel(p => ({ ...p, [i]: !p[i] })); }
  const numSel = Object.values(selected).filter(Boolean).length;

  if (phase === "upload") return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.bg }}>
      <input ref={fileRef} type="file" accept="image/*" onChange={e => readFile(e.target.files?.[0])} style={{ display: "none" }} />
      <div style={{ padding: "12px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>← Volver</button>
        <Logo size={15} /><div style={{ width: 55 }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 16px 20px", gap: 13, overflowY: "auto" }}>
        <div>
          <p style={{ color: T.text, fontSize: 16, fontWeight: 700, fontFamily: "'Cormorant Garamond',serif", marginBottom: 3 }}>Escanear prenda</p>
          <p style={{ color: T.muted, fontSize: 12, lineHeight: 1.6 }}>Sube una foto. La IA detecta tipo, color, marca y material.</p>
        </div>
        {!apiKey && <div onClick={onNeedKey} style={{ background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.3)", borderRadius: 12, padding: "10px 13px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 14 }}>⚠️</span><p style={{ color: T.err, fontSize: 12, margin: 0, fontWeight: 600 }}>Sin API key. Toca para configurar</p></div>}
        {photoRoomKey && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 12 }}>✂️</span><span style={{ color: T.dim, fontSize: 11 }}>Recorte con IA</span></div>
            {(() => { const u = getApiUsage("photoroom"); const color = u.remaining === 0 ? T.err : u.remaining <= 100 ? "#FF9F0A" : T.ok; return <span style={{ color, fontSize: 11, fontWeight: 700 }}>{u.remaining} / 500</span>; })()}
          </div>
        )}
        <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); readFile(e.dataTransfer.files?.[0]); }}
          style={{ flex: 1, minHeight: 220, border: `2px dashed ${imgUrl ? T.accent : T.border}`, borderRadius: 18, cursor: "pointer", background: "#0d0d0d", position: "relative", overflow: "hidden", transition: "border-color 0.2s", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          {imgUrl ? (
            <>
              <img src={imgUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(8,8,10,0.9) 0%,transparent 45%)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", bottom: 11, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
                <button onClick={e => { e.stopPropagation(); reset(); }} style={{ background: "rgba(8,8,10,0.9)", border: `1px solid ${T.border}`, color: T.text, borderRadius: 9, padding: "6px 13px", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>🗑 Cambiar foto</button>
              </div>
            </>
          ) : (<><div style={{ fontSize: 44, marginBottom: 11, opacity: 0.3 }}>📸</div><p style={{ color: T.dim, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Toca para subir foto</p><p style={{ color: T.muted, fontSize: 11, textAlign: "center", maxWidth: 190, lineHeight: 1.6 }}>JPG, PNG, WEBP</p></>)}
        </div>
        {apiErr && <p style={{ color: T.err, fontSize: 11, textAlign: "center", background: "rgba(255,77,109,0.08)", padding: "9px", borderRadius: 9, lineHeight: 1.5 }}>{apiErr}</p>}
        {imgUrl && <Btn onClick={analyze} icon="✦" disabled={!apiKey}>Analizar con IA</Btn>}
      </div>
    </div>
  );

  if (phase === "analyzing") return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: T.bg, padding: 26 }}>
      <div style={{ width: 90, height: 90, borderRadius: "50%", border: `3px solid ${T.border}`, position: "relative", marginBottom: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="42" fill="none" stroke={T.accent} strokeWidth="3" strokeDasharray={`${2 * Math.PI * 42}`} strokeDashoffset={`${2 * Math.PI * 42 * (1 - (countdown || 0) / 30)}`} style={{ transition: "stroke-dashoffset 1s linear" }} />
        </svg>
        <span style={{ color: T.accent, fontSize: 28, fontWeight: 700, fontFamily: "'Cormorant Garamond',serif", zIndex: 1 }}>{countdown ?? "…"}</span>
      </div>
      <div style={{ width: 130, height: 160, borderRadius: 16, overflow: "hidden", marginBottom: 20, position: "relative", border: `1px solid ${T.border}`, background: "#0d0d0d" }}>
        <img src={imgUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
        <div style={{ position: "absolute", inset: 0, background: "rgba(8,8,10,0.45)" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${T.border}`, borderTop: `3px solid ${T.accent}`, animation: "spin 0.8s linear infinite" }} />
        </div>
      </div>
      <p style={{ color: T.text, fontSize: 16, fontWeight: 700, marginBottom: 4, fontFamily: "'Cormorant Garamond',serif" }}>Claude Vision analizando...</p>
      <p style={{ color: T.muted, fontSize: 12, textAlign: "center", maxWidth: 220, lineHeight: 1.7, marginBottom: 18 }}>Identificando prendas, colores, marcas y material</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%", maxWidth: 240 }}>
        {[["🔍","Detectando prendas"],["🎨","Analizando colores"],["🏷️","Identificando marcas"],["📊","Generando análisis"]].map(([ic, tx], i) => (
          <div key={tx} style={{ display: "flex", alignItems: "center", gap: 9, opacity: step > i ? 1 : 0.22, transition: "opacity 0.4s" }}>
            <span style={{ fontSize: 13 }}>{ic}</span>
            <span style={{ color: step > i ? T.text : T.muted, fontSize: 12 }}>{tx}</span>
            {step === i + 1 && <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.accent, marginLeft: "auto", animation: "pulse 0.9s infinite" }} />}
            {step > i + 1 && <span style={{ color: T.ok, fontSize: 11, marginLeft: "auto" }}>✓</span>}
          </div>
        ))}
      </div>
    </div>
  );

  if (phase === "results" && result) {
    const prendas = result.prendas || [];
    if (savedAll) return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: T.bg, gap: 11 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(77,255,180,0.12)", border: `2px solid ${T.ok}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>✓</div>
        <p style={{ color: T.ok, fontWeight: 700, fontSize: 17, fontFamily: "'Cormorant Garamond',serif" }}>¡{numSel} prenda{numSel !== 1 ? "s" : ""} guardada{numSel !== 1 ? "s" : ""}!</p>
        <p style={{ color: T.muted, fontSize: 12 }}>Volviendo al armario...</p>
      </div>
    );
    if (saving) return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: T.bg, gap: 16, padding: 26 }}>
        <p style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>Guardando {numSel} prenda{numSel !== 1 ? "s" : ""}...</p>
        <div style={{ width: 200, height: 3, background: T.high, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", background: T.accent, borderRadius: 2, animation: "bar 1.5s ease forwards" }} /></div>
      </div>
    );
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.bg }}>
        <div style={{ padding: "12px 15px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={reset} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>↺ Nueva</button>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ color: T.accent, fontSize: 11, fontWeight: 700 }}>✦ {prendas.length} prenda{prendas.length !== 1 ? "s" : ""} detectada{prendas.length !== 1 ? "s" : ""}</span>
            {usingPR && <span style={{ color: T.ok, fontSize: 9 }}>✂️ Fondo eliminado con PhotoRoom</span>}
          </div>
          <button onClick={onBack} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px 100px" }}>
          <p style={{ color: T.muted, fontSize: 11, marginBottom: 10 }}>Selecciona las prendas a guardar:</p>
          {prendas.map((p, i) => {
            const isSel = selected[i];
            return (
              <div key={i} style={{ background: T.surface, border: `2px solid ${isSel ? T.accent : T.border}`, borderRadius: 16, marginBottom: 11, overflow: "hidden", transition: "border-color 0.2s" }}>
                <div style={{ display: "flex" }}>
                  <div style={{ width: 90, height: 90, background: "#fff", flexShrink: 0, overflow: "hidden" }}>
                    <img src={garmentImgs[i] || imgUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                  <div style={{ flex: 1, padding: "10px 12px", minWidth: 0 }}>
                    <input value={editNames[i] || ""} onChange={e => sen(prev => ({ ...prev, [i]: e.target.value }))}
                      style={{ background: "none", border: "none", outline: "none", color: T.text, fontSize: 13, fontWeight: 700, width: "100%", marginBottom: 5, fontFamily: "'Sora',system-ui" }} />
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
                      <Tag>{p.subcategoria || p.categoria}</Tag>
                      {p.marca_detectada && <Tag hi>{p.marca_detectada}</Tag>}
                      {p.color_principal && <Tag>{p.color_principal}</Tag>}
                    </div>
                    {p.material_estimado && <p style={{ color: T.muted, fontSize: 10, margin: 0 }}>{p.material_estimado}</p>}
                  </div>
                  <button onClick={() => toggleSel(i)} style={{ width: 44, background: "none", border: "none", borderLeft: `1px solid ${T.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: isSel ? T.accent : T.high, border: `2px solid ${isSel ? T.accent : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                      {isSel && <span style={{ color: "#08080A", fontSize: 12, fontWeight: 900 }}>✓</span>}
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "12px 14px 16px", background: T.bg, borderTop: `1px solid ${T.border}` }}>
          <Btn onClick={saveAll} disabled={numSel === 0} icon="→">{numSel === 0 ? "Selecciona al menos una" : `Guardar ${numSel} prenda${numSel !== 1 ? "s" : ""}`}</Btn>
        </div>
      </div>
    );
  }
  return null;
}

/* ═══════════════════════════════════════
   EDIT MODAL
═══════════════════════════════════════ */
function EditModal({ garment, onSave, onClose, onDelete }) {
  const [name, sn] = useState(garment.name); const [brand, sb] = useState(garment.brand || "");
  const [cat, sc] = useState(garment.category); const [occ, so] = useState(garment.occasion);
  const [mat, sm] = useState(garment.material || ""); const [szn, ss] = useState(garment.seasons || []);
  const [fav, sf] = useState(garment.is_favorite || false); const [confirmDel, scd] = useState(false);
  const tS = s => ss(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  return (
    <Sheet>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 15px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <p style={{ color: T.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px" }}>Editar prenda</p>
        <button onClick={onClose} style={{ background: T.high, border: `1px solid ${T.border}`, color: T.text, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>✕</button>
      </div>
      <div style={{ width: 75, height: 90, borderRadius: 12, margin: "10px auto", overflow: "hidden", border: `1px solid ${T.border}`, background: "#0d0d0d", flexShrink: 0 }}>
        {garment.imageUrl ? <img src={garment.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div style={{ width: "100%", height: "100%", background: garment.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>{garment.emoji}</div>}
      </div>
      <div style={{ padding: "0 15px 24px", flex: 1, overflowY: "auto" }}>
        <Field label="Nombre" value={name} onChange={sn} placeholder="Nombre" icon="✏️" />
        <Field label="Marca" value={brand} onChange={sb} placeholder="Ej: Zara, Nike..." icon="🏷️" />
        <Field label="Material" value={mat} onChange={sm} placeholder="Ej: Algodón 100%..." icon="🧵" />
        <SField label="Categoría" value={cat} onChange={sc} options={CAT_KEYS} lmap={{ top:"Top",bottom:"Pantalón",dress:"Vestido",outerwear:"Abrigo",shoes:"Zapatos",bag:"Bolso",accessory:"Accesorio" }} />
        <SField label="Ocasión" value={occ} onChange={so} options={OCC_KEYS} lmap={OCC_LBL} />
        <MSelect label="Temporadas" options={SZN_KEYS} selected={szn} onToggle={tS} lmap={SZN_LBL} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11, padding: "10px 13px", marginBottom: 14 }}>
          <span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>⭐ Favorita</span>
          <button onClick={() => sf(!fav)} style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: fav ? T.accent : T.high, position: "relative", transition: "all 0.2s" }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: fav ? "#08080A" : "#555", position: "absolute", top: 3, left: fav ? 21 : 3, transition: "all 0.2s" }} />
          </button>
        </div>
        <Btn onClick={() => onSave({ ...garment, name, brand: brand || null, category: cat, occasion: occ, material: mat, seasons: szn, is_favorite: fav })} icon="✓">Guardar cambios</Btn>
        <div style={{ height: 7 }} /><Btn onClick={onClose} v="ghost">Cancelar</Btn>
        <div style={{ height: 14 }} />
        {!confirmDel ? <Btn onClick={() => scd(true)} danger icon="🗑">Eliminar prenda</Btn>
          : <div style={{ background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.3)", borderRadius: 11, padding: "11px 13px" }}>
            <p style={{ color: T.err, fontSize: 12, fontWeight: 700, marginBottom: 9, textAlign: "center" }}>¿Eliminar esta prenda?</p>
            <div style={{ display: "flex", gap: 7 }}><Btn onClick={onDelete} danger icon="🗑">Sí, eliminar</Btn><Btn onClick={() => scd(false)} v="ghost">Cancelar</Btn></div>
          </div>}
      </div>
    </Sheet>
  );
}

/* ═══════════════════════════════════════
   OUTFIT MODAL
═══════════════════════════════════════ */
function OutfitModal({ garments, startWith, onSave, onClose }) {
  const [name, sn] = useState("Mi outfit"); const [sel, ss] = useState(startWith ? [startWith.id] : []); const [occ, so] = useState("casual"); const [saved, sv] = useState(false);
  const tog = id => ss(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const picked = garments.filter(g => sel.includes(g.id));
  function save() { if (sel.length < 2) return; sv(true); setTimeout(() => onSave({ id: `o_${Date.now()}`, name, garmentIds: sel, occasion: occ, created_at: new Date().toISOString() }), 900); }
  if (saved) return <Sheet><div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 11 }}><div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(77,255,180,0.12)", border: `2px solid ${T.ok}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>✓</div><p style={{ color: T.ok, fontWeight: 700, fontSize: 16, fontFamily: "'Cormorant Garamond',serif" }}>¡Outfit guardado!</p></div></Sheet>;
  return (
    <Sheet>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 15px 10px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <p style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>👔 Crear outfit</p>
        <button onClick={onClose} style={{ background: T.high, border: `1px solid ${T.border}`, color: T.text, borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        <Field label="Nombre" value={name} onChange={sn} placeholder="Ej: Look de oficina" icon="✏️" />
        <SField label="Ocasión" value={occ} onChange={so} options={OCC_KEYS} lmap={OCC_LBL} />
        {picked.length > 0 && <div style={{ marginBottom: 12 }}><p style={{ color: T.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.3px", marginBottom: 6 }}>Tu combinación</p><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{picked.map(g => <div key={g.id} style={{ width: 52, height: 62, borderRadius: 10, overflow: "hidden", border: `2px solid ${T.accent}`, position: "relative", flexShrink: 0, background: "#0d0d0d" }}>{g.imageUrl ? <img src={g.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div style={{ width: "100%", height: "100%", background: g.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{g.emoji}</div>}<button onClick={() => tog(g.id)} style={{ position: "absolute", top: -4, right: -4, width: 15, height: 15, borderRadius: "50%", background: T.err, border: "none", color: "#fff", fontSize: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button></div>)}</div></div>}
        <p style={{ color: T.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.3px", marginBottom: 6 }}>Todas las prendas (mín. 2)</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 15 }}>
          {garments.map(g => { const s = sel.includes(g.id); return <div key={g.id} onClick={() => tog(g.id)} style={{ borderRadius: 10, overflow: "hidden", cursor: "pointer", border: `2px solid ${s ? T.accent : T.border}`, transition: "all 0.15s", transform: s ? "scale(1.04)" : "scale(1)" }}><div style={{ height: 64, background: "#0d0d0d", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{g.imageUrl ? <img src={g.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : g.emoji}{s && <div style={{ position: "absolute", inset: 0, background: "rgba(201,240,78,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✓</div>}</div><div style={{ background: T.surface, padding: "3px 5px" }}><p style={{ color: T.text, fontSize: 9, fontWeight: 600, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</p></div></div>; })}
        </div>
        <Btn onClick={save} disabled={sel.length < 2} icon="✓">{sel.length < 2 ? `Selecciona ${2 - sel.length} más` : `Guardar outfit (${sel.length})`}</Btn>
        <div style={{ height: 7 }} /><Btn onClick={onClose} v="ghost">Cancelar</Btn>
      </div>
    </Sheet>
  );
}

/* ═══════════════════════════════════════
   DETAIL SCREEN
═══════════════════════════════════════ */
function DetailScreen({ garment, garments, onBack, onUpdate, onDelete }) {
  const [fav, sf] = useState(garment.is_favorite || false); const [modal, sm] = useState(null); const [wornToast, swt] = useState(false);
  function handleFav() { const nf = !fav; sf(nf); onUpdate({ ...garment, is_favorite: nf }); }
  function handleWorn() { onUpdate({ ...garment, times_worn: (garment.times_worn || 0) + 1, last_worn: new Date().toISOString() }); swt(true); setTimeout(() => swt(false), 2000); }
  return (
    <div style={{ height: "100%", position: "relative", background: T.bg }}>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ height: 215, position: "relative", flexShrink: 0, overflow: "hidden", background: "#0d0d0d" }}>
          {garment.imageUrl ? <img src={garment.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div style={{ width: "100%", height: "100%", background: garment.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80 }}>{garment.emoji}</div>}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,0.35),rgba(0,0,0,0.05) 40%,rgba(8,8,10,0.9))" }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "12px 14px", display: "flex", justifyContent: "space-between", zIndex: 2 }}>
            <button onClick={onBack} style={{ background: "rgba(0,0,0,0.65)", border: "none", color: "#fff", borderRadius: 9, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>← Volver</button>
            <button onClick={handleFav} style={{ background: "rgba(0,0,0,0.65)", border: "none", color: fav ? "#FFD700" : "#fff", borderRadius: 9, padding: "6px 12px", cursor: "pointer", fontSize: 15 }}>{fav ? "⭐" : "☆"}</button>
          </div>
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 14px", zIndex: 2 }}>
            <h2 style={{ color: "#fff", fontSize: 19, fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, marginBottom: 2 }}>{garment.name}</h2>
            {garment.brand && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>by {garment.brand}</p>}
          </div>
        </div>
        <div style={{ padding: "13px 14px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Tag hi>{garment.occasion}</Tag>
            <button onClick={handleWorn} style={{ background: T.aLow, border: `1px solid ${T.accent}`, color: T.accent, borderRadius: 8, padding: "5px 11px", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}>+ Registrar uso</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
            {[["Categoría", garment.category], ["Veces puesto", `${garment.times_worn || 0}x`], ["Material", garment.material || "—"]].map(([k, v]) => (
              <div key={k} style={{ background: T.high, border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 7px", textAlign: "center" }}>
                <p style={{ color: T.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 2px" }}>{k}</p>
                <p style={{ color: T.text, fontSize: 11, fontWeight: 700, margin: 0, textTransform: "capitalize" }}>{v}</p>
              </div>
            ))}
          </div>
          {garment.seasons?.length > 0 && <div style={{ marginBottom: 9 }}><p style={{ color: T.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.3px", marginBottom: 4 }}>Temporadas</p><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{garment.seasons.map(s => <Tag key={s}>{SZN_LBL[s] || s}</Tag>)}</div></div>}
          {garment.occasions_list?.length > 0 && <div style={{ marginBottom: 13 }}><p style={{ color: T.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.3px", marginBottom: 4 }}>Ocasiones</p><div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{garment.occasions_list.map(o => <Tag key={o} hi>{OCC_LBL[o] || o}</Tag>)}</div></div>}
          {garment.details && <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11, padding: "9px 12px", marginBottom: 13 }}><p style={{ color: T.muted, fontSize: 9, textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 3 }}>Detalles IA</p><p style={{ color: T.dim, fontSize: 11, lineHeight: 1.7, margin: 0 }}>{garment.details}</p></div>}
          <div style={{ display: "flex", gap: 7 }}>
            <Btn onClick={() => sm("outfit")} icon="👔">Crear outfit</Btn>
            <Btn onClick={() => sm("edit")} v="ghost" icon="✏️" full={false}>Editar</Btn>
          </div>
        </div>
      </div>
      {wornToast && <Toast msg="¡Uso registrado!" type="ok" />}
      {modal === "edit" && <EditModal garment={garment} onSave={u => { onUpdate(u); sm(null); }} onClose={() => sm(null)} onDelete={() => onDelete(garment.id)} />}
      {modal === "outfit" && <OutfitModal garments={garments} startWith={garment} onSave={() => sm(null)} onClose={() => sm(null)} />}
    </div>
  );
}

/* ═══════════════════════════════════════
   OUTFITS SCREEN
═══════════════════════════════════════ */
function OutfitsScreen({ outfits, garments, onNew, onDeleteOutfit }) {
  const [confirmDel, scd] = useState(null);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.bg }}>
      <div style={{ padding: "13px 14px 10px", borderBottom: `1px solid ${T.border}`, flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ color: T.text, fontSize: 16, fontWeight: 700, fontFamily: "'Cormorant Garamond',serif" }}>Mis Outfits</p>
        <Btn onClick={onNew} icon="+" full={false} sm>Nuevo</Btn>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 13px 84px" }}>
        {outfits.length === 0 ? <div style={{ textAlign: "center", padding: "60px 0" }}><div style={{ fontSize: 40, marginBottom: 10 }}>👔</div><p style={{ color: T.muted, fontSize: 13, marginBottom: 16 }}>Aún no tienes outfits</p><Btn onClick={onNew} icon="+" full={false}>Crear primer outfit</Btn></div>
          : outfits.map(o => {
            const pieces = garments.filter(g => o.garmentIds.includes(g.id));
            return (
              <div key={o.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 13px", marginBottom: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div><p style={{ color: T.text, fontSize: 13, fontWeight: 700, margin: "0 0 3px" }}>{o.name}</p><Tag hi>{OCC_LBL[o.occasion] || o.occasion}</Tag></div>
                  <button onClick={() => scd(o.id)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14 }}>✕</button>
                </div>
                <div style={{ display: "flex", gap: 5 }}>{pieces.map(g => <div key={g.id} style={{ width: 46, height: 54, borderRadius: 9, overflow: "hidden", border: `1px solid ${T.border}`, background: "#0d0d0d", flexShrink: 0 }}>{g.imageUrl ? <img src={g.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div style={{ width: "100%", height: "100%", background: g.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{g.emoji}</div>}</div>)}</div>
                {confirmDel === o.id && <div style={{ marginTop: 10, display: "flex", gap: 7 }}><Btn onClick={() => { onDeleteOutfit(o.id); scd(null); }} danger sm icon="🗑">Eliminar</Btn><Btn onClick={() => scd(null)} v="ghost" sm>Cancelar</Btn></div>}
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   STATS SCREEN
═══════════════════════════════════════ */
function StatsScreen({ garments }) {
  const total = garments.length, favs = garments.filter(g => g.is_favorite).length, totalWorn = garments.reduce((a, g) => a + (g.times_worn || 0), 0);
  const mostWorn = [...garments].sort((a, b) => (b.times_worn || 0) - (a.times_worn || 0)).slice(0, 3);
  const byCategory = CAT_KEYS.reduce((acc, k) => ({ ...acc, [k]: garments.filter(g => g.category === k).length }), {});
  const maxCat = Math.max(...Object.values(byCategory), 1);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.bg }}>
      <div style={{ padding: "13px 14px 10px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}><p style={{ color: T.text, fontSize: 16, fontWeight: 700, fontFamily: "'Cormorant Garamond',serif" }}>Estadísticas</p></div>
      <div style={{ flex: 1, overflowY: "auto", padding: "13px 13px 84px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[["👗", total, "Total prendas"], ["⭐", favs, "Favoritas"], ["👟", totalWorn, "Total usos"], ["📊", Object.values(byCategory).filter(v => v > 0).length, "Categorías"]].map(([ic, v, lb]) => (
            <div key={lb} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px 12px", textAlign: "center" }}>
              <p style={{ fontSize: 22, margin: "0 0 3px" }}>{ic}</p>
              <p style={{ color: T.accent, fontSize: 22, fontWeight: 700, margin: "0 0 2px", fontFamily: "'Cormorant Garamond',serif" }}>{v}</p>
              <p style={{ color: T.muted, fontSize: 10 }}>{lb}</p>
            </div>
          ))}
        </div>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "13px 14px", marginBottom: 12 }}>
          <p style={{ color: T.dim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.3px", marginBottom: 12 }}>Por categoría</p>
          {CAT_KEYS.map(k => { const count = byCategory[k] || 0; if (!count) return null; return (<div key={k} style={{ marginBottom: 9 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ color: T.text, fontSize: 11 }}>{EMOJI_MAP[k]} {CAT_LBL[k]}</span><span style={{ color: T.accent, fontSize: 11, fontWeight: 700 }}>{count}</span></div><div style={{ height: 4, background: T.high, borderRadius: 2, overflow: "hidden" }}><div style={{ height: "100%", background: T.accent, borderRadius: 2, width: `${(count / maxCat) * 100}%`, transition: "width 0.6s ease" }} /></div></div>); })}
        </div>
        {mostWorn.length > 0 && <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "13px 14px" }}><p style={{ color: T.dim, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.3px", marginBottom: 10 }}>Más usadas</p>{mostWorn.map((g, i) => (<div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}><span style={{ color: i === 0 ? T.accent : T.muted, fontSize: 13, fontWeight: 700, width: 16, textAlign: "center" }}>{i + 1}</span><div style={{ width: 36, height: 42, borderRadius: 8, overflow: "hidden", border: `1px solid ${T.border}`, background: "#0d0d0d", flexShrink: 0 }}>{g.imageUrl ? <img src={g.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div style={{ width: "100%", height: "100%", background: g.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{g.emoji}</div>}</div><div style={{ flex: 1 }}><p style={{ color: T.text, fontSize: 12, fontWeight: 600, margin: "0 0 2px" }}>{g.name}</p><p style={{ color: T.muted, fontSize: 10 }}>{g.brand || g.category}</p></div><span style={{ color: T.accent, fontSize: 12, fontWeight: 700 }}>{g.times_worn || 0}x</span></div>))}</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   PROFILE SCREEN
═══════════════════════════════════════ */
function ProfileScreen({ user, garments, onLogout, onApiKey, apiKey, photoRoomKey }) {
  const added = garments.filter(g => g.added_at && new Date(g.added_at) > new Date(Date.now() - 7 * 24 * 3600 * 1000)).length;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.bg }}>
      <div style={{ padding: "13px 14px 10px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}><p style={{ color: T.text, fontSize: 16, fontWeight: 700, fontFamily: "'Cormorant Garamond',serif" }}>Perfil</p></div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 84px" }}>
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: "16px 14px", marginBottom: 14, display: "flex", gap: 13, alignItems: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#08080A", flexShrink: 0 }}>{user.name[0].toUpperCase()}</div>
          <div><p style={{ color: T.text, fontSize: 15, fontWeight: 700, margin: "0 0 3px", fontFamily: "'Cormorant Garamond',serif" }}>{user.name}</p><p style={{ color: T.muted, fontSize: 11, margin: 0 }}>{user.email}</p></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 14 }}>
          {[[garments.length, "Prendas"], [garments.filter(g => g.is_favorite).length, "Favoritas"], [added, "Esta semana"]].map(([v, lb]) => (
            <div key={lb} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 11, padding: "10px 8px", textAlign: "center" }}>
              <p style={{ color: T.accent, fontSize: 19, fontWeight: 700, margin: "0 0 2px", fontFamily: "'Cormorant Garamond',serif" }}>{v}</p>
              <p style={{ color: T.muted, fontSize: 10 }}>{lb}</p>
            </div>
          ))}
        </div>
        {photoRoomKey && <ApiUsageCounter provider="photoroom" />}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 12 }}>
          {[{ icon:"🔑", label:"APIs configuradas", sub:`Claude ${apiKey?"✓":"✗"} · PhotoRoom ${photoRoomKey?"✓":"✗"}`, action:onApiKey, ok:!!apiKey }, { icon:"📤", label:"Exportar armario", sub:"Próximamente", action:null, ok:false }].map((item, i) => (
            <button key={i} onClick={item.action || undefined} disabled={!item.action} style={{ width: "100%", background: "none", border: "none", borderBottom: i === 0 ? `1px solid ${T.border}` : "none", padding: "13px 14px", cursor: item.action ? "pointer" : "default", display: "flex", alignItems: "center", gap: 11, textAlign: "left", fontFamily: "inherit" }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              <div style={{ flex: 1 }}><p style={{ color: T.text, fontSize: 12, fontWeight: 600, margin: "0 0 2px" }}>{item.label}</p><p style={{ color: item.ok ? T.ok : T.muted, fontSize: 10, margin: 0 }}>{item.sub}</p></div>
              {item.action && <span style={{ color: T.muted, fontSize: 12 }}>→</span>}
            </button>
          ))}
        </div>
        <Btn onClick={onLogout} v="ghost" icon="🚪" danger>Cerrar sesión</Btn>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   HOME SCREEN
═══════════════════════════════════════ */
function HomeScreen({ user, garments, onScan, onOpenGarment, onConfig, apiKey }) {
  const [cat, sc] = useState("Todos"); const [q, sq] = useState("");
  const items = garments.filter(g => (cat === "Todos" || g.category === cat) && (!q || g.name.toLowerCase().includes(q.toLowerCase()) || (g.brand || "").toLowerCase().includes(q.toLowerCase())));
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: T.bg, position: "relative" }}>
      <div style={{ padding: "13px 14px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div><p style={{ color: T.muted, fontSize: 10, margin: "0 0 1px", textTransform: "uppercase", letterSpacing: "1.4px" }}>Bienvenido</p><p style={{ color: T.text, fontSize: 18, fontWeight: 700, margin: 0, fontFamily: "'Cormorant Garamond',serif" }}>{user.name}</p></div>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <div style={{ background: T.high, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 9px" }}><span style={{ color: T.dim, fontSize: 11, fontWeight: 600 }}>{garments.length} prendas</span></div>
            <button onClick={onConfig} style={{ width: 32, height: 32, borderRadius: 9, background: apiKey ? T.high : "rgba(255,77,109,0.15)", border: `1px solid ${apiKey ? T.border : "rgba(255,77,109,0.4)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
              <span style={{ fontSize: 14 }}>⚙️</span>
              {!apiKey && <span style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: "50%", background: T.err, border: `1.5px solid ${T.bg}` }} />}
            </button>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#08080A" }}>{user.name[0].toUpperCase()}</div>
          </div>
        </div>
        <div style={{ position: "relative", marginBottom: 9 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, fontSize: 12, pointerEvents: "none" }}>🔍</span>
          <input value={q} onChange={e => sq(e.target.value)} placeholder="Buscar prendas o marcas..." style={{ width: "100%", background: T.high, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 10px 9px 32px", color: T.text, fontSize: 12, outline: "none" }} />
        </div>
        <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 10 }}>{CATS.map(c => <Pill key={c} label={CAT_LBL[c] || c} active={cat === c} onClick={() => sc(c)} />)}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 11px 84px" }}>
        {items.length === 0 ? <div style={{ textAlign: "center", padding: "50px 0" }}><div style={{ fontSize: 36, marginBottom: 8 }}>👗</div><p style={{ color: T.muted, fontSize: 12 }}>{q ? "Sin resultados" : "No hay prendas aquí"}</p></div>
          : <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{items.map(g => <GarmentCard key={g.id} g={g} onClick={() => onOpenGarment(g)} />)}</div>}
      </div>
      <button onClick={onScan} style={{ position: "absolute", bottom: 72, right: 13, width: 50, height: 50, borderRadius: "50%", background: T.accent, border: "none", cursor: "pointer", fontSize: 19, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 24px ${T.aMid},0 0 0 4px ${T.bg}`, animation: "glow 2.5s infinite" }}>📸</button>
    </div>
  );
}

/* ═══════════════════════════════════════
   BOTTOM NAV
═══════════════════════════════════════ */
function BottomNav({ active, onChange }) {
  const tabs = [["🏠","Armario","home"],["👔","Outfits","outfits"],["📊","Stats","stats"],["👤","Perfil","profile"]];
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: T.surface, borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "flex-start", justifyContent: "space-around", zIndex: 100, paddingBottom: "var(--sab)" }}>
      {tabs.map(([ic, lb, id]) => (
        <button key={id} onClick={() => onChange(id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", flex: 1, padding: "6px 0" }}>
          <span style={{ fontSize: 17 }}>{ic}</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: active === id ? T.accent : T.muted, transition: "color 0.2s" }}>{lb}</span>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════
   ROOT APP
═══════════════════════════════════════ */
export default function App() {
  const [screen, ss] = useState("auth");
  const [tab, st] = useState("home");
  const [user, su] = useState(null);
  const [items, si] = useState([]);
  const [outfits, so] = useState([]);
  const [sel, ssel] = useState(null);
  const [apiKey, sak] = useState(() => DB.getApiKey());
  const [photoRoomKey, sprk] = useState(() => DB.getPhotoRoomKey());
  const [outfitNew, son] = useState(false);
  const [toast, stt] = useState(null);

  // ★ Restaura sesión persistente al montar
  useEffect(() => {
    const session = restoreSession();
    if (session) { su(session); si(DB.getGarments(session.id)); so(DB.getOutfits(session.id)); ss("app"); }
  }, []);

  function showToast(msg, type = "ok") { stt({ msg, type }); setTimeout(() => stt(null), 2200); }
  function login(u) { su(u); si(DB.getGarments(u.id)); so(DB.getOutfits(u.id)); ss("app"); }
  function logout() { DB.clearSession(); su(null); si([]); so([]); ssel(null); ss("auth"); st("home"); }

  function saveGarment(g, keepScreen = false) {
    if (!g) { ss("app"); return; }
    si(prev => { const next = [{ id: `g_${Date.now()}_${Math.random().toString(36).slice(2)}`, ...g }, ...prev]; DB.saveGarments(user.id, next); return next; });
    if (!keepScreen) { ss("app"); showToast("¡Prendas guardadas ✓"); }
  }

  function updateGarment(u) { si(prev => { const next = prev.map(g => g.id === u.id ? u : g); DB.saveGarments(user.id, next); return next; }); ssel(u); }
  function deleteGarment(id) { si(prev => { const next = prev.filter(g => g.id !== id); DB.saveGarments(user.id, next); return next; }); ssel(null); ss("app"); st("home"); showToast("Prenda eliminada", "err"); }
  function saveOutfit(o) { so(prev => { const next = [o, ...prev]; DB.saveOutfits(user.id, next); return next; }); son(false); showToast("Outfit guardado ✓"); }
  function deleteOutfit(id) { so(prev => { const next = prev.filter(o => o.id !== id); DB.saveOutfits(user.id, next); return next; }); showToast("Outfit eliminado", "err"); }
  function saveKey(k) { sak(k); showToast("Claude API key guardada ✓"); ss("app"); }
  function savePhotoRoomKey(k) { sprk(k); showToast("PhotoRoom key guardada ✓"); }

  return (
    <div style={{ width: "100%", height: "100dvh", background: T.bg, fontFamily: "'Sora',system-ui,sans-serif", position: "relative", overflow: "hidden", paddingTop: "var(--sat)" }}>
      <style>{CSS}</style>
      <div style={{ height: "100%", display: "flex", flexDirection: "column", position: "relative" }}>
        {screen === "auth" && <AuthScreen onLogin={login} />}
        {screen === "apikey" && <ApiKeyScreen onSave={saveKey} onBack={() => ss("app")} current={apiKey} currentPhotoRoom={photoRoomKey} onSavePhotoRoom={savePhotoRoomKey} />}
        {screen === "scanner" && <ScannerScreen onSave={saveGarment} onBack={() => ss("app")} apiKey={apiKey} photoRoomKey={photoRoomKey} onNeedKey={() => ss("apikey")} />}
        {screen === "detail" && sel && <DetailScreen garment={sel} garments={items} onBack={() => ss("app")} onUpdate={updateGarment} onDelete={deleteGarment} />}
        {screen === "app" && (
          <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
              {tab === "home" && <HomeScreen user={user} garments={items} onScan={() => ss("scanner")} onOpenGarment={g => { ssel(g); ss("detail"); }} onConfig={() => ss("apikey")} apiKey={apiKey} />}
              {tab === "outfits" && <OutfitsScreen outfits={outfits} garments={items} onNew={() => son(true)} onDeleteOutfit={deleteOutfit} />}
              {tab === "stats" && <StatsScreen garments={items} />}
              {tab === "profile" && <ProfileScreen user={user} garments={items} onLogout={logout} onApiKey={() => ss("apikey")} apiKey={apiKey} photoRoomKey={photoRoomKey} />}
            </div>
            <BottomNav active={tab} onChange={st} />
            {outfitNew && <div style={{ position: "absolute", inset: 0, zIndex: 250 }}><OutfitModal garments={items} startWith={null} onSave={saveOutfit} onClose={() => son(false)} /></div>}
          </div>
        )}
        {toast && screen !== "scanner" && <Toast msg={toast.msg} type={toast.type} />}
      </div>
    </div>
  );
}
