import { useState, useRef, useEffect } from "react";

/* ─────────────────────────────────────────────────────────────
   THEME
───────────────────────────────────────────────────────────── */
const T = {
  bg:      "#08080A",
  surface: "#111116",
  high:    "#1C1C23",
  border:  "#26262E",
  accent:  "#C9F04E",
  aLow:    "rgba(201,240,78,0.13)",
  aMid:    "rgba(201,240,78,0.26)",
  text:    "#EFEFEF",
  muted:   "#55555F",
  dim:     "#888896",
  ok:      "#4DFFB4",
  err:     "#FF4D6D",
};

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const CATS     = ["Todos","top","bottom","dress","outerwear","shoes","bag","accessory"];
const CAT_LBL  = { Todos:"Todos",top:"Tops",bottom:"Pantalones",dress:"Vestidos",outerwear:"Abrigos",shoes:"Zapatos",bag:"Bolsos",accessory:"Accesorios" };
const SZN_LBL  = { spring:"🌸 Primavera",summer:"☀️ Verano",autumn:"🍂 Otoño",winter:"❄️ Invierno",all_season:"🌍 Todo año" };
const OCC_LBL  = { casual:"Casual",formal:"Formal",business:"Business",sport:"Sport",party:"Party",beach:"Beach",home:"Casa",outdoor:"Outdoor" };
const OCC_KEYS = ["casual","formal","business","sport","party","beach","home","outdoor"];
const SZN_KEYS = ["spring","summer","autumn","winter","all_season"];
const CAT_KEYS = ["top","bottom","dress","outerwear","shoes","bag","accessory"];
const EMOJI_MAP= { top:"👕",bottom:"👖",dress:"👗",outerwear:"🧥",shoes:"👟",bag:"👜",accessory:"💍" };
const COLOR_HEX = {
  negro:"#1a1a1a",blanco:"#f0f0f0",gris:"#888",azul:"#1a3a6c",marino:"#0a1a3a",
  celeste:"#7ec8e3",rojo:"#8b1a1a",rosa:"#d4687a",morado:"#5a2a7a",lila:"#9a7ac8",
  verde:"#1a5a2a",oliva:"#6b7a2a",naranja:"#c86a1a",amarillo:"#c8b41a",
  marron:"#6a3a1a",beige:"#d4c4a0",camel:"#c4a060",crema:"#f0e8d0",
  nude:"#d4b090",burdeos:"#6a1a2a",tostado:"#a07040",
  white:"#f0f0f0",black:"#1a1a1a",blue:"#1a3a6c",red:"#8b1a1a",
  green:"#1a5a2a",pink:"#d4687a",gray:"#888",grey:"#888",brown:"#6a3a1a",
};
const API_LIMITS = { removebg:50, photoroom:500 };

function toHex(n) {
  if (!n) return "#2a2a2a";
  return COLOR_HEX[n.toLowerCase().trim().split(" ")[0]] || "#2a2a2a";
}

/* ─────────────────────────────────────────────────────────────
   SAFE JSON PARSE
   Handles Claude responses wrapped in markdown fences
───────────────────────────────────────────────────────────── */
function safeParseJSON(text) {
  if (!text) throw new Error("Respuesta vacía de la IA");
  // Strip markdown fences
  let s = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
  // Direct parse
  try { return JSON.parse(s); } catch (_) {}
  // Extract object
  const om = s.match(/(\{[\s\S]*\})/);
  if (om) { try { return JSON.parse(om[1]); } catch (_) {} }
  // Extract array
  const am = s.match(/(\[[\s\S]*\])/);
  if (am) { try { return JSON.parse(am[1]); } catch (_) {} }
  // Try repairing truncated JSON
  try { return JSON.parse(s + "]}"); } catch (_) {}
  throw new Error("No se pudo leer la respuesta de la IA. Intenta de nuevo.");
}

/* ─────────────────────────────────────────────────────────────
   SESSION PERSISTENCE
───────────────────────────────────────────────────────────── */
function restoreSession() {
  try {
    const raw = localStorage.getItem("cai_session");
    if (!raw) return null;
    const sess = JSON.parse(raw);
    const users = JSON.parse(localStorage.getItem("cai_users") || "{}");
    if (!users[sess.email]) { localStorage.removeItem("cai_session"); return null; }
    return sess;
  } catch { localStorage.removeItem("cai_session"); return null; }
}

/* ─────────────────────────────────────────────────────────────
   API USAGE COUNTER
───────────────────────────────────────────────────────────── */
function getApiUsage(provider) {
  const limit = API_LIMITS[provider] || 500;
  try {
    const raw = localStorage.getItem("cai_" + provider + "_usage");
    if (!raw) return { count:0, remaining:limit };
    const { count, month } = JSON.parse(raw);
    const cur = new Date().toISOString().slice(0,7);
    if (month !== cur) {
      localStorage.setItem("cai_" + provider + "_usage", JSON.stringify({ count:0, month:cur }));
      return { count:0, remaining:limit };
    }
    return { count, remaining:Math.max(0, limit - count) };
  } catch { return { count:0, remaining:limit }; }
}
function incrementApiUsage(provider) {
  const limit = API_LIMITS[provider] || 500;
  const cur = new Date().toISOString().slice(0,7);
  const { count } = getApiUsage(provider);
  localStorage.setItem("cai_" + provider + "_usage", JSON.stringify({ count:count+1, month:cur }));
}
function daysUntilReset() {
  const now = new Date();
  return Math.ceil((new Date(now.getFullYear(), now.getMonth()+1, 1) - now) / 86400000);
}

/* ─────────────────────────────────────────────────────────────
   LOCAL DB
───────────────────────────────────────────────────────────── */
const DB = {
  getUsers:        () => { try { return JSON.parse(localStorage.getItem("cai_users")||"{}"); } catch { return {}; } },
  saveUsers:       (u) => localStorage.setItem("cai_users", JSON.stringify(u)),
  getGarments:     (uid) => { try { return JSON.parse(localStorage.getItem("cai_garments_"+uid)||"[]"); } catch { return []; } },
  saveGarments:    (uid,g) => localStorage.setItem("cai_garments_"+uid, JSON.stringify(g)),
  getOutfits:      (uid) => { try { return JSON.parse(localStorage.getItem("cai_outfits_"+uid)||"[]"); } catch { return []; } },
  saveOutfits:     (uid,o) => localStorage.setItem("cai_outfits_"+uid, JSON.stringify(o)),
  getApiKey:       () => localStorage.getItem("cai_gemini_key")||"",
  saveApiKey:      (k) => localStorage.setItem("cai_gemini_key", k),
  getPhotoRoomKey: () => localStorage.getItem("cai_photoroom_key")||"",
  savePhotoRoomKey:(k) => localStorage.setItem("cai_photoroom_key", k),
  getRemoveBgKey:  () => localStorage.getItem("cai_removebg_key")||"",
  saveRemoveBgKey: (k) => localStorage.setItem("cai_removebg_key", k),
  saveSession:     (u) => localStorage.setItem("cai_session", JSON.stringify(u)),
  clearSession:    () => localStorage.removeItem("cai_session"),
};

/* ─────────────────────────────────────────────────────────────
   CLAUDE VISION API
   ★ FIXED: correct body structure, correct model, full prompt
───────────────────────────────────────────────────────────── */
const VISION_PROMPT = `You are a fashion expert. Analyze the image and identify ALL visible garments.
IGNORE: phone cases, technology accessories, hands, faces, furniture, non-clothing objects.

For each garment provide its bounding box as fractions (0.0–1.0):
  bbox_x = left edge, bbox_y = top edge, bbox_w = width, bbox_h = height

Only include garments with confidence >= 0.6.

Respond ONLY with pure JSON — no markdown, no code fences, no extra text:

{"prendas":[{"nombre":"descriptive name in Spanish","categoria":"top|bottom|dress|outerwear|shoes|bag|accessory","subcategoria":"exact type in Spanish","color_principal":"main color in Spanish","colores":["c1","c2"],"marca_detectada":null,"marca_posible":null,"razon_marca":null,"material_estimado":"estimated fabric","patron":"solid|stripes|plaid|floral|geometric|animal_print|graphic|denim|knit","fit":"slim|regular|oversized|wide|fitted|cropped","temporadas":["all_season"],"ocasiones":["casual"],"detalles":"notable details","estado_visible":"nuevo|excelente|bueno|usado","precio_estimado":"estimated price range in euros","confianza":0.95,"bbox_x":0.1,"bbox_y":0.05,"bbox_w":0.8,"bbox_h":0.7}],"conjunto_analisis":"overall analysis if multiple garments","estilo_general":"casual|smart_casual|formal|sporty|bohemian|streetwear|elegante|otro"}`;

async function callClaude(base64, mediaType, apiKey) {
  if (!apiKey) throw new Error("No hay API key. Ve a ⚙️ Configuración.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
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
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: VISION_PROMPT },
        ],
      }],
    }),
  });

  if (!response.ok) {
    let msg = "HTTP " + response.status;
    try { const e = await response.json(); msg = e?.error?.message || msg; } catch (_) {}
    if (response.status === 401) throw new Error("API key inválida. Comprueba en console.anthropic.com");
    if (response.status === 429) throw new Error("Demasiadas peticiones. Espera un momento.");
    throw new Error("Error Claude: " + msg);
  }

  const data = await response.json();
  const rawText = (data.content || []).find(b => b.type === "text")?.text || "";
  if (!rawText) throw new Error("Claude no devolvió texto. Intenta de nuevo.");

  const parsed = safeParseJSON(rawText);
  if (!parsed.prendas || parsed.prendas.length === 0) {
    throw new Error("No se detectaron prendas. Intenta con una foto más clara.");
  }
  parsed.prendas = parsed.prendas.filter(p => (p.confianza ?? 1) >= 0.6);
  if (parsed.prendas.length === 0) {
    throw new Error("Confianza insuficiente. Intenta con una foto más nítida.");
  }
  return parsed;
}

/* ─────────────────────────────────────────────────────────────
   CLAUDE API TEST (for key verification)
───────────────────────────────────────────────────────────── */
async function testClaudeKey(apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 10,
      messages: [{ role: "user", content: "Hi" }],
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  if (!response.ok) throw new Error("HTTP " + response.status);
  return true;
}

/* ─────────────────────────────────────────────────────────────
   PHOTOROOM — remove background
───────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────
   IMAGE HELPERS — canvas utilities
───────────────────────────────────────────────────────────── */

// Coloca un blob PNG (transparente) sobre fondo blanco
function blobToWhiteBg(blob, SIZE = 600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const r = Math.min(SIZE / img.width, SIZE / img.height) * 0.9;
      const w = img.width * r, h = img.height * r;
      const c = document.createElement("canvas"); c.width = SIZE; c.height = SIZE;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, (SIZE-w)/2, (SIZE-h)/2, w, h);
      resolve(c.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

// Centra una dataUrl en fondo blanco (fallback sin recorte de fondo)
function centerOnWhite(dataUrl, SIZE = 600) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = SIZE; c.height = SIZE;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, SIZE, SIZE);
      const r = Math.min(SIZE / img.width, SIZE / img.height) * 0.82;
      ctx.drawImage(img, (SIZE - img.width*r)/2, (SIZE - img.height*r)/2, img.width*r, img.height*r);
      resolve(c.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Recorta la zona bbox de una dataUrl y la centra en fondo blanco
// Devuelve { dataUrl, base64 } del recorte
function cropBbox(dataUrl, bbox, SIZE = 600) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const PAD = 0.05;
      const bx = Math.max(0, (bbox.x||0) - PAD);
      const by = Math.max(0, (bbox.y||0) - PAD);
      const bw = Math.min(1 - bx, (bbox.w||1) + PAD*2);
      const bh = Math.min(1 - by, (bbox.h||1) + PAD*2);
      const sx = bx * img.width, sy = by * img.height;
      const sw = bw * img.width, sh = bh * img.height;
      const c = document.createElement("canvas"); c.width = SIZE; c.height = SIZE;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, SIZE, SIZE);
      const r = Math.min(SIZE/sw, SIZE/sh) * 0.88;
      ctx.drawImage(img, sx, sy, sw, sh, (SIZE - sw*r)/2, (SIZE - sh*r)/2, sw*r, sh*r);
      const url = c.toDataURL("image/jpeg", 0.9);
      resolve({ dataUrl: url, base64: url.split(",")[1] });
    };
    img.onerror = () => resolve({ dataUrl, base64: dataUrl.split(",")[1] });
    img.src = dataUrl;
  });
}

// Convierte base64 a Blob para las APIs de recorte de fondo
function base64ToBlob(base64, type = "image/jpeg") {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type });
}

