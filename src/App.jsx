import React, { useState, useEffect, useRef } from 'react';
import { sessionDB } from './storage.js';

// ── Shared constants & helpers (extracted from cellar app) ───────
const RED = "#8B2635", GOLD = "#9A7020";
const TH = { CARD:"#fff", CARD2:"#FAFAFA", BD:"#e8e0d8", T2:"#666", T3:"#888" };
const CS = { background:"#fff", border:"1px solid #e8e0d8", borderRadius:12, padding:16, marginBottom:12 };
function cleanName(name, vintage) {
  if (!name||!vintage) return name||"";
  return name.replace(new RegExp(`\\s*${vintage}\\s*$`), "").trim();
}

import {
  WINE_ORIGINS,
  GRAPE_CATEGORIES,
  GRAPE_LIST,
  REGION_GRAPES,
  REGION_CLASSES,
  DEFAULT_CLASSES,
} from './wineData.js';

// ── 토스트 알림 (라이브러리 없이 동작) ──────────────────────────
function toast(message, type="info", duration=3000) {
  if(typeof document === "undefined") return;
  const el = document.createElement("div");
  el.textContent = message;
  const bg = type==="error"?"#991B1B":type==="warn"?"#92400E":"#2E7D32";
  el.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:${bg};color:#fff;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.25);max-width:360px;text-align:center;pointer-events:none;`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), duration);
}

// ── AI 정성 평가 루브릭 ──────────────────────────────────────────
// Criterion 1: 감각 묘사 해상도 (Aroma & Flavor)       8점
// Criterion 2: 구조감 및 텍스처 (Structure & Texture)  12점 ← 핵심
// Criterion 3: 논리의 정합성 (Logical Conclusion)      10점 ← 오답도 논리 탄탄하면 고점
const QUAL_RUBRIC = {
  aroma:     { label:"향 묘사",    max:8  },
  structure: { label:"구조·텍스처", max:12 },
  logic:     { label:"논리 정합성", max:10 },
};
const QUAL_MAX = 30;
// 점수 배지 (와인 등급 패러디)
function scoreLabel(pct) {
  if(pct>=90) return {emoji:"🏆",label:"그랑크뤼",color:"#9A7020"};
  if(pct>=75) return {emoji:"🥇",label:"1er Cru", color:"#8B6914"};
  if(pct>=50) return {emoji:"🍷",label:"빌라주",  color:"#8B2635"};
  if(pct>=25) return {emoji:"🌱",label:"레지오날",color:"#2E7D32"};
  return           {emoji:"🍇",label:"도전중",  color:"#888"};
}

// ── 공통 Gemini 호출 (재시도 + JSON모드 + thinking제어) ──────────
// 와인셀러 앱에서 이식: 503/500 일시오류 자동 재시도(2초·4초), 429는 즉시 중단,
// JSON 모드 강제로 파싱 안정성 확보, Flash는 thinking 꺼서 속도 개선
const GEMINI_MODEL = "gemini-2.5-flash-lite";
async function geminiRequest(apiKey, parts, { maxTokens=4000 }={}) {
  if (!apiKey) throw new Error("Gemini API 키가 없습니다");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const genConfig = {
    maxOutputTokens: maxTokens,
    temperature: 0.15,
    responseMimeType: "application/json",
    thinkingConfig: { thinkingBudget: 0 }, // Flash 계열 thinking 끔 → 속도↑
  };
  const body = JSON.stringify({ contents:[{ parts }], generationConfig: genConfig });
  const sleep = ms => new Promise(res => setTimeout(res, ms));
  let lastStatus = 0;
  for (let attempt=0; attempt<3; attempt++) {
    if (attempt>0) await sleep(attempt*2000); // 2초, 4초 대기
    let r;
    try {
      r = await fetch(url, { method:"POST", headers:{"Content-Type":"application/json","x-goog-api-key":apiKey}, body });
    } catch(netErr) { lastStatus="network"; continue; } // 네트워크 일시 오류 → 재시도
    if (r.ok) {
      const d = await r.json();
      if (d.error) throw new Error(d.error.message);
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
      // JSON 파싱 (마크다운 펜스 제거 안전망)
      const stripped = text.replace(/```json\n?|\n?```/g, "").trim();
      try { return JSON.parse(stripped); }
      catch(e1) { const m=stripped.match(/\{[\s\S]*\}/); if(m){ try{ return JSON.parse(m[0]); }catch(e2){} } }
      return null;
    }
    if (r.status===429) throw new Error("RATE_LIMIT 429 — 한도 초과 (잠시 후 재시도)"); // 한도는 즉시 중단
    lastStatus = r.status;
    if (r.status>=500) continue; // 서버 일시 오류 → 재시도
    const errText = await r.text();
    throw new Error(`Gemini HTTP ${r.status}: ${errText.slice(0,150)}`); // 그 외 즉시 중단
  }
  throw new Error(`Gemini ${lastStatus} (재시도 실패)`);
}

// ── AI 라벨 스캐너 (Gemini Vision) ──────────────────────────────
async function callGeminiVision(apiKey, imageBase64, mimeType) {
  if (!apiKey) return null;
  const prompt = `이 와인 라벨 사진을 분석하여 아래 JSON 형식으로만 반환하세요. 읽을 수 없으면 null:
{
  "nameKR": "와인 이름 (한글 또는 영문)",
  "country": "국가명 (한국어, 예: 프랑스, 이탈리아)",
  "region": "지역명 (한국어, 예: 부르고뉴, 피에몬테)",
  "subRegion": "마을/아펠라시옹 (한국어, 예: 주브레샹베르탱)",
  "grapeVariety": "품종 (한국어, 예: 피노누아, 네비올로)",
  "vintage": "빈티지 연도 (숫자만, 예: 2019)",
  "classification": "등급 (예: 그랑크뤼, 1er Cru, DOC)"
}`;
  try {
    return await geminiRequest(apiKey, [
      { inline_data:{ mime_type:mimeType, data:imageBase64 } },
      { text: prompt }
    ], { maxTokens: 1500 });
  } catch(e) {
    const msg = String(e.message||e);
    alert(msg.includes("429") ? "⏳ AI 호출 한도 초과 — 잠시 후 다시 시도하세요" : "라벨 스캔 오류: "+msg);
    return null;
  }
}

// ── callGeminiForBatchWines: 와인 1병 × 모든 참가자를 한 번에 평가 ──
async function callGeminiForBatchWines(apiKey, ans, batchTargets) {
  if (!apiKey || !batchTargets.length) return null;

  const wineInfo = [ans.nameKR||ans.nameEN, ans.country, ans.region, ans.subRegion,
    ans.grapeVariety, ans.vintage, ans.classification].filter(Boolean).join(", ");

  const participantsData = batchTargets.map(g => {
    const wset = [
      g.acidity && `산도:${g.acidity}`,
      g.tannin && `타닌:${g.tannin}`,
      g.body && `바디:${g.body}`,
      g.aromas && `향:${g.aromas}`,
    ].filter(Boolean).join(", ");
    return `
[참가자: ${g.participantName}]
마을 추측: "${g.village||""}"
시음 지표: ${wset||"(미입력)"}
추론 이유: "${g.reason||""}"
`;
  }).join("\n");

  const prompt = `당신은 WSET Diploma 수준의 와인 심사위원입니다. 마크다운 없이 순수 JSON만 반환하세요.

정답 와인 실제 정보: ${wineInfo}

─── 채점 대상 참가자 데이터 ───
${participantsData}

─── 마을/아펠라시옹 의미 판정 기준 (정답 마을: "${ans.subRegion||ans.vineyard||""}") ───
- exact: 표기만 다르거나 공백 차이인 동일 아펠라시옹
- close: 동일 서브리전 내 지리적 인접 마을 또는 상하위 계층 관계
- miss: 다른 서브리전 혹은 먼 거리 (같은 품종이라는 이유만으로 근접 처리 금지)

─── 정성 평가 루브릭 (총 30점 만점) ───
1. aroma(0~8점): 향 묘사 해상도 (시음 지표의 향·풍미 칩 + 추론 이유 종합)
2. structure(0~12점): 구조감 및 텍스처 분석 (시음 지표의 산도·타닌·바디가 정답 와인과 얼마나 일치하는지 가장 중요하게 평가)
3. logic(0~10점): 묘사 기반의 논리적 결론 도출 (타당한 오답 고점 부여)

반드시 "참가자 이름"을 Key로 하는 JSON 객체를 반환하세요.
형식: {"참가자이름": {"village_level":"exact|close|miss", "village_note":"이유", "aroma":점수, "structure":점수, "logic":점수, "feedback":"평가 코멘트"}}`;

  try {
    const result = await geminiRequest(apiKey, [{ text: prompt }], { maxTokens: 6000 });
    if (!result) throw new Error("AI 응답을 파싱하지 못했습니다");
    return result;
  } catch(e) {
    console.error("[Gemini Batch Error]:", e);
    throw e;
  }
}


// ── 다크모드 테마 팔레트 ──────────────────────────────────────────
function getTheme(dark) {
  return dark ? {
    BG:    "#16090C",   // 페이지 배경 (딥 와인 블랙)
    CARD:  "#231217",   // 카드 배경
    CARD2: "#2C1820",   // 보조 카드 (패널 등)
    T1:    "#EDE0E3",   // 주 텍스트
    T2:    "#9E7E84",   // 보조 텍스트
    T3:    "#5A3A40",   // 희미한 텍스트
    BD:    "#3D2028",   // 테두리
    INP:   "#1E0F13",   // 입력창 배경
    RED:   "#C04060",   // 다크모드 레드 (더 밝게)
  } : {
    BG:    "#F7F4F0",
    CARD:  "#fff",
    CARD2: "#FAFAFA",
    T1:    "#3B2A1A",
    T2:    "#666",
    T3:    "#aaa",
    BD:    "#ddd",
    INP:   "#fff",
    RED:   "#8B2635",
  };
}

// ── Toast 알림 시스템 ──────────────────────────────────────────────
function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",
      zIndex:9999,display:"flex",flexDirection:"column",gap:8,alignItems:"center",pointerEvents:"none"}}>
      {toasts.map(t=>(
        <div key={t.id} style={{
          padding:"10px 20px",borderRadius:24,fontSize:13,fontWeight:600,
          color:"#fff",boxShadow:"0 4px 16px rgba(0,0,0,.25)",
          background: t.type==="error"?"#991B1B": t.type==="success"?"#2E7D32":
                      t.type==="warn"?"#92400E":"#3B2A1A",
          opacity: t.fading ? 0 : 1,
          transition:"opacity .3s",
          maxWidth:320,textAlign:"center",
        }}>{t.msg}</div>
      ))}
    </div>
  );
}

// ── 커스텀 확인 Modal (confirm 대체) ──────────────────────────────
function ConfirmModal({ message, onYes, onNo }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:9998,
      display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#fff",borderRadius:16,padding:24,maxWidth:320,width:"100%",
        boxShadow:"0 8px 32px rgba(0,0,0,.2)"}}>
        <div style={{fontSize:14,color:TH.T1,marginBottom:20,lineHeight:1.6}}>{message}</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onNo} style={{flex:1,padding:"10px",border:`1px solid ${TH.BD}`,
            borderRadius:10,fontSize:13,cursor:"pointer",background:"#fff",color:TH.T2}}>취소</button>
          <button onClick={onYes} style={{flex:1,padding:"10px",border:"none",
            borderRadius:10,fontSize:13,cursor:"pointer",background:"#8B2635",color:"#fff",fontWeight:700}}>확인</button>
        </div>
      </div>
    </div>
  );
}

// ── Blind tasting scoring (custom rubric, proximity-aware, AI-ready) ──
const DEFAULT_RUBRIC = {
  weights: { country:1, region:1.5, village:2, classification:2, grape:1.5, vintage:1 },
  closeRatio: 0.5,
  vintageTol: 2,
  qualRatio: 0.3,    // AI 정성 평가 비율 (0=사용안함, 0.3=30%)
};
// 등급 정규화: 자유 텍스트/약칭을 표준 등급으로
function normClass(s){
  const x=norm(s);
  if(!x) return "";
  if(/(grand ?cru|그랑\s?크뤼|그랑크루|gc\b)/.test(x)) return "grandcru";
  if(/(1er|premier|프리미에|prem|일\s?등급|1등급)/.test(x)) return "premiercru";
  if(/(village|빌라주|빌라쥬|마을)/.test(x)) return "village";
  if(/(regional|bourgogne|부르고뉴\s?급|지역급|generic)/.test(x)) return "regional";
  return x; // 기타 등급(보르도 growth 등)은 원문 비교
}
function levelClass(guess, answer){
  const g=normClass(guess), a=normClass(answer);
  if(!g||!a) return "none";
  if(g===a) return "exact";
  // 인접 등급은 근접 처리 (빌라주↔1er↔그랑크뤼 한 칸 차이)
  const ladder=["regional","village","premiercru","grandcru"];
  const gi=ladder.indexOf(g), ai=ladder.indexOf(a);
  if(gi>=0&&ai>=0&&Math.abs(gi-ai)===1) return "close";
  // 보르도 등 텍스트 부분일치
  if(a.includes(g)||g.includes(a)) return "close";
  return "miss";
}
function norm(s){ return (s||"").toString().toLowerCase().trim().replace(/\s+/g," "); }
function levelField(guess, answer){
  const g=norm(guess), a=norm(answer);
  if(!g||!a) return "none";
  if(g===a) return "exact";
  if(a.includes(g)||g.includes(a)) return "close";
  return "miss";
}
// 품종: 블렌드 교집합 기반. 토큰 분리 후 일치 비율로 판정
function splitGrapes(s){
  return norm(s).split(/[,/]|\s*[·]\s*|및|그리고/).map(x=>x.trim()).filter(Boolean);
}
function levelGrape(guess, answer){
  const gs=splitGrapes(guess), as=splitGrapes(answer);
  if(!gs.length||!as.length) return "none";
  // 부분 일치(한 토큰이 다른 토큰을 포함)도 매칭으로 인정
  const match=(x,y)=>x===y||x.includes(y)||y.includes(x);
  const hit=gs.filter(g=>as.some(a=>match(g,a))).length;
  if(hit===0) return "miss";
  // 정답 품종을 모두 맞히고 추측에 군더더기 거의 없으면 정확
  const coverAns=as.filter(a=>gs.some(g=>match(g,a))).length;
  if(coverAns===as.length && gs.length<=as.length+1) return "exact";
  return "close";
}
function levelVintage(guess, answer, tol){
  const g=(guess||"").toString(), a=(answer||"").toString();
  if(!g||!a) return "none";
  const gy=(g.match(/\d{4}/g)||[]).map(Number);
  const ay=parseInt(a);
  if(!gy.length||isNaN(ay)) return norm(g)===norm(a)?"exact":"miss";
  if(gy.length>=2 && ay>=Math.min(...gy) && ay<=Math.max(...gy)) return "exact";
  if(gy.some(y=>Math.abs(y-ay)<=tol)) return "close";
  return "miss";
}
function lvlToPts(level, closeRatio){
  if(level==="exact") return 1;
  if(level==="close") return closeRatio;
  return 0;
}
// 와인별 채점 깊이: 해당 단계까지의 항목만 채점에 포함
const DEPTH_FIELDS = {
  country: ["country"],
  region:  ["country","region"],
  village: ["country","region","village"],
  full:    ["country","region","village","classification","grape","vintage"],
};
// ── 참가자 레벨 정의 ─────────────────────────────────────────────
const PARTICIPANT_LEVELS = {
  expert:   { label:"🎯 Expert",   fields:["country","region","village","classification","grape","vintage"], vintageTol:1 },
  standard: { label:"🍷 Standard", fields:["country","region","grape","vintage"],                           vintageTol:1 },
  beginner: { label:"🌱 Beginner", fields:["country","grape","vintage"],                                    vintageTol:2 },
};
const LEVEL_WEIGHTS = {
  expert:   {country:1, region:1.5, village:2,   classification:2,   grape:1.5, vintage:1},
  standard: {country:1, region:1.5, village:0,   classification:0,   grape:1.5, vintage:1},
  beginner: {country:1, region:0,   village:0,   classification:0,   grape:1.5, vintage:1},
};

function scoreGuessVsAnswer(g, ans, rubric, depth, villageOverride, level){
  const R = rubric || DEFAULT_RUBRIC;
  // 레벨 가중치 우선 적용 (참가자별 레벨)
  const W = (level && LEVEL_WEIGHTS[level]) ? LEVEL_WEIGHTS[level] : (R.weights || DEFAULT_RUBRIC.weights);
  const cr = R.closeRatio ?? 0.5;
  const vintageTol = (level && PARTICIPANT_LEVELS[level]) ? PARTICIPANT_LEVELS[level].vintageTol : (R.vintageTol ?? 2);
  const tol = R.vintageTol ?? 2;
  const fields = {
    country: levelField(g.country, ans.country),
    region:  levelField(g.region, ans.region),
    village: villageOverride || levelField(g.village, ans.subRegion||ans.vineyard),
    classification: levelClass(g.classification, ans.classification),
    grape:   levelGrape(g.grape, ans.grapeVariety),
    vintage: levelVintage(g.vintage, ans.vintage, tol),
  };
  const allowed = DEPTH_FIELDS[depth||"full"] || DEPTH_FIELDS.full;
  let total=0, max=0;
  Object.keys(W).forEach(k=>{
    const w=W[k]||0;
    if(w<=0) return;             // 가중치 0이면 제외
    if(!allowed.includes(k)) return; // 와인별 깊이 밖이면 제외
    max += w;
    total += lvlToPts(fields[k], cr) * w;
  });
  const result = {country:{level:fields.country},region:{level:fields.region},village:{level:fields.village},classification:{level:fields.classification},grape:{level:fields.grape},vintage:{level:fields.vintage}};
  result.total=Math.round(total*10)/10;
  result.max=max;
  result.pct=max>0?Math.round(total/max*100):0;
  result.depth=depth||"full";
  return result;
}
const LVL = {exact:{c:"#2E7D32",bg:"#E8F5E9",t:"정확"},close:{c:"#92400E",bg:"#FEF3C7",t:"근접"},miss:{c:"#991B1B",bg:"#FEE2E2",t:"오답"},none:{c:"#ccc",bg:"#f5f5f5",t:"-"}};

// ── 세션 사진 유틸리티 ──────────────────────────────────────────
function compressPhoto(file, maxSize=800, quality=0.75) {
  return new Promise(resolve=>{
    const img=new Image(), url=URL.createObjectURL(file);
    img.onload=()=>{
      const canvas=document.createElement("canvas");
      const ratio=Math.min(maxSize/img.width, maxSize/img.height, 1);
      canvas.width=Math.round(img.width*ratio);
      canvas.height=Math.round(img.height*ratio);
      canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg",quality));
    };
    img.src=url;
  });
}

function SessionPhotos({ photos=[], onAdd, onDelete, readOnly=false }) {
  const fileRef = React.useRef();
  async function handleFiles(files) {
    for(const f of Array.from(files)) {
      if(!f.type.startsWith("image/")) continue;
      const data = await compressPhoto(f);
      onAdd({data, caption:"", addedAt:new Date().toISOString()});
    }
  }
  return (
    <div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:readOnly?0:8}}>
        {photos.map((p,i)=>(
          <div key={i} style={{position:"relative",width:90,height:90}}>
            <img src={p.data} alt="" style={{width:90,height:90,objectFit:"cover",borderRadius:8,display:"block"}}/>
            {!readOnly&&(
              <button onClick={()=>onDelete(i)}
                style={{position:"absolute",top:2,right:2,background:"rgba(0,0,0,.55)",color:"#fff",border:"none",borderRadius:"50%",width:20,height:20,fontSize:12,cursor:"pointer",lineHeight:1,padding:0}}>×</button>
            )}
          </div>
        ))}
        {!readOnly&&(
          <button onClick={()=>fileRef.current?.click()}
            style={{width:90,height:90,border:"1px dashed #ddd",borderRadius:8,background:TH.CARD2,color:TH.T3,fontSize:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            +
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}}
        onChange={e=>{handleFiles(e.target.files);e.target.value="";}}/>
    </div>
  );
}