/* ─────────────────────────────────────────────────────────────
   REMOVE.BG API — mejor calidad, 50 gratis/mes
───────────────────────────────────────────────────────────── */
async function removeBackgroundRemoveBg(base64, apiKey) {
  if (!apiKey || getApiUsage("removebg").remaining <= 0) return null;
  try {
    const fd = new FormData();
    fd.append("image_file", base64ToBlob(base64), "img.jpg");
    fd.append("size", "auto");
    const res = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: fd,
    });
    if (!res.ok) return null;
    incrementApiUsage("removebg");
    return await res.blob(); // PNG transparente
  } catch (_) { return null; }
}

/* ─────────────────────────────────────────────────────────────
   PHOTOROOM API — fallback, 500 gratis/mes
───────────────────────────────────────────────────────────── */
async function removeBackgroundPhotoRoom(base64, apiKey) {
  if (!apiKey || getApiUsage("photoroom").remaining <= 0) return null;
  try {
    const fd = new FormData();
    fd.append("image_file", base64ToBlob(base64), "img.jpg");
    const res = await fetch("https://sdk.photoroom.com/v1/segment", {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: fd,
    });
    if (!res.ok) return null;
    incrementApiUsage("photoroom");
    return await res.blob(); // PNG transparente
  } catch (_) { return null; }
}

/* ─────────────────────────────────────────────────────────────
   PIPELINE PRINCIPAL
   1. Claude detecta prendas + bbox
   2. Recorta cada prenda por su bbox (canvas, sin API)
   3. Envía el RECORTE a Remove.bg → si falla → PhotoRoom
   4. Fallback: recorte en fondo blanco sin quitar fondo
───────────────────────────────────────────────────────────── */
async function buildGarmentImage(fullDataUrl, fullBase64, garment, removeBgKey, photoRoomKey, onProgress) {
  const bbox = {
    x: garment.bbox_x ?? 0,
    y: garment.bbox_y ?? 0,
    w: garment.bbox_w ?? 1,
    h: garment.bbox_h ?? 1,
  };
  const isFullImage = bbox.w > 0.88 && bbox.h > 0.88;

  // PASO 1 — BRIA local (gratis, ilimitado, sin API)
  // Enviamos la foto COMPLETA para mejor segmentación
  try {
    const { removeBackgroundBRIA } = await import("./useBackgroundRemoval.js");
    const briaResult = await removeBackgroundBRIA(fullDataUrl, onProgress);
    if (briaResult) {
      // Si hay bbox, recortamos DESPUÉS de que BRIA quitó el fondo
      if (!isFullImage) {
        const cropped = await cropBbox(briaResult, bbox);
        return cropped.dataUrl;
      }
      return briaResult;
    }
  } catch (e) {
    console.warn("BRIA no disponible, usando fallback:", e);
  }

  // PASO 2 — Recortar por bbox (para APIs cloud)
  let croppedDataUrl = fullDataUrl;
  let croppedBase64 = fullBase64;
  if (!isFullImage) {
    const cropped = await cropBbox(fullDataUrl, bbox);
    croppedDataUrl = cropped.dataUrl;
    croppedBase64 = cropped.base64;
  }

  // PASO 3 — Remove.bg
  const hasRemoveBg  = removeBgKey  && getApiUsage("removebg").remaining  > 0;
  const hasPhotoRoom = photoRoomKey && getApiUsage("photoroom").remaining > 0;

  if (hasRemoveBg || hasPhotoRoom) {
    let blob = null;
    if (hasRemoveBg)  blob = await removeBackgroundRemoveBg(croppedBase64, removeBgKey);
    if (!blob && hasPhotoRoom) blob = await removeBackgroundPhotoRoom(croppedBase64, photoRoomKey);
    if (blob) return await blobToWhiteBg(blob, 600);
  }

  // PASO 4 — Fallback canvas
  if (!isFullImage) return croppedDataUrl;
  return centerOnWhite(fullDataUrl);
};
  const isFullImage = bbox.w > 0.88 && bbox.h > 0.88;

  // PASO 1: Recortar por bbox (siempre, gratis, para aislar la prenda)
  let croppedDataUrl = fullDataUrl;
  let croppedBase64 = fullBase64;
  if (!isFullImage) {
    const cropped = await cropBbox(fullDataUrl, bbox);
    croppedDataUrl = cropped.dataUrl;
    croppedBase64 = cropped.base64;
  }

  // PASO 2: Quitar fondo del recorte — primero Remove.bg, luego PhotoRoom
  const hasRemoveBg  = removeBgKey  && getApiUsage("removebg").remaining  > 0;
  const hasPhotoRoom = photoRoomKey && getApiUsage("photoroom").remaining > 0;

  if (hasRemoveBg || hasPhotoRoom) {
    let blob = null;
    if (hasRemoveBg)  blob = await removeBackgroundRemoveBg(croppedBase64, removeBgKey);
    if (!blob && hasPhotoRoom) blob = await removeBackgroundPhotoRoom(croppedBase64, photoRoomKey);
    if (blob) return await blobToWhiteBg(blob, 600);
  }

  // PASO 3: Fallback — recorte en fondo blanco sin quitar fondo
  if (!isFullImage) return croppedDataUrl;
  return centerOnWhite(fullDataUrl);


/* ─────────────────────────────────────────────────────────────
   CSS
───────────────────────────────────────────────────────────── */
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
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes risefast{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes bar{from{width:0}to{width:100%}}
@keyframes glow{0%,100%{box-shadow:0 0 18px rgba(201,240,78,0.15)}50%{box-shadow:0 0 36px rgba(201,240,78,0.4)}}
@keyframes fadein{from{opacity:0}to{opacity:1}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
`;

/* ─────────────────────────────────────────────────────────────
   PRIMITIVE COMPONENTS
───────────────────────────────────────────────────────────── */
function Logo({ size=22 }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{width:size+10,height:size+10,background:T.accent,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.65,fontWeight:900}}>✦</div>
      <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:size+2,fontWeight:700,color:T.text,letterSpacing:"-0.5px"}}>Closet<span style={{color:T.accent}}>AI</span></span>
    </div>
  );
}

function Field({ label,type="text",value,onChange,placeholder,icon,autoComplete }) {
  const [f,sf] = useState(false);
  return (
    <div style={{marginBottom:12}}>
      {label && <label style={{display:"block",fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:5}}>{label}</label>}
      <div style={{display:"flex",alignItems:"center",background:T.high,borderRadius:11,padding:"0 13px",border:`1px solid ${f?T.accent:T.border}`,boxShadow:f?`0 0 0 3px ${T.aLow}`:"none",transition:"all 0.2s"}}>
        {icon && <span style={{color:f?T.accent:T.muted,marginRight:8,fontSize:13,flexShrink:0}}>{icon}</span>}
        <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete}
          onFocus={()=>sf(true)} onBlur={()=>sf(false)}
          style={{background:"none",border:"none",outline:"none",color:T.text,fontSize:13,padding:"11px 0",width:"100%"}} />
      </div>
    </div>
  );
}

function Btn({ children,onClick,v="primary",disabled=false,icon,full=true,sm=false,danger=false }) {
  const [p,sp] = useState(false);
  const base = danger
    ? {background:"rgba(255,77,109,0.15)",color:T.err,border:"1px solid rgba(255,77,109,0.4)"}
    : v==="primary"
      ? {background:T.accent,color:"#08080A",border:"none",boxShadow:p?"none":`0 4px 18px ${T.aLow}`}
      : {background:"transparent",color:T.text,border:`1px solid ${T.border}`};
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseDown={()=>sp(true)} onMouseUp={()=>sp(false)} onMouseLeave={()=>sp(false)}
      style={{width:full?"100%":"auto",padding:sm?"7px 12px":"12px 16px",borderRadius:11,cursor:disabled?"not-allowed":"pointer",fontSize:sm?11:13,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:6,transform:p?"scale(0.97)":"scale(1)",opacity:disabled?0.38:1,transition:"all 0.15s",...base}}>
      {icon && <span>{icon}</span>}{children}
    </button>
  );
}

function Pill({ label,active,onClick }) {
  return <button onClick={onClick} style={{padding:"6px 13px",borderRadius:20,border:"none",background:active?T.accent:T.high,color:active?"#08080A":T.dim,fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,transition:"all 0.2s"}}>{label}</button>;
}

function Tag({ children,hi=false }) {
  return <span style={{background:hi?T.aLow:T.high,border:`1px solid ${hi?T.accent:T.border}`,color:hi?T.accent:T.dim,fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:6,display:"inline-block"}}>{children}</span>;
}

function SField({ label,value,onChange,options,lmap }) {
  return (
    <div style={{marginBottom:12}}>
      <label style={{display:"block",fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:5}}>{label}</label>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",background:T.high,border:`1px solid ${T.border}`,borderRadius:11,padding:"11px 13px",color:T.text,fontSize:13,outline:"none",appearance:"none"}}>
        {options.map(o=><option key={o} value={o} style={{background:"#111"}}>{lmap[o]||o}</option>)}
      </select>
    </div>
  );
}

function MSelect({ label,options,selected,onToggle,lmap }) {
  return (
    <div style={{marginBottom:13}}>
      <label style={{display:"block",fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:6}}>{label}</label>
      <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
        {options.map(o=>(
          <button key={o} onClick={()=>onToggle(o)} style={{padding:"5px 11px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,transition:"all 0.15s",background:selected.includes(o)?T.accent:T.high,color:selected.includes(o)?"#08080A":T.dim}}>{lmap[o]||o}</button>
        ))}
      </div>
    </div>
  );
}

function Sheet({ children,zIndex=200 }) {
  return <div style={{position:"absolute",inset:0,zIndex,display:"flex",flexDirection:"column",background:T.bg,animation:"rise 0.22s ease"}}>{children}</div>;
}

function Toast({ msg,type="ok" }) {
  const color = type==="ok"?T.ok:T.err;
  return (
    <div style={{position:"absolute",bottom:75,left:14,right:14,zIndex:999,background:T.surface,border:`1px solid ${color}`,borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:9,animation:"risefast 0.2s ease",boxShadow:"0 4px 24px rgba(0,0,0,0.6)"}}>
      <span style={{fontSize:15}}>{type==="ok"?"✓":"✕"}</span>
      <p style={{color:T.text,fontSize:12,fontWeight:600,margin:0}}>{msg}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   API USAGE COUNTER COMPONENT
───────────────────────────────────────────────────────────── */
function ApiUsageCounter({ provider="photoroom" }) {
  const limit = API_LIMITS[provider]||500;
  const label = provider==="photoroom"?"PhotoRoom":"Remove.bg";
  const [usage,setUsage] = useState({count:0,remaining:limit});
  const [animated,setAnimated] = useState(false);
  useEffect(()=>{
    setUsage(getApiUsage(provider));
    const t = setTimeout(()=>setAnimated(true),100);
    return ()=>clearTimeout(t);
  },[provider]);
  const pct = (usage.count/limit)*100;
  const days = daysUntilReset();
  const isEmpty   = usage.remaining===0;
  const isWarning = !isEmpty && usage.remaining <= Math.round(limit*0.2);
  const color = isEmpty?"#FF4D6D":isWarning?"#FF9F0A":"#C9F04E";
  return (
    <div style={{background:isEmpty?"rgba(255,77,109,0.07)":isWarning?"rgba(255,159,10,0.07)":"rgba(201,240,78,0.05)",border:`1px solid ${isEmpty?"rgba(255,77,109,0.3)":isWarning?"rgba(255,159,10,0.3)":"rgba(201,240,78,0.2)"}`,borderRadius:14,padding:"12px 14px",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <span style={{fontSize:14}}>{provider==="photoroom"?"✂️":"🎭"}</span>
          <div>
            <p style={{color:T.text,fontSize:12,fontWeight:700,margin:0}}>{label}</p>
            <p style={{color:T.muted,fontSize:10,margin:0}}>Recorte de fondo</p>
          </div>
        </div>
        <div style={{background:color+"18",border:`1px solid ${color}35`,borderRadius:20,padding:"2px 9px"}}>
          <span style={{color,fontSize:10,fontWeight:700}}>{isEmpty?"Límite alcanzado":isWarning?"Pocos usos":"Activo"}</span>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"baseline",gap:4,marginBottom:8}}>
        <span style={{color,fontSize:26,fontWeight:800,letterSpacing:"-1px",fontFamily:"'Cormorant Garamond',serif"}}>{usage.remaining}</span>
        <span style={{color:T.muted,fontSize:12}}>/ {limit} restantes</span>
      </div>
      <div style={{background:T.high,borderRadius:4,height:5,overflow:"hidden",marginBottom:7}}>
        <div style={{width:animated?`${pct}%`:"0%",height:"100%",background:`linear-gradient(90deg,${color},${isEmpty?"#ff8080":isWarning?"#ffcc44":"#a8e63d"})`,borderRadius:4,transition:"width 0.9s cubic-bezier(0.16,1,0.3,1)"}} />
      </div>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <span style={{color:T.muted,fontSize:10}}>{usage.count} uso{usage.count!==1?"s":""} este mes</span>
        <span style={{color:T.muted,fontSize:10}}>Reset en {days} día{days!==1?"s":""}</span>
      </div>
      {isEmpty && <p style={{color:"#ff6b6b",fontSize:10,marginTop:7,lineHeight:1.5}}>⚠️ Se usará la foto completa como fallback.</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   GARMENT CARD
───────────────────────────────────────────────────────────── */
function GarmentCard({ g,onClick }) {
  const [hov,sh] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>sh(true)} onMouseLeave={()=>sh(false)}
      style={{background:T.surface,border:`1px solid ${hov?T.dim:T.border}`,borderRadius:16,overflow:"hidden",cursor:"pointer",transform:hov?"scale(1.02)":"scale(1)",transition:"all 0.18s"}}>
      <div style={{height:148,background:"#0d0d0d",position:"relative",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
        {g.imageUrl
          ? <img src={g.imageUrl} alt={g.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} />
          : <span style={{fontSize:50}}>{g.emoji||EMOJI_MAP[g.category]||"👗"}</span>}
        {g.imageUrl && <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(8,8,10,0.6) 0%,transparent 55%)",pointerEvents:"none"}} />}
        {g.brand && <div style={{position:"absolute",top:7,right:7,background:"rgba(0,0,0,0.8)",border:`1px solid ${T.border}`,borderRadius:6,padding:"2px 6px"}}><span style={{color:T.text,fontSize:9,fontWeight:700}}>{g.brand}</span></div>}
        {g.is_favorite && <span style={{position:"absolute",top:6,left:7,fontSize:13}}>⭐</span>}
      </div>
      <div style={{padding:"9px 11px 11px"}}>
        <p style={{color:T.text,fontSize:12,fontWeight:600,margin:"0 0 5px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{g.name}</p>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <Tag hi>{g.occasion}</Tag>
          <div style={{width:9,height:9,borderRadius:"50%",background:g.color||"#444",border:`1.5px solid ${T.border}`}} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   AUTH SCREEN
───────────────────────────────────────────────────────────── */
function AuthScreen({ onLogin }) {
  const [mode,sm] = useState("login");
  const [email,se] = useState("");
  const [pass,sp] = useState("");
  const [name,sn] = useState("");
  const [load,sl] = useState(false);
  const [err,ser] = useState("");
  const [shake,ssh] = useState(false);

  function doShake() { ssh(true); setTimeout(()=>ssh(false),500); }

  function submit() {
    ser("");
    if (!email.trim()||!email.includes("@")) { ser("Email no válido"); doShake(); return; }
    if (pass.length<4) { ser("Contraseña mínimo 4 caracteres"); doShake(); return; }
    sl(true);
    const users = DB.getUsers();
    if (mode==="login") {
      if (!users[email]) { ser("Email no registrado"); sl(false); doShake(); return; }
      if (users[email].pass!==pass) { ser("Contraseña incorrecta"); sl(false); doShake(); return; }
      const u = { id:users[email].id, email, name:users[email].name };
      DB.saveSession(u);
      setTimeout(()=>{ sl(false); onLogin(u); },600);
    } else {
      if (!name.trim()) { ser("El nombre es obligatorio"); sl(false); doShake(); return; }
      if (users[email]) { ser("Email ya registrado"); sl(false); doShake(); return; }
      const u = { id:"u_"+Date.now(), email, name:name.trim() };
      users[email] = {...u,pass};
      DB.saveUsers(users); DB.saveSession(u);
      setTimeout(()=>{ sl(false); onLogin(u); },600);
    }
  }

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",justifyContent:"center",padding:"26px 22px",background:T.bg,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-80,right:-80,width:260,height:260,background:"rgba(201,240,78,0.05)",borderRadius:"50%",filter:"blur(70px)",pointerEvents:"none"}} />
      <div style={{position:"relative",zIndex:1,animation:"rise 0.4s ease"}}>
        <div style={{textAlign:"center",marginBottom:32}}><Logo size={26} /><p style={{color:T.muted,fontSize:12,marginTop:8,fontStyle:"italic"}}>Tu armario, inteligente.</p></div>
        <div style={{display:"flex",background:T.high,border:`1px solid ${T.border}`,borderRadius:12,padding:4,marginBottom:18}}>
          {["login","register"].map(m=>(
            <button key={m} onClick={()=>{sm(m);ser("");}} style={{flex:1,padding:"9px",borderRadius:9,border:"none",background:mode===m?T.accent:"transparent",color:mode===m?"#08080A":T.dim,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all 0.2s"}}>
              {m==="login"?"Iniciar sesión":"Crear cuenta"}
            </button>
          ))}
        </div>
        <div style={{animation:shake?"shake 0.4s ease":"none"}}>
          {mode==="register" && <Field label="Nombre" value={name} onChange={sn} placeholder="Tu nombre" icon="✦" autoComplete="name" />}
          <Field label="Email" type="email" value={email} onChange={se} placeholder="tu@email.com" icon="@" autoComplete="email" />
          <Field label="Contraseña" type="password" value={pass} onChange={sp} placeholder="••••••••" icon="🔒" autoComplete={mode==="login"?"current-password":"new-password"} />
        </div>
        {err && <p style={{color:T.err,fontSize:11,marginBottom:9,textAlign:"center",animation:"fadein 0.2s ease"}}>{err}</p>}
        <div style={{height:4}} />
        <Btn onClick={submit} disabled={load} icon={load?"⟳":"→"}>{load?"Entrando...":mode==="login"?"Entrar al armario":"Crear cuenta"}</Btn>
        {mode==="login" && (
          <p style={{color:T.muted,fontSize:10,textAlign:"center",marginTop:12}}>
            ¿Primera vez?{" "}
            <button onClick={()=>{sm("register");ser("");}} style={{background:"none",border:"none",color:T.accent,fontSize:10,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Crea tu cuenta gratis</button>
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   API KEY SCREEN
───────────────────────────────────────────────────────────── */
function ApiKeyScreen({ onSave,onBack,current,currentRemoveBg,currentPhotoRoom,onSaveRemoveBg,onSavePhotoRoom }) {
  const [key,sk]     = useState(current||"");
  const [rbKey,srbk] = useState(currentRemoveBg||"");
  const [prKey,sprk] = useState(currentPhotoRoom||"");
  const [show,ss]    = useState(false);
  const [err,se]     = useState("");
  const [testing,st] = useState(false);
  const [rbSaved,srbs]  = useState(false);
  const [prSaved,sprs]  = useState(false);

  async function testAndSave() {
    const trimmed = key.trim();
    if (!trimmed) { se("Pega tu API key"); return; }
    if (!trimmed.startsWith("sk-ant-")) { se("La key debe empezar por sk-ant-"); return; }
    st(true); se("");
    try {
      await testClaudeKey(trimmed);
      DB.saveApiKey(trimmed);
      onSave(trimmed);
    } catch(e) {
      se("Error: " + e.message);
    } finally { st(false); }
  }

  function saveRemoveBg() {
    const t = rbKey.trim(); if (!t) return;
    DB.saveRemoveBgKey(t); onSaveRemoveBg(t);
    srbs(true); setTimeout(()=>srbs(false),2200);
  }

  function savePhotoRoom() {
    const t = prKey.trim(); if (!t) return;
    DB.savePhotoRoomKey(t); onSavePhotoRoom(t);
    sprs(true); setTimeout(()=>sprs(false),2200);
  }

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:T.bg,overflow:"hidden"}}>
      <div style={{padding:"12px 15px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:T.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Volver</button>
        <Logo size={15} />
        <div style={{width:55}} />
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"20px 20px 40px"}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:32,marginBottom:8}}>🔑</div>
          <p style={{color:T.text,fontSize:16,fontWeight:700,fontFamily:"'Cormorant Garamond',serif",marginBottom:4}}>APIs de ClosetAI</p>
          <p style={{color:T.muted,fontSize:12,lineHeight:1.6}}>Tus keys se guardan solo en este dispositivo.</p>
        </div>

        {/* ── CLAUDE ── */}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 14px",marginBottom:14}}>
          <p style={{color:T.dim,fontSize:11,fontWeight:700,marginBottom:10,textTransform:"uppercase",letterSpacing:"1.2px"}}>Claude API — análisis de imagen</p>
          {[["1","Ve a console.anthropic.com"],["2","API Keys → Create Key"],["3","Copia la key (sk-ant-...)"],["4","Pégala abajo"]].map(([n,t])=>(
            <div key={n} style={{display:"flex",alignItems:"center",gap:9,marginBottom:7}}>
              <span style={{width:18,height:18,borderRadius:"50%",background:T.accent,color:"#08080A",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{n}</span>
              <span style={{color:T.dim,fontSize:12}}>{t}</span>
            </div>
          ))}
        </div>
        <div style={{marginBottom:14}}>
          <label style={{display:"block",fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:5}}>Claude API Key</label>
          <div style={{display:"flex",alignItems:"center",background:T.high,borderRadius:11,padding:"0 13px",border:`1px solid ${T.border}`}}>
            <input type={show?"text":"password"} value={key} onChange={e=>sk(e.target.value)} placeholder="sk-ant-api03-..."
              style={{background:"none",border:"none",outline:"none",color:T.text,fontSize:12,padding:"12px 0",width:"100%",fontFamily:"monospace"}} />
            <button onClick={()=>ss(!show)} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:14,padding:"0 0 0 8px"}}>{show?"🙈":"👁"}</button>
          </div>
        </div>
        {err && <p style={{color:T.err,fontSize:11,marginBottom:10,textAlign:"center"}}>{err}</p>}
        <Btn onClick={testAndSave} icon={testing?"⟳":"✓"} disabled={!key.trim()||testing}>
          {testing?"Verificando...":"Verificar y guardar Claude key"}
        </Btn>

        {/* ── PIPELINE INFO ── */}
        <div style={{marginTop:20,padding:"10px 13px",background:"rgba(201,240,78,0.05)",border:`1px solid ${T.aLow}`,borderRadius:10}}>
          <p style={{color:T.accent,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:5}}>✂️ Cómo funciona el recorte</p>
          <p style={{color:T.muted,fontSize:11,lineHeight:1.7,margin:0}}>
            1. Claude detecta cada prenda y su posición<br/>
            2. Se recorta cada prenda por su zona (sin API)<br/>
            3. Remove.bg quita el fondo del recorte <strong style={{color:T.dim}}>(50/mes)</strong><br/>
            4. Si se agota → PhotoRoom como reserva <strong style={{color:T.dim}}>(500/mes)</strong><br/>
            5. Sin APIs → recorte en fondo blanco igualmente
          </p>
        </div>

        {/* ── REMOVE.BG ── */}
        <div style={{marginTop:20,borderTop:`1px solid ${T.border}`,paddingTop:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <p style={{color:T.dim,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",margin:0}}>🥇 Remove.bg — principal</p>
            <span style={{background:"rgba(77,255,180,0.12)",border:`1px solid ${T.ok}`,borderRadius:20,padding:"2px 8px",fontSize:9,color:T.ok,fontWeight:700}}>MEJOR CALIDAD</span>
          </div>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"9px 12px",marginBottom:12}}>
            <p style={{color:T.muted,fontSize:11,lineHeight:1.6,margin:0}}>
              Gratis en{" "}
              <a href="https://www.remove.bg/api" target="_blank" rel="noopener noreferrer" style={{color:T.accent}}>remove.bg/api</a>
              {" "}— <strong style={{color:T.dim}}>50 recortes/mes gratis</strong>
            </p>
          </div>
          <ApiUsageCounter provider="removebg" />
          <div style={{marginBottom:10}}>
            <label style={{display:"block",fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:5}}>Remove.bg API Key</label>
            <input type="text" value={rbKey} onChange={e=>srbk(e.target.value)} placeholder="tu-api-key-remove-bg"
              style={{width:"100%",background:T.high,border:`1px solid ${T.border}`,borderRadius:11,padding:"11px 13px",color:T.text,fontSize:12,outline:"none",fontFamily:"monospace"}} />
          </div>
          <Btn onClick={saveRemoveBg} disabled={!rbKey.trim()} icon={rbSaved?"✓":"💾"} v={rbSaved?"ghost":"primary"}>
            {rbSaved?"¡Guardada!":"Guardar Remove.bg key"}
          </Btn>
        </div>

        {/* ── PHOTOROOM ── */}
        <div style={{marginTop:20,borderTop:`1px solid ${T.border}`,paddingTop:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <p style={{color:T.dim,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",margin:0}}>🥈 PhotoRoom — reserva</p>
            <span style={{background:"rgba(201,240,78,0.1)",border:`1px solid ${T.aLow}`,borderRadius:20,padding:"2px 8px",fontSize:9,color:T.accent,fontWeight:700}}>500/MES</span>
          </div>
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"9px 12px",marginBottom:12}}>
            <p style={{color:T.muted,fontSize:11,lineHeight:1.6,margin:0}}>
              Gratis en{" "}
              <a href="https://www.photoroom.com/api" target="_blank" rel="noopener noreferrer" style={{color:T.accent}}>photoroom.com/api</a>
              {" "}— <strong style={{color:T.dim}}>500 recortes/mes gratis</strong>
            </p>
          </div>
          <ApiUsageCounter provider="photoroom" />
          <div style={{marginBottom:10}}>
            <label style={{display:"block",fontSize:10,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:"1.5px",marginBottom:5}}>PhotoRoom API Key</label>
            <input type="text" value={prKey} onChange={e=>sprk(e.target.value)} placeholder="sk_pr_..."
              style={{width:"100%",background:T.high,border:`1px solid ${T.border}`,borderRadius:11,padding:"11px 13px",color:T.text,fontSize:12,outline:"none",fontFamily:"monospace"}} />
          </div>
          <Btn onClick={savePhotoRoom} disabled={!prKey.trim()} icon={prSaved?"✓":"💾"} v={prSaved?"ghost":"primary"}>
            {prSaved?"¡Guardada!":"Guardar PhotoRoom key"}
          </Btn>
        </div>

        <div style={{marginTop:14,padding:"10px 13px",background:"rgba(201,240,78,0.05)",border:`1px solid ${T.aLow}`,borderRadius:10}}>
          <p style={{color:T.muted,fontSize:10,lineHeight:1.7,margin:0}}>🔒 Keys guardadas en <strong style={{color:T.dim}}>localStorage</strong>. Nadie externo puede leerlas.</p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   SCANNER SCREEN
───────────────────────────────────────────────────────────── */
function ScannerScreen({ onSave,onBack,apiKey,removeBgKey,photoRoomKey,onNeedKey }) {
  const [phase,sp] = useState("upload");
  const [imgUrl,siu] = useState(null);
  const [imgB64,sib] = useState(null);
  const [imgMime,sim] = useState("image/jpeg");
  const [result,sr] = useState(null);
  const [apiErr,sae] = useState(null);
  const [step,ss] = useState(0);
  const [cd,scd] = useState(null);
  const [saving,ssv] = useState(false);
  const [savedAll,ssa] = useState(false);
  const [gImgs,sgi] = useState([]);
  const [selected,ssel] = useState({});
  const [editNames,sen] = useState({});
  const [usingPR,supr] = useState(false);
const [briaProgress,sbp] = useState(null); // {pct, msg};
  const fileRef = useRef(null);
  const timerRef = useRef(null);
  useEffect(()=>()=>clearInterval(timerRef.current),[]);

  function readFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { sae("Solo imágenes JPG, PNG, WEBP"); return; }
    sim("image/jpeg");
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX=1600; let w=img.width,h=img.height;
        if (w>MAX||h>MAX) { if(w>h){h=Math.round(h*MAX/w);w=MAX;}else{w=Math.round(w*MAX/h);h=MAX;} }
        const c=document.createElement("canvas"); c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        const compressed=c.toDataURL("image/jpeg",0.82);
        siu(compressed); sib(compressed.split(",")[1]); sae(null);
      };
      img.src=ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function analyze() {
    if (!imgB64) return;
    if (!apiKey) { onNeedKey(); return; }
    sae(null); sp("analyzing"); ss(0); scd(35);
    timerRef.current=setInterval(()=>scd(p=>{if(p<=1){clearInterval(timerRef.current);return 0;}return p-1;}),1000);
    [400,1100,1900,2800].forEach((ms,i)=>setTimeout(()=>ss(i+1),ms));
    try {
      const data = await callClaude(imgB64,imgMime,apiKey);
      clearInterval(timerRef.current);
      const hasRB = removeBgKey  && getApiUsage("removebg").remaining  > 0;
      const hasPR = photoRoomKey && getApiUsage("photoroom").remaining > 0;
      supr(hasRB || hasPR);
      const imgs = await Promise.all(data.prendas.map(p=>
  buildGarmentImage(imgUrl, imgB64, p, removeBgKey, photoRoomKey, (pct, msg) => {
    sbp({ pct, msg });
  })
));
sbp(null);
      sgi(imgs);
      const initSel={},initNames={};
      data.prendas.forEach((p,i)=>{initSel[i]=true;initNames[i]=p.nombre;});
      ssel(initSel); sen(initNames); sr(data); sp("results");
    } catch(e) {
      clearInterval(timerRef.current);
      sae(e.message); sp("upload");
    }
  }

  async function saveAll() {
    const prendas = result.prendas;
    const toSave = prendas.filter((_,i)=>selected[i]);
    if (!toSave.length) return;
    ssv(true);
    const garments = toSave.map(p=>{
      const i=prendas.indexOf(p);
      return {
        name:editNames[i]||p.nombre,
        category:p.categoria,
        color:toHex(p.color_principal),
        emoji:EMOJI_MAP[p.categoria]||"👗",
        brand:p.marca_detectada||p.marca_posible||null,
        brand_detected:p.marca_detectada,
        brand_possible:p.marca_posible,
        brand_reason:p.razon_marca,
        occasion:(p.ocasiones||[])[0]||"casual",
        occasions_list:p.ocasiones||[],
        seasons:p.temporadas||[],
        material:p.material_estimado,
        pattern:p.patron,fit:p.fit,
        details:p.detalles,
        subcategory:p.subcategoria,
        price_range:p.precio_estimado,
        imageUrl:gImgs[i]||imgUrl,
        times_worn:0,is_favorite:false,
        confidence:p.confianza,
        added_at:new Date().toISOString(),
      };
    });
    for (let i=0;i<garments.length;i++) {
      await new Promise(r=>setTimeout(r,280));
      onSave(garments[i], i<garments.length-1);
    }
    ssa(true);
  }

  function reset() { sp("upload");siu(null);sib(null);sr(null);sae(null);scd(null);ssa(false);ssv(false); }
  function toggleSel(i) { ssel(p=>({...p,[i]:!p[i]})); }
  const numSel = Object.values(selected).filter(Boolean).length;

  /* UPLOAD */
  if (phase==="upload") return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:T.bg}}>
      <input ref={fileRef} type="file" accept="image/*" onChange={e=>readFile(e.target.files?.[0])} style={{display:"none"}} />
      <div style={{padding:"12px 15px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:T.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>← Volver</button>
        <Logo size={15} /><div style={{width:55}} />
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",padding:"16px 16px 20px",gap:13,overflowY:"auto"}}>
        <div>
          <p style={{color:T.text,fontSize:16,fontWeight:700,fontFamily:"'Cormorant Garamond',serif",marginBottom:3}}>Escanear prenda</p>
          <p style={{color:T.muted,fontSize:12,lineHeight:1.6}}>Sube una foto. IA detecta tipo, color, marca y material.</p>
        </div>
        {!apiKey && (
          <div onClick={onNeedKey} style={{background:"rgba(255,77,109,0.08)",border:"1px solid rgba(255,77,109,0.3)",borderRadius:12,padding:"10px 13px",cursor:"pointer",display:"flex",alignItems:"center",gap:8}}>
            <span>⚠️</span><p style={{color:T.err,fontSize:12,margin:0,fontWeight:600}}>Sin API key — toca para configurar</p>
          </div>
        )}
        {(removeBgKey || photoRoomKey) && (
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:10,padding:"8px 12px"}}>
            <p style={{color:T.dim,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:6}}>✂️ Recorte IA activado</p>
            <div style={{display:"flex",gap:10}}>
              {removeBgKey && (()=>{ const u=getApiUsage("removebg"); const c=u.remaining===0?T.err:T.ok; return(
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:10}}>🥇</span>
                  <span style={{color:T.muted,fontSize:10}}>Remove.bg</span>
                  <span style={{color:c,fontSize:10,fontWeight:700}}>{u.remaining}/50</span>
                </div>
              );})()}
              {photoRoomKey && (()=>{ const u=getApiUsage("photoroom"); const c=u.remaining===0?T.err:u.remaining<=100?"#FF9F0A":T.ok; return(
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:10}}>🥈</span>
                  <span style={{color:T.muted,fontSize:10}}>PhotoRoom</span>
                  <span style={{color:c,fontSize:10,fontWeight:700}}>{u.remaining}/500</span>
                </div>
              );})()}
            </div>
          </div>
        )}
        <div onClick={()=>fileRef.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();readFile(e.dataTransfer.files?.[0]);}}
          style={{flex:1,minHeight:220,border:`2px dashed ${imgUrl?T.accent:T.border}`,borderRadius:18,cursor:"pointer",background:"#0d0d0d",position:"relative",overflow:"hidden",transition:"border-color 0.2s",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          {imgUrl ? (
            <>
              <img src={imgUrl} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain"}} />
              <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(8,8,10,0.9),transparent 45%)",pointerEvents:"none"}} />
              <div style={{position:"absolute",bottom:11,left:0,right:0,display:"flex",justifyContent:"center"}}>
                <button onClick={e=>{e.stopPropagation();reset();}} style={{background:"rgba(8,8,10,0.9)",border:`1px solid ${T.border}`,color:T.text,borderRadius:9,padding:"6px 13px",cursor:"pointer",fontSize:11,fontFamily:"inherit"}}>🗑 Cambiar foto</button>
              </div>
            </>
          ) : (
            <>
              <div style={{fontSize:44,marginBottom:11,opacity:0.3}}>📸</div>
              <p style={{color:T.dim,fontSize:13,fontWeight:600,marginBottom:4}}>Toca para subir foto</p>
              <p style={{color:T.muted,fontSize:11,textAlign:"center",maxWidth:190,lineHeight:1.6}}>O arrastra · JPG, PNG, WEBP</p>
            </>
          )}
        </div>
        {apiErr && <p style={{color:T.err,fontSize:11,textAlign:"center",background:"rgba(255,77,109,0.08)",padding:"9px",borderRadius:9,lineHeight:1.5}}>{apiErr}</p>}
        {imgUrl && <Btn onClick={analyze} icon="✦" disabled={!apiKey}>Analizar con IA</Btn>}
      </div>
    </div>
  );

  /* ANALYZING */
  if (phase==="analyzing") return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:T.bg,padding:26}}>
      <div style={{width:90,height:90,borderRadius:"50%",border:`3px solid ${T.border}`,position:"relative",marginBottom:22,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <svg style={{position:"absolute",inset:0,transform:"rotate(-90deg)"}} viewBox="0 0 90 90">
          <circle cx="45" cy="45" r="42" fill="none" stroke={T.accent} strokeWidth="3"
            strokeDasharray={`${2*Math.PI*42}`}
            strokeDashoffset={`${2*Math.PI*42*(1-(cd||0)/35)}`}
            style={{transition:"stroke-dashoffset 1s linear"}} />
        </svg>
        <span style={{color:T.accent,fontSize:26,fontWeight:700,fontFamily:"'Cormorant Garamond',serif",zIndex:1}}>{cd??""}</span>
      </div>
      <div style={{width:120,height:150,borderRadius:16,overflow:"hidden",marginBottom:20,border:`1px solid ${T.border}`,background:"#0d0d0d",position:"relative"}}>
        <img src={imgUrl} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}} />
        <div style={{position:"absolute",inset:0,background:"rgba(8,8,10,0.45)"}} />
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:40,height:40,borderRadius:"50%",border:`3px solid ${T.border}`,borderTop:`3px solid ${T.accent}`,animation:"spin 0.8s linear infinite"}} />
        </div>
      </div>
      <p style={{color:T.text,fontSize:16,fontWeight:700,marginBottom:4,fontFamily:"'Cormorant Garamond',serif"}}>Claude Vision analizando...</p>
      <p style={{color:T.muted,fontSize:12,textAlign:"center",maxWidth:220,lineHeight:1.7,marginBottom:18}}>Detectando prendas, colores, marcas y materiales</p>
{briaProgress && (
  <div style={{width:"100%",maxWidth:260,marginBottom:14}}>
    <p style={{color:T.accent,fontSize:12,textAlign:"center",marginBottom:6,fontWeight:600}}>{briaProgress.msg}</p>
    <div style={{background:T.high,borderRadius:4,height:5,overflow:"hidden"}}>
      <div style={{width:`${briaProgress.pct}%`,height:"100%",background:T.accent,borderRadius:4,transition:"width 0.4s ease"}} />
    </div>
  </div>
)}
      <div style={{display:"flex",flexDirection:"column",gap:7,width:"100%",maxWidth:240}}>
        {[["🔍","Detectando prendas"],["🎨","Analizando colores y patrones"],["🏷️","Identificando marcas y material"],["📊","Generando análisis completo"]].map(([ic,tx],i)=>(
          <div key={tx} style={{display:"flex",alignItems:"center",gap:9,opacity:step>i?1:0.22,transition:"opacity 0.4s"}}>
            <span style={{fontSize:13}}>{ic}</span>
            <span style={{color:step>i?T.text:T.muted,fontSize:12}}>{tx}</span>
            {step===i+1 && <div style={{width:5,height:5,borderRadius:"50%",background:T.accent,marginLeft:"auto",animation:"pulse 0.9s infinite"}} />}
            {step>i+1 && <span style={{color:T.ok,fontSize:11,marginLeft:"auto"}}>✓</span>}
          </div>
        ))}
      </div>
    </div>
  );

  /* RESULTS */
  if (phase==="results"&&result) {
    const prendas = result.prendas||[];
    if (savedAll) return (
      <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:T.bg,gap:11}}>
        <div style={{width:72,height:72,borderRadius:"50%",background:"rgba(77,255,180,0.12)",border:`2px solid ${T.ok}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>✓</div>
        <p style={{color:T.ok,fontWeight:700,fontSize:17,fontFamily:"'Cormorant Garamond',serif"}}>¡{numSel} prenda{numSel!==1?"s":""} guardada{numSel!==1?"s":""}!</p>
        <p style={{color:T.muted,fontSize:12}}>Volviendo al armario...</p>
      </div>
    );
    if (saving) return (
      <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:T.bg,gap:16,padding:26}}>
        <p style={{color:T.text,fontWeight:700,fontSize:14}}>Guardando {numSel} prenda{numSel!==1?"s":""}...</p>
        <div style={{width:200,height:3,background:T.high,borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",background:T.accent,borderRadius:2,animation:"bar 1.5s ease forwards"}} />
        </div>
      </div>
    );
    return (
      <div style={{height:"100%",display:"flex",flexDirection:"column",background:T.bg}}>
        <div style={{padding:"12px 15px 10px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
          <button onClick={reset} style={{background:"none",border:"none",color:T.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>↺ Nueva</button>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{color:T.accent,fontSize:11,fontWeight:700}}>✦ {prendas.length} prenda{prendas.length!==1?"s":""} detectada{prendas.length!==1?"s":""}</span>
            {usingPR && <span style={{color:T.ok,fontSize:9}}>✂️ Recorte bbox + fondo eliminado con IA</span>}
          </div>
          <button onClick={onBack} style={{background:"none",border:"none",color:T.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 14px 100px"}}>
          {result.conjunto_analisis && (
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:10,marginBottom:12}}>
              <p style={{color:T.muted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.3px",marginBottom:3}}>Análisis del conjunto</p>
              <p style={{color:T.text,fontSize:12,lineHeight:1.6,margin:0}}>{result.conjunto_analisis}</p>
            </div>
          )}
          <p style={{color:T.muted,fontSize:11,marginBottom:10}}>Selecciona las prendas a guardar:</p>
          {prendas.map((p,i)=>{
            const isSel=selected[i];
            return (
              <div key={i} style={{background:T.surface,border:`2px solid ${isSel?T.accent:T.border}`,borderRadius:16,marginBottom:11,overflow:"hidden",transition:"border-color 0.2s"}}>
                <div style={{display:"flex"}}>
                  <div style={{width:90,height:90,background:"#fff",flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <img src={gImgs[i]||imgUrl} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}} />
                  </div>
                  <div style={{flex:1,padding:"10px 12px",minWidth:0}}>
                    <input value={editNames[i]||""} onChange={e=>sen(prev=>({...prev,[i]:e.target.value}))}
                      style={{background:"none",border:"none",outline:"none",color:T.text,fontSize:13,fontWeight:700,width:"100%",marginBottom:5,fontFamily:"'Sora',system-ui"}} />
                    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
                      <Tag>{p.subcategoria||p.categoria}</Tag>
                      {p.marca_detectada && <Tag hi>{p.marca_detectada}</Tag>}
                      {p.color_principal && <Tag>{p.color_principal}</Tag>}
                    </div>
                    {p.material_estimado && <p style={{color:T.muted,fontSize:10,margin:0,lineHeight:1.4}}>{p.material_estimado}</p>}
                  </div>
                  <button onClick={()=>toggleSel(i)} style={{width:44,background:"none",border:"none",borderLeft:`1px solid ${T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <div style={{width:22,height:22,borderRadius:"50%",background:isSel?T.accent:T.high,border:`2px solid ${isSel?T.accent:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>
                      {isSel && <span style={{color:"#08080A",fontSize:12,fontWeight:900}}>✓</span>}
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"12px 14px 16px",background:T.bg,borderTop:`1px solid ${T.border}`}}>
          <Btn onClick={saveAll} disabled={numSel===0} icon="→">
            {numSel===0?"Selecciona al menos una":`Guardar ${numSel} prenda${numSel!==1?"s":""} en mi armario`}
          </Btn>
        </div>
      </div>
    );
  }
  return null;
}

/* ─────────────────────────────────────────────────────────────
   EDIT MODAL
───────────────────────────────────────────────────────────── */
function EditModal({ garment,onSave,onClose,onDelete }) {
  const [name,sn]=useState(garment.name);
  const [brand,sb]=useState(garment.brand||"");
  const [cat,sc]=useState(garment.category);
  const [occ,so]=useState(garment.occasion);
  const [mat,sm]=useState(garment.material||"");
  const [szn,ss]=useState(garment.seasons||[]);
  const [fav,sf]=useState(garment.is_favorite||false);
  const [confirmDel,scd]=useState(false);
  const tS=s=>ss(p=>p.includes(s)?p.filter(x=>x!==s):[...p,s]);
  return (
    <Sheet>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 15px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        <p style={{color:T.muted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.5px"}}>Editar prenda</p>
        <button onClick={onClose} style={{background:T.high,border:`1px solid ${T.border}`,color:T.text,borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>✕</button>
      </div>
      <div style={{width:75,height:90,borderRadius:12,margin:"10px auto",overflow:"hidden",border:`1px solid ${T.border}`,background:"#0d0d0d",flexShrink:0}}>
        {garment.imageUrl?<img src={garment.imageUrl} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}} />:<div style={{width:"100%",height:"100%",background:garment.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:34}}>{garment.emoji}</div>}
      </div>
      <div style={{padding:"0 15px 24px",flex:1,overflowY:"auto"}}>
        <Field label="Nombre" value={name} onChange={sn} placeholder="Nombre" icon="✏️" />
        <Field label="Marca" value={brand} onChange={sb} placeholder="Ej: Zara, Nike..." icon="🏷️" />
        <Field label="Material" value={mat} onChange={sm} placeholder="Ej: Algodón 100%" icon="🧵" />
        <SField label="Categoría" value={cat} onChange={sc} options={CAT_KEYS} lmap={{top:"Top",bottom:"Pantalón",dress:"Vestido",outerwear:"Abrigo",shoes:"Zapatos",bag:"Bolso",accessory:"Accesorio"}} />
        <SField label="Ocasión" value={occ} onChange={so} options={OCC_KEYS} lmap={OCC_LBL} />
        <MSelect label="Temporadas" options={SZN_KEYS} selected={szn} onToggle={tS} lmap={SZN_LBL} />
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:T.surface,border:`1px solid ${T.border}`,borderRadius:11,padding:"10px 13px",marginBottom:14}}>
          <span style={{color:T.text,fontSize:13,fontWeight:600}}>⭐ Favorita</span>
          <button onClick={()=>sf(!fav)} style={{width:40,height:22,borderRadius:11,border:"none",cursor:"pointer",background:fav?T.accent:T.high,position:"relative",transition:"all 0.2s"}}>
            <div style={{width:16,height:16,borderRadius:"50%",background:fav?"#08080A":"#555",position:"absolute",top:3,left:fav?21:3,transition:"all 0.2s"}} />
          </button>
        </div>
        <Btn onClick={()=>onSave({...garment,name,brand:brand||null,category:cat,occasion:occ,material:mat,seasons:szn,is_favorite:fav})} icon="✓">Guardar cambios</Btn>
        <div style={{height:7}} />
        <Btn onClick={onClose} v="ghost">Cancelar</Btn>
        <div style={{height:14}} />
        {!confirmDel
          ? <Btn onClick={()=>scd(true)} danger icon="🗑">Eliminar prenda</Btn>
          : <div style={{background:"rgba(255,77,109,0.08)",border:"1px solid rgba(255,77,109,0.3)",borderRadius:11,padding:"11px 13px"}}>
              <p style={{color:T.err,fontSize:12,fontWeight:700,marginBottom:9,textAlign:"center"}}>¿Eliminar esta prenda?</p>
              <div style={{display:"flex",gap:7}}>
                <Btn onClick={onDelete} danger icon="🗑">Sí, eliminar</Btn>
                <Btn onClick={()=>scd(false)} v="ghost">Cancelar</Btn>
              </div>
            </div>}
      </div>
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────────────────
   OUTFIT MODAL
───────────────────────────────────────────────────────────── */
function OutfitModal({ garments,startWith,onSave,onClose }) {
  const [name,sn]=useState("Mi outfit");
  const [sel,ss]=useState(startWith?[startWith.id]:[]);
  const [occ,so]=useState("casual");
  const [saved,sv]=useState(false);
  const tog=id=>ss(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const picked=garments.filter(g=>sel.includes(g.id));
  function save(){if(sel.length<2)return;sv(true);setTimeout(()=>onSave({id:"o_"+Date.now(),name,garmentIds:sel,occasion:occ,created_at:new Date().toISOString()}),900);}
  if (saved) return (
    <Sheet>
      <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:11}}>
        <div style={{width:68,height:68,borderRadius:"50%",background:"rgba(77,255,180,0.12)",border:`2px solid ${T.ok}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>✓</div>
        <p style={{color:T.ok,fontWeight:700,fontSize:16,fontFamily:"'Cormorant Garamond',serif"}}>¡Outfit guardado!</p>
      </div>
    </Sheet>
  );
  return (
    <Sheet>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 15px 10px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        <p style={{color:T.text,fontSize:14,fontWeight:700}}>👔 Crear outfit</p>
        <button onClick={onClose} style={{background:T.high,border:`1px solid ${T.border}`,color:T.text,borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>✕</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"12px 14px"}}>
        <Field label="Nombre del outfit" value={name} onChange={sn} placeholder="Ej: Look de oficina" icon="✏️" />
        <SField label="Ocasión" value={occ} onChange={so} options={OCC_KEYS} lmap={OCC_LBL} />
        {picked.length>0 && (
          <div style={{marginBottom:12}}>
            <p style={{color:T.muted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.3px",marginBottom:6}}>Tu combinación</p>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {picked.map(g=>(
                <div key={g.id} style={{width:52,height:62,borderRadius:10,overflow:"hidden",border:`2px solid ${T.accent}`,position:"relative",flexShrink:0,background:"#0d0d0d"}}>
                  {g.imageUrl?<img src={g.imageUrl} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}} />:<div style={{width:"100%",height:"100%",background:g.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{g.emoji}</div>}
                  <button onClick={()=>tog(g.id)} style={{position:"absolute",top:-4,right:-4,width:15,height:15,borderRadius:"50%",background:T.err,border:"none",color:"#fff",fontSize:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <p style={{color:T.muted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.3px",marginBottom:6}}>Todas las prendas (mín. 2)</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:15}}>
          {garments.map(g=>{const s=sel.includes(g.id);return(
            <div key={g.id} onClick={()=>tog(g.id)} style={{borderRadius:10,overflow:"hidden",cursor:"pointer",border:`2px solid ${s?T.accent:T.border}`,transition:"all 0.15s",transform:s?"scale(1.04)":"scale(1)"}}>
              <div style={{height:64,background:"#0d0d0d",position:"relative",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
                {g.imageUrl?<img src={g.imageUrl} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}} />:g.emoji}
                {s&&<div style={{position:"absolute",inset:0,background:"rgba(201,240,78,0.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>✓</div>}
              </div>
              <div style={{background:T.surface,padding:"3px 5px"}}><p style={{color:T.text,fontSize:9,fontWeight:600,margin:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{g.name}</p></div>
            </div>
          );})}
        </div>
        <Btn onClick={save} disabled={sel.length<2} icon="✓">{sel.length<2?`Selecciona ${2-sel.length} más`:`Guardar outfit (${sel.length})`}</Btn>
        <div style={{height:7}} /><Btn onClick={onClose} v="ghost">Cancelar</Btn>
      </div>
    </Sheet>
  );
}

/* ─────────────────────────────────────────────────────────────
   DETAIL SCREEN
───────────────────────────────────────────────────────────── */
function DetailScreen({ garment,garments,onBack,onUpdate,onDelete }) {
  const [fav,sf]=useState(garment.is_favorite||false);
  const [modal,sm]=useState(null);
  const [wornToast,swt]=useState(false);
  function handleFav(){const nf=!fav;sf(nf);onUpdate({...garment,is_favorite:nf});}
  function handleWorn(){onUpdate({...garment,times_worn:(garment.times_worn||0)+1,last_worn:new Date().toISOString()});swt(true);setTimeout(()=>swt(false),2000);}
  return (
    <div style={{height:"100%",position:"relative",background:T.bg}}>
      <div style={{height:"100%",display:"flex",flexDirection:"column",overflowY:"auto"}}>
        <div style={{height:215,position:"relative",flexShrink:0,overflow:"hidden",background:"#0d0d0d"}}>
          {garment.imageUrl?<img src={garment.imageUrl} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}} />:<div style={{width:"100%",height:"100%",background:garment.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:80}}>{garment.emoji}</div>}
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(0,0,0,0.35),rgba(0,0,0,0.05) 40%,rgba(8,8,10,0.9))"}} />
          <div style={{position:"absolute",top:0,left:0,right:0,padding:"12px 14px",display:"flex",justifyContent:"space-between",zIndex:2}}>
            <button onClick={onBack} style={{background:"rgba(0,0,0,0.65)",border:"none",color:"#fff",borderRadius:9,padding:"6px 12px",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>← Volver</button>
            <button onClick={handleFav} style={{background:"rgba(0,0,0,0.65)",border:"none",color:fav?"#FFD700":"#fff",borderRadius:9,padding:"6px 12px",cursor:"pointer",fontSize:15}}>{fav?"⭐":"☆"}</button>
          </div>
          <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"10px 14px",zIndex:2}}>
            <h2 style={{color:"#fff",fontSize:19,fontFamily:"'Cormorant Garamond',serif",fontWeight:700,marginBottom:2,lineHeight:1.2}}>{garment.name}</h2>
            {garment.brand&&<p style={{color:"rgba(255,255,255,0.5)",fontSize:11}}>by {garment.brand}</p>}
          </div>
        </div>
        <div style={{padding:"13px 14px 22px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <Tag hi>{garment.occasion}</Tag>
            <button onClick={handleWorn} style={{background:T.aLow,border:`1px solid ${T.accent}`,color:T.accent,borderRadius:8,padding:"5px 11px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit"}}>+ Registrar uso</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:12}}>
            {[["Categoría",garment.category],["Usos",`${garment.times_worn||0}x`],["Material",garment.material||"—"]].map(([k,v])=>(
              <div key={k} style={{background:T.high,border:`1px solid ${T.border}`,borderRadius:10,padding:"8px 7px",textAlign:"center"}}>
                <p style={{color:T.muted,fontSize:9,textTransform:"uppercase",letterSpacing:"1px",margin:"0 0 2px"}}>{k}</p>
                <p style={{color:T.text,fontSize:11,fontWeight:700,margin:0,textTransform:"capitalize"}}>{v}</p>
              </div>
            ))}
          </div>
          {garment.last_worn&&<p style={{color:T.muted,fontSize:11,marginBottom:10}}>🕐 Último uso: {new Date(garment.last_worn).toLocaleDateString("es-ES")}</p>}
          {(garment.brand_detected||garment.brand_possible)&&(
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:11,padding:"9px 12px",marginBottom:11}}>
              <p style={{color:T.muted,fontSize:9,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:4}}>Identificación de marca</p>
              {garment.brand_detected&&<p style={{color:T.text,fontSize:12,margin:"0 0 2px"}}>✅ Detectada: <span style={{color:T.accent,fontWeight:700}}>{garment.brand_detected}</span></p>}
              {garment.brand_possible&&<p style={{color:T.dim,fontSize:12,margin:"0 0 2px"}}>❓ Posible: {garment.brand_possible}</p>}
              {garment.brand_reason&&<p style={{color:T.muted,fontSize:11,margin:0,lineHeight:1.5}}>{garment.brand_reason}</p>}
            </div>
          )}
          {garment.price_range&&<p style={{color:T.dim,fontSize:12,marginBottom:10}}>💶 Precio estimado: {garment.price_range}</p>}
          {garment.seasons?.length>0&&<div style={{marginBottom:9}}><p style={{color:T.muted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.3px",marginBottom:4}}>Temporadas</p><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{garment.seasons.map(s=><Tag key={s}>{SZN_LBL[s]||s}</Tag>)}</div></div>}
          {garment.occasions_list?.length>0&&<div style={{marginBottom:13}}><p style={{color:T.muted,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.3px",marginBottom:4}}>Ocasiones</p><div style={{display:"flex",flexWrap:"wrap",gap:4}}>{garment.occasions_list.map(o=><Tag key={o} hi>{OCC_LBL[o]||o}</Tag>)}</div></div>}
          {garment.details&&<div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:11,padding:"9px 12px",marginBottom:13}}><p style={{color:T.muted,fontSize:9,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:3}}>Detalles IA</p><p style={{color:T.dim,fontSize:11,lineHeight:1.7,margin:0}}>{garment.details}</p></div>}
          <div style={{display:"flex",gap:7}}>
            <Btn onClick={()=>sm("outfit")} icon="👔">Crear outfit</Btn>
            <Btn onClick={()=>sm("edit")} v="ghost" icon="✏️" full={false}>Editar</Btn>
          </div>
        </div>
      </div>
      {wornToast&&<Toast msg="¡Uso registrado!" type="ok" />}
      {modal==="edit"&&<EditModal garment={garment} onSave={u=>{onUpdate(u);sm(null);}} onClose={()=>sm(null)} onDelete={()=>onDelete(garment.id)} />}
      {modal==="outfit"&&<OutfitModal garments={garments} startWith={garment} onSave={()=>sm(null)} onClose={()=>sm(null)} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   OUTFITS SCREEN
───────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────
   AI STYLIST — genera outfits con Claude
───────────────────────────────────────────────────────────── */
async function callStylist(garments, existingOutfits, apiKey) {
  if (!apiKey) throw new Error("Necesitas configurar tu Claude API key en ⚙️");
  if (garments.length < 2) throw new Error("Necesitas al menos 2 prendas en el armario");

  const wardrobeDesc = garments.map((g,i) =>
    `${i+1}. ID:${g.id} | ${g.name} | ${g.category} | color:${g.color_principal||g.color} | ocasion:${g.occasion} | temporadas:${(g.seasons||[]).join(",")} | material:${g.material||"?"} | marca:${g.brand||"ninguna"}`
  ).join("\n");

  const existingDesc = existingOutfits.length > 0
    ? existingOutfits.map(o => `"${o.name}" (${o.garmentIds.join(",")})`).join(", ")
    : "ninguno aún";

  const prompt = `Eres un estilista de moda experto de lujo. Analiza este armario y crea 3 outfits creativos y coherentes.

ARMARIO (${garments.length} prendas):
${wardrobeDesc}

OUTFITS YA EXISTENTES (no repetir): ${existingDesc}

INSTRUCCIONES:
- Analiza el estilo general de la persona según sus prendas
- Crea 3 outfits distintos y con sentido (casual, smart-casual, especial)
- Cada outfit debe tener 2-4 prendas que combinen bien
- Usa SOLO los IDs de las prendas del armario
- Justifica brevemente por qué combinan

Responde SOLO con este JSON, sin markdown ni texto extra:
{
  "estilo_persona": "descripción del estilo general en 1-2 frases",
  "outfits": [
    {
      "nombre": "nombre creativo del outfit",
      "ocasion": "casual|formal|business|sport|party|beach|home|outdoor",
      "garmentIds": ["id1","id2","id3"],
      "por_que": "explicación en 1 frase de por qué funciona esta combinación",
      "estacion": "primavera|verano|otoño|invierno|todo el año"
    }
  ]
}`;

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
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const e = await res.json().catch(()=>({}));
    throw new Error(e?.error?.message || "Error " + res.status);
  }
  const d = await res.json();
  const raw = d.content?.find(b=>b.type==="text")?.text || "";
  return safeParseJSON(raw);
}

function OutfitsScreen({ outfits,garments,onNew,onDeleteOutfit,onSaveAiOutfit,apiKey }) {
  const [confirmDel,scd] = useState(null);
  const [aiLoading,sal]  = useState(false);
  const [aiResult,sar]   = useState(null);
  const [aiErr,sae]      = useState(null);

  async function generateAiOutfits() {
    sal(true); sae(null); sar(null);
    try {
      const result = await callStylist(garments, outfits, apiKey);
      sar(result);
    } catch(e) { sae(e.message); }
    finally { sal(false); }
  }

  function saveAiOutfit(o) {
    onSaveAiOutfit({
      id: "o_"+Date.now()+"_"+Math.random().toString(36).slice(2),
      name: o.nombre,
      garmentIds: o.garmentIds,
      occasion: o.ocasion,
      ai_generated: true,
      por_que: o.por_que,
      created_at: new Date().toISOString(),
    });
  }

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:T.bg}}>
      <div style={{padding:"13px 14px 10px",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <p style={{color:T.text,fontSize:16,fontWeight:700,fontFamily:"'Cormorant Garamond',serif"}}>Mis Outfits</p>
        <Btn onClick={onNew} icon="+" full={false} sm>Manual</Btn>
      </div>

      <div style={{flex:1,overflowY:"auto",padding:"12px 13px 84px"}}>

        {/* ── BOTÓN ESTILISTA IA ── */}
        <div style={{marginBottom:16}}>
          {!aiResult && !aiLoading && (
            <button onClick={generateAiOutfits} disabled={garments.length<2||!apiKey}
              style={{width:"100%",padding:"14px 16px",borderRadius:14,border:`1px solid ${T.accent}`,background:T.aLow,cursor:garments.length<2||!apiKey?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:12,opacity:garments.length<2||!apiKey?0.4:1,transition:"all 0.2s"}}>
              <div style={{width:40,height:40,borderRadius:12,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>✦</div>
              <div style={{textAlign:"left"}}>
                <p style={{color:T.accent,fontSize:13,fontWeight:700,margin:"0 0 2px"}}>Crear outfits con IA</p>
                <p style={{color:T.muted,fontSize:11,margin:0}}>
                  {!apiKey?"Configura tu API key primero":garments.length<2?"Necesitas al menos 2 prendas":"El estilista analiza tu armario y combina prendas"}
                </p>
              </div>
            </button>
          )}

          {aiLoading && (
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px 16px",textAlign:"center"}}>
              <div style={{width:36,height:36,borderRadius:"50%",border:`3px solid ${T.border}`,borderTop:`3px solid ${T.accent}`,animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}} />
              <p style={{color:T.text,fontSize:13,fontWeight:600,margin:"0 0 4px"}}>Analizando tu armario...</p>
              <p style={{color:T.muted,fontSize:11,margin:0}}>El estilista está combinando tus prendas</p>
            </div>
          )}

          {aiErr && (
            <div style={{background:"rgba(255,77,109,0.08)",border:"1px solid rgba(255,77,109,0.3)",borderRadius:12,padding:"10px 13px",marginBottom:10}}>
              <p style={{color:T.err,fontSize:12,margin:"0 0 8px"}}>{aiErr}</p>
              <Btn onClick={generateAiOutfits} sm full={false} icon="↺">Reintentar</Btn>
            </div>
          )}

          {aiResult && (
            <div style={{animation:"rise 0.3s ease"}}>
              {/* Estilo de la persona */}
              <div style={{background:`linear-gradient(135deg,${T.aLow},rgba(201,240,78,0.05))`,border:`1px solid ${T.accent}`,borderRadius:14,padding:"12px 14px",marginBottom:12}}>
                <p style={{color:T.accent,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.3px",margin:"0 0 5px"}}>✦ Tu estilo personal</p>
                <p style={{color:T.text,fontSize:13,lineHeight:1.6,margin:"0 0 10px"}}>{aiResult.estilo_persona}</p>
                <button onClick={()=>sar(null)} style={{background:"none",border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>Generar nuevos ↺</button>
              </div>

              {/* Outfits sugeridos */}
              <p style={{color:T.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:8}}>Outfits sugeridos</p>
              {(aiResult.outfits||[]).map((o,idx)=>{
                const pieces = garments.filter(g=>o.garmentIds.includes(g.id));
                const alreadySaved = outfits.some(ex=>
                  ex.garmentIds.length===o.garmentIds.length &&
                  o.garmentIds.every(id=>ex.garmentIds.includes(id))
                );
                return (
                  <div key={idx} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"12px 13px",marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div>
                        <p style={{color:T.text,fontSize:13,fontWeight:700,margin:"0 0 3px"}}>{o.nombre}</p>
                        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                          <Tag hi>{OCC_LBL[o.ocasion]||o.ocasion}</Tag>
                          <Tag>{o.estacion}</Tag>
                        </div>
                      </div>
                      {!alreadySaved
                        ? <button onClick={()=>saveAiOutfit(o)} style={{background:T.accent,border:"none",color:"#08080A",borderRadius:8,padding:"5px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"inherit",flexShrink:0}}>+ Guardar</button>
                        : <span style={{color:T.ok,fontSize:10,fontWeight:700}}>✓ Guardado</span>}
                    </div>
                    <div style={{display:"flex",gap:5,marginBottom:8}}>
                      {pieces.map(g=>(
                        <div key={g.id} style={{width:50,height:58,borderRadius:9,overflow:"hidden",border:`1px solid ${T.border}`,background:"#fff",flexShrink:0}}>
                          {g.imageUrl?<img src={g.imageUrl} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}} />:<div style={{width:"100%",height:"100%",background:g.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{g.emoji}</div>}
                        </div>
                      ))}
                    </div>
                    <p style={{color:T.dim,fontSize:11,lineHeight:1.5,margin:0,fontStyle:"italic"}}>"{o.por_que}"</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── OUTFITS GUARDADOS ── */}
        {outfits.length>0 && (
          <>
            <p style={{color:T.muted,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.2px",marginBottom:8}}>Tus outfits guardados</p>
            {outfits.map(o=>{
              const pieces=garments.filter(g=>o.garmentIds.includes(g.id));
              return (
                <div key={o.id} style={{background:T.surface,border:`1px solid ${o.ai_generated?T.accent:T.border}`,borderRadius:14,padding:"12px 13px",marginBottom:9}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                        {o.ai_generated && <span style={{fontSize:9,background:T.aLow,color:T.accent,border:`1px solid ${T.accent}`,borderRadius:4,padding:"1px 5px",fontWeight:700}}>IA</span>}
                        <p style={{color:T.text,fontSize:13,fontWeight:700,margin:0}}>{o.name}</p>
                      </div>
                      <Tag hi>{OCC_LBL[o.occasion]||o.occasion}</Tag>
                    </div>
                    <button onClick={()=>scd(o.id)} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:14,padding:"0 4px"}}>✕</button>
                  </div>
                  <div style={{display:"flex",gap:5}}>
                    {pieces.map(g=>(
                      <div key={g.id} style={{width:46,height:54,borderRadius:9,overflow:"hidden",border:`1px solid ${T.border}`,background:"#0d0d0d",flexShrink:0}}>
                        {g.imageUrl?<img src={g.imageUrl} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}} />:<div style={{width:"100%",height:"100%",background:g.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{g.emoji}</div>}
                      </div>
                    ))}
                  </div>
                  {o.por_que && <p style={{color:T.muted,fontSize:10,marginTop:7,lineHeight:1.4,fontStyle:"italic"}}>"{o.por_que}"</p>}
                  {confirmDel===o.id&&(
                    <div style={{marginTop:10,display:"flex",gap:7}}>
                      <Btn onClick={()=>{onDeleteOutfit(o.id);scd(null);}} danger sm icon="🗑">Eliminar</Btn>
                      <Btn onClick={()=>scd(null)} v="ghost" sm>Cancelar</Btn>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {outfits.length===0 && !aiResult && !aiLoading && (
          <div style={{textAlign:"center",padding:"30px 0"}}>
            <div style={{fontSize:36,marginBottom:8}}>👔</div>
            <p style={{color:T.muted,fontSize:12}}>Usa el estilista IA arriba o crea outfits manualmente</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CHAT SCREEN — Asistente del armario
───────────────────────────────────────────────────────────── */
function ChatScreen({ garments,outfits,user,apiKey }) {
  const [msgs,sm]    = useState([]);
  const [input,si]   = useState("");
  const [loading,sl] = useState(false);
  const bottomRef    = useRef(null);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);

  // Carga historial del chat guardado en localStorage
  useEffect(()=>{
    if (!user) return;
    try {
      const saved = JSON.parse(localStorage.getItem("cai_chat_"+user.id)||"[]");
      if (saved.length>0) sm(saved);
      else sm([{role:"assistant",text:"¡Hola! Soy tu estilista personal. Conozco todo tu armario — puedes preguntarme qué ponerte hoy, cómo combinar prendas, qué te falta comprar, o pedirme que analice tu estilo. ¿En qué te ayudo? 👗✨"}]);
    } catch { sm([{role:"assistant",text:"¡Hola! Soy tu estilista personal. ¿En qué te ayudo hoy? 👗✨"}]); }
  },[user]);

  function saveHistory(newMsgs) {
    if (!user) return;
    // Guardamos solo los últimos 40 mensajes para no llenar localStorage
    const toSave = newMsgs.slice(-40);
    localStorage.setItem("cai_chat_"+user.id, JSON.stringify(toSave));
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    if (!apiKey) { sm(p=>[...p,{role:"assistant",text:"⚠️ Necesitas configurar tu Claude API key en ⚙️ Configuración para usar el chat."}]); return; }

    const userMsg = {role:"user",text};
    const newMsgs = [...msgs, userMsg];
    sm(newMsgs); si(""); sl(true);

    // Contexto del armario para Claude
    const wardrobeCtx = garments.length===0
      ? "El armario está vacío."
      : garments.map(g=>`• ${g.name} (${g.category}, ${g.color_principal||g.color||""}, ${g.occasion}, ${(g.seasons||[]).join("/")||"todo año"}, ${g.material||"?"}, marca:${g.brand||"ninguna"})`).join("\n");

    const outfitsCtx = outfits.length===0
      ? "No tiene outfits guardados."
      : outfits.map(o=>{
          const pieces = garments.filter(g=>o.garmentIds.includes(g.id)).map(g=>g.name).join(", ");
          return `• "${o.name}" (${o.occasion}): ${pieces}`;
        }).join("\n");

    // Historial de conversación para Claude (últimos 10 mensajes)
    const history = newMsgs.slice(-11,-1).map(m=>({
      role: m.role==="user"?"user":"assistant",
      content: m.text,
    }));

    const systemPrompt = `Eres un estilista de moda experto y personal de ${user.name}. Conoces su armario al detalle y das consejos prácticos, creativos y personalizados.

ARMARIO DE ${user.name.toUpperCase()} (${garments.length} prendas):
${wardrobeCtx}

OUTFITS GUARDADOS:
${outfitsCtx}

INSTRUCCIONES:
- Sé conversacional, cálido y experto
- Cuando sugiereas outfits, menciona las prendas por su nombre exacto
- Si preguntan qué comprar, analiza los gaps del armario
- Máximo 3 párrafos por respuesta, sé conciso
- Puedes usar emojis con moderación
- Responde siempre en español`;

    try {
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
          max_tokens: 600,
          system: systemPrompt,
          messages: [
            ...history,
            { role: "user", content: text },
          ],
        }),
      });
      const d = await res.json();
      if (d.error) throw new Error(d.error.message);
      const reply = d.content?.find(b=>b.type==="text")?.text || "No pude responder, intenta de nuevo.";
      const updated = [...newMsgs,{role:"assistant",text:reply}];
      sm(updated); saveHistory(updated);
    } catch(e) {
      const updated = [...newMsgs,{role:"assistant",text:"❌ Error: "+e.message}];
      sm(updated); saveHistory(updated);
    } finally { sl(false); }
  }

  function clearChat() {
    const initial = [{role:"assistant",text:"Chat reiniciado. ¿En qué te puedo ayudar? 👗"}];
    sm(initial);
    if (user) localStorage.removeItem("cai_chat_"+user.id);
  }

  const QUICK = [
    "¿Qué me pongo hoy?",
    "¿Qué me falta en el armario?",
    "Analiza mi estilo",
    "Outfit para una cena elegante",
    "¿Cómo combino mis prendas de colores?",
  ];

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:T.bg}}>
      {/* Header */}
      <div style={{padding:"12px 14px 10px",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <p style={{color:T.text,fontSize:16,fontWeight:700,fontFamily:"'Cormorant Garamond',serif",margin:"0 0 1px"}}>Estilista IA</p>
          <p style={{color:T.muted,fontSize:10,margin:0}}>{garments.length} prendas en tu armario</p>
        </div>
        <button onClick={clearChat} style={{background:"none",border:`1px solid ${T.border}`,color:T.muted,borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>Limpiar</button>
      </div>

      {/* Mensajes */}
      <div style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>

        {/* Quick replies si no hay conversación */}
        {msgs.length<=1 && (
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:4}}>
            {QUICK.map(q=>(
              <button key={q} onClick={()=>{si(q);}} style={{background:T.surface,border:`1px solid ${T.border}`,color:T.dim,borderRadius:20,padding:"6px 11px",cursor:"pointer",fontSize:11,fontFamily:"inherit",transition:"all 0.15s"}}>
                {q}
              </button>
            ))}
          </div>
        )}

        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",animation:"risefast 0.2s ease"}}>
            {m.role==="assistant" && (
              <div style={{width:28,height:28,borderRadius:8,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginRight:8,marginTop:2}}>✦</div>
            )}
            <div style={{maxWidth:"78%",padding:"10px 13px",borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:m.role==="user"?T.accent:T.surface,border:m.role==="user"?"none":`1px solid ${T.border}`}}>
              <p style={{color:m.role==="user"?"#08080A":T.text,fontSize:13,lineHeight:1.6,margin:0,whiteSpace:"pre-wrap"}}>{m.text}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:8,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>✦</div>
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"14px 14px 14px 4px",padding:"10px 14px",display:"flex",gap:5,alignItems:"center"}}>
              {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:T.accent,animation:`pulse 1.2s ease ${i*0.2}s infinite`}} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{padding:"10px 14px 16px",borderTop:`1px solid ${T.border}`,flexShrink:0,display:"flex",gap:8,alignItems:"flex-end",background:T.bg}}>
        <div style={{flex:1,background:T.high,borderRadius:14,padding:"10px 13px",border:`1px solid ${T.border}`}}>
          <textarea value={input} onChange={e=>si(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="Pregunta sobre tu armario..." rows={1}
            style={{width:"100%",background:"none",border:"none",outline:"none",color:T.text,fontSize:13,resize:"none",fontFamily:"inherit",lineHeight:1.5,maxHeight:80,overflowY:"auto"}} />
        </div>
        <button onClick={send} disabled={!input.trim()||loading}
          style={{width:42,height:42,borderRadius:12,background:input.trim()&&!loading?T.accent:T.high,border:"none",cursor:input.trim()&&!loading?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0,transition:"all 0.2s"}}>
          {loading?"⟳":"↑"}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   STATS SCREEN
───────────────────────────────────────────────────────────── */
function StatsScreen({ garments }) {
  const total=garments.length;
  const favs=garments.filter(g=>g.is_favorite).length;
  const totalWorn=garments.reduce((a,g)=>a+(g.times_worn||0),0);
  const mostWorn=[...garments].sort((a,b)=>(b.times_worn||0)-(a.times_worn||0)).slice(0,3);
  const byCategory=CAT_KEYS.reduce((acc,k)=>({...acc,[k]:garments.filter(g=>g.category===k).length}),{});
  const maxCat=Math.max(...Object.values(byCategory),1);
  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:T.bg}}>
      <div style={{padding:"13px 14px 10px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        <p style={{color:T.text,fontSize:16,fontWeight:700,fontFamily:"'Cormorant Garamond',serif"}}>Estadísticas</p>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"13px 13px 84px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {[["👗",total,"Total prendas"],["⭐",favs,"Favoritas"],["👟",totalWorn,"Total usos"],["📊",Object.values(byCategory).filter(v=>v>0).length,"Categorías"]].map(([ic,v,lb])=>(
            <div key={lb} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:"13px 12px",textAlign:"center"}}>
              <p style={{fontSize:22,margin:"0 0 3px"}}>{ic}</p>
              <p style={{color:T.accent,fontSize:22,fontWeight:700,margin:"0 0 2px",fontFamily:"'Cormorant Garamond',serif"}}>{v}</p>
              <p style={{color:T.muted,fontSize:10}}>{lb}</p>
            </div>
          ))}
        </div>
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 14px",marginBottom:12}}>
          <p style={{color:T.dim,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.3px",marginBottom:12}}>Por categoría</p>
          {CAT_KEYS.map(k=>{const count=byCategory[k]||0;if(!count)return null;return(
            <div key={k} style={{marginBottom:9}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:T.text,fontSize:11}}>{EMOJI_MAP[k]} {CAT_LBL[k]}</span><span style={{color:T.accent,fontSize:11,fontWeight:700}}>{count}</span></div>
              <div style={{height:4,background:T.high,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",background:T.accent,borderRadius:2,width:`${(count/maxCat)*100}%`,transition:"width 0.6s ease"}} /></div>
            </div>
          );})}
        </div>
        {mostWorn.length>0&&(
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:"13px 14px"}}>
            <p style={{color:T.dim,fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"1.3px",marginBottom:10}}>Más usadas</p>
            {mostWorn.map((g,i)=>(
              <div key={g.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:9}}>
                <span style={{color:i===0?T.accent:T.muted,fontSize:13,fontWeight:700,width:16,textAlign:"center"}}>{i+1}</span>
                <div style={{width:36,height:42,borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`,background:"#0d0d0d",flexShrink:0}}>
                  {g.imageUrl?<img src={g.imageUrl} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}} />:<div style={{width:"100%",height:"100%",background:g.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{g.emoji}</div>}
                </div>
                <div style={{flex:1}}><p style={{color:T.text,fontSize:12,fontWeight:600,margin:"0 0 2px"}}>{g.name}</p><p style={{color:T.muted,fontSize:10}}>{g.brand||g.category}</p></div>
                <span style={{color:T.accent,fontSize:12,fontWeight:700}}>{g.times_worn||0}x</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   PROFILE SCREEN
───────────────────────────────────────────────────────────── */
function ProfileScreen({ user,garments,onLogout,onApiKey,apiKey,removeBgKey,photoRoomKey }) {
  const added=garments.filter(g=>g.added_at&&new Date(g.added_at)>new Date(Date.now()-7*86400000)).length;
  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:T.bg}}>
      <div style={{padding:"13px 14px 10px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        <p style={{color:T.text,fontSize:16,fontWeight:700,fontFamily:"'Cormorant Garamond',serif"}}>Perfil</p>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 14px 84px"}}>
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"16px 14px",marginBottom:14,display:"flex",gap:13,alignItems:"center"}}>
          <div style={{width:52,height:52,borderRadius:14,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:"#08080A",flexShrink:0}}>{user.name[0].toUpperCase()}</div>
          <div><p style={{color:T.text,fontSize:15,fontWeight:700,margin:"0 0 3px",fontFamily:"'Cormorant Garamond',serif"}}>{user.name}</p><p style={{color:T.muted,fontSize:11,margin:0}}>{user.email}</p></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:14}}>
          {[[garments.length,"Prendas"],[garments.filter(g=>g.is_favorite).length,"Favoritas"],[added,"Esta semana"]].map(([v,lb])=>(
            <div key={lb} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:11,padding:"10px 8px",textAlign:"center"}}>
              <p style={{color:T.accent,fontSize:19,fontWeight:700,margin:"0 0 2px",fontFamily:"'Cormorant Garamond',serif"}}>{v}</p>
              <p style={{color:T.muted,fontSize:10}}>{lb}</p>
            </div>
          ))}
        </div>
        {(removeBgKey || photoRoomKey) && (
          <div style={{marginBottom:14}}>
            {removeBgKey  && <ApiUsageCounter provider="removebg" />}
            {photoRoomKey && <ApiUsageCounter provider="photoroom" />}
          </div>
        )}
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden",marginBottom:12}}>
          {[
            {icon:"🔑",label:"APIs configuradas",sub:`Claude ${apiKey?"✓":"✗"} · Remove.bg ${removeBgKey?"✓":"✗"} · PhotoRoom ${photoRoomKey?"✓":"✗"}`,action:onApiKey,ok:!!apiKey},
            {icon:"📤",label:"Exportar armario",sub:"Próximamente",action:null,ok:false},
          ].map((item,i)=>(
            <button key={i} onClick={item.action||undefined} disabled={!item.action}
              style={{width:"100%",background:"none",border:"none",borderBottom:i===0?`1px solid ${T.border}`:"none",padding:"13px 14px",cursor:item.action?"pointer":"default",display:"flex",alignItems:"center",gap:11,textAlign:"left",fontFamily:"inherit"}}>
              <span style={{fontSize:16,flexShrink:0}}>{item.icon}</span>
              <div style={{flex:1}}><p style={{color:T.text,fontSize:12,fontWeight:600,margin:"0 0 2px"}}>{item.label}</p><p style={{color:item.ok?T.ok:T.muted,fontSize:10,margin:0}}>{item.sub}</p></div>
              {item.action&&<span style={{color:T.muted,fontSize:12}}>→</span>}
            </button>
          ))}
        </div>
        <Btn onClick={onLogout} v="ghost" icon="🚪" danger>Cerrar sesión</Btn>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   HOME SCREEN
───────────────────────────────────────────────────────────── */
function HomeScreen({ user,garments,onScan,onOpenGarment,onConfig,apiKey }) {
  const [cat,sc]=useState("Todos");
  const [q,sq]=useState("");
  const items=garments.filter(g=>(cat==="Todos"||g.category===cat)&&(!q||g.name.toLowerCase().includes(q.toLowerCase())||(g.brand||"").toLowerCase().includes(q.toLowerCase())));
  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column",background:T.bg,position:"relative"}}>
      <div style={{padding:"13px 14px 0",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <p style={{color:T.muted,fontSize:10,margin:"0 0 1px",textTransform:"uppercase",letterSpacing:"1.4px"}}>Bienvenida</p>
            <p style={{color:T.text,fontSize:18,fontWeight:700,margin:0,fontFamily:"'Cormorant Garamond',serif"}}>{user.name}</p>
          </div>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            <div style={{background:T.high,border:`1px solid ${T.border}`,borderRadius:8,padding:"4px 9px"}}><span style={{color:T.dim,fontSize:11,fontWeight:600}}>{garments.length} prendas</span></div>
            <button onClick={onConfig} style={{width:32,height:32,borderRadius:9,background:apiKey?T.high:"rgba(255,77,109,0.15)",border:`1px solid ${apiKey?T.border:"rgba(255,77,109,0.4)"}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",position:"relative"}}>
              <span style={{fontSize:14}}>⚙️</span>
              {!apiKey&&<span style={{position:"absolute",top:-3,right:-3,width:8,height:8,borderRadius:"50%",background:T.err,border:`1.5px solid ${T.bg}`}} />}
            </button>
            <div style={{width:32,height:32,borderRadius:9,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#08080A"}}>{user.name[0].toUpperCase()}</div>
          </div>
        </div>
        <div style={{position:"relative",marginBottom:9}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:T.muted,fontSize:12,pointerEvents:"none"}}>🔍</span>
          <input value={q} onChange={e=>sq(e.target.value)} placeholder="Buscar prendas o marcas..."
            style={{width:"100%",background:T.high,border:`1px solid ${T.border}`,borderRadius:10,padding:"9px 10px 9px 32px",color:T.text,fontSize:12,outline:"none"}} />
        </div>
        <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:10}}>
          {CATS.map(c=><Pill key={c} label={CAT_LBL[c]||c} active={cat===c} onClick={()=>sc(c)} />)}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"0 11px 84px"}}>
        {items.length===0
          ? <div style={{textAlign:"center",padding:"50px 0"}}><div style={{fontSize:36,marginBottom:8}}>👗</div><p style={{color:T.muted,fontSize:12}}>{q?"Sin resultados":"No hay prendas aquí"}</p></div>
          : <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{items.map(g=><GarmentCard key={g.id} g={g} onClick={()=>onOpenGarment(g)} />)}</div>}
      </div>
      <button onClick={onScan}
        style={{position:"absolute",bottom:72,right:13,width:50,height:50,borderRadius:"50%",background:T.accent,border:"none",cursor:"pointer",fontSize:19,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 24px ${T.aMid},0 0 0 4px ${T.bg}`,animation:"glow 2.5s infinite"}}>
        📸
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   BOTTOM NAV
───────────────────────────────────────────────────────────── */
function BottomNav({ active,onChange }) {
  const tabs=[["🏠","Armario","home"],["👔","Outfits","outfits"],["💬","Chat","chat"],["📊","Stats","stats"],["👤","Perfil","profile"]];
  return (
    <div style={{position:"absolute",bottom:0,left:0,right:0,background:T.surface,borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"flex-start",justifyContent:"space-around",zIndex:100,paddingBottom:"var(--sab)"}}>
      {tabs.map(([ic,lb,id])=>(
        <button key={id} onClick={()=>onChange(id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"none",border:"none",cursor:"pointer",flex:1,padding:"6px 0"}}>
          <span style={{fontSize:16}}>{ic}</span>
          <span style={{fontSize:9,fontWeight:700,color:active===id?T.accent:T.muted,transition:"color 0.2s"}}>{lb}</span>
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ROOT APP
───────────────────────────────────────────────────────────── */
export default function App() {
  const [screen,ss] = useState("auth");
  const [tab,st]   = useState("home");
  const [user,su]  = useState(null);
  const [items,si] = useState([]);
  const [outfits,so] = useState([]);
  const [sel,ssel] = useState(null);
  const [apiKey,sak]   = useState(()=>DB.getApiKey());
  const [rbKey,srbk]   = useState(()=>DB.getRemoveBgKey());
  const [prKey,sprk]   = useState(()=>DB.getPhotoRoomKey());
  const [outfitNew,son] = useState(false);
  const [toast,stt] = useState(null);

  /* Restore session on mount */
  useEffect(()=>{
    const session = restoreSession();
    if (session) {
      su(session);
      si(DB.getGarments(session.id));
      so(DB.getOutfits(session.id));
      ss("app");
    }
  },[]);

  function showToast(msg,type="ok"){ stt({msg,type}); setTimeout(()=>stt(null),2200); }

  function login(u){ su(u); si(DB.getGarments(u.id)); so(DB.getOutfits(u.id)); ss("app"); }

  function logout(){ DB.clearSession(); su(null); si([]); so([]); ssel(null); ss("auth"); st("home"); }

  function saveGarment(g,keepScreen=false){
    if (!g){ ss("app"); return; }
    si(prev=>{
      const next=[{id:"g_"+Date.now()+"_"+Math.random().toString(36).slice(2),...g},...prev];
      DB.saveGarments(user.id,next); return next;
    });
    if (!keepScreen){ ss("app"); showToast("¡Prendas guardadas en el armario ✓"); }
  }

  function updateGarment(u){
    si(prev=>{ const next=prev.map(g=>g.id===u.id?u:g); DB.saveGarments(user.id,next); return next; });
    ssel(u);
  }

  function deleteGarment(id){
    si(prev=>{ const next=prev.filter(g=>g.id!==id); DB.saveGarments(user.id,next); return next; });
    ssel(null); ss("app"); st("home");
    showToast("Prenda eliminada","err");
  }

  function saveOutfit(o){
    so(prev=>{ const next=[o,...prev]; DB.saveOutfits(user.id,next); return next; });
    son(false); showToast("Outfit guardado ✓");
  }

  function saveAiOutfit(o){
    so(prev=>{ const next=[o,...prev]; DB.saveOutfits(user.id,next); return next; });
    showToast("Outfit IA guardado ✓");
  }

  function deleteOutfit(id){
    so(prev=>{ const next=prev.filter(o=>o.id!==id); DB.saveOutfits(user.id,next); return next; });
    showToast("Outfit eliminado","err");
  }

  function saveKey(k){ sak(k); showToast("Claude key guardada ✓"); ss("app"); }
  function saveRemoveBgKey(k){ srbk(k); showToast("Remove.bg key guardada ✓"); }
  function savePhotoRoomKey(k){ sprk(k); showToast("PhotoRoom key guardada ✓"); }

  return (
    <div style={{width:"100%",height:"100dvh",background:T.bg,fontFamily:"'Sora',system-ui,sans-serif",position:"relative",overflow:"hidden",paddingTop:"var(--sat)"}}>
      <style>{CSS}</style>
      <div style={{height:"100%",display:"flex",flexDirection:"column",position:"relative"}}>

        {screen==="auth" && <AuthScreen onLogin={login} />}

        {screen==="apikey" && (
          <ApiKeyScreen
            onSave={saveKey}
            onBack={()=>ss("app")}
            current={apiKey}
            currentRemoveBg={rbKey}
            currentPhotoRoom={prKey}
            onSaveRemoveBg={saveRemoveBgKey}
            onSavePhotoRoom={savePhotoRoomKey}
          />
        )}

        {screen==="scanner" && (
          <ScannerScreen
            onSave={saveGarment}
            onBack={()=>ss("app")}
            apiKey={apiKey}
            removeBgKey={rbKey}
            photoRoomKey={prKey}
            onNeedKey={()=>ss("apikey")}
          />
        )}

        {screen==="detail" && sel && (
          <DetailScreen
            garment={sel}
            garments={items}
            onBack={()=>ss("app")}
            onUpdate={updateGarment}
            onDelete={deleteGarment}
          />
        )}

        {screen==="app" && (
          <div style={{flex:1,position:"relative",overflow:"hidden",display:"flex",flexDirection:"column"}}>
            <div style={{flex:1,overflow:"hidden",position:"relative"}}>
              {tab==="home" && <HomeScreen user={user} garments={items} onScan={()=>ss("scanner")} onOpenGarment={g=>{ssel(g);ss("detail");}} onConfig={()=>ss("apikey")} apiKey={apiKey} />}
              {tab==="outfits" && <OutfitsScreen outfits={outfits} garments={items} onNew={()=>son(true)} onDeleteOutfit={deleteOutfit} onSaveAiOutfit={saveAiOutfit} apiKey={apiKey} />}
              {tab==="chat" && <ChatScreen garments={items} outfits={outfits} user={user} apiKey={apiKey} />}
              {tab==="stats" && <StatsScreen garments={items} />}
              {tab==="profile" && <ProfileScreen user={user} garments={items} onLogout={logout} onApiKey={()=>ss("apikey")} apiKey={apiKey} removeBgKey={rbKey} photoRoomKey={prKey} />}
            </div>
            <BottomNav active={tab} onChange={st} />
            {outfitNew && (
              <div style={{position:"absolute",inset:0,zIndex:250}}>
                <OutfitModal garments={items} startWith={null} onSave={saveOutfit} onClose={()=>son(false)} />
              </div>
            )}
          </div>
        )}

        {toast && screen!=="scanner" && <Toast msg={toast.msg} type={toast.type} />}
      </div>
    </div>
  );
}