// ── 추측 입력 외부 컴포넌트 (BlindTastingPage 밖으로 분리 → 포커스 버그 방지) ─
function GCountry({ country, onChange, TH, IST }) {
  return (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>국가</div>
      <select value={country} onChange={e=>{onChange("country",e.target.value);onChange("region","");onChange("village","");}}
        style={{...IST,background:"#fff",color:country&&country!=="__other"?"#1a1a1a":"#888",fontWeight:country?500:400}}>
        <option value="">선택...</option>
        {Object.keys(WINE_ORIGINS).map(c=><option key={c} value={c}>{c}</option>)}
        <option value="__other">기타 (직접입력)</option>
      </select>
      {country==="__other"&&<input autoFocus placeholder="국가 직접 입력" onChange={e=>onChange("country",e.target.value)} style={{...IST,marginTop:6}}/>}
    </div>
  );
}

function GRegion({ country, region, onChange, TH, IST, setBottomSheet, setBsSearch }) {
  const regions = WINE_ORIGINS[country] ? Object.keys(WINE_ORIGINS[country]) : [];
  const popular = country ? Object.keys(WINE_ORIGINS[country]||{}).slice(0,6)
    : ["부르고뉴","보르도","피에몬테","토스카나","나파 밸리","말버러"];
  return (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>지역</div>
      <button onClick={()=>{setBsSearch("");setBottomSheet({label:"지역 선택",options:regions.length?regions:Object.values(WINE_ORIGINS).flatMap(r=>Object.keys(r)),popular,field:"region"});}}
        style={{width:"100%",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"9px 12px",fontSize:13,background:TH.INP,color:region?TH.T1:"#aaa",textAlign:"left",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>{region||"탭하여 선택"}</span>
        <span style={{fontSize:12,color:"#aaa"}}>▾</span>
      </button>
    </div>
  );
}

function GVillage({ country, region, village, onChange, TH, setBottomSheet, setBsSearch }) {
  let villages = WINE_ORIGINS[country]?.[region]||[];
  if(!villages.length && region) Object.values(WINE_ORIGINS[country]||{}).forEach(vs=>villages.push(...vs));
  const VILLAGE_POPULAR = {
    "부르고뉴":["주브레샹베르탱","본로마네","샹볼뮈지니","뫼르소","퓔리니몽라셰","샤사뉴몽라셰","포마르","볼네"],
    "보르도":["포이약","마고","생줄리앙","생테스테프","포므롤","생테밀리옹","소테른","그라브"],
    "론":["에르미타주","코트로티","샤토뇌프뒤파프","콩드리외","크로즈에르미타주","지공다스"],
    "피에몬테":["바롤로","바르바레스코","아스티","알바","가비","모스카토다스티"],
    "토스카나":["키안티","브루넬로디몬탈치노","몬테풀차노","볼게리","마렘마"],
  };
  const popular = region ? (VILLAGE_POPULAR[region]||villages.slice(0,8)) : [];
  return (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>세부 마을 <span style={{fontWeight:400,color:TH.T3}}>(선택)</span></div>
      <button onClick={()=>{setBsSearch("");setBottomSheet({label:"마을/아펠라시옹 선택",options:[...new Set(villages)],popular,field:"village"});}}
        style={{width:"100%",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"9px 12px",fontSize:13,background:TH.INP,color:village?TH.T1:"#aaa",textAlign:"left",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>{village||"탭하여 선택 (선택사항)"}</span>
        <span style={{fontSize:12,color:"#aaa"}}>▾</span>
      </button>
    </div>
  );
}

function GGrape({ grape, region, onChange, TH }) {
  const sel = (grape||"").split(",").map(s=>s.trim()).filter(Boolean);
  const toggle = (g) => {
    const next = sel.includes(g) ? sel.filter(x=>x!==g) : [...sel,g];
    onChange("grape", next.join(", "));
  };
  const regionGrapes = region ? (REGION_GRAPES[region]||[]) : [];
  const cats = GRAPE_CATEGORIES;
  return (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>품종 <span style={{fontWeight:400,color:TH.T3}}>(복수 선택 가능)</span></div>
      {regionGrapes.length>0&&(
        <div style={{marginBottom:6}}>
          <div style={{fontSize:10,color:TH.T3,marginBottom:4}}>🍷 {region} 주요 품종</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {regionGrapes.map(g=><button key={g} onClick={()=>toggle(g)}
              style={{padding:"4px 10px",border:`1px solid ${sel.includes(g)?RED:"#ddd"}`,borderRadius:16,fontSize:12,fontWeight:sel.includes(g)?700:400,background:sel.includes(g)?RED:"#fff",color:sel.includes(g)?"#fff":"#666",cursor:"pointer",marginBottom:4}}>{g}</button>)}
          </div>
        </div>
      )}
      {[["🍷 레드",cats.red],["🥂 화이트",cats.white]].map(([label,grapes])=>(
        <div key={label} style={{marginBottom:6}}>
          <div style={{fontSize:10,color:TH.T3,marginBottom:4}}>{label}</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {grapes.map(g=><button key={g} onClick={()=>toggle(g)}
              style={{padding:"4px 10px",border:`1px solid ${sel.includes(g)?RED:"#ddd"}`,borderRadius:16,fontSize:12,fontWeight:sel.includes(g)?700:400,background:sel.includes(g)?RED:"#fff",color:sel.includes(g)?"#fff":"#666",cursor:"pointer",marginBottom:4}}>{g}</button>)}
          </div>
        </div>
      ))}
      <input value={sel.filter(g=>!Object.values(cats).flat().includes(g)).join(", ")||""}
        onChange={e=>onChange("grape",[...sel.filter(g=>Object.values(cats).flat().includes(g)),...e.target.value.split(",").map(s=>s.trim()).filter(Boolean)].join(", "))}
        placeholder="직접 입력 후 Enter" style={{width:"100%",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"7px 10px",fontSize:12,outline:"none",boxSizing:"border-box",marginTop:4}}/>
    </div>
  );
}

// ── 에러 경계 (모바일 에러 화면에 표시) ─────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = {error:null}; }
  static getDerivedStateFromError(e) { return {error:e}; }
  componentDidCatch(e, info) { console.error("RENDER ERROR:", e, info); }
  render() {
    if(this.state.error) {
      return (
        <div style={{padding:24,fontFamily:"monospace",background:"#fff",minHeight:"100vh"}}>
          <div style={{color:"red",fontWeight:700,fontSize:16,marginBottom:12}}>⚠️ 렌더링 에러 (개발자용)</div>
          <div style={{background:"#f5f5f5",padding:12,borderRadius:8,fontSize:12,wordBreak:"break-all",marginBottom:12}}>
            {this.state.error.toString()}
          </div>
          <button onClick={()=>this.setState({error:null})}
            style={{padding:"8px 16px",background:"#8B2635",color:"#fff",border:"none",borderRadius:8,cursor:"pointer"}}>
            재시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── WSET 시음 지표 (블라인드 추론용 — 술자리 빠른 입력) ──────────
// 와인셀러 앱에서 이식·간소화: 핵심 지표만(산도/타닌/바디 + 향 칩)
const WSET_SCALE = {
  acidity: ["낮음","중간-","중간","중간+","높음"],
  tannin:  ["거의 없음","부드러움","중간","뻑뻑함","강함"],
  body:    ["가벼움","다소 가벼움","중간","다소 무거움","풀바디"],
};
const WSET_AROMA = [
  ["레드과실", ["딸기","라즈베리","레드체리","레드커런트"]],
  ["블랙과실", ["블랙베리","블랙커런트","블랙체리","자두"]],
  ["꽃·허브",  ["제비꽃","장미","민트","유칼립투스","말린꽃"]],
  ["스파이스", ["검은후추","감초","정향","시나몬"]],
  ["오크·숙성",["바닐라","토스트","시더","스모크","가죽","흙","버섯","담배"]],
  ["미네랄",   ["부싯돌","젖은돌","흑연"]],
];

function WsetScale({ label, opts, value, onChange, TH, RED }) {
  return (
    <div style={{marginBottom:11}}>
      <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:5}}>{label}</div>
      <div style={{display:"flex",gap:4}}>
        {opts.map((o,i)=>{ const on=value===o; return (
          <button key={o} onClick={()=>onChange(on?"":o)}
            style={{flex:1,padding:"6px 1px",borderRadius:7,cursor:"pointer",border:`1px solid ${on?RED:TH.BD}`,
              background:on?RED:TH.INP,color:on?"#fff":TH.T2,fontWeight:on?700:400,lineHeight:1.3}}>
            <div style={{fontSize:12}}>{i+1}</div><div style={{fontSize:9}}>{o}</div>
          </button> ); })}
      </div>
    </div>
  );
}

function WsetAroma({ groups, value, onChange, TH, RED }) {
  const sel = value||[];
  const toggle = chip => onChange(sel.includes(chip)?sel.filter(x=>x!==chip):[...sel,chip]);
  return (
    <div style={{marginBottom:11}}>
      <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:6}}>🌸 향·풍미{sel.length>0&&<span style={{color:RED}}> ({sel.length})</span>}</div>
      {groups.map(([cat,items])=>(
        <div key={cat} style={{marginBottom:6}}>
          <div style={{fontSize:10,color:TH.T3,marginBottom:3}}>{cat}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {items.map(name=>{ const on=sel.includes(name); return (
              <button key={name} onClick={()=>toggle(name)}
                style={{padding:"4px 9px",fontSize:11,borderRadius:14,cursor:"pointer",border:`1px solid ${on?RED:TH.BD}`,
                  background:on?RED:TH.INP,color:on?"#fff":TH.T2,fontWeight:on?600:400}}>{name}</button>
            ); })}
          </div>
        </div>
      ))}
    </div>
  );
}


function BottomSheet({ config, search, onSearch, onSelect, onClose }) {
  if (!config) return null;
  const { label, options, popular } = config;
  const filtered = search
    ? options.filter(o => o.includes(search))
    : options;
  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      {/* 반투명 배경 */}
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.5)"}} onClick={onClose}/>
      {/* 시트 패널 */}
      <div style={{position:"relative",background:"#fff",borderRadius:"20px 20px 0 0",maxHeight:"75vh",display:"flex",flexDirection:"column",paddingTop:12}}>
        {/* 핸들 */}
        <div style={{width:40,height:4,borderRadius:2,background:"#ddd",margin:"0 auto 12px"}}/>
        <div style={{padding:"0 16px 8px",fontWeight:700,fontSize:14,color:"#333"}}>{label}</div>
        {/* 검색 */}
        <div style={{padding:"0 16px 10px"}}>
          <input autoFocus value={search} onChange={e=>onSearch(e.target.value)}
            placeholder="검색..."
            style={{width:"100%",border:"1px solid #eee",borderRadius:10,padding:"10px 14px",fontSize:14,outline:"none",boxSizing:"border-box",background:"#f7f4f0"}}/>
        </div>
        {/* 인기 항목 칩 */}
        {!search && popular?.length>0 && (
          <div style={{padding:"0 16px 10px"}}>
            <div style={{fontSize:10,color:"#aaa",fontWeight:600,marginBottom:6}}>자주 선택</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {popular.map(p=>(
                <button key={p} onClick={()=>onSelect(p)}
                  style={{padding:"8px 14px",border:"1px solid #8B2635",borderRadius:20,fontSize:13,fontWeight:600,color:"#8B2635",background:"#FDF1F2",cursor:"pointer"}}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* 전체 목록 */}
        <div style={{overflowY:"auto",padding:"0 16px 24px",flex:1}}>
          {filtered.length===0
            ? <div style={{textAlign:"center",color:"#aaa",padding:24}}>결과 없음</div>
            : filtered.map(opt=>(
                <button key={opt} onClick={()=>onSelect(opt)}
                  style={{display:"block",width:"100%",textAlign:"left",padding:"13px 4px",border:"none",borderBottom:"1px solid #f7f4f0",background:"none",fontSize:14,color:"#333",cursor:"pointer"}}>
                  {opt}
                </button>
              ))
          }
        </div>
      </div>
    </div>
  );
}

// ── Blind Tasting Session (모임용) ────────────────────────────────
function BlindTastingPage({ sessions, onSaveSessions, groups=[], onSaveGroups, onBack, tasters, geminiKey, setGeminiKey, initialView, initialJoinCode }) {
  const [view, setView] = useState(initialView||"list");
  const [joinCode, setJoinCode] = useState(() => {
    if (initialJoinCode) return initialJoinCode;
    const p = new URLSearchParams(window.location.search);
    return p.get("join") || "";
  });
  const [grapeShowAll, setGrapeShowAll] = useState(false);
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingNameVal, setEditingNameVal] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showGroupMgr, setShowGroupMgr] = useState(false);
  const [showRubric, setShowRubric] = useState(false);
  const [scanningWno, setScanningWno] = useState(null);
  const [unboxed, setUnboxed] = useState(new Set()); // 공개된 와인 번호

  function fireConfetti(good=false) {
    const colors = good
      ? ["#8B2635","#9A7020","#2E7D32","#1E6FA0","#FFD700","#FF6B6B"]
      : ["#ddd","#bbb","#aaa"];
    const container = document.getElementById("confetti-root");
    if(!container) return;
    const count = good ? 80 : 20;
    for(let i=0;i<count;i++){
      const el = document.createElement("div");
      const size = 6+Math.random()*8;
      const color = colors[Math.floor(Math.random()*colors.length)];
      el.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:${color};border-radius:${Math.random()>0.5?"50%":"2px"};left:${10+Math.random()*80}%;top:0;opacity:1;pointer-events:none;`;
      el.style.animation = `confetti-fall ${1+Math.random()*2}s ease-in ${Math.random()*0.5}s forwards`;
      container.appendChild(el);
      setTimeout(()=>el.remove(), 3000);
    }
    if(good && navigator.vibrate) navigator.vibrate([100,50,100]);
  }
  const [bottomSheet, setBottomSheet] = useState(null); // {field, options, popular}
  const [bsSearch, setBsSearch] = useState(""); // 스캔 중인 와인 번호    // group manager panel
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupVal, setEditingGroupVal] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [showCodeShare, setShowCodeShare] = useState(false); // 초대 코드 공유 오버레이
  const [filterGroupId, setFilterGroupId] = useState("all");
  const [dashParticipant, setDashParticipant] = useState(null);
  const [darkMode, setDarkMode] = useState(()=>{
    try { return localStorage.getItem("blind-dark-mode")==="1"; } catch(e) { return false; }
  });
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState(null);
  const TH = getTheme(darkMode);
  const toast = (msg, type="info", ms=3000)=>{
    const id = Date.now()+Math.random();
    setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)), ms);
  };
  const showConfirm = (message)=>new Promise(res=>{
    setConfirmModal({message, onYes:()=>{setConfirmModal(null);res(true);}, onNo:()=>{setConfirmModal(null);res(false);}});
  }); // "all"|"none"|groupId
  const GROUP_COLORS = ["#8B2635","#2E7D32","#1E6FA0","#7a5c10","#6B21A8","#C0392B"];
  const [active, setActive] = useState(null);
  const [qualLoading, setQualLoading] = useState(false);
  const [wineIdx, setWineIdx] = useState(0);
  const [pIdx, setPIdx] = useState(0);

  // ── 멀티플레이어 / 초대 코드 ─────────────────────────────────────
  // ── 호스트 PIN 인증 ────────────────────────────────────────────
  const [hostPin, setHostPin] = useState(()=>localStorage.getItem("blind-host-pin")||"");
  const [isHost, setIsHost] = useState(()=>!!localStorage.getItem("blind-host-authed"));
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  function verifyPin(pin) {
    if(!hostPin) { setIsHost(true); localStorage.setItem("blind-host-authed","1"); return; }
    if(pin===hostPin) {
      setIsHost(true);
      localStorage.setItem("blind-host-authed","1");
      setPinError("");
    } else {
      setPinError("PIN이 맞지 않습니다");
    }
  }
  function saveHostPin(pin) {
    if(!pin.trim()) {
      localStorage.removeItem("blind-host-pin");
      localStorage.removeItem("blind-host-authed");
      setHostPin(""); setIsHost(true);
      toast("PIN 잠금 해제됨 (누구나 접근 가능)", "info");
    } else {
      localStorage.setItem("blind-host-pin", pin.trim());
      localStorage.setItem("blind-host-authed","1");
      setHostPin(pin.trim()); setIsHost(true);
      toast("PIN 설정됨", "info");
    }
  }

  const [joinName, setJoinName] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isParticipant, setIsParticipant] = useState(false); // 참가자 모드
  const [myName, setMyName] = useState("");                   // 이 기기의 참가자 이름
  const unsubRef = useRef(null); // Firestore 리스너 해제용

  function genCode() {
    return Array.from({length:6}, ()=>"ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random()*32)]).join("");
  }

  // URL ?join=XXXXXX 있으면 바로 join 화면으로
  useEffect(()=>{
    const p = new URLSearchParams(window.location.search);
    const code = p.get("join");
    if(code) { setView("join"); setJoinCode(code.toUpperCase()); }
    return ()=>{ if(unsubRef.current) unsubRef.current(); };
  },[]);

  async function joinSession() {
    if(!joinCode.trim() || !joinName.trim()) { setJoinError("코드와 이름을 모두 입력해주세요."); return; }
    setJoinError("찾는 중...");
    try {
      const session = await sessionDB.findByCode(joinCode.trim());
      if(!session) { setJoinError("세션을 찾을 수 없습니다. 코드를 다시 확인해주세요."); return; }
      const name = joinName.trim();
      // 참가자 등록: guesses에 이름 추가 (없으면)
      const updated = {...session};
      if(!updated.participants.includes(name)) {
        updated.participants = [...updated.participants, name];
      }
      if(!updated.guesses[name]) updated.guesses[name] = {};
      await sessionDB.save(updated);
      setMyName(name);
      setIsParticipant(true);
      setActive(updated);
      setView("taste");
      setWineIdx(0);
      setPIdx(updated.participants.indexOf(name));
      // 실시간 리스너 시작
      if(unsubRef.current) unsubRef.current();
      unsubRef.current = sessionDB.subscribe(session.id, (latest) => {
        setActive(latest);
        if(latest.revealed) setView("summary");
      });
      // URL 정리
      window.history.replaceState({}, "", window.location.pathname);
    } catch(e) {
      setJoinError("오류: " + e.message);
    }
  }

  // Setup form
  const [sName, setSName] = useState("");
  const [sCount, setSCount] = useState(4);
  const [sParts, setSParts] = useState(tasters.filter(Boolean));
  const [sGroupId, setSGroupId] = useState(null);
  const [sLevels, setSLevels] = useState({}); // {참가자명: "expert"|"standard"|"beginner"}
  const [sAnswerMode, setSAnswerMode] = useState("prefill"); // prefill | reveal
  const [sRubric, setSRubric] = useState(JSON.parse(JSON.stringify(DEFAULT_RUBRIC)));

  function startSetup() {
    setSName(`블라인드 ${new Date().toLocaleDateString("ko-KR",{month:"numeric",day:"numeric"})}`);
    setSCount(4); setSParts(tasters.filter(Boolean)); setSGroupId(null); setSLevels({}); setSAnswerMode("prefill"); setSRubric(JSON.parse(JSON.stringify(DEFAULT_RUBRIC))); setView("setup");
  }
  function createSession() {
    const parts = sParts.filter(Boolean);
    if(parts.length===0){alert("참가자를 1명 이상 추가하세요");return;}
    // 인덱스 기반 레벨(sLevels) → 이름 기반(participantLevels)으로 변환
    const nameLevels = {};
    sParts.forEach((name,i)=>{ if(name && name.trim()) nameLevels[name] = sLevels[i]||"expert"; });
    const s = {
      id:String(Date.now()), name:sName||"블라인드 테이스팅",
      date:new Date().toISOString(), participants:parts, wineCount:sCount,
      accessCode:genCode(),
      groupId:sGroupId, participantLevels:nameLevels, answerMode:sAnswerMode, rubric:sRubric,
      guesses:{}, answers:{}, revealed:false, answersLocked:false, createdAt:new Date().toISOString(),
    };
    parts.forEach(p=>{s.guesses[p]={};});
    setActive(s); setWineIdx(0); setPIdx(0);
    // Firestore 저장 + 실시간 리스너
    sessionDB.save(s).catch(e=>console.warn("세션 저장 실패:", e));
    if(unsubRef.current) unsubRef.current();
    unsubRef.current = sessionDB.subscribe(s.id, (latest)=>{
      try { sessionStorage.setItem("bt-active", JSON.stringify(latest)); } catch(e) {}
      setActive(latest);
    });
    // sessionStorage에 백업 (모바일 재렌더링 시 복원용)
    try { sessionStorage.setItem("bt-active", JSON.stringify(s)); } catch(e) {}
    setShowCodeShare(true);
    setView("list");
  }
  function lockAnswersAndStart() {
    setActive(prev=>({...prev, answersLocked:true}));
    setWineIdx(0); setPIdx(0); setView("taste");
  }
  function updateGuess(field, val) {
    const p = active.participants[pIdx];
    const wno = wineIdx+1;
    setActive(prev=>{
      const g={...prev.guesses};
      g[p]={...g[p], [wno]:{...(g[p]?.[wno]||{}), [field]:val}};
      return {...prev, guesses:g};
    });
  }
  function updateAnswer(wno, field, val) {
    setActive(prev=>({...prev, answers:{...prev.answers, [wno]:{...(prev.answers[wno]||{}), [field]:val}}}));
  }

  function addSessionPhoto(photo) {
    const updated = {...active, photos:[...(active.photos||[]), photo]};
    setActive(updated);
    onSaveSessions([updated, ...sessions.filter(s=>s.id!==updated.id)]);
  }
  function deleteSessionPhoto(idx) {
    const photos = (active.photos||[]).filter((_,i)=>i!==idx);
    const updated = {...active, photos};
    setActive(updated);
    onSaveSessions([updated, ...sessions.filter(s=>s.id!==updated.id)]);
  }

  function adjustScore(pp, wno, delta) {
    const g={...active.guesses};
    const curAdj=g[pp]?.[wno]?.adjust||0;
    g[pp]={...g[pp], [wno]:{...(g[pp]?.[wno]||{}), adjust:Math.max(-100,Math.min(100,curAdj+delta))}};
    const updated={...active, guesses:g};
    setActive(updated);
    onSaveSessions([updated, ...sessions.filter(s=>s.id!==updated.id)]);
  }
  function adjustQualCriterion(pp, wno, criterion, delta) {
    // criterion: "aroma"|"structure"|"logic"
    const maxes = {aroma:8, structure:12, logic:10};
    const g = {...active.guesses};
    const cur_g = g[pp]?.[wno]||{};
    const newVal = Math.max(0, Math.min(maxes[criterion], (cur_g[criterion]||0) + delta));
    const newAroma     = criterion==="aroma"     ? newVal : (cur_g.aroma||0);
    const newStructure = criterion==="structure"  ? newVal : (cur_g.structure||0);
    const newLogic     = criterion==="logic"      ? newVal : (cur_g.logic||0);
    const newQualScore = Math.round((newAroma+newStructure+newLogic)/QUAL_MAX*100);
    g[pp] = {...g[pp], [wno]: {...cur_g,
      [criterion]: newVal, qualScore: newQualScore,
      aroma: newAroma, structure: newStructure, logic: newLogic,
    }};
    const updated = {...active, guesses:g};
    setActive(updated);
    onSaveSessions([updated, ...sessions.filter(s=>s.id!==updated.id)]);
  }
  function overrideVillageAI(pp, wno, level) {
    const g = {...active.guesses};
    g[pp] = {...g[pp], [wno]: {...(g[pp]?.[wno]||{}), villageAILevel:level, villageNote:"수동 보정"}};
    const updated = {...active, guesses:g};
    setActive(updated);
    onSaveSessions([updated, ...sessions.filter(s=>s.id!==updated.id)]);
  }
  function finishSession() {
    // Event-handler closure sees the latest committed `active`; compute, set, then persist.
    const done = {...active, revealed:true};
    setActive(done);
    onSaveSessions([done, ...sessions.filter(s=>s.id!==done.id)]);
    setView("summary");
  }
  function deleteSession(id) {
    showConfirm("이 세션을 삭제할까요?").then(ok=>{if(ok){onSaveSessions(sessions.filter(s=>s.id!==id));toast("세션 삭제됨","info");}});
  }
  // ── Group helpers ──────────────────────────────────────────────
  function createGroup(name) {
    if(!name.trim()) return;
    const g = { id:String(Date.now()), name:name.trim(),
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
      members:[...tasters.filter(Boolean)], createdAt:new Date().toISOString() };
    onSaveGroups([g, ...groups]);
  }
  function deleteGroup(id) {
    showConfirm("모임을 삭제할까요? 세션은 유지됩니다.").then(ok=>{
    if(!ok)return;
    onSaveGroups(groups.filter(g=>g.id!==id));
    // Unlink sessions from this group
    const updated = sessions.map(s=>s.groupId===id?{...s,groupId:null}:s);
    onSaveSessions(updated);
  });
  }
  function renameGroup(id, name) {
    if(!name.trim()) return;
    onSaveGroups(groups.map(g=>g.id===id?{...g,name:name.trim()}:g));
    setEditingGroupId(null);
  }
  function assignSessionToGroup(sessionId, groupId) {
    // groupId=null → remove from group
    onSaveSessions(sessions.map(s=>s.id===sessionId?{...s,groupId:groupId||null}:s));
  }

  function renameSession(id, newName) {
    if(!newName.trim()) return;
    const updated = sessions.map(s=>s.id===id?{...s,name:newName.trim()}:s);
    onSaveSessions(updated);
    // Also update active if this is the current session
    if(active?.id===id) setActive(prev=>({...prev,name:newName.trim()}));
    setEditingNameId(null);
  }

  // active가 null인데 뷰가 prep/taste/reveal/summary면 sessionStorage에서 복원
  let cur = active;
  if(!cur && ["prep","taste","reveal","summary"].includes(view)) {
    try {
      const backed = sessionStorage.getItem("bt-active");
      if(backed) { cur = JSON.parse(backed); setActive(cur); }
    } catch(e) {}
    if(!cur) { setView("list"); }
  }
  const p_=cur?.participants?.[pIdx], wno_=wineIdx+1;
  const gval=(field)=>cur?.guesses?.[p_]?.[wno_]?.[field]||"";
  const IST={width:"100%",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"7px 10px",fontSize:13,outline:"none",boxSizing:"border-box",background:TH.INP,color:TH.T1};
  // Country dropdown
  // ════ PIN 입력 화면 (호스트 인증) ════
  if(!isHost && !joinCode && view==="list") {
    return (
      <div style={{minHeight:"100vh",background:"#F7F4F0",fontFamily:"system-ui,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{width:"100%",maxWidth:360}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontSize:48,marginBottom:8}}>🍷</div>
            <div style={{fontSize:22,fontWeight:800,color:RED}}>블라인드 테이스팅</div>
          </div>
          <div style={{background:"#fff",borderRadius:16,padding:24,boxShadow:"0 2px 16px rgba(0,0,0,.08)",marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:"#333",marginBottom:4}}>호스트로 입장</div>
            <div style={{fontSize:12,color:"#aaa",marginBottom:12}}>세션을 만들고 관리하려면 PIN을 입력하세요</div>
            <input type="password" value={pinInput} onChange={e=>setPinInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")verifyPin(pinInput);}}
              placeholder="HOST PIN"
              style={{width:"100%",border:`2px solid ${pinError?RED:"#ddd"}`,borderRadius:8,padding:"10px 14px",fontSize:18,fontWeight:700,textAlign:"center",letterSpacing:4,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
            {pinError&&<div style={{color:RED,fontSize:12,marginBottom:8,textAlign:"center"}}>{pinError}</div>}
            <button onClick={()=>verifyPin(pinInput)}
              style={{width:"100%",background:RED,color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer"}}>
              입장하기
            </button>
          </div>
          <div style={{background:"#fff",borderRadius:16,padding:20,boxShadow:"0 2px 16px rgba(0,0,0,.08)"}}>
            <div style={{fontSize:14,fontWeight:700,color:"#333",marginBottom:4}}>초대 코드로 참여</div>
            <div style={{fontSize:12,color:"#aaa",marginBottom:12}}>호스트에게 초대 코드를 받으셨나요?</div>
            <button onClick={()=>setView("join")}
              style={{width:"100%",background:"#fff",color:RED,border:`2px solid ${RED}`,borderRadius:10,padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer"}}>
              🔑 코드로 참여하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════ JOIN VIEW (참가자 입장 화면) ════
  if(view==="join") {
    return (
      <div style={{minHeight:"100vh",background:"#F7F4F0",fontFamily:"system-ui,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{width:"100%",maxWidth:380}}>
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontSize:48,marginBottom:8}}>🍷</div>
            <div style={{fontSize:22,fontWeight:800,color:RED}}>블라인드 테이스팅</div>
            <div style={{fontSize:14,color:"#888",marginTop:4}}>초대 코드로 세션에 참여하세요</div>
          </div>
          <div style={{background:"#fff",borderRadius:16,padding:24,boxShadow:"0 2px 16px rgba(0,0,0,.08)"}}>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:11,fontWeight:600,color:"#888",marginBottom:6}}>초대 코드 (6자리)</div>
              <input
                value={joinCode}
                onChange={e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6))}
                onKeyDown={e=>{if(e.key==="Enter")document.getElementById("join-name-input")?.focus();}}
                placeholder="예: WK7M2P"
                style={{width:"100%",border:"2px solid #ddd",borderRadius:8,padding:"10px 14px",fontSize:20,fontWeight:700,letterSpacing:4,textAlign:"center",outline:"none",boxSizing:"border-box"}}
              />
            </div>
            <div style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:600,color:"#888",marginBottom:6}}>내 이름</div>
              <input
                id="join-name-input"
                value={joinName}
                onChange={e=>setJoinName(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")joinSession();}}
                placeholder="예: 인우"
                style={{width:"100%",border:"2px solid #ddd",borderRadius:8,padding:"10px 14px",fontSize:15,outline:"none",boxSizing:"border-box"}}
              />
            </div>
            {joinError&&<div style={{color:joinError.includes("중")||joinError.includes("찾는")?"#888":RED,fontSize:12,marginBottom:12,textAlign:"center"}}>{joinError}</div>}
            <button onClick={joinSession}
              style={{width:"100%",background:RED,color:"#fff",border:"none",borderRadius:10,padding:"13px",fontSize:15,fontWeight:700,cursor:"pointer"}}>
              입장하기 →
            </button>
          </div>
          <div style={{textAlign:"center",marginTop:16}}>
            <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:"#aaa",fontSize:12,cursor:"pointer"}}>
              내 세션 목록으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════ LIST VIEW ════
  if(view==="list") {
    // Derive filtered sessions
    const filteredSessions = filterGroupId==="all" ? sessions
      : filterGroupId==="none" ? sessions.filter(s=>!s.groupId)
      : sessions.filter(s=>s.groupId===filterGroupId);

    // Sessions grouped by groupId for group view
    const sessionCountByGroup = (gid) => sessions.filter(s=>s.groupId===gid).length;
    const lastSessionDate = (gid) => {
      const gs = sessions.filter(s=>s.groupId===gid).sort((a,b)=>b.date?.localeCompare(a.date||"")||0);
      return gs[0]?.date?.split("T")[0]||"";
    };

    return (
      <div style={{minHeight:"100vh",background:TH.BG,fontFamily:"system-ui,sans-serif"}}>

        {/* ── 초대 코드 공유 오버레이 ── */}
        {showCodeShare&&active&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
            <div style={{background:"#fff",borderRadius:20,padding:28,width:"100%",maxWidth:380,textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,.3)"}}>
              <div style={{fontSize:36,marginBottom:8}}>🍷</div>
              <div style={{fontSize:18,fontWeight:800,color:RED,marginBottom:4}}>세션이 시작됐습니다!</div>
              <div style={{fontSize:13,color:"#888",marginBottom:20}}>아래 코드를 참가자들에게 공유하세요</div>
              <div style={{background:"#F7F4F0",borderRadius:12,padding:"16px 20px",marginBottom:16}}>
                <div style={{fontSize:11,color:"#aaa",marginBottom:6}}>초대 코드</div>
                <div style={{fontSize:40,fontWeight:900,letterSpacing:8,color:RED}}>{active.accessCode}</div>
              </div>
              <button onClick={()=>{
                const url=`${window.location.origin}?join=${active.accessCode}`;
                if(navigator.share){navigator.share({title:"블라인드 테이스팅 참여",text:`초대 코드: ${active.accessCode}`,url});}
                else{navigator.clipboard?.writeText(url).then(()=>toast("링크 복사됨!","info")).catch(()=>alert(url));}
              }}
                style={{width:"100%",background:RED,color:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer",marginBottom:10}}>
                🔗 초대 링크 공유하기
              </button>
              <button onClick={()=>{
                setShowCodeShare(false);
                setView(active.answerMode==="prefill" ? "prep" : "taste");
              }}
                style={{width:"100%",background:"#fff",color:"#555",border:"1px solid #ddd",borderRadius:12,padding:"13px",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                계속하기 →
              </button>
              <div style={{fontSize:11,color:"#aaa",marginTop:10}}>나중에도 화면 상단 코드에서 공유 가능</div>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{background:RED,color:"#fff",padding:"16px 18px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
            {onBack && <button onClick={onBack} style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer",padding:0}}>←</button>}
            <span style={{fontSize:17,fontWeight:700}}>🎯 블라인드 테이스팅</span>
            <div style={{marginLeft:"auto",display:"flex",gap:8}}>
              <button onClick={()=>{setView("dashboard");setDashParticipant(tasters[0]||null);}}
                style={{background:"none",border:"none",color:"rgba(255,255,255,.8)",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}>📊<span style={{fontSize:10}}>통계</span></button>
              <button onClick={()=>{setShowGroupMgr(v=>!v);setShowSettings(false);}}
                style={{background:"none",border:"none",color:"rgba(255,255,255,.8)",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}>👥<span style={{fontSize:10}}>모임</span></button>
              <button onClick={()=>{
                const next=!darkMode;
                setDarkMode(next);
                try{localStorage.setItem("blind-dark-mode",next?"1":"0");}catch(e){}
              }} style={{background:"none",border:"none",color:"rgba(255,255,255,.8)",fontSize:16,cursor:"pointer"}}
                title={darkMode?"라이트 모드":"다크 모드"}>
                {darkMode?"☀️":"🌙"}
              </button>
              <button onClick={()=>{setShowSettings(v=>!v);setShowGroupMgr(false);}}
                style={{background:"none",border:"none",color:"rgba(255,255,255,.8)",fontSize:16,cursor:"pointer"}}>⚙️</button>
            </div>
          </div>
          {/* Group filter chips */}
          {groups.length>0&&(
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {[["all","전체"],["none","단독"]].map(([k,l])=>(
                <button key={k} onClick={()=>setFilterGroupId(k)}
                  style={{padding:"3px 10px",border:`1px solid ${filterGroupId===k?"#fff":"rgba(255,255,255,.4)"}`,borderRadius:14,fontSize:11,fontWeight:filterGroupId===k?700:400,background:filterGroupId===k?"rgba(255,255,255,.25)":"none",color:"#fff",cursor:"pointer"}}>{l}</button>
              ))}
              {groups.map(g=>(
                <button key={g.id} onClick={()=>setFilterGroupId(g.id)}
                  style={{padding:"3px 10px",border:`1px solid ${filterGroupId===g.id?"#fff":"rgba(255,255,255,.4)"}`,borderRadius:14,fontSize:11,fontWeight:filterGroupId===g.id?700:400,background:filterGroupId===g.id?"rgba(255,255,255,.25)":"none",color:"#fff",cursor:"pointer"}}>
                  {g.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Settings panel */}
        {showSettings&&(
          <div style={{background:"#fff",padding:"14px 16px",borderBottom:`1px solid ${TH.BD}`}}>
            <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:6}}>Gemini API 키 <span style={{fontWeight:400}}>(정성 평가 · 무료: aistudio.google.com/apikey)</span></div>
            <div style={{display:"flex",gap:8}}>
              <input type="password" value={geminiKey} onChange={e=>setGeminiKey(e.target.value)}
                placeholder="AIza..." style={{flex:1,border:`1px solid ${TH.BD}`,borderRadius:6,padding:"7px 10px",fontSize:12,outline:"none"}}/>
              <button onClick={()=>{try{window.storage.set("blind-gemini-key",geminiKey);}catch(e){} setShowSettings(false);}}
                style={{background:RED,color:"#fff",border:"none",borderRadius:6,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>저장</button>
            </div>

            {geminiKey&&<div style={{fontSize:11,color:"#2E7D32",marginTop:4}}>✓ 키 설정됨</div>}
            {/* HOST PIN 설정 */}
            <div style={{borderTop:"1px solid #eee",marginTop:12,paddingTop:12}}>
              <div style={{fontSize:11,fontWeight:600,color:"#888",marginBottom:6}}>🔐 호스트 PIN <span style={{fontWeight:400}}>(설정 시 PIN 모르는 사람은 초대 참여만 가능)</span></div>
              <div style={{display:"flex",gap:8}}>
                <input type="password" placeholder={hostPin?"••••":"PIN 없음 (공개)"}
                  onChange={e=>setPinInput(e.target.value)}
                  style={{flex:1,border:"1px solid #ddd",borderRadius:6,padding:"7px 10px",fontSize:12,outline:"none"}}/>
                <button onClick={()=>saveHostPin(pinInput)}
                  style={{background:"#555",color:"#fff",border:"none",borderRadius:6,padding:"7px 12px",fontSize:12,cursor:"pointer"}}>저장</button>
              </div>
              {hostPin&&<div style={{fontSize:10,color:RED,marginTop:3}}>🔐 PIN 잠금 활성화 중 · 비워서 저장하면 해제</div>}
            </div>
            {/* ── 데이터 백업/복원 ── */}
            <div style={{borderTop:`1px solid ${TH.BD}`,marginTop:12,paddingTop:12}}>
              <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:8}}>💾 데이터 백업/복원</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{
                  const data = {
                    version: 2,
                    exportedAt: new Date().toISOString(),
                    sessions, groups, tasters,
                  };
                  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `blind-tasting-backup-${new Date().toISOString().slice(0,10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                  style={{flex:1,background:"#fff",color:TH.T2,border:`1px solid ${TH.BD}`,borderRadius:6,padding:"8px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                  📥 백업 다운로드
                </button>
                <label style={{flex:1,background:"#fff",color:TH.T2,border:`1px solid ${TH.BD}`,borderRadius:6,padding:"8px",fontSize:12,fontWeight:600,cursor:"pointer",textAlign:"center"}}>
                  📤 복원하기
                  <input type="file" accept=".json" style={{display:"none"}} onChange={async(e)=>{
                    const file = e.target.files?.[0];
                    if(!file) return;
                    try {
                      const text = await file.text();
                      const data = JSON.parse(text);
                      if(!data.sessions || !Array.isArray(data.sessions)) {
                        alert("유효한 백업 파일이 아닙니다."); return;
                      }
                      const mode = await showConfirm(
                        `백업 파일 정보:\n세션 ${data.sessions.length}개 · 모임 ${(data.groups||[]).length}개\n\n[확인] = 기존 데이터에 병합\n[취소] = 가져오기 취소`
                      );
                      if(!mode) return;
                      // Merge: add sessions not already present (by id)
                      const existingIds = new Set(sessions.map(s=>s.id));
                      const newSessions = data.sessions.filter(s=>!existingIds.has(s.id));
                      if(newSessions.length>0) onSaveSessions([...sessions, ...newSessions]);
                      // Merge groups
                      if(data.groups?.length) {
                        const existingGids = new Set(groups.map(g=>g.id));
                        const newGroups = data.groups.filter(g=>!existingGids.has(g.id));
                        if(newGroups.length>0) onSaveGroups([...groups, ...newGroups]);
                      }
                      alert(`✅ 복원 완료!\n새 세션 ${newSessions.length}개 추가됨`);
                    } catch(err) {
                      alert("파일 읽기 오류: " + err.message);
                    }
                    e.target.value = "";
                  }}/>
                </label>
              </div>
              <div style={{fontSize:10,color:TH.T3,marginTop:4}}>
                세션·모임·참가자 데이터를 JSON으로 내보내기/가져오기. 브라우저 데이터 유실 대비용.
              </div>
            </div>
          </div>
        )}

        {/* Group manager panel */}
        {showGroupMgr&&(
          <div style={{background:"#fff",padding:"14px 16px",borderBottom:`1px solid ${TH.BD}`}}>
            <div style={{fontSize:12,fontWeight:700,color:TH.T1,marginBottom:10}}>👥 모임 관리</div>
            {groups.map(g=>(
              <div key={g.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:g.color,flexShrink:0}}/>
                {editingGroupId===g.id ? (
                  <div style={{display:"flex",gap:6,flex:1}}>
                    <input value={editingGroupVal} onChange={e=>setEditingGroupVal(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")renameGroup(g.id,editingGroupVal);if(e.key==="Escape")setEditingGroupId(null);}}
                      autoFocus style={{flex:1,border:"1px solid "+RED,borderRadius:6,padding:"4px 8px",fontSize:13,outline:"none"}}/>
                    <button onClick={()=>renameGroup(g.id,editingGroupVal)}
                      style={{background:RED,color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:"pointer"}}>저장</button>
                  </div>
                ) : (
                  <span style={{flex:1,fontSize:13,fontWeight:600}}>{g.name}</span>
                )}
                <span style={{fontSize:11,color:TH.T3}}>{sessionCountByGroup(g.id)}회</span>
                <button onClick={()=>{setEditingGroupId(g.id);setEditingGroupVal(g.name);}}
                  style={{background:"none",border:"none",color:TH.T3,fontSize:13,cursor:"pointer"}}>✏️</button>
                <button onClick={()=>deleteGroup(g.id)}
                  style={{background:"none",border:"none",color:TH.T3,fontSize:14,cursor:"pointer"}}>🗑</button>
              </div>
            ))}
            {/* New group input */}
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&newGroupName.trim()){createGroup(newGroupName);setNewGroupName("");}}}
                placeholder="+ 새 모임 이름..." style={{flex:1,border:"1px dashed #ddd",borderRadius:6,padding:"6px 10px",fontSize:13,outline:"none"}}/>
              <button onClick={()=>{if(newGroupName.trim()){createGroup(newGroupName);setNewGroupName("");}}}
                style={{background:RED,color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>추가</button>
            </div>
          </div>
        )}

        <div style={{padding:16,maxWidth:640,margin:"0 auto"}}>
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <button onClick={startSetup}
              style={{flex:1,background:RED,color:"#fff",border:"none",borderRadius:12,padding:"14px",fontSize:15,fontWeight:700,cursor:"pointer"}}>
              + 새 세션 시작
            </button>
            <button onClick={()=>setView("join")}
              style={{flex:1,background:"#fff",color:RED,border:`2px solid ${RED}`,borderRadius:12,padding:"14px",fontSize:15,fontWeight:700,cursor:"pointer"}}>
              🔑 코드로 참여
            </button>
          </div>

          {filteredSessions.length===0 ? (
            <div style={{textAlign:"center",color:TH.T3,padding:48,fontSize:14}}>
              {sessions.length===0 ? "모임에서 블라인드 테이스팅을\n진행하고 기록해보세요 🍷" : "해당 모임의 세션이 없습니다"}
            </div>
          ) : filteredSessions.map(s=>{
            const grp = groups.find(g=>g.id===s.groupId);
            return (
              <div key={s.id} onClick={()=>{setActive(s);setView("summary");}}
                style={{...CS,cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1,minWidth:0}}>
                    {/* Group badge */}
                    {grp&&<div style={{display:"inline-flex",alignItems:"center",gap:4,background:grp.color+"18",borderRadius:10,padding:"2px 8px",marginBottom:4}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:grp.color}}/>
                      <span style={{fontSize:10,fontWeight:600,color:grp.color}}>{grp.name}</span>
                    </div>}
                    {editingNameId===s.id ? (
                      <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                        <input value={editingNameVal} onChange={e=>setEditingNameVal(e.target.value)}
                          onKeyDown={e=>{if(e.key==="Enter")renameSession(s.id,editingNameVal);if(e.key==="Escape")setEditingNameId(null);}}
                          autoFocus style={{flex:1,border:"1px solid "+RED,borderRadius:6,padding:"4px 8px",fontSize:13,outline:"none"}}/>
                        <button onClick={()=>renameSession(s.id,editingNameVal)}
                          style={{background:RED,color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:"pointer"}}>저장</button>
                        <button onClick={()=>setEditingNameId(null)}
                          style={{background:"none",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"4px 8px",fontSize:12,color:TH.T3,cursor:"pointer"}}>취소</button>
                      </div>
                    ) : (
                      <div style={{fontSize:14,fontWeight:600}}>{s.name}</div>
                    )}
                    <div style={{fontSize:12,color:TH.T3,marginTop:2}}>{s.date?.split("T")[0]} · {s.wineCount}병 · {s.participants.length}명</div>
                    {/* Photo thumbnails */}
                    {(s.photos||[]).length>0&&(
                      <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
                        {(s.photos||[]).slice(0,5).map((p,i)=>(
                          <img key={i} src={p.data} alt="" style={{width:40,height:40,objectFit:"cover",borderRadius:5}}/>
                        ))}
                        {(s.photos||[]).length>5&&(
                          <div style={{width:40,height:40,borderRadius:5,background:"#eee",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:TH.T3}}>+{(s.photos||[]).length-5}</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",gap:4,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                    {/* Assign to group */}
                    <select value={s.groupId||""} onChange={e=>assignSessionToGroup(s.id,e.target.value||null)}
                      style={{fontSize:11,border:`1px solid ${TH.BD}`,borderRadius:6,padding:"2px 4px",color:TH.T3,background:"#fff",maxWidth:90}}>
                      <option value="">모임없음</option>
                      {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                    <button onClick={()=>{setEditingNameId(s.id);setEditingNameVal(s.name);}}
                      style={{background:"none",border:"none",color:TH.T3,fontSize:14,cursor:"pointer"}}>✏️</button>
                    <button onClick={e=>{e.stopPropagation();deleteSession(s.id);}}
                      style={{background:"none",border:"none",color:TH.T3,fontSize:16,cursor:"pointer"}}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <ToastContainer toasts={toasts}/>
        {confirmModal&&<ConfirmModal {...confirmModal}/>}
        {/* 폭죽 컨테이너 */}
        <div id="confetti-root" style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:8888,overflow:"hidden"}}/>
        <style>{`@keyframes confetti-fall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}`}</style>
      </div>
    );
  }

  // ════ DASHBOARD VIEW ════
  if(view==="dashboard") {
    // ── Data aggregation ──────────────────────────────────────
    const FIELD_LABELS = {country:"국가",region:"지역",village:"마을",classification:"등급",grape:"품종",vintage:"빈티지"};
    // 받침 있으면 은/이, 없으면 는/가
    const josa = (word, type="은는") => {
      const code = word.charCodeAt(word.length-1);
      const hasBatchim = code >= 0xAC00 && ((code - 0xAC00) % 28 !== 0);
      if(type==="은는") return hasBatchim ? "은" : "는";
      if(type==="이가") return hasBatchim ? "이" : "가";
      return "";
    };
    const FIELD_KEYS = Object.keys(FIELD_LABELS);

    function buildStats(participant) {
      const revealedSessions = [...sessions].filter(s=>s.revealed&&s.answers)
        .sort((a,b)=>(a.date||"").localeCompare(b.date||""));
      const sessionData = [];
      const fieldTotals = {};
      FIELD_KEYS.forEach(k=>{ fieldTotals[k]={exact:0,close:0,miss:0,total:0}; });
      const confusions = {}; // region: {guessed → actual: count}

      for(const s of revealedSessions) {
        const scores=[]; const sFields={};
        FIELD_KEYS.forEach(k=>{ sFields[k]={exact:0,close:0,miss:0,n:0}; });

        for(let wno=1;wno<=s.wineCount;wno++) {
          const ans=s.answers[wno]||{};
          if(ans.bringer===participant) continue;
          if(!(ans.region||ans.grapeVariety)) continue;
          const g=s.guesses?.[participant]?.[wno]||{};
          if(!(g.country||g.region||g.grape||g.vintage||g.village)) continue;

          const sc=scoreGuessVsAnswer(g,ans,s.rubric,ans.depth,g.villageAILevel,(s.participantLevels||{})[participant]);
          const adj=g.adjust||0;
          const qr=s.rubric?.qualRatio||0;
          const quantPct=Math.max(0,Math.min(100,sc.pct+adj));
          const finalPct=(g.qualScore!==undefined&&qr>0)
            ? Math.round(quantPct*(1-qr)+g.qualScore*qr) : quantPct;
          scores.push(finalPct);

          FIELD_KEYS.forEach(k=>{
            const lvl=sc[k]?.level||"none";
            if(lvl==="none") return;
            sFields[k].n++; fieldTotals[k].total++;
            if(lvl==="exact"){sFields[k].exact++;fieldTotals[k].exact++;}
            else if(lvl==="close"){sFields[k].close++;fieldTotals[k].close++;}
            else{sFields[k].miss++;fieldTotals[k].miss++;}
            // Track confusion: region misses
            if(k==="region"&&lvl==="miss"&&g.region&&ans.region) {
              const key=`${g.region}→${ans.region}`;
              confusions[key]=(confusions[key]||0)+1;
            }
          });
        }
        if(scores.length>0) sessionData.push({
          date:s.date?.split("T")[0]||"",
          name:s.name, avg:Math.round(scores.reduce((a,b)=>a+b)/scores.length),
          wines:scores.length, groupId:s.groupId, fields:sFields,
        });
      }
      return {sessionData, fieldTotals, confusions};
    }

    const allParticipants=[...new Set(sessions.flatMap(s=>s.participants||[]))].filter(Boolean);
    const dp=dashParticipant||allParticipants[0]||"";
    const {sessionData,fieldTotals,confusions}=buildStats(dp);
    const totalGames=sessionData.length;
    const overallAvg=totalGames>0?Math.round(sessionData.reduce((a,s)=>a+s.avg,0)/totalGames):0;
    const trend=totalGames>=3?(sessionData.slice(-3).reduce((a,s)=>a+s.avg,0)/3 - sessionData.slice(0,3).reduce((a,s)=>a+s.avg,0)/3).toFixed(0)*1:null;

    // SVG line chart helper
    const LineChart=({data,w=320,h=120})=>{
      if(!data.length) return null;
      const pad={l:30,r:10,t:10,b:24};
      const yw=h-pad.t-pad.b, xw=w-pad.l-pad.r;
      const minY=Math.max(0,Math.min(...data.map(d=>d.avg))-10);
      const maxY=Math.min(100,Math.max(...data.map(d=>d.avg))+10);
      const px=(i)=>pad.l+i/(data.length-1||1)*xw;
      const py=(v)=>pad.t+yw-(v-minY)/(maxY-minY||1)*yw;
      const pts=data.map((d,i)=>`${px(i)},${py(d.avg)}`).join(" ");
      return (
        <svg width={w} height={h} style={{overflow:"visible"}}>
          {/* Y gridlines */}
          {[0,50,100].map(v=>(v>=minY&&v<=maxY)&&(
            <g key={v}>
              <line x1={pad.l} y1={py(v)} x2={pad.l+xw} y2={py(v)} stroke="#eee" strokeWidth="1"/>
              <text x={pad.l-4} y={py(v)+4} fontSize="9" fill="#bbb" textAnchor="end">{v}</text>
            </g>
          ))}
          {/* Line */}
          <polyline points={pts} fill="none" stroke={RED} strokeWidth="2.5" strokeLinejoin="round"/>
          {/* Points */}
          {data.map((d,i)=>(
            <g key={i}>
              <circle cx={px(i)} cy={py(d.avg)} r="4" fill={RED}/>
              <text x={px(i)} y={py(d.avg)-8} fontSize="10" fill={RED} textAnchor="middle" fontWeight="700">{d.avg}%</text>
              <text x={px(i)} y={h-6} fontSize="8" fill="#bbb" textAnchor="middle">{d.date?.slice(5)||""}</text>
            </g>
          ))}
        </svg>
      );
    };

    // Field accuracy bar
    const FieldBar=({label,ft})=>{
      if(!ft.total) return null;
      const ep=Math.round(ft.exact/ft.total*100);
      const cp=Math.round(ft.close/ft.total*100);
      const mp=100-ep-cp;
      return (
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
            <span style={{fontSize:12,fontWeight:600,color:TH.T2}}>{label}</span>
            <span style={{fontSize:11,color:TH.T2}}>{ep}% 정확 · {cp}% 근접</span>
          </div>
          <div style={{height:10,borderRadius:5,overflow:"hidden",display:"flex",background:"#f0f0f0"}}>
            {ep>0&&<div style={{width:`${ep}%`,background:"#2E7D32",transition:"width .3s"}}/>}
            {cp>0&&<div style={{width:`${cp}%`,background:GOLD,transition:"width .3s"}}/>}
            {mp>0&&<div style={{width:`${mp}%`,background:"#f0f0f0"}}/>}
          </div>
        </div>
      );
    };

    // Insights
    const insights=[];
    FIELD_KEYS.forEach(k=>{
      const ft=fieldTotals[k]; if(!ft.total) return;
      const missRate=ft.miss/ft.total;
      const exactRate=ft.exact/ft.total;
      if(missRate>0.5) insights.push({type:"weak",text:`${FIELD_LABELS[k]} 적중률이 낮아요 (${Math.round(exactRate*100)}%)`});
      if(exactRate>0.8) insights.push({type:"strong",text:`${FIELD_LABELS[k]}${josa(FIELD_LABELS[k],"은는")} 강점이에요 (${Math.round(exactRate*100)}%)`});
    });
    const topConfusions=Object.entries(confusions).sort((a,b)=>b[1]-a[1]).slice(0,3);
    topConfusions.forEach(([k,v])=>insights.push({type:"confusion",text:`자주 혼동: ${k.replace("→"," → ")} (${v}회)`}));
    if(trend!==null) insights.push({type:trend>=0?"up":"down",
      text:trend>=0?`최근 3세션 적중률이 올라가고 있어요 (+${trend}%p)`:` 최근 3세션 적중률이 떨어지고 있어요 (${trend}%p)`});

    return (
      <div style={{minHeight:"100vh",background:TH.BG,fontFamily:"system-ui,sans-serif"}}>
        <div style={{background:RED,color:"#fff",padding:"16px 18px",display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer"}}>←</button>
          <span style={{fontSize:17,fontWeight:700}}>📊 성과 대시보드</span>
        </div>

        <div style={{padding:16,maxWidth:640,margin:"0 auto"}}>
          {/* Participant selector */}
          {allParticipants.length>1&&(
            <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
              {allParticipants.map(p=>(
                <button key={p} onClick={()=>setDashParticipant(p)}
                  style={{padding:"7px 16px",border:`1px solid ${dp===p?RED:"#ddd"}`,borderRadius:20,fontSize:13,fontWeight:dp===p?700:400,background:dp===p?RED:"#fff",color:dp===p?"#fff":"#666",cursor:"pointer"}}>{p}</button>
              ))}
            </div>
          )}

          {totalGames===0 ? (
            <div style={{textAlign:"center",color:TH.T3,padding:64,fontSize:14}}>
              공개된 세션이 없습니다.<br/>블라인드 테이스팅을 진행하고 정답을 공개해보세요.
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
                {[["참여 세션",`${totalGames}회`,"#555"],["평균 적중률",`${overallAvg}%`,overallAvg>=70?"#2E7D32":overallAvg>=40?"#92400E":"#991B1B"],
                  ["추세",trend===null?"—":(trend>=0?`↑+${trend}%p`:`↓${trend}%p`),trend===null?"#aaa":trend>=0?"#2E7D32":"#991B1B"]
                ].map(([lbl,val,col])=>(
                  <div key={lbl} style={{...CS,textAlign:"center",marginBottom:0}}>
                    <div style={{fontSize:20,fontWeight:800,color:col}}>{val}</div>
                    <div style={{fontSize:11,color:TH.T3,marginTop:2}}>{lbl}</div>
                  </div>
                ))}
              </div>

              {/* Time series */}
              {sessionData.length>=2&&(
                <div style={CS}>
                  <div style={{fontSize:13,fontWeight:700,color:TH.T2,marginBottom:12}}>📈 세션별 적중률 추이</div>
                  <div style={{overflowX:"auto"}}>
                    <LineChart data={sessionData} w={Math.max(320, sessionData.length*60+40)} h={130}/>
                  </div>
                </div>
              )}
              {sessionData.length===1&&(
                <div style={{...CS,textAlign:"center",color:TH.T3,fontSize:12}}>2회 이상 참여하면 추이 차트가 표시됩니다</div>
              )}

              {/* Field accuracy */}
              <div style={CS}>
                <div style={{fontSize:13,fontWeight:700,color:TH.T2,marginBottom:12}}>🎯 항목별 정확도</div>
                {FIELD_KEYS.map(k=><FieldBar key={k} label={FIELD_LABELS[k]} ft={fieldTotals[k]}/>)}
                <div style={{display:"flex",gap:12,marginTop:8,fontSize:10,color:TH.T3}}>
                  <span><span style={{display:"inline-block",width:10,height:10,background:"#2E7D32",borderRadius:2,marginRight:3}}/>정확</span>
                  <span><span style={{display:"inline-block",width:10,height:10,background:GOLD,borderRadius:2,marginRight:3}}/>근접</span>
                  <span><span style={{display:"inline-block",width:10,height:10,background:"#f0f0f0",border:`1px solid ${TH.BD}`,borderRadius:2,marginRight:3}}/>오답</span>
                </div>
              </div>

              {/* Session history */}
              <div style={CS}>
                <div style={{fontSize:13,fontWeight:700,color:TH.T2,marginBottom:10}}>📋 세션별 기록</div>
                {[...sessionData].reverse().map((s,i)=>{
                  const grp=groups.find(g=>g.id===s.groupId);
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px solid ${TH.BD}`}}>
                      <span style={{fontSize:11,color:TH.T3,width:40,flexShrink:0}}>{s.date?.slice(5)}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <span style={{fontSize:13,fontWeight:600}}>{s.name}</span>
                        {grp&&<span style={{fontSize:10,color:grp.color,marginLeft:6}}>{grp.name}</span>}
                        <span style={{fontSize:11,color:TH.T3,marginLeft:6}}>{s.wines}종</span>
                      </div>
                      <span style={{fontSize:16,fontWeight:700,color:s.avg>=70?"#2E7D32":s.avg>=40?"#92400E":"#991B1B"}}>{s.avg}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Insights */}
              {insights.length>0&&(
                <div style={CS}>
                  <div style={{fontSize:13,fontWeight:700,color:TH.T2,marginBottom:10}}>💡 인사이트</div>
                  {insights.map((ins,i)=>(
                    <div key={i} style={{display:"flex",gap:8,marginBottom:7,alignItems:"flex-start"}}>
                      <span style={{fontSize:14}}>{ins.type==="strong"?"🟢":ins.type==="weak"?"🔴":ins.type==="confusion"?"🔀":ins.type==="up"?"📈":"📉"}</span>
                      <span style={{fontSize:13,color:TH.T2,lineHeight:1.4}}>{ins.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── 미각 싱크로율 ── */}
          {(()=>{
            // 두 참가자 간 싱크로율 계산
            const allParts = [...new Set(sessions.flatMap(s=>s.participants||[]))].filter(Boolean);
            if(allParts.length < 2) return null;

            const syncRate = (pA, pB) => {
              let agree=0, total=0;
              for(const s of sessions) {
                if(!s.revealed||!s.answers) continue;
                if(!(s.participants.includes(pA)&&s.participants.includes(pB))) continue;
                for(let i=0;i<s.wineCount;i++) {
                  const wno=i+1, ans=s.answers[wno]||{};
                  const gA=s.guesses?.[pA]?.[wno]||{};
                  const gB=s.guesses?.[pB]?.[wno]||{};
                  if(!(gA.country||gA.region)&&!(gB.country||gB.region)) continue;
                  // 국가
                  if(gA.country&&gB.country){total++;if(norm(gA.country)===norm(gB.country))agree++;}
                  // 지역
                  if(gA.region&&gB.region){total++;if(norm(gA.region)===norm(gB.region))agree++;}
                  // 품종
                  if(gA.grape&&gB.grape){total++;
                    const sA=new Set((gA.grape).split(",").map(x=>norm(x.trim())));
                    const sB=new Set((gB.grape).split(",").map(x=>norm(x.trim())));
                    const inter=[...sA].filter(x=>sB.has(x)).length;
                    if(inter>0)agree++;
                  }
                  // 빈티지
                  if(gA.vintage&&gB.vintage){total++;
                    if(Math.abs(parseInt(gA.vintage)-parseInt(gB.vintage))<=2)agree++;
                  }
                }
              }
              return total>0 ? Math.round(agree/total*100) : null;
            };

            const soulmateMsg = (r) => {
              if(r>=90) return {msg:"사실상 하나의 혀를 공유 중! 🧬", color:"#2E7D32"};
              if(r>=75) return {msg:"취향 공명 파트너 🎵", color:"#1E6FA0"};
              if(r>=60) return {msg:"비슷한 방향을 보고 있어요 🎯", color:"#7B68EE"};
              if(r>=45) return {msg:"미묘하게 다른 두 혀 🤔", color:"#D97706"};
              if(r>=30) return {msg:"서로 다른 우주에 삽니다 🌍", color:"#92400E"};
              return {msg:"의견 충돌 99% 예상 🎭", color:"#991B1B"};
            };

            // 모든 조합 계산
            const pairs = [];
            for(let i=0;i<allParts.length;i++)
              for(let j=i+1;j<allParts.length;j++) {
                const r = syncRate(allParts[i], allParts[j]);
                if(r!==null) pairs.push({a:allParts[i], b:allParts[j], rate:r, ...soulmateMsg(r)});
              }
            if(pairs.length===0) return null;
            pairs.sort((a,b)=>b.rate-a.rate);

            return (
              <div style={CS}>
                <div style={{fontSize:13,fontWeight:700,color:TH.T1,marginBottom:12}}>🔗 미각 싱크로율</div>
                <div style={{fontSize:11,color:TH.T3,marginBottom:12}}>같은 세션에서 얼마나 비슷하게 추측했는지 — 국가/지역/품종/빈티지 기준</div>
                {pairs.map(({a,b,rate,msg,color})=>(
                  <div key={a+b} style={{padding:"12px 0",borderBottom:`1px solid ${TH.BD}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <span style={{fontSize:14,fontWeight:700,color:TH.T1}}>{a}</span>
                      <span style={{fontSize:12,color:TH.T3}}>·</span>
                      <span style={{fontSize:14,fontWeight:700,color:TH.T1}}>{b}</span>
                      <span style={{marginLeft:"auto",fontSize:20,fontWeight:800,color}}>{rate}%</span>
                    </div>
                    {/* 싱크로 바 */}
                    <div style={{height:8,background:TH.BD,borderRadius:4,marginBottom:6,overflow:"hidden"}}>
                      <div style={{width:`${rate}%`,height:"100%",background:color,borderRadius:4,transition:"width .4s"}}/>
                    </div>
                    <div style={{fontSize:12,color,fontWeight:600}}>{msg}</div>
                  </div>
                ))}
              </div>
            );
          })()}

        </div>
      </div>
    );
  }

  // ════ SETUP VIEW ════
  if(view==="setup") {
    return (
      <div style={{minHeight:"100vh",background:TH.BG,fontFamily:"system-ui,sans-serif"}}>
        <div style={{background:RED,color:"#fff",padding:"16px 18px",display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer"}}>←</button>
          <span style={{fontSize:17,fontWeight:700}}>세션 설정</span>
        </div>
        {cur?.accessCode&&(
          <div style={{background:"rgba(0,0,0,.45)",padding:"6px 18px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:"rgba(255,255,255,.85)",fontSize:11}}>초대 코드</span>
            <span style={{fontWeight:800,letterSpacing:3,fontSize:15,color:"#fff"}}>{cur?.accessCode}</span>
            <button onClick={()=>{
              const url=`${window.location.origin}?join=${cur?.accessCode}`;
              if(navigator.share){navigator.share({title:"블라인드 테이스팅 참여",url});}
              else{navigator.clipboard?.writeText(url).then(()=>toast("링크 복사됨!","info")).catch(()=>alert(url));}
            }} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",borderRadius:6,padding:"3px 10px",fontSize:11,cursor:"pointer",marginLeft:"auto"}}>
              🔗 초대 링크 공유
            </button>
          </div>
        )}
        <div style={{padding:0,margin:"0 auto"}}>
          <div style={CS}>
            <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:6}}>세션 이름</div>
            <input value={sName} onChange={e=>setSName(e.target.value)}
              style={{width:"100%",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"8px 10px",fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:14}}/>
            {groups.length>0&&(
              <>
                <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:6}}>모임 (선택)</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
                  <button onClick={()=>setSGroupId(null)}
                    style={{padding:"6px 12px",border:`1px solid ${!sGroupId?RED:"#ddd"}`,borderRadius:18,fontSize:12,fontWeight:!sGroupId?700:400,background:!sGroupId?RED:"#fff",color:!sGroupId?"#fff":"#666",cursor:"pointer"}}>단독</button>
                  {groups.map(g=>(
                    <button key={g.id} onClick={()=>setSGroupId(g.id)}
                      style={{padding:"6px 12px",border:`1px solid ${sGroupId===g.id?g.color:"#ddd"}`,borderRadius:18,fontSize:12,fontWeight:sGroupId===g.id?700:400,background:sGroupId===g.id?g.color:"#fff",color:sGroupId===g.id?"#fff":"#666",cursor:"pointer"}}>{g.name}</button>
                  ))}
                </div>
              </>
            )}
            <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:6}}>와인 수</div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {[1,2,3,4,5,6,8].map(n=>(
                <button key={n} onClick={()=>setSCount(n)}
                  style={{flex:1,padding:"8px",border:`1px solid ${sCount===n?RED:"#ddd"}`,borderRadius:8,background:sCount===n?RED:"#fff",color:sCount===n?"#fff":"#666",fontWeight:sCount===n?700:400,fontSize:13,cursor:"pointer"}}>{n}</button>
              ))}
            </div>
            <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:6}}>참가자</div>
            {/* 최근 참가자 빠른 추가 */}
            {tasters.filter(t=>t&&!sParts.includes(t)).length>0&&(
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                {tasters.filter(t=>t&&!sParts.includes(t)).map(t=>(
                  <button key={t} onClick={()=>setSParts(p=>[...p,t])}
                    style={{padding:"4px 10px",border:"1px dashed "+RED,borderRadius:14,fontSize:12,color:RED,background:"#fff",cursor:"pointer"}}>
                    + {t}
                  </button>
                ))}
              </div>
            )}
            {sParts.map((p,i)=>(
              <div key={i} style={{display:"flex",gap:6,marginBottom:6,alignItems:"center"}}>
                <input value={p} onChange={e=>{const a=[...sParts];a[i]=e.target.value;setSParts(a);}}
                  placeholder="이름" style={{flex:1,border:`1px solid ${TH.BD}`,borderRadius:6,padding:"7px 10px",fontSize:13,outline:"none"}}/>
                <select value={sLevels[i]||"expert"}
                  onChange={e=>setSLevels(prev=>({...prev,[i]:e.target.value}))}
                  style={{border:`1px solid ${TH.BD}`,borderRadius:6,padding:"7px 6px",fontSize:11,background:TH.CARD,color:TH.T1,cursor:"pointer"}}>
                  {Object.entries(PARTICIPANT_LEVELS).map(([k,v])=>(
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <button onClick={()=>setSParts(sParts.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:TH.T3,fontSize:16,cursor:"pointer"}}>×</button>
              </div>
            ))}
            <button onClick={()=>setSParts([...sParts,""])} style={{border:"1px dashed #ddd",borderRadius:6,padding:"7px 12px",fontSize:12,color:TH.T3,background:"none",cursor:"pointer",marginTop:4}}>+ 참가자 추가</button>
          </div>

          {/* Answer mode */}
          <div style={CS}>
            <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:10}}>정답 입력 시점</div>
            {/* 정답 입력 시점 — 2열 그리드 */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
              <button onClick={()=>setSAnswerMode("prefill")}
                style={{padding:"12px 10px",border:`2px solid ${sAnswerMode==="prefill"?RED:"#ddd"}`,borderRadius:12,background:sAnswerMode==="prefill"?"#FDF1F2":TH.CARD,cursor:"pointer",textAlign:"left"}}>
                <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>🔒 미리 등록</div>
                <div style={{fontSize:11,color:TH.T2,lineHeight:1.4}}>혼자 진행 / 한 명이 정답 관리</div>
              </button>
              <button onClick={()=>setSAnswerMode("reveal")}
                style={{padding:"12px 10px",border:`2px solid ${sAnswerMode==="reveal"?RED:"#ddd"}`,borderRadius:12,background:sAnswerMode==="reveal"?"#FDF1F2":TH.CARD,cursor:"pointer",textAlign:"left"}}>
                <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>🎉 공개 시 입력</div>
                <div style={{fontSize:11,color:TH.T2,lineHeight:1.4}}>여러 출제자 모임 (정답 비공개)</div>
              </button>
            </div>

            {sAnswerMode==="prefill" && (
              <div style={{background:"#F0F7FF",borderRadius:8,padding:"9px 11px",marginTop:6,fontSize:11,color:"#1E40AF",lineHeight:1.5}}>
                💡 한 명이 모든 정답을 미리 입력합니다. <b>혼자 연습</b>하거나, 한 사람이 정답을 도맡아 관리할 때 적합해요. (이 화면에서 정답이 다 보이므로 여러 출제자가 서로 숨겨야 하는 모임엔 부적합)
              </div>
            )}
            {sAnswerMode==="reveal" && (
              <div style={{background:"#FEF3C7",borderRadius:8,padding:"9px 11px",marginTop:6,fontSize:11,color:"#92400E",lineHeight:1.5}}>
                💡 <b>여러 출제자 모임</b>에 적합합니다. 진행 중엔 정답을 입력하지 않아 미리 노출되지 않고, 와인을 하나씩 공개할 때 그 출제자가 직접 정답을 입력합니다. 와인별 "가져온 사람"도 공개 시 지정해요.
              </div>
            )}
          </div>

          {/* Scoring rubric */}
          <div style={CS}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{fontSize:11,fontWeight:600,color:TH.T2}}>채점 기준 (항목별 가중치)</div>
              <button onClick={()=>setSRubric(JSON.parse(JSON.stringify(DEFAULT_RUBRIC)))}
                style={{background:"none",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"3px 10px",fontSize:11,color:TH.T2,cursor:"pointer"}}>
                ↺ 기본값 복원
              </button>
            </div>
            <div style={{fontSize:11,color:TH.T3,marginBottom:10}}>0으로 두면 채점에서 제외됩니다. 만점은 가중치 합.</div>
            {[["country","국가"],["region","지역"],["village","마을/밭"],["classification","등급"],["grape","품종"],["vintage","빈티지"]].map(([k,label])=>(
              <div key={k} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <span style={{fontSize:13,width:64,flexShrink:0}}>{label}</span>
                <input type="range" min="0" max="3" step="0.5" value={sRubric.weights[k]}
                  onChange={e=>setSRubric(r=>({...r,weights:{...r.weights,[k]:parseFloat(e.target.value)}}))}
                  style={{flex:1,accentColor:RED}}/>
                <span style={{fontSize:13,fontWeight:700,color:sRubric.weights[k]>0?RED:"#ccc",width:32,textAlign:"right"}}>
                  {sRubric.weights[k]>0?`×${sRubric.weights[k]}`:"제외"}
                </span>
              </div>
            ))}
            <div style={{borderTop:`1px solid ${TH.BD}`,marginTop:10,paddingTop:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:13,width:90,flexShrink:0}}>빈티지 근접</span>
                <div style={{display:"flex",gap:6}}>
                  {[1,2,3].map(t=>(
                    <button key={t} onClick={()=>setSRubric(r=>({...r,vintageTol:t}))}
                      style={{padding:"4px 12px",border:`1px solid ${sRubric.vintageTol===t?RED:"#ddd"}`,borderRadius:6,fontSize:12,background:sRubric.vintageTol===t?RED:"#fff",color:sRubric.vintageTol===t?"#fff":"#666",cursor:"pointer"}}>±{t}년</button>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:13,width:90,flexShrink:0}}>근접 점수</span>
                <div style={{display:"flex",gap:6}}>
                  {[[0.3,"30%"],[0.5,"50%"],[0.7,"70%"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setSRubric(r=>({...r,closeRatio:v}))}
                      style={{padding:"4px 12px",border:`1px solid ${sRubric.closeRatio===v?RED:"#ddd"}`,borderRadius:6,fontSize:12,background:sRubric.closeRatio===v?RED:"#fff",color:sRubric.closeRatio===v?"#fff":"#666",cursor:"pointer"}}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            {/* 정성 평가 비율 */}
            <div style={{borderTop:`1px solid ${TH.BD}`,marginTop:10,paddingTop:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <span style={{fontSize:13,flex:1}}>🤖 AI 정성 평가</span>
                <div style={{display:"flex",gap:6}}>
                  {[[0,"없음"],[0.2,"20%"],[0.3,"30%"],[0.4,"40%"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setSRubric(r=>({...r,qualRatio:v}))}
                      style={{padding:"4px 10px",border:`1px solid ${sRubric.qualRatio===v?RED:"#ddd"}`,borderRadius:6,fontSize:12,background:sRubric.qualRatio===v?RED:"#fff",color:sRubric.qualRatio===v?"#fff":"#666",cursor:"pointer"}}>{l}</button>
                  ))}
                </div>
              </div>
              {sRubric.qualRatio>0&&(
                <div style={{fontSize:11,color:TH.T2,background:"#f9f9f9",borderRadius:6,padding:"6px 10px"}}>
                  정량 {Math.round((1-sRubric.qualRatio)*100)}% + AI 정성 {Math.round(sRubric.qualRatio*100)}% · 결과 화면에서 AI 평가 버튼으로 실행
                </div>
              )}
            </div>
            <div style={{marginTop:10,background:"#FBF4E4",borderRadius:8,padding:"8px 10px",fontSize:11,color:"#7a5c10"}}>
              만점 {Object.values(sRubric.weights).reduce((a,b)=>a+b,0)}점 · 정확={`${Object.values(sRubric.weights).reduce((a,b)=>a+b,0)}`}점, 근접={`${Math.round(sRubric.closeRatio*100)}`}% 부분점수
            </div>
          </div>

          <button onClick={createSession} style={{width:"100%",background:RED,color:"#fff",border:"none",borderRadius:12,padding:"14px",fontSize:15,fontWeight:700,cursor:"pointer"}}>
            {sAnswerMode==="prefill" ? "정답 등록하러 가기 →" : "시작하기 →"}
          </button>
        </div>
      </div>
    );
  }

  // ── 답변 입력 컴포넌트 팩토리 (Prep/Reveal 뷰용) ────────────────
  const ISTA = {width:"100%",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"7px 10px",
    fontSize:13,outline:"none",boxSizing:"border-box",background:TH.INP,color:TH.T1};
  const allCls = {regional:"레지오날",village:"빌라주",premiercru:"1er Cru",grandcru:"그랑크뤼",other:"기타"};
  const regionClassLabel = (key, region) => {
    if(region==="보르도") return {regional:"일반 AOP",village:"크뤼 부르주아",premiercru:"크뤼 클라쎄",grandcru:"그랑 크뤼 클라쎄",other:"기타"}[key]||key;
    if(region==="리오하") return {regional:"Rioja",village:"크리안사",premiercru:"레세르바",grandcru:"그란 레세르바",other:"기타"}[key]||key;
    return allCls[key]||key;
  };

  function makeAnswerComponents(wno) {
    const ans = cur.answers[wno] || {};
    const upd = (field, val) => updateAnswer(wno, field, val);

    const ACountry = () => (
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>국가</div>
        <select value={ans.country||""} onChange={e=>{upd("country",e.target.value);upd("region","");upd("subRegion","");}}
          style={{...ISTA,background:"#fff",color:ans.country?TH.T1:"#888"}}>
          <option value="">선택...</option>
          {Object.keys(WINE_ORIGINS).map(co=><option key={co} value={co}>{co}</option>)}
        </select>
      </div>
    );

    const ARegion = () => {
      const regions = WINE_ORIGINS[ans.country]?Object.keys(WINE_ORIGINS[ans.country]):[];
      return (
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>지역</div>
          <div style={{position:"relative"}}>
            <input list={`dl-ans-r-${wno}`} value={ans.region||""} onChange={e=>{upd("region",e.target.value);upd("subRegion","");}}
              placeholder={regions.length?"입력 또는 선택":"예: 부르고뉴"} style={{...ISTA,paddingRight:28}}/>
            {regions.length>0&&<span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#aaa",pointerEvents:"none"}}>▾</span>}
            <datalist id={`dl-ans-r-${wno}`}>{regions.map(r=><option key={r} value={r}/>)}</datalist>
          </div>
        </div>
      );
    };

    const AVillage = () => {
      const villages = WINE_ORIGINS[ans.country]?.[ans.region]
        ||[...new Set(Object.values(WINE_ORIGINS).flatMap(rg=>Object.values(rg).flat()))];
      return (
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>마을/아펠라시옹 <span style={{fontWeight:400,color:TH.T3}}>(선택)</span></div>
          <div style={{position:"relative"}}>
            <input list={`dl-ans-v-${wno}`} value={ans.subRegion||""} onChange={e=>upd("subRegion",e.target.value)}
              placeholder="입력하면 자동완성" style={{...ISTA,paddingRight:28}}/>
            <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#aaa",pointerEvents:"none"}}>▾</span>
            <datalist id={`dl-ans-v-${wno}`}>{[...new Set(villages)].map(v=><option key={v} value={v}/>)}</datalist>
          </div>
        </div>
      );
    };

    const AClassification = () => {
      const allowed = REGION_CLASSES[ans.region]||DEFAULT_CLASSES;
      return (
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>등급{ans.region&&REGION_CLASSES[ans.region]?` (${ans.region})`:""}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {allowed.map(v=>(
              <button key={v} onClick={()=>upd("classification",v)}
                style={{padding:"6px 11px",border:`1px solid ${ans.classification===v?RED:"#ddd"}`,borderRadius:18,fontSize:12,
                  fontWeight:ans.classification===v?700:400,background:ans.classification===v?RED:"#fff",
                  color:ans.classification===v?"#fff":"#666",cursor:"pointer"}}>
                {regionClassLabel(v,ans.region)}
              </button>
            ))}
          </div>
        </div>
      );
    };

    const AGrape = () => {
      const sel = (ans.grapeVariety||"").split(",").map(s=>s.trim()).filter(Boolean);
      const toggle = (g) => { const next=sel.includes(g)?sel.filter(x=>x!==g):[...sel,g]; upd("grapeVariety",next.join(", ")); };
      return (
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>품종 <span style={{fontWeight:400,color:TH.T3}}>(복수 선택)</span></div>
          {[["🍷 레드",GRAPE_CATEGORIES.red],["🥂 화이트",GRAPE_CATEGORIES.white]].map(([label,grapes])=>(
            <div key={label} style={{marginBottom:6}}>
              <div style={{fontSize:10,color:TH.T3,marginBottom:4}}>{label}</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {grapes.map(g=><button key={g} onClick={()=>toggle(g)}
                  style={{padding:"4px 10px",border:`1px solid ${sel.includes(g)?RED:"#ddd"}`,borderRadius:16,fontSize:12,
                    fontWeight:sel.includes(g)?700:400,background:sel.includes(g)?RED:"#fff",
                    color:sel.includes(g)?"#fff":"#666",cursor:"pointer",marginBottom:4}}>{g}</button>)}
              </div>
            </div>
          ))}
          <input value={sel.filter(g=>!Object.values(GRAPE_CATEGORIES).flat().includes(g)).join(", ")||""}
            onChange={e=>upd("grapeVariety",[...sel.filter(g=>Object.values(GRAPE_CATEGORIES).flat().includes(g)),
              ...e.target.value.split(",").map(s=>s.trim()).filter(Boolean)].join(", "))}
            placeholder="직접 입력 후 Enter"
            style={{width:"100%",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"7px 10px",fontSize:12,outline:"none",boxSizing:"border-box",marginTop:4}}/>
        </div>
      );
    };

    const AVintage = () => (
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>빈티지</div>
        <input type="number" inputMode="numeric" min="1900" max="2030" value={ans.vintage||""}
          onChange={e=>upd("vintage",e.target.value)}
          placeholder="예: 2019" style={{...ISTA,width:120}}/>
      </div>
    );

    return {ACountry,ARegion,AVillage,AClassification,AGrape,AVintage};
  }

  // ════ PREP VIEW (host pre-registers answers) ════
  if(view==="prep"&&cur) {
    const allFilled = Array.from({length:cur.wineCount}).every((_,i)=>{
      const a=cur.answers[i+1]||{};
      return a.nameKR||a.nameEN||a.region||a.grapeVariety;
    });
    return (
      <div style={{minHeight:"100vh",background:TH.BG,fontFamily:"system-ui,sans-serif"}}>
        <div style={{background:"#3B2A1A",color:"#fff",padding:"16px 18px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:4}}>
            <button onClick={()=>setView("setup")} style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer"}}>←</button>
            <span style={{fontSize:17,fontWeight:700}}>🔒 정답 등록</span>
          </div>
          <div style={{fontSize:12,opacity:.85,paddingLeft:32}}>참가자에게 보이지 않습니다 · 와인별 "가져온 사람"도 지정하세요</div>
        </div>
        {cur?.accessCode&&(
          <div style={{background:"rgba(0,0,0,.45)",padding:"6px 18px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:"rgba(255,255,255,.85)",fontSize:11}}>초대 코드</span>
            <span style={{fontWeight:800,letterSpacing:3,fontSize:15,color:"#fff"}}>{cur?.accessCode}</span>
            <button onClick={()=>{
              const url=`${window.location.origin}?join=${cur?.accessCode}`;
              if(navigator.share){navigator.share({title:"블라인드 테이스팅 참여",url});}
              else{navigator.clipboard?.writeText(url).then(()=>toast("링크 복사됨!","info")).catch(()=>alert(url));}
            }} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",borderRadius:6,padding:"3px 10px",fontSize:11,cursor:"pointer",marginLeft:"auto"}}>
              🔗 초대 링크 공유
            </button>
          </div>
        )}
        <div style={{padding:16,maxWidth:640,margin:"0 auto"}}><datalist id="dl-all-regions">{Object.values(WINE_ORIGINS).flatMap(rg=>Object.keys(rg)).map(r=><option key={r} value={r}/>)}</datalist><datalist id="dl-villages">{[...new Set(Object.values(WINE_ORIGINS).flatMap(rg=>Object.values(rg).flat()))].map(v=><option key={v} value={v}/>)}</datalist><datalist id="dl-grapes">{GRAPE_LIST.map(g=><option key={g} value={g}/>)}</datalist>
          <div style={{background:"#FEF3C7",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#92400E"}}>
            ⚠️ 각 와인의 실제 정보를 입력하세요. 잠금 후에는 참가자 추론 단계로 넘어갑니다.
          </div>
          {Array.from({length:cur.wineCount}).map((_,i)=>{
            const wno=i+1, ans=cur.answers[wno]||{};
            return (
              <div key={wno} style={CS}>
                <div style={{fontSize:16,fontWeight:800,color:TH.T1,marginBottom:12}}>#{wno}</div>
                {/* 📷 라벨 스캐너 버튼 */}
                <div style={{marginBottom:12}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:geminiKey?"#FDF1F2":"#f5f5f5",border:`1px dashed ${geminiKey?RED:"#ccc"}`,borderRadius:10,cursor:geminiKey?"pointer":"default",justifyContent:"center"}}>
                    {scanningWno===wno
                      ? <span style={{fontSize:13,color:"#888"}}>🔍 라벨 분석 중...</span>
                      : <>
                          <span style={{fontSize:18}}>📷</span>
                          <span style={{fontSize:13,fontWeight:600,color:geminiKey?RED:"#aaa"}}>
                            {geminiKey ? "라벨 스캔으로 자동 입력" : "라벨 스캔 (Gemini 키 필요)"}
                          </span>
                        </>
                    }
                    {geminiKey&&scanningWno!==wno&&<input type="file" accept="image/*" capture="environment" style={{display:"none"}}
                      onChange={async(e)=>{
                        const file=e.target.files?.[0]; if(!file) return;
                        setScanningWno(wno);
                        const base64=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.readAsDataURL(file);});
                        const result=await callGeminiVision(geminiKey,base64,file.type);
                        if(result){
                          if(result.nameKR) updateAnswer(wno,"nameKR",result.nameKR);
                          if(result.country) updateAnswer(wno,"country",result.country);
                          if(result.region) updateAnswer(wno,"region",result.region);
                          if(result.subRegion) updateAnswer(wno,"subRegion",result.subRegion);
                          if(result.grapeVariety){
                            // 품종명을 칩 이름과 매칭 (공백 제거 + 영문 매핑)
                            const allChips=[...GRAPE_CATEGORIES.red,...GRAPE_CATEGORIES.white];
                            const engMap={"cabernet sauvignon":"카베르네소비뇽","pinot noir":"피노누아","merlot":"메를로","syrah":"시라/쉬라즈","shiraz":"시라/쉬라즈","nebbiolo":"네비올로","sangiovese":"산지오베제","tempranillo":"템프라니요","malbec":"말벡","grenache":"그르나슈","chardonnay":"샤르도네","sauvignon blanc":"소비뇽블랑","riesling":"리슬링","pinot grigio":"피노그리지오","pinot gris":"피노그리지오","chenin blanc":"슈냉블랑","viognier":"비오니에","semillon":"세미용"};
                            const matched=result.grapeVariety.split(/[,،]/).map(g=>{
                              const t=g.trim(); const tl=t.toLowerCase();
                              if(engMap[tl]) return engMap[tl];
                              const noSpace=t.replace(/\s/g,"");
                              const found=allChips.find(ch=>ch===noSpace||ch.replace(/[/]/g,"")===noSpace);
                              return found||t;
                            }).filter(Boolean);
                            updateAnswer(wno,"grapeVariety",matched.join(", "));
                          }
                          if(result.vintage) updateAnswer(wno,"vintage",String(result.vintage||"").replace(/[^0-9]/g,""));
                          // 등급 정규화: Gemini 반환값 → 코드 키로 변환
                          if(result.classification){
                            const raw=result.classification.toLowerCase().replace(/\s/g,"");
                            const clsMap={"그랑크뤼":"grandcru","grandcru":"grandcru","premiercru":"premiercru","1ercru":"premiercru","프르미에":"premiercru","빌라주":"village","레지오날":"regional","크뤼부르주아":"village","crubourgeois":"village","크뤼클라쎄":"premiercru","cruclasse":"premiercru","그랑크뤼클라쎄":"grandcru","grandcruclasse":"grandcru","프리미에그랑크뤼클라쎄":"grandcru","doc":"regional","docg":"grandcru","docga":"grandcru","igt":"other","aoc":"regional","aop":"regional","리오하":"regional","크리안사":"village","crianza":"village","레세르바":"premiercru","reserva":"premiercru","그란레세르바":"grandcru","granreserva":"grandcru"};
                            const normalized=clsMap[raw]||result.classification;
                            updateAnswer(wno,"classification",normalized);
                          }
                          toast("✅ 라벨 스캔 완료! 확인 후 수정하세요","info",4000);
                        }
                        setScanningWno(null);
                        e.target.value="";
                      }}/>}
                  </label>
                </div>
                {/* 와인 이름 (정답에만 있음) */}
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>와인 이름</div>
                  <input value={ans.nameKR||""} onChange={e=>updateAnswer(wno,"nameKR",e.target.value)} placeholder="예: 오퍼스 원, 샤토 마고"
                    style={{width:"100%",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"7px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
                {(()=>{const {ACountry,ARegion,AVillage,AClassification,AGrape,AVintage}=makeAnswerComponents(wno); return(<>{ACountry()}{ARegion()}{AVillage()}{AClassification()}{AGrape()}{AVintage()}</>);})()}
                {/* Bringer selector */}
                <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:5}}>가져온 사람 (출제자)</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                  <button onClick={()=>updateAnswer(wno,"bringer","")}
                    style={{padding:"5px 11px",border:`1px solid ${!ans.bringer?RED:"#ddd"}`,borderRadius:18,fontSize:12,fontWeight:!ans.bringer?700:400,background:!ans.bringer?RED:"#fff",color:!ans.bringer?"#fff":"#666",cursor:"pointer"}}>없음</button>
                  {cur.participants.map(pp=>(
                    <button key={pp} onClick={()=>updateAnswer(wno,"bringer",pp)}
                      style={{padding:"5px 11px",border:`1px solid ${ans.bringer===pp?RED:"#ddd"}`,borderRadius:18,fontSize:12,fontWeight:ans.bringer===pp?700:400,background:ans.bringer===pp?RED:"#fff",color:ans.bringer===pp?"#fff":"#666",cursor:"pointer"}}>{pp}</button>
                  ))}
                </div>
                <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:5}}>채점 목표 <span style={{fontWeight:400,color:TH.T3}}>(어디까지 맞혀야 만점)</span></div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {[["country","국가까지"],["region","지역까지"],["village","마을까지"],["full","전체(품종·등급·빈티지)"]].map(([dv,dl])=>{
                    const d=ans.depth||"full";
                    return (
                      <button key={dv} onClick={()=>updateAnswer(wno,"depth",dv)}
                        style={{padding:"5px 11px",border:`1px solid ${d===dv?"#7a5c10":"#ddd"}`,borderRadius:18,fontSize:12,fontWeight:d===dv?700:400,background:d===dv?"#FBF4E4":"#fff",color:d===dv?"#7a5c10":"#666",cursor:"pointer"}}>{dl}</button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <button onClick={lockAnswersAndStart} disabled={!allFilled}
            style={{width:"100%",background:allFilled?RED:"#ccc",color:"#fff",border:"none",borderRadius:12,padding:"14px",fontSize:15,fontWeight:700,cursor:allFilled?"pointer":"default"}}>
            🔒 정답 잠금 & 시음 시작 →
          </button>
          {!allFilled&&<div style={{fontSize:11,color:TH.T3,textAlign:"center",marginTop:8}}>모든 와인의 정보를 입력해주세요</div>}
        <ToastContainer toasts={toasts}/>
        {confirmModal&&<ConfirmModal {...confirmModal}/>}
        </div>
      </div>
    );
  }

  // ════ TASTE VIEW (input guesses) ════
  if(view==="taste"&&cur) {
    // Everyone tastes every wine. The wine's bringer skips guessing on it (tasting eval only).
    const guessers=cur.participants;
    const p=guessers[pIdx]||guessers[0], wno=wineIdx+1;
    const isBringer=(cur.answers[wno]?.bringer===p);
    const lastWine=wineIdx===cur.wineCount-1, lastP=pIdx===guessers.length-1;
    return (
      <div style={{minHeight:"100vh",background:TH.BG,fontFamily:"system-ui,sans-serif"}}>
        <div style={{background:RED,color:"#fff",padding:"16px 18px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
            <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer"}}>←</button>
            <span style={{fontSize:16,fontWeight:700}}>{cur.name}</span>
          </div>
{cur?.accessCode&&(
          <div style={{background:"rgba(0,0,0,.45)",padding:"6px 18px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:"rgba(255,255,255,.85)",fontSize:11}}>초대 코드</span>
            <span style={{fontWeight:800,letterSpacing:3,fontSize:15,color:"#fff"}}>{cur?.accessCode}</span>
            <button onClick={()=>{
              const url=`${window.location.origin}?join=${cur?.accessCode}`;
              if(navigator.share){navigator.share({title:"블라인드 테이스팅 참여",url});}
              else{navigator.clipboard?.writeText(url).then(()=>toast("링크 복사됨!","info")).catch(()=>alert(url));}
            }} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",borderRadius:6,padding:"3px 10px",fontSize:11,cursor:"pointer",marginLeft:"auto"}}>
              🔗 초대 링크 공유
            </button>
          </div>
        )}
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {Array.from({length:cur.wineCount}).map((_,i)=>(
              <div key={i} style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,
                background:i===wineIdx?"#fff":"rgba(255,255,255,.25)",color:i===wineIdx?RED:"#fff"}}>{i+1}</div>
            ))}
          </div>
        </div>
        <div style={{padding:16,maxWidth:640,margin:"0 auto"}}>
          {/* Wine number + participant indicator */}
          <div style={{textAlign:"center",marginBottom:14}}>
            <div style={{fontSize:32,fontWeight:800,color:RED}}>#{wno}</div>
            <div style={{fontSize:13,color:TH.T2,marginTop:4}}>작성자: <b style={{color:TH.T1}}>{p}</b> ({pIdx+1}/{guessers.length})</div>
            {cur.answers[wno]?.depth&&cur.answers[wno].depth!=="full"&&(
              <div style={{display:"inline-block",marginTop:6,background:"#FBF4E4",color:"#7a5c10",borderRadius:14,padding:"3px 12px",fontSize:11,fontWeight:600}}>
                🎯 이 와인은 {({country:"국가",region:"지역",village:"마을"})[cur.answers[wno].depth]}까지 맞히면 OK
              </div>
            )}
          </div>

          {/* Reveal mode: set "가져온 사람" up-front (answer stays hidden) so the bringer can skip guessing */}
          {cur.answerMode==="reveal" && (
            <div style={{...CS,paddingTop:12,paddingBottom:12}}>
              <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:6}}>이 와인 가져온 사람 <span style={{fontWeight:400,color:TH.T3}}>(출제자는 추측 제외)</span></div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                <button onClick={()=>updateAnswer(wno,"bringer","")}
                  style={{padding:"5px 11px",border:`1px solid ${!cur.answers[wno]?.bringer?RED:"#ddd"}`,borderRadius:18,fontSize:12,fontWeight:!cur.answers[wno]?.bringer?700:400,background:!cur.answers[wno]?.bringer?RED:"#fff",color:!cur.answers[wno]?.bringer?"#fff":"#666",cursor:"pointer"}}>없음</button>
                {cur.participants.map(pp=>(
                  <button key={pp} onClick={()=>updateAnswer(wno,"bringer",pp)}
                    style={{padding:"5px 11px",border:`1px solid ${cur.answers[wno]?.bringer===pp?RED:"#ddd"}`,borderRadius:18,fontSize:12,fontWeight:cur.answers[wno]?.bringer===pp?700:400,background:cur.answers[wno]?.bringer===pp?RED:"#fff",color:cur.answers[wno]?.bringer===pp?"#fff":"#666",cursor:"pointer"}}>{pp}</button>
                ))}
              </div>
            </div>
          )}

          {isBringer && (
            <div style={{...CS,background:"#FBF4E4",border:`1px solid ${GOLD}40`}}>
              <div style={{fontSize:13,fontWeight:700,color:"#7a5c10",marginBottom:4}}>🍾 이 와인을 가져오셨네요</div>
              <div style={{fontSize:12,color:TH.T3}}>출제자는 추측 없이 시음 평가만 작성합니다.</div>
            </div>
          )}
          {!isBringer && (
          <div style={CS}>
            {/* 참가자 레벨 배지 */}
            {(()=>{ const lv=(cur.participantLevels||{})[p_]||"expert"; return (
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:700,color:TH.T2}}>🔍 추론</div>
                <span style={{fontSize:11,padding:"2px 8px",borderRadius:10,background:lv==="beginner"?"#DCFCE7":lv==="standard"?"#FEF3C7":"#FDF1F2",color:lv==="beginner"?"#166534":lv==="standard"?"#92400E":RED,fontWeight:600}}>
                  {PARTICIPANT_LEVELS[lv]?.label||"🎯 Expert"}
                </span>
              </div>
            ); })()}
            {/* 공통: 국가 */}
            <GCountry country={gval("country")} onChange={updateGuess} TH={TH} IST={IST} />
            {/* 레벨별 필드 표시 */}
            {(()=>{
              const lv=(cur.participantLevels||{})[p_]||"expert";
              const fields=PARTICIPANT_LEVELS[lv]?.fields||PARTICIPANT_LEVELS.expert.fields;
              const depthAns=cur.answers[wno_]||{};
              const showRegion=fields.includes("region")&&(!depthAns.depth||depthAns.depth==="region"||depthAns.depth==="village");
              const showVillage=fields.includes("village")&&(!depthAns.depth||depthAns.depth==="village");
              return (<>
                {showRegion&&<GRegion country={gval("country")} region={gval("region")} onChange={updateGuess} TH={TH} IST={IST} setBottomSheet={setBottomSheet} setBsSearch={setBsSearch} />}
                {showVillage&&<GVillage country={gval("country")} region={gval("region")} village={gval("village")} onChange={updateGuess} TH={TH} setBottomSheet={setBottomSheet} setBsSearch={setBsSearch} />}
                {showVillage&&(
                  <div style={{marginBottom:10}}>
                    <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>등급</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {(()=>{const r=gval("region");const al=REGION_CLASSES[r]||DEFAULT_CLASSES;const bl={regional:"레지오날",village:"빌라주",premiercru:"1er Cru",grandcru:"그랑크뤼",other:"기타"};const bx={regional:"일반 AOP",village:"크뤼 부르주아",premiercru:"크뤼 클라쎄",grandcru:"그랑 크뤼 클라쎄",other:"기타"};const rj={regional:"Rioja",village:"크리안사",premiercru:"레세르바",grandcru:"그란 레세르바",other:"기타"};const lm=r==="보르도"?bx:r==="리오하"?rj:bl;return al.map(v=>[v,lm[v]||v]);})().map(([v,l])=>(
                        <button key={v} onClick={()=>updateGuess("classification",v==="other"?"기타":v)}
                          style={{padding:"6px 12px",border:`1px solid ${gval("classification")===v?RED:TH.BD}`,borderRadius:18,fontSize:13,fontWeight:gval("classification")===v?700:400,background:gval("classification")===v?RED:TH.CARD,color:gval("classification")===v?"#fff":TH.T2,cursor:"pointer"}}>{l}</button>
                      ))}
                    </div>
                  </div>
                )}
                <GGrape grape={gval("grape")} region={gval("region")} onChange={updateGuess} TH={TH} />
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>빈티지 추정
                    <span style={{fontWeight:400,color:TH.T3,fontSize:10}}> (±{PARTICIPANT_LEVELS[lv]?.vintageTol||1}년)</span>
                  </div>
                  <input value={gval("vintage")} onChange={e=>updateGuess("vintage",e.target.value)}
                    type="number" inputMode="numeric" min="1900" max="2030" placeholder="예: 2019" style={{...IST,width:120}}/>
                </div>
                <div style={{marginBottom:10,paddingTop:10,borderTop:`1px dashed ${TH.BD}`}}>
                  <div style={{fontSize:11,fontWeight:700,color:RED,marginBottom:8}}>🎯 시음 지표 <span style={{fontWeight:400,color:TH.T3}}>(톡톡 입력 — 추론 근거)</span></div>
                  <WsetScale label="🍋 산도" opts={WSET_SCALE.acidity} value={gval("acidity")} onChange={v=>updateGuess("acidity",v)} TH={TH} RED={RED}/>
                  <WsetScale label="🍷 타닌" opts={WSET_SCALE.tannin} value={gval("tannin")} onChange={v=>updateGuess("tannin",v)} TH={TH} RED={RED}/>
                  <WsetScale label="💪 바디" opts={WSET_SCALE.body} value={gval("body")} onChange={v=>updateGuess("body",v)} TH={TH} RED={RED}/>
                  <WsetAroma groups={WSET_AROMA}
                    value={(gval("aromas")||"").split(",").map(s=>s.trim()).filter(Boolean)}
                    onChange={arr=>updateGuess("aromas",arr.join(", "))} TH={TH} RED={RED}/>
                </div>
                <div style={{marginBottom:0}}>
                  <div style={{fontSize:11,fontWeight:600,color:RED,marginBottom:4}}>💭 이렇게 픽한 이유 <span style={{fontWeight:400,color:TH.T3}}>(선택)</span></div>
                  <textarea value={cur.guesses[p_]?.[wno_]?.reason||""} onChange={e=>updateGuess("reason",e.target.value)}
                    placeholder="예: 높은 산도와 미네랄, 환원 뉘앙스 → 부르고뉴 샤르도네"
                    rows={3} style={{width:"100%",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"7px 10px",fontSize:12,outline:"none",resize:"vertical",boxSizing:"border-box",background:TH.INP,color:TH.T1}}/>
                </div>
              </>);
            })()}
          </div>
          )}

          {/* Tasting eval — everyone incl. bringer */}
          <div style={CS}>
            <div style={{fontSize:13,fontWeight:700,color:TH.T2,marginBottom:12}}>🍷 시음 평가</div>
            {isBringer && (
              <div style={{marginBottom:10}}>
                <div style={{fontSize:11,fontWeight:600,color:RED,marginBottom:4}}>💬 메모 (자유)</div>
                <textarea value={cur.guesses[p]?.[wno]?.reason||""} onChange={e=>updateGuess("reason",e.target.value)}
                  placeholder="이 와인을 고른 이유, 시음 소감 등"
                  rows={3} style={{width:"100%",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"8px 10px",fontSize:13,outline:"none",boxSizing:"border-box",lineHeight:1.5,resize:"vertical"}}/>
              </div>
            )}
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{fontSize:11,fontWeight:600,color:TH.T2}}>내 점수</div>
              <input type="number" min="0" max="100" value={cur.guesses[p]?.[wno]?.score||""} onChange={e=>updateGuess("score",e.target.value)}
                placeholder="0-100" style={{width:90,border:`1px solid ${TH.BD}`,borderRadius:6,padding:"7px 10px",fontSize:13,outline:"none"}}/>
            </div>
          </div>

          {/* Navigation */}
          <div style={{display:"flex",gap:8}}>
            {!(wineIdx===0&&pIdx===0)&&(
              <button onClick={()=>{
                if(pIdx>0)setPIdx(pIdx-1);
                else{setWineIdx(wineIdx-1);setPIdx(guessers.length-1);}
              }} style={{flex:1,background:"#fff",border:`1px solid ${TH.BD}`,borderRadius:10,padding:"12px",fontSize:14,color:TH.T2,cursor:"pointer"}}>← 이전</button>
            )}
            {!(lastWine&&lastP)?(
              <button onClick={()=>{
                if(!lastP)setPIdx(pIdx+1);
                else{setWineIdx(wineIdx+1);setPIdx(0);}
              }} style={{flex:2,background:RED,color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer"}}>
                {lastP?`다음 와인 (#${wno+1}) →`:`다음: ${guessers[pIdx+1]} →`}
              </button>
            ):(
              <button onClick={()=>{
                if(cur.answerMode==="prefill"){finishSession();}
                else{setView("reveal");}
              }} style={{flex:2,background:GOLD,color:"#fff",border:"none",borderRadius:10,padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer"}}>
                {cur.answerMode==="prefill"?"✓ 입력 완료 → 채점 결과":"✓ 입력 완료 → 정답 공개"}
              </button>
            )}
          </div>
        </div>
        {/* 바텀시트 */}
        <BottomSheet config={bottomSheet} search={bsSearch} onSearch={setBsSearch}
          onSelect={v=>{
            if(bottomSheet?.field==="region"){updateGuess("region",v);updateGuess("village","");}
            else if(bottomSheet?.field==="village"){updateGuess("village",v);}
            setBottomSheet(null);setBsSearch("");
          }}
          onClose={()=>{setBottomSheet(null);setBsSearch("");}}/>
      </div>
    );
  }

  // ════ REVEAL VIEW (enter answers) ════
  if(view==="reveal"&&cur) {
    return (
      <div style={{minHeight:"100vh",background:TH.BG,fontFamily:"system-ui,sans-serif"}}>
        <div style={{background:GOLD,color:"#fff",padding:"16px 18px",display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setView("taste")} style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer"}}>←</button>
          <span style={{fontSize:17,fontWeight:700}}>🎉 정답 입력</span>
        </div>
        <div style={{padding:16,maxWidth:640,margin:"0 auto"}}><datalist id="dl-all-regions">{Object.values(WINE_ORIGINS).flatMap(rg=>Object.keys(rg)).map(r=><option key={r} value={r}/>)}</datalist><datalist id="dl-villages">{[...new Set(Object.values(WINE_ORIGINS).flatMap(rg=>Object.values(rg).flat()))].map(v=><option key={v} value={v}/>)}</datalist><datalist id="dl-grapes">{GRAPE_LIST.map(g=><option key={g} value={g}/>)}</datalist>
          <div style={{fontSize:12,color:TH.T2,marginBottom:14,textAlign:"center"}}>각 와인의 실제 정보를 입력하세요. 셀러에서 선택하거나 직접 입력 가능합니다.</div>
          {Array.from({length:cur.wineCount}).map((_,i)=>{
            const wno=i+1, ans=cur.answers[wno]||{};
            return (
              <div key={wno} style={CS}>
                <div style={{fontSize:16,fontWeight:800,color:RED,marginBottom:12}}>#{wno}</div>
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>와인 이름</div>
                  <input value={ans.nameKR||""} onChange={e=>updateAnswer(wno,"nameKR",e.target.value)} placeholder="예: 오퍼스 원, 샤토 마고"
                    style={{width:"100%",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"7px 10px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
                {(()=>{const {ACountry,ARegion,AVillage,AClassification,AGrape,AVintage}=makeAnswerComponents(wno); return(<>{ACountry()}{ARegion()}{AVillage()}{AClassification()}{AGrape()}{AVintage()}</>);})()}
                <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:5}}>가져온 사람 (출제자)</div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                  <button onClick={()=>updateAnswer(wno,"bringer","")}
                    style={{padding:"5px 11px",border:`1px solid ${!ans.bringer?RED:"#ddd"}`,borderRadius:18,fontSize:12,fontWeight:!ans.bringer?700:400,background:!ans.bringer?RED:"#fff",color:!ans.bringer?"#fff":"#666",cursor:"pointer"}}>없음</button>
                  {cur.participants.map(pp=>(
                    <button key={pp} onClick={()=>updateAnswer(wno,"bringer",pp)}
                      style={{padding:"5px 11px",border:`1px solid ${ans.bringer===pp?RED:"#ddd"}`,borderRadius:18,fontSize:12,fontWeight:ans.bringer===pp?700:400,background:ans.bringer===pp?RED:"#fff",color:ans.bringer===pp?"#fff":"#666",cursor:"pointer"}}>{pp}</button>
                  ))}
                </div>
                <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:5}}>채점 목표 <span style={{fontWeight:400,color:TH.T3}}>(어디까지 맞혀야 만점)</span></div>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {[["country","국가까지"],["region","지역까지"],["village","마을까지"],["full","전체(품종·등급·빈티지)"]].map(([dv,dl])=>{
                    const d=ans.depth||"full";
                    return (
                      <button key={dv} onClick={()=>updateAnswer(wno,"depth",dv)}
                        style={{padding:"5px 11px",border:`1px solid ${d===dv?"#7a5c10":"#ddd"}`,borderRadius:18,fontSize:12,fontWeight:d===dv?700:400,background:d===dv?"#FBF4E4":"#fff",color:d===dv?"#7a5c10":"#666",cursor:"pointer"}}>{dl}</button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <button onClick={finishSession} style={{width:"100%",background:RED,color:"#fff",border:"none",borderRadius:12,padding:"14px",fontSize:15,fontWeight:700,cursor:"pointer"}}>
            결과 보기 →
          </button>
        </div>
      </div>
    );
  }


  async function runQualEval(active, onSaveSessions) {
    if(!geminiKey){ toast("⚙️ Gemini API 키를 먼저 설정해주세요","error"); return null; }
    const qr=active?.rubric?.qualRatio||0;
    if(qr===0){ toast("세션 설정에서 AI 정성 평가 비율을 설정해주세요","warn"); return null; }

    setQualLoading(true);
    try {
      const updated={...active, guesses:JSON.parse(JSON.stringify(active.guesses||{}))};
      let totalEvaluated=0;

      for(let i=0; i<active.wineCount; i++){
        const wno=i+1;
        const ans=active.answers[wno]||{};
        if(!(ans.region||ans.grapeVariety)) continue;

        const batchTargets=[];
        for(const p of active.participants){
          if(ans.bringer===p) continue;
          const g=active.guesses[p]?.[wno]||{};
          if((g.village||"").trim()||g.reason?.trim()){
            batchTargets.push({...g, participantName:p});
          }
        }
        if(batchTargets.length===0) continue;

        const batchResult=await callGeminiForBatchWines(geminiKey, ans, batchTargets);
        totalEvaluated++;

        if(batchResult){
          for(const p of batchTargets.map(t=>t.participantName)){
            const res=batchResult[p];
            if(!res) continue;
            const patch={...(updated.guesses[p]?.[wno]||{})};
            if(res.village_level){
              patch.villageAILevel=res.village_level;
              patch.villageNote=res.village_note||"";
            }
            if(res.aroma!==undefined){
              const a=Math.max(0,Math.min(8,res.aroma));
              const s=Math.max(0,Math.min(12,res.structure));
              const l=Math.max(0,Math.min(10,res.logic));
              patch.aroma=a; patch.structure=s; patch.logic=l;
              patch.qualScore=Math.round((a+s+l)/QUAL_MAX*100);
              patch.qualFeedback=res.feedback||"";
            }
            if(!updated.guesses[p]) updated.guesses[p]={};
            updated.guesses[p][wno]=patch;
          }
        }
        if(i<active.wineCount-1) await new Promise(r=>setTimeout(r,2000));
      }

      if(totalEvaluated===0){
        toast("평가할 내용이 없습니다 — 참가자 추론 입력 필요","warn");
        return null;
      }
      onSaveSessions([updated,...sessions.filter(s=>s.id!==updated.id)]);
      try { sessionStorage.setItem("bt-active", JSON.stringify(updated)); } catch(e) {}
      toast("✅ AI 채점이 완료되었습니다!","info");
      return updated;
    } catch(err){
      toast("AI 채점 오류: "+err.message,"error",5000);
      return null;
    } finally {
      setQualLoading(false);
    }
  }

  // ════ SUMMARY VIEW ════
  if(view==="summary"&&cur) {
    // Compute average scores per wine
    const wineScores={};
    Array.from({length:cur.wineCount}).forEach((_,i)=>{
      const wno=i+1, scores=[];
      cur.participants.forEach(p=>{const s=parseFloat(cur.guesses[p]?.[wno]?.score);if(!isNaN(s))scores.push(s);});
      wineScores[wno]=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null;
    });
    const ranked=Object.entries(wineScores).filter(([,v])=>v!==null).sort((a,b)=>b[1]-a[1]);

    return (
      <div style={{minHeight:"100vh",background:TH.BG,fontFamily:"system-ui,sans-serif"}}>
        <div style={{background:RED,color:"#fff",padding:"16px 18px",display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer"}}>←</button>
          {editingNameId===cur.id ? (
            <div style={{display:"flex",gap:6,flex:1}}>
              <input value={editingNameVal} onChange={e=>setEditingNameVal(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")renameSession(cur.id,editingNameVal);if(e.key==="Escape")setEditingNameId(null);}}
                autoFocus style={{flex:1,border:"1px solid rgba(255,255,255,.5)",borderRadius:6,padding:"4px 8px",fontSize:15,background:"rgba(255,255,255,.15)",color:"#fff",outline:"none"}}/>
              <button onClick={()=>renameSession(cur.id,editingNameVal)}
                style={{background:"rgba(255,255,255,.2)",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:12,cursor:"pointer"}}>저장</button>
            </div>
          ) : (
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:17,fontWeight:700}}>{cur.name}</span>
              <button onClick={()=>{setEditingNameId(cur.id);setEditingNameVal(cur.name);}}
                style={{background:"none",border:"none",color:"rgba(255,255,255,.6)",fontSize:13,cursor:"pointer",padding:0}}>✏️</button>
            </div>
          )}
        </div>
        <div style={{padding:16,maxWidth:640,margin:"0 auto"}}>
          {/* Ranking */}
          {/* Session Photos */}
          <div style={CS}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:700,color:TH.T2}}>📷 세션 사진</div>
              <span style={{fontSize:11,color:TH.T3}}>{(cur.photos||[]).length}장</span>
            </div>
            <SessionPhotos
              photos={cur.photos||[]}
              onAdd={addSessionPhoto}
              onDelete={deleteSessionPhoto}
            />
            {(cur.photos||[]).length===0&&(
              <div style={{fontSize:12,color:TH.T3,textAlign:"center",padding:"8px 0"}}>
                와인 사진, 모임 사진을 추가해보세요
              </div>
            )}
          </div>

          {ranked.length>0&&(
            <div style={CS}>
              <div style={{fontSize:13,fontWeight:700,color:TH.T2,marginBottom:10}}>🏆 와인 순위 (평균 점수)</div>
              {ranked.map(([wno,sc],i)=>{
                const ans=cur.answers[wno]||{};
                return (
                  <div key={wno} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px solid ${TH.BD}`}}>
                    <span style={{fontSize:15,fontWeight:700,color:i===0?GOLD:"#aaa",width:28}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600}}>#{wno} {ans.nameKR||ans.nameEN||"(미입력)"}</div>
                      {ans.region&&<div style={{fontSize:11,color:TH.T3}}>{ans.region}{ans.vintage?` · ${ans.vintage}`:""}</div>}
                    </div>
                    <div style={{fontSize:17,fontWeight:700,color:GOLD}}>{sc}</div>
                  </div>
                );
              })}
            </div>
          )}


          {/* ── 채점 기준 공개 ── */}
          <div style={{marginBottom:10,textAlign:"right"}}>
            <button onClick={()=>setShowRubric(v=>!v)}
              style={{background:"none",border:`1px solid ${TH.BD}`,borderRadius:8,padding:"5px 12px",fontSize:11,color:TH.T2,cursor:"pointer"}}>
              📋 채점 기준 {showRubric?"숨기기":"보기"}
            </button>
          </div>
          {showRubric&&(
            <div style={{...CS,background:TH.CARD2,fontSize:11,lineHeight:1.6,marginBottom:10}}>
              <div style={{fontWeight:700,fontSize:12,marginBottom:8,color:TH.T1}}>📋 이 세션 채점 기준</div>
              <div style={{marginBottom:8}}>
                <div style={{fontWeight:600,color:TH.T2,marginBottom:2}}>🔢 정량 채점 · {Math.round((1-(cur.rubric?.qualRatio||0))*100)}%</div>
                <div style={{color:TH.T2}}>
                  {Object.entries(cur.rubric?.weights||DEFAULT_RUBRIC.weights).filter(([,w])=>w>0)
                    .map(([k,w])=>`${({country:"국가",region:"지역",village:"마을",classification:"등급",grape:"품종",vintage:"빈티지"})[k]}×${w}`).join(" · ")}
                </div>
                <div style={{color:TH.T3,marginTop:1}}>빈티지 ±{cur.rubric?.vintageTol??2}년 근접 허용 · 근접 점수 {Math.round((cur.rubric?.closeRatio??0.5)*100)}%</div>
              </div>
              <div style={{marginBottom:8}}>
                <div style={{fontWeight:600,color:TH.T2,marginBottom:2}}>🤖 마을 AI 의미 판정 (AI 실행 시)</div>
                <div style={{color:TH.T2}}>동일 서브리전 내 인접 마을만 근접 처리</div>
                <div style={{color:TH.T3}}>예) 코트드뉘 인접 마을 → 근접 / 코트드뉘↔코트드본 → 오답</div>
              </div>
              {(cur.rubric?.qualRatio||0)>0&&(
                <div>
                  <div style={{fontWeight:600,color:TH.T2,marginBottom:4}}>🤖 AI 정성 평가 · {Math.round((cur.rubric?.qualRatio||0)*100)}%</div>
                  {[["향 묘사 해상도","8점","1차·2차·3차 향 세밀도, 정답 와인 핵심 마커 포착"],
                    ["구조감·텍스처","12점","산도·타닌·바디·피니시 텍스처까지 묘사 (가장 중요)"],
                    ["논리 정합성","10점","묘사→결론 논리. 타당한 오답은 만점 가능"]
                  ].map(([t,pt,d])=>(
                    <div key={t} style={{marginBottom:4}}>
                      <span style={{fontWeight:600,color:TH.T2}}>{t}</span>
                      <span style={{color:"#2E7D32",marginLeft:4,fontWeight:600}}>{pt}</span>
                      <div style={{color:TH.T3,paddingLeft:4}}>→ {d}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{...CS,background:"linear-gradient(135deg,#FBF4E4,#fff5f5)"}}>
            {cur?.accessCode&&(
          <div style={{background:"rgba(255,255,255,.15)",padding:"6px 12px",fontSize:12,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{color:"rgba(255,255,255,.7)"}}>초대 코드</span>
            <span style={{fontWeight:800,letterSpacing:3,fontSize:16,color:"#fff"}}>{cur?.accessCode}</span>
            <button onClick={()=>{
              const url = `${window.location.origin}?join=${cur?.accessCode}`;
              if(navigator.share){navigator.share({title:"블라인드 테이스팅 참여",url});}
              else{navigator.clipboard?.writeText(url).then(()=>toast("링크 복사됨!","info")).catch(()=>alert(url));}
            }} style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",borderRadius:6,padding:"3px 8px",fontSize:11,cursor:"pointer"}}>
              🔗 공유
            </button>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:TH.T2}}>채점 방식</div>
                <div style={{fontSize:11,color:TH.T2,marginTop:2}}>
                  {cur.rubric?.qualRatio>0
                    ? `정량 ${Math.round((1-(cur.rubric?.qualRatio||0))*100)}% + AI(마을 의미판정+정성) ${Math.round((cur.rubric?.qualRatio||0)*100)}%`
                    : "정량 100% (AI 정성 평가 미사용)"}
                </div>
              </div>
              {cur.rubric?.qualRatio>0&&(
                <button onClick={()=>{
                  runQualEval(active,onSaveSessions)
                    .then(u=>{ if(u) setActive(u); })
                    .catch(err=>{ console.error("AI 채점 오류:", err); alert("오류: "+err.message); });
                }} disabled={qualLoading}
                  style={{background:qualLoading?"#ccc":RED,color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",fontSize:13,fontWeight:600,cursor:qualLoading?"default":"pointer"}}>
                  {qualLoading?"🤖 평가 중...":"🤖 AI 채점 실행"}
                </button>
              )}
            </div>
            {qualLoading&&<div style={{fontSize:11,color:TH.T3,marginTop:8}}>참가자별 추론을 Gemini가 분석 중입니다... 잠시 기다려주세요.</div>}
            {!cur.rubric?.qualRatio&&<div style={{fontSize:11,color:TH.T3,marginTop:4}}>± 버튼으로 출제자가 점수 보정 가능 (예: 마이너 산지 근접 가점)</div>}
          </div>
          {/* Per-wine comparison with scoring */}
          {Array.from({length:cur.wineCount}).map((_,i)=>{
            const wno=i+1, ans=cur.answers[wno]||{};
            // Compute scores for each participant (skip host's own wine in prefill)
            const scored=cur.participants.map(p=>{
              const g=cur.guesses[p]?.[wno]||{};
              const isBringerHere=(ans.bringer===p);
              const hasGuess=g.country||g.region||g.grape||g.vintage||g.village;
              if(isBringerHere) return {p, g, bringer:true};   // 출제자: 점수/메모만, 추측 채점 제외
              if(!hasGuess) return {p, skip:true};
              return {p, g, score:scoreGuessVsAnswer(g, ans, cur.rubric, ans.depth, g.villageAILevel, (cur.participantLevels||{})[p])};
            });
            // Rank by score for this wine
            const validScored=scored.filter(s=>!s.skip&&s.score);
            const bestPct=validScored.length?Math.max(...validScored.map(s=>s.score.pct)):0;
            return (
              <div key={wno} style={{...CS,position:"relative",overflow:"hidden"}}>
                {/* 언박싱 오버레이 — 아직 공개 안 한 와인 */}
                {!unboxed.has(wno)&&(
                  <div onClick={()=>{
                    setUnboxed(prev=>new Set([...prev,wno]));
                    // 내 점수 확인해서 폭죽 여부 결정
                    const myGuess=cur.guesses[cur.participants[0]]?.[wno]||{};
                    const myScore=scoreGuessVsAnswer(myGuess,ans,cur.rubric,ans.depth,myGuess.villageAILevel,(cur.participantLevels||{})[cur.participants[0]]);
                    fireConfetti(myScore.pct>=60);
                  }}
                    style={{position:"absolute",inset:0,zIndex:10,backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",background:"rgba(139,38,53,.15)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",borderRadius:12}}>
                    <div style={{fontSize:36,marginBottom:8}}>🍷</div>
                    <div style={{fontSize:16,fontWeight:800,color:RED,marginBottom:4}}>#{wno} 와인</div>
                    <div style={{fontSize:13,color:"#555",background:"rgba(255,255,255,.8)",borderRadius:20,padding:"8px 20px",fontWeight:600}}>
                      탭하여 결과 공개 ✨
                    </div>
                  </div>
                )}
                <div style={{fontSize:15,fontWeight:800,color:RED,marginBottom:4}}>#{wno} {ans.nameKR||ans.nameEN||""}</div>
                {(ans.region||ans.grapeVariety||ans.vintage||ans.classification)&&(
                  <div style={{background:"#FBF4E4",borderRadius:8,padding:"8px 10px",marginBottom:10,fontSize:12,color:"#7a5c10"}}>
                    <div>✓ 정답: {[ans.country,ans.region,ans.subRegion||ans.vineyard,ans.classification,ans.grapeVariety,ans.vintage].filter(Boolean).join(" · ")}</div>
                    {ans.depth&&ans.depth!=="full"&&<div style={{fontSize:11,color:"#a8862a",marginTop:3}}>🎯 채점 목표: {({country:"국가까지",region:"지역까지",village:"마을까지"})[ans.depth]}</div>}
                  </div>
                )}
                {scored.map(({p,g,score,skip,bringer})=>{
                  if(bringer) return (
                    <div key={p} style={{borderLeft:`3px solid ${GOLD}`,paddingLeft:10,marginBottom:10,background:"#FBF8F0",borderRadius:"0 6px 6px 0",padding:"6px 10px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontSize:12,fontWeight:700,color:"#7a5c10"}}>🍾 {p} <span style={{fontWeight:400,fontSize:11}}>(가져온 사람)</span></span>
                        {g.score&&<span style={{fontSize:13,fontWeight:700,color:GOLD}}>{g.score}점</span>}
                      </div>
                      {g.reason&&<div style={{fontSize:11,color:TH.T2,fontStyle:"italic",lineHeight:1.4,marginTop:3}}>💬 {g.reason}</div>}
                    </div>
                  );
                  if(skip) return (
                    <div key={p} style={{borderLeft:"3px solid #eee",paddingLeft:10,marginBottom:10}}>
                      <span style={{fontSize:12,fontWeight:700,color:TH.T3}}>{p}</span>
                      <span style={{fontSize:11,color:TH.T3,marginLeft:6}}>미입력</span>
                    </div>
                  );
                  const isWinner=score.pct===bestPct&&bestPct>0;
                  const Tag=({lvl,label})=>(
                    <span style={{fontSize:10,background:LVL[lvl.level].bg,color:LVL[lvl.level].c,borderRadius:4,padding:"1px 6px",fontWeight:600,marginRight:4,marginBottom:3,display:"inline-block"}}>
                      {label}{lvl.level==="exact"?" ✓":lvl.level==="close"?" ~":lvl.level==="miss"?" ✗":""}
                    </span>
                  );
                  return (
                    <div key={p} style={{borderLeft:`3px solid ${isWinner?GOLD:(p===cur.participants[0]?RED:"#2E7D32")}`,paddingLeft:10,marginBottom:12,background:isWinner?"#FFFBF0":"transparent",borderRadius:isWinner?"0 6px 6px 0":0,padding:isWinner?"6px 10px":"0 0 0 10px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <span style={{fontSize:12,fontWeight:700,color:TH.T1}}>{isWinner?"👑 ":""}{p}{g.score?` · 시음 ${g.score}점`:""}</span>
                        {score&&(()=>{
                          const adj=g.adjust||0;
                          const quantPct=Math.max(0,Math.min(100,score.pct+adj));
                          const qr=cur.rubric?.qualRatio||0;
                          const hasQual=g.qualScore!==undefined&&qr>0;
                          const finalPct=hasQual
                            ? Math.round(quantPct*(1-qr)+g.qualScore*qr)
                            : quantPct;
                          return (
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <button onClick={()=>adjustScore(p,wno,-5)} style={{width:22,height:22,borderRadius:"50%",border:`1px solid ${TH.BD}`,background:"#fff",color:TH.T3,fontSize:13,cursor:"pointer",lineHeight:1,padding:0}}>−</button>
                              <div style={{textAlign:"center",minWidth:60}}>
                                <div style={{fontSize:14,fontWeight:700,color:finalPct>=60?"#2E7D32":finalPct>=30?"#92400E":"#991B1B"}}>{finalPct}%</div>
                                <div style={{fontSize:10,color:scoreLabel(finalPct).color,fontWeight:600}}>{scoreLabel(finalPct).emoji} {scoreLabel(finalPct).label}</div>
                                {hasQual&&(
                                  <div style={{fontSize:9,color:TH.T3,lineHeight:1.4}}>
                                    정량{quantPct}·AI{g.qualScore}
                                  </div>
                                )}
                                {!hasQual&&adj!==0&&<div style={{fontSize:9,color:TH.T3}}>{adj>0?"+":""}{adj} 보정</div>}
                              </div>
                              <button onClick={()=>adjustScore(p,wno,5)} style={{width:22,height:22,borderRadius:"50%",border:`1px solid ${TH.BD}`,background:"#fff",color:TH.T3,fontSize:13,cursor:"pointer",lineHeight:1,padding:0}}>+</button>
                            </div>
                          );
                        })()}
                      </div>
                      {/* Scoring tags */}
                      <div style={{marginBottom:4}}>
                        {g.country&&<Tag lvl={score.country} label={g.country}/>}
                        {g.region&&<Tag lvl={score.region} label={g.region}/>}
                        {g.village&&(
                          <div style={{display:"inline-flex",flexDirection:"column",gap:2}}>
                            <div style={{display:"inline-flex",alignItems:"center",gap:2}}>
                              <Tag lvl={score.village} label={g.village}/>
                              {g.villageAILevel&&<span style={{fontSize:9,color:TH.T2,fontStyle:"italic"}}>🤖{g.villageNote||"AI 판정"}</span>}
                            </div>
                            {/* Village AI override buttons */}
                            {g.villageAILevel&&(
                              <div style={{display:"flex",gap:3,marginTop:1}}>
                                <span style={{fontSize:9,color:TH.T3}}>보정:</span>
                                {[["exact","정확","#2E7D32"],["close","근접",GOLD],["miss","오답","#991B1B"]].map(([lvl,lbl,col])=>(
                                  <button key={lvl} onClick={()=>overrideVillageAI(p,wno,lvl)}
                                    style={{padding:"1px 6px",border:`1px solid ${g.villageAILevel===lvl?col:"#ddd"}`,borderRadius:8,fontSize:9,fontWeight:g.villageAILevel===lvl?700:400,background:g.villageAILevel===lvl?col+"22":"#fff",color:g.villageAILevel===lvl?col:"#aaa",cursor:"pointer"}}>{lbl}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {g.classification&&<Tag lvl={score.classification} label={({regional:"지역급",village:"빌라주",premiercru:"1er",grandcru:"그랑크뤼"})[g.classification]||g.classification}/>}
                        {g.grape&&<Tag lvl={score.grape} label={g.grape}/>}
                        {g.vintage&&<Tag lvl={score.vintage} label={g.vintage}/>}
                      </div>
                      {(g.acidity||g.tannin||g.body||g.aromas)&&(
                        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>
                          {[["산",g.acidity],["탄",g.tannin],["바",g.body]].filter(([,v])=>v).map(([k,v])=>(
                            <span key={k} style={{fontSize:10,background:TH.CARD2,color:TH.T2,borderRadius:4,padding:"1px 6px"}}>{k} {v}</span>
                          ))}
                          {g.aromas&&g.aromas.split(",").map(s=>s.trim()).filter(Boolean).slice(0,4).map((a,i)=>(
                            <span key={i} style={{fontSize:10,background:"#FBF1F3",color:RED,borderRadius:4,padding:"1px 6px"}}>{a}</span>
                          ))}
                        </div>
                      )}
                      {g.reason&&<div style={{fontSize:11,color:TH.T2,fontStyle:"italic",lineHeight:1.4,marginTop:3}}>💭 {g.reason}</div>}
                      {g.qualScore!==undefined&&(
                        <div style={{marginTop:6,background:"#F0FBF0",borderRadius:6,padding:"8px 10px"}}>
                          {/* Per-criterion interactive breakdown */}
                          <div style={{marginBottom:6}}>
                            {[["향","aroma",g.aroma,8,"#7B68EE"],["구조","structure",g.structure,12,"#2E7D32"],["논리","logic",g.logic,10,"#1E6FA0"]].map(([lbl,key,sc,mx,col])=>(
                              <div key={key} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                                <span style={{fontSize:11,color:col,fontWeight:700,width:28}}>{lbl}</span>
                                <div style={{flex:1,height:6,background:"#e0e0e0",borderRadius:3,overflow:"hidden"}}>
                                  <div style={{width:`${Math.round((sc||0)/mx*100)}%`,height:"100%",background:col,transition:"width .2s"}}/>
                                </div>
                                <span style={{fontSize:11,fontWeight:700,color:col,minWidth:32,textAlign:"right"}}>{sc||0}/{mx}</span>
                                {/* ±1 adjust buttons */}
                                <button onClick={()=>adjustQualCriterion(p,wno,key,-1)}
                                  style={{width:20,height:20,borderRadius:"50%",border:`1px solid ${TH.BD}`,background:"#fff",color:TH.T3,fontSize:12,cursor:"pointer",lineHeight:1,padding:0,flexShrink:0}}>−</button>
                                <button onClick={()=>adjustQualCriterion(p,wno,key,1)}
                                  style={{width:20,height:20,borderRadius:"50%",border:`1px solid ${TH.BD}`,background:"#fff",color:TH.T3,fontSize:12,cursor:"pointer",lineHeight:1,padding:0,flexShrink:0}}>+</button>
                              </div>
                            ))}
                            <div style={{fontSize:10,color:TH.T2,textAlign:"right",marginTop:2}}>AI 종합 {g.qualScore}점 / 100</div>
                          </div>
                          {g.qualFeedback&&<div style={{fontSize:11,color:"#2E7D32",lineHeight:1.5}}>🤖 {g.qualFeedback}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Overall accuracy leaderboard */}
          {(()=>{
            const totals={};
            cur.participants.forEach(p=>{totals[p]={sum:0,n:0};});
            Array.from({length:cur.wineCount}).forEach((_,i)=>{
              const wno=i+1, ans=cur.answers[wno]||{};
              if(!(ans.region||ans.grapeVariety))return;
              cur.participants.forEach(p=>{
                if(ans.bringer===p)return; // 자기가 가져온 와인은 적중률에서 제외
                const g=cur.guesses[p]?.[wno]||{};
                if(!(g.country||g.region||g.grape||g.vintage||g.village))return;
                const s=scoreGuessVsAnswer(g,ans,cur.rubric,ans.depth,g.villageAILevel,(cur.participantLevels||{})[p]);
                const quantPct=Math.max(0,Math.min(100,s.pct+(g.adjust||0)));
                const qr=cur.rubric?.qualRatio||0;
                const finalPct=(g.qualScore!==undefined&&qr>0)
                  ? Math.round(quantPct*(1-qr)+g.qualScore*qr)
                  : quantPct;
                totals[p].sum+=finalPct; totals[p].n++;
              });
            });
            const board=Object.entries(totals).filter(([,v])=>v.n>0).map(([p,v])=>({p,avg:Math.round(v.sum/v.n),n:v.n})).sort((a,b)=>b.avg-a.avg);
            if(board.length<1)return null;
            return (
              <div style={{...CS,background:"linear-gradient(135deg,#FBF4E4,#FFF8F0)"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#7a5c10",marginBottom:10}}>🎯 추론 적중률 순위</div>
                {board.map((b,i)=>(
                  <div key={b.p} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0"}}>
                    <span style={{fontSize:15,width:28}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span>
                    <span style={{flex:1,fontSize:13,fontWeight:600}}>{b.p}</span>
                    <span style={{fontSize:11,color:TH.T3}}>{b.n}종</span>
                    <span style={{fontSize:16,fontWeight:700,color:GOLD}}>{b.avg}%</span>
                  </div>
                ))}
                <div style={{fontSize:10,color:TH.T3,marginTop:8}}>
                  채점 기준: {Object.entries(cur.rubric?.weights||{}).filter(([,w])=>w>0).map(([k,w])=>`${({country:"국가",region:"지역",village:"마을",classification:"등급",grape:"품종",vintage:"빈티지"})[k]}×${w}`).join(" · ")} · 근접 {Math.round((cur.rubric?.closeRatio??0.5)*100)}%
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  return null;
}


// ── Standalone App ───────────────────────────────────────────────
const SESSIONS_KEY = "blind-tasting-sessions";
const TASTERS_KEY = "blind-tasting-tasters";
const GROUPS_KEY = "blind-tasting-groups";

function App() {
  const [sessions, setSessions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [tasters, setTasters] = useState(["나"]);
  const [ready, setReady] = useState(false);
  const [geminiKey, setGeminiKey] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(SESSIONS_KEY);
        if (r) setSessions(JSON.parse(r.value));
      } catch (e) {}
      try {
        const t = await window.storage.get(TASTERS_KEY);
        if (t) setTasters(JSON.parse(t.value));
      } catch (e) {}
      try {
        const gr = await window.storage.get(GROUPS_KEY);
        if (gr) setGroups(JSON.parse(gr.value));
      } catch (e) {}
      try {
        const gk = await window.storage.get("blind-gemini-key");
        if (gk) setGeminiKey(gk.value);
      } catch (e) {}
      setReady(true);
    })();
  }, []);


  function saveGroups(arr) {
    setGroups(arr);
    try { window.storage.set(GROUPS_KEY, JSON.stringify(arr)); } catch(e) {}
  }
  function saveSessions(arr) {
    setSessions(arr);
    try { window.storage.set(SESSIONS_KEY, JSON.stringify(arr)); } catch (e) {}
    // Remember the latest session's participants as next session's default tasters
    const latest = arr[0];
    if (latest && Array.isArray(latest.participants) && latest.participants.length) {
      setTasters(latest.participants);
      try { window.storage.set(TASTERS_KEY, JSON.stringify(latest.participants)); } catch (e) {}
    }
  }

  if (!ready) {
    // 초대 링크로 들어온 참가자는 로딩 없이 바로 참여 화면으로
    const joinParam = new URLSearchParams(window.location.search).get("join");
    if (joinParam) {
      return (
        <BlindTastingPage
          sessions={sessions}
          onSaveSessions={(arr) => {
            setSessions(arr);
            try { window.storage.set(SESSIONS_KEY, JSON.stringify(arr)); } catch(e) {}
          }}
          groups={groups} onSaveGroups={saveGroups}
          tasters={tasters} onSaveTasters={saveTasters}
          initialView="join" initialJoinCode={joinParam}
        />
      );
    }
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:TH.T3}}>
        🍷 불러오는 중...
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <BlindTastingPage
      sessions={sessions}
      onSaveSessions={(arr) => {
        saveSessions(arr);
        // Sync updated active session to Firestore for real-time collaboration
        if(arr && arr.length > 0 && arr[0]?.accessCode) {
          sessionDB.save(arr[0]).catch(()=>{});
        }
      }}
      groups={groups}
      onSaveGroups={saveGroups}
      onBack={null}
      tasters={tasters}
      geminiKey={geminiKey}
      setGeminiKey={setGeminiKey}
    />
    </ErrorBoundary>
  );
}

export default App;
