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

const WINE_ORIGINS = {"프랑스": {"부르고뉴": ["마르사네", "픽생", "주브레샹베르탱", "모레생드니", "샹볼뮈지니", "부조", "본로마네", "뉘생조르주", "사비니레본", "알록스코르통", "본", "포마르", "볼네", "몽텔리", "오세뒤레스", "뫼르소", "퓔리니몽라셰", "샤사뉴몽라셰", "생토뱅", "상트네", "코트드뉘빌라주", "코트드본빌라주", "부르고뉴 오트 코트 드 뉘", "부르고뉴 오트 코트 드 본", "프티샤블리", "샤블리", "마콩", "생베랑", "풀리퓌세", "지브리", "메르퀴레", "뤼이"], "보르도": ["마고", "포이약", "생쥘리앵", "생테스테프", "오메독", "메독", "리스트락메독", "물리", "페삭레오냥", "그라브", "소테른", "바르삭", "생테밀리옹", "포므롤", "라랑드드포므롤", "프롱사크", "카농프롱사크"], "론": ["코트로티", "콩드리외", "샤토그리예", "생조제프", "에르미타주", "크로즈에르미타주", "코르나스", "샤토뇌프뒤파프", "지공다스", "바케라스", "뱅소브르", "라스토", "타벨", "리락"], "샹파뉴": ["몽타뉴드랭스", "발레드라마른", "코트데블랑", "코트데바르", "아이", "크라망", "아비즈"], "루아르": ["상세르", "푸이퓌메", "뮈스카데", "부브레", "몽루이", "시농", "부르괴유", "소뮈르", "소뮈르 상피니", "앙주", "사브니에르"], "알자스": ["알자스", "알자스 그랑 크뤼"], "쥐라": ["아르부아", "아르부아 풀사르", "샤토샬롱", "레투알", "크레망 뒤 쥐라"], "프로방스": ["방돌", "카시스", "레보드프로방스", "코트드프로방스"], "랑그도크루시용": ["피투", "코르비에르", "미네르부아", "포제르", "생시니앙", "피크풀 드 피네"], "남서부": ["카오르", "마디랑", "쥐랑송", "가이약", "베르주라크"], "보졸레": ["물랭아방", "플뢰리", "모르공", "쥘리에나", "시루블", "브루이", "코트드브루이", "레니에", "쉐나", "생타무르"]}, "이탈리아": {"피에몬테": ["바롤로", "바르바레스코", "바르베라 달바", "바르베라 다스티", "돌체토 달바", "랑게 네비올로", "랑게", "모스카토 다스티", "가비", "가티나라", "겜메", "로에로", "알타 랑가"], "토스카나": ["브루넬로 디 몬탈치노", "로쏘 디 몬탈치노", "키안티 클라시코", "키안티 루피나", "키안티", "비노 노빌레 디 몬테풀치아노", "로쏘 디 몬테풀치아노", "볼게리", "볼게리 사시카이아", "모렐리노 디 스칸사노", "베르나치아 디 산지미냐노", "카르미냐노", "수베레토", "IGT 토스카나"], "베네토": ["아마로네 델라 발폴리첼라", "발폴리첼라", "발폴리첼라 리파소", "레치오토 델라 발폴리첼라", "소아베", "소아베 클라시코", "바르돌리노", "프로세코"], "시칠리아": ["에트나 로쏘", "에트나 비앙코", "에트나 로사토", "체라수올로 디 비토리아", "노토", "마르살라"], "롬바르디아": ["프란치아코르타", "발텔리나 수페리오레", "루가나"], "캄파니아": ["타우라시", "피아노 디 아벨리노", "그레코 디 투포"], "아브루초": ["몬테풀치아노 다브루초", "트레비아노 다브루초"], "움브리아": ["몬테팔코 사그란티노", "몬테팔코", "오르비에토"], "프리울리": ["콜리오", "프리울리 코일 오리엔탈리", "프리울리"], "풀리아": ["프리미티보 디 만두리아", "살리체 살렌티노", "네그로아마로"], "사르데냐": ["베르멘티노 디 갈루라", "칸노나우 디 사르데냐"], "트렌티노알토아디제": ["알토 아디제", "트렌티노", "트렌토"]}, "독일": {"모젤": ["베른카스텔", "피스포르트", "벨렌", "그라하", "위르치히", "에르덴", "브라우네베르크"], "라인가우": ["뤼데스하임", "요하니스베르크", "에르바흐", "라우엔탈"], "팔츠": ["다이데스하임", "포르스트", "루퍼츠베르크", "바헨하임"], "나에": ["니더하우젠", "슐로스뵈켈하임"], "라인헤센": ["니어슈타인", "오펜하임"], "바덴": ["카이저슈툴", "오르테나우"]}, "스페인": {"리오하": ["리오하 알타", "리오하 알라베사", "리오하 오리엔탈"], "리베라 델 두에로": ["리베라 델 두에로"], "프리오라트": ["프리오라트", "몬산트"], "루에다": ["루에다"], "리아스 바이샤스": ["리아스 바이샤스", "살네스"], "카탈루냐": ["페네데스", "카바", "엠포르다"], "시에라 데 그레도스": ["시에라 데 그레도스"], "비에르소": ["비에르소"], "헤레스": ["헤레스", "만사니야"], "토로": ["토로"]}, "미국": {"캘리포니아": ["나파 밸리", "오크빌", "러더퍼드", "스택스 립", "하웰 마운틴", "칼리스토가", "소노마", "러시안 리버 밸리", "드라이 크릭 밸리", "산타 바바라", "산타 리타 힐스", "산타 루시아 하이랜즈", "파소 로블레스"], "오리건": ["윌래밋 밸리", "던디 힐스", "에올라아미티 힐스"], "워싱턴": ["컬럼비아 밸리", "왈라왈라", "레드 마운틴"]}, "호주": {"사우스오스트레일리아": ["바로사 밸리", "에덴 밸리", "맥라렌 베일", "쿠나와라", "클레어 밸리", "애들레이드 힐스"], "빅토리아": ["야라 밸리", "모닝턴 페닌술라", "히스코트"], "서호주": ["마가렛 리버"], "뉴사우스웨일스": ["헌터 밸리"], "태즈메이니아": ["태즈메이니아"]}, "뉴질랜드": {"말버러": ["말버러", "와이라우 밸리", "아와테레 밸리"], "센트럴 오타고": ["센트럴 오타고", "배녹번"], "혹스 베이": ["혹스 베이", "김블렛 그래블스"], "마틴버러": ["마틴버러"]}, "아르헨티나": {"멘도사": ["우코 밸리", "루한 데 쿠요", "마이푸", "투푼가토"], "살타": ["카파야테", "칼차키 밸리"], "파타고니아": ["리오 네그로"]}, "칠레": {"아콩카과": ["카사블랑카 밸리", "산안토니오", "아콩카과 밸리"], "센트럴 밸리": ["마이포 밸리", "카차포알", "콜차과 밸리", "쿠리코"], "비오비오": ["비오비오", "이타타"]}, "포르투갈": {"도루": ["도루", "포트"], "알렌테주": ["알렌테주", "에스트레모스", "보르바"], "다웅": ["다웅"], "바이라다": ["바이라다"], "비뉴 베르드": ["비뉴 베르드"]}, "오스트리아": {"니더외스터라이히": ["바하우", "크렘스탈", "캄프탈", "바인피어텔"], "부르겐란트": ["노이지들러제", "미텔부르겐란트"], "슈타이어마르크": ["남슈타이어마르크"]}, "남아프리카": {"웨스턴케이프": ["스텔렌보스", "파를", "프란슈후크", "스와트란트", "콘스탄시아"]}, "그리스": {"에게해": ["산토리니"], "북부그리스": ["나우사", "아민테오"], "펠로폰네소스": ["네메아"]}};
const GRAPE_CATEGORIES = {"red": ["카베르네소비뇽", "피노누아", "메를로", "시라/쉬라즈", "네비올로", "산지오베제", "템프라니요", "말벡", "그르나슈", "카베르네프랑", "무르베드르", "진판델", "바르베라", "돌체토", "코르비나", "카리냥", "프티베르도", "생소", "가메", "피노타지", "투리가나시오날", "네그로아마로", "프리미티보", "아글리아니코", "몬테풀치아노", "블라우프랭키슈"], "white": ["샤르도네", "소비뇽블랑", "리슬링", "피노그리지오", "게뷔르츠트라미너", "슈냉블랑", "비오니에", "세미용", "뮈스카", "그뤼너벨트리너", "피노블랑", "알리고테", "베르멘티노", "아시르티코", "카리칸테", "팔랑기나", "가르가네가", "코르테제", "말바지아", "뮈스카데", "마르산", "루산", "실바너"]};
const GRAPE_LIST = [...GRAPE_CATEGORIES.red, ...GRAPE_CATEGORIES.white];
const REGION_GRAPES = {"부르고뉴": ["피노누아", "샤르도네", "알리고테", "가메"], "보르도": ["카베르네소비뇽", "메를로", "카베르네프랑", "프티베르도", "세미용", "소비뇽블랑"], "론": ["시라/쉬라즈", "그르나슈", "무르베드르", "비오니에", "마르산", "루산"], "샹파뉴": ["피노누아", "샤르도네", "피노뮈니에"], "루아르": ["슈냉블랑", "소비뇽블랑", "카베르네프랑", "뮈스카데"], "알자스": ["리슬링", "게뷔르츠트라미너", "피노그리지오", "피노블랑"], "쥐라": ["사바냉", "샤르도네", "풀사르", "트루소"], "보졸레": ["가메"], "프로방스": ["그르나슈", "무르베드르", "생소", "시라/쉬라즈"], "피에몬테": ["네비올로", "바르베라", "돌체토", "모스카토"], "토스카나": ["산지오베제", "카베르네소비뇽", "메를로"], "베네토": ["코르비나", "가르가네가", "글레라"], "시칠리아": ["네렐로마스칼레제", "카리칸테", "네로다볼라", "카타라토"], "모젤": ["리슬링"], "라인가우": ["리슬링", "피노누아"], "팔츠": ["리슬링"], "리오하": ["템프라니요", "가르나차", "그라치아노"], "리베라 델 두에로": ["템프라니요"], "프리오라트": ["가르나차", "카리냥"], "리아스 바이샤스": ["알바리뇨"], "시에라 데 그레도스": ["가르나차"], "캘리포니아": ["카베르네소비뇽", "샤르도네", "피노누아", "진판델"], "오리건": ["피노누아", "샤르도네"], "사우스오스트레일리아": ["시라/쉬라즈", "카베르네소비뇽", "그르나슈", "리슬링"], "말버러": ["소비뇽블랑", "피노누아"], "센트럴 오타고": ["피노누아"], "멘도사": ["말벡", "카베르네소비뇽", "샤르도네"], "에게해": ["아시르티코"], "북부그리스": ["크시노마브로"], "도루": ["투리가나시오날", "투리가프란카"]};
const REGION_CLASSES = {"부르고뉴": ["regional", "village", "premiercru", "grandcru"], "보르도": ["other"], "샹파뉴": ["regional", "premiercru", "grandcru"], "알자스": ["regional", "grandcru"], "루아르": ["regional", "village"], "론": ["regional", "village"], "리오하": ["other"], "피에몬테": ["regional", "village"], "토스카나": ["regional", "other"]};
const DEFAULT_CLASSES = ["regional", "other"];
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

// ── callGeminiForBatchWines: 와인 1병 × 모든 참가자를 한 번에 평가 ──
// 호출 수: (참가자수 × 와인수) → 와인수만큼으로 감소
// 예) 4명 × 4병 = 16회 → 4회
async function callGeminiForBatchWines(apiKey, ans, guessesArray) {
  // guessesArray: [{name, village, reason}]
  if (!apiKey || !guessesArray?.length) return null;

  const wine = [ans.nameKR||ans.nameEN, ans.country, ans.region, ans.subRegion,
    ans.grapeVariety, ans.vintage, ans.classification].filter(Boolean).join(", ");

  // 참가자 데이터를 하나의 텍스트로 합치기
  const participantsText = guessesArray.map(g => {
    const lines = [`참가자: ${g.name}`];
    if(g.village) lines.push(`  예측 마을: ${g.village}`);
    return lines.join("\n");
  }).join("\n\n");

  const hasVillage = guessesArray.some(g => g.village && (ans.subRegion||ans.vineyard));
  const hasReason  = guessesArray.some(g => g.reason?.trim());

  const villageSection = hasVillage ? `
─── 마을/아펠라시옹 의미 판정 ───
정답 마을: "${ans.subRegion||ans.vineyard||""}"

판정 기준 (엄격히 적용):
✅ "exact": 동일 아펠라시옹 또는 표기만 다른 경우
✅ "close": 동일 서브리전 내 인접 마을만 (예: 코트드뉘 내 인접 마을)
  - 계층 관계도 close (예: 코트드뉘빌라주↔주브레샹베르탱)
❌ "miss": 다른 서브리전, 먼 거리, 국가만 같은 경우
  - 코트드뉘↔코트드본 = miss
  - 같은 품종이라는 이유만으로 close 금지
예측 마을이 없으면 "village_level": null
───────────────────────────────` : "";

  const qualSection = hasReason ? `
─── 정성 평가 루브릭 (총 30점) ───
[항목 1] 감각 묘사 해상도 — 향/부케 (0~8점)
 8점: 1차·2차·3차 향을 세밀히 분리하고 정답 와인 핵심 마커 포착
 4~7점: 지배적인 향의 계열은 올바르나 뉘앙스가 뭉뚱그려짐
 0~3점: 실제 와인과 상반된 향 묘사 또는 극히 단조로움

[항목 2] 구조감·텍스처 (0~12점) ← 가장 중요
 11~12점: 산도·타닌·바디·피니시를 텍스처 질감까지 묘사
 6~10점: 강도를 대략 알맞게 파악하고 무게감 설명
 0~5점: 정답 와인의 구조감과 명백히 다르게 테이스팅

[항목 3] 논리 정합성 (0~10점) — 오답도 구제 가능
 9~10점: 묘사→결론 논리가 완벽히 연결됨. 타당한 오답은 만점
 5~8점: 연관성 있으나 일부 논리적 비약 존재
 0~4점: 묘사와 결론이 완전히 모순
추론이 없는 참가자는 aroma/structure/logic/feedback 모두 null
───────────────────────────────` : "";

  const prompt = `당신은 WSET Diploma 수준의 와인 심사위원입니다. 마크다운 없이 순수 JSON만 반환하세요.

정답 와인: ${wine}
${villageSection}
${qualSection}

=== 평가 대상 참가자 ===
${participantsText}

모든 참가자를 동시에 평가하여 아래 JSON 형식으로 반환하세요:
{
  "results": {
    "참가자이름": {
      "village_level": "exact"|"close"|"miss"|null,
      "village_note": "한 줄 이유 또는 null",
      "aroma": 0~8 또는 null,
      "structure": 0~12 또는 null,
      "logic": 0~10 또는 null,
      "feedback": "한국어 2~3문장 또는 null"
    }
  }
}
참가자 이름을 정확히 key로 사용하세요.`;

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent",
      { method:"POST",
        headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},
        body: JSON.stringify({
          contents:[{parts:[{text:prompt}]}],
          generationConfig:{ responseMimeType:"application/json" }
        }) }
    );
    if(!r.ok) {
      const errText = await r.text();
      console.error("[Gemini] HTTP 오류:", r.status, errText);
      alert("[Gemini API 에러] HTTP " + r.status + "\n" + errText.slice(0,300));
      return null;
    }
    const d = await r.json();
    if(d.error) {
      alert("[Gemini API 에러] " + (d.error.message||JSON.stringify(d.error)));
      return null;
    }
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text||"";
    if(!text.trim()) { alert("[Gemini API 에러] 빈 응답을 받았습니다."); return null; }
    const parsed = JSON.parse(text);
    return parsed.results || null;
  } catch(e) {
    console.error("[Gemini] 예외:", e);
    alert("AI 평가 중 오류가 발생했습니다: " + e.message);
    return null;
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
function scoreGuessVsAnswer(g, ans, rubric, depth, villageOverride){
  const R = rubric || DEFAULT_RUBRIC;
  const W = R.weights || DEFAULT_RUBRIC.weights;
  const cr = R.closeRatio ?? 0.5;
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

// ── Blind Tasting Session (모임용) ────────────────────────────────
function BlindTastingPage({ sessions, onSaveSessions, groups=[], onSaveGroups, onBack, tasters, geminiKey, setGeminiKey, runQualEval, qualLoading }) {
  const [view, setView] = useState("list");
  const [grapeShowAll, setGrapeShowAll] = useState(false);
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingNameVal, setEditingNameVal] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showGroupMgr, setShowGroupMgr] = useState(false);
  const [showRubric, setShowRubric] = useState(false);    // group manager panel
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

  const [joinCode, setJoinCode] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("join") || "";
  });
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
  const [sPartyMode, setSPartyMode] = useState(false); // null = 단독
  const [sAnswerMode, setSAnswerMode] = useState("prefill"); // prefill | reveal
  const [sRubric, setSRubric] = useState(JSON.parse(JSON.stringify(DEFAULT_RUBRIC)));

  function startSetup() {
    setSName(`블라인드 ${new Date().toLocaleDateString("ko-KR",{month:"numeric",day:"numeric"})}`);
    setSCount(4); setSParts(tasters.filter(Boolean)); setSGroupId(null); setSPartyMode(false); setSAnswerMode("prefill"); setSRubric(JSON.parse(JSON.stringify(DEFAULT_RUBRIC))); setView("setup");
  }
  function createSession() {
    const parts = sParts.filter(Boolean);
    if(parts.length===0){alert("참가자를 1명 이상 추가하세요");return;}
    const s = {
      id:String(Date.now()), name:sName||"블라인드 테이스팅",
      date:new Date().toISOString(), participants:parts, wineCount:sCount,
      accessCode:genCode(),
      groupId:sGroupId, partyMode:sPartyMode, answerMode:sAnswerMode, rubric:sRubric,
      guesses:{}, answers:{}, revealed:false, answersLocked:false, createdAt:new Date().toISOString(),
    };
    parts.forEach(p=>{s.guesses[p]={};});
    setActive(s); setWineIdx(0); setPIdx(0);
    // Firestore 저장 + 실시간 리스너
    sessionDB.save(s).catch(e=>console.warn("세션 저장 실패:", e));
    if(unsubRef.current) unsubRef.current();
    unsubRef.current = sessionDB.subscribe(s.id, (latest)=>{
      setActive(latest);
    });
    setShowCodeShare(true); // 초대 코드 먼저 보여주기
    setView("list"); // 리스트 뷰로 이동 (오버레이가 거기 있음)
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

  const cur = active;
  const p_=cur?.participants?.[pIdx], wno_=wineIdx+1;
  const gval=(field)=>cur?.guesses?.[p_]?.[wno_]?.[field]||"";
  const IST={width:"100%",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"7px 10px",fontSize:13,outline:"none",boxSizing:"border-box",background:TH.INP,color:TH.T1};
  // Country dropdown
  const GCountry=()=>(
    <div style={{marginBottom:10}}>
      <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>국가</div>
      <select value={gval("country")} onChange={e=>{updateGuess("country",e.target.value);updateGuess("region","");updateGuess("village","");}} style={{...IST,background:"#fff"}}>
        <option value="">선택...</option>
        {Object.keys(WINE_ORIGINS).map(c=><option key={c} value={c}>{c}</option>)}
        <option value="__other">기타 (직접입력)</option>
      </select>
      {gval("country")==="__other"&&<input autoFocus placeholder="국가 직접 입력" onChange={e=>updateGuess("country",e.target.value)} style={{...IST,marginTop:6}}/>}
    </div>
  );
  // Region: datalist filtered by country
  const GRegion=()=>{
    const c=gval("country");
    const regions=WINE_ORIGINS[c]?Object.keys(WINE_ORIGINS[c]):[];
    return (
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>지역</div>
        <div style={{position:"relative"}}>
          <input list="dl-regions" value={gval("region")} onChange={e=>{updateGuess("region",e.target.value);updateGuess("village","");}}
            placeholder={regions.length?"입력 또는 선택":"예: 부르고뉴"} style={{...IST,paddingRight:28}}/>
          {regions.length>0&&<span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#aaa",pointerEvents:"none"}}>▾</span>}
        </div>
        <datalist id="dl-regions">{regions.map(r=><option key={r} value={r}/>)}</datalist>
      </div>
    );
  };
  // Village: datalist filtered by region (fallback all villages)
  const GVillage=()=>{
    const c=gval("country"), r=gval("region");
    let villages=[];
    if(WINE_ORIGINS[c]?.[r]) villages=WINE_ORIGINS[c][r];
    else { Object.values(WINE_ORIGINS).forEach(rg=>Object.values(rg).forEach(vs=>villages.push(...vs))); }
    return (
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>세부 마을 (선택)</div>
        <div style={{position:"relative"}}>
          <input list="dl-villages" value={gval("village")} onChange={e=>updateGuess("village",e.target.value)}
            placeholder="입력하면 자동완성" style={{...IST,paddingRight:28}}/>
          <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:12,color:"#aaa",pointerEvents:"none"}}>▾</span>
        </div>
        <datalist id="dl-villages">{[...new Set(villages)].map(v=><option key={v} value={v}/>)}</datalist>
      </div>
    );
  };
  // Grape: region-aware multi-select chips + free input
  const GGrape=()=>{
    const sel=(gval("grape")||"").split(",").map(s=>s.trim()).filter(Boolean);
    const toggle=(g)=>{
      const next=sel.includes(g)?sel.filter(x=>x!==g):[...sel,g];
      updateGuess("grape",next.join(", "));
    };
    const showAll=grapeShowAll, setShowAll=setGrapeShowAll;
    const region=gval("region");
    const regionGrapes=REGION_GRAPES[region]||null;
    const Chip=({g})=>(
      <button onClick={()=>toggle(g)} style={{padding:"5px 10px",border:`1px solid ${sel.includes(g)?RED:"#ddd"}`,borderRadius:16,fontSize:12,fontWeight:sel.includes(g)?700:400,background:sel.includes(g)?RED:"#fff",color:sel.includes(g)?"#fff":"#666",cursor:"pointer",marginBottom:4}}>{g}</button>
    );
    return (
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>품종 <span style={{fontWeight:400,color:TH.T3}}>(복수 선택 — 블렌드)</span></div>
        {sel.length>0&&<div style={{fontSize:12,color:RED,fontWeight:600,marginBottom:6}}>선택: {sel.join(", ")}</div>}
        {/* Region-recommended grapes first */}
        {regionGrapes&&!showAll&&(
          <div>
            <div style={{fontSize:10,color:GOLD,fontWeight:600,margin:"4px 0 3px"}}>⭐ {region} 대표 품종</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{regionGrapes.map(g=><Chip key={g} g={g}/>)}</div>
          </div>
        )}
        {(!regionGrapes||showAll)&&(
          <div>
            <div style={{fontSize:10,color:TH.T3,margin:"4px 0 3px"}}>🍷 레드</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{GRAPE_CATEGORIES.red.slice(0,showAll?99:8).map(g=><Chip key={g} g={g}/>)}</div>
            <div style={{fontSize:10,color:TH.T3,margin:"6px 0 3px"}}>🥂 화이트</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{GRAPE_CATEGORIES.white.slice(0,showAll?99:8).map(g=><Chip key={g} g={g}/>)}</div>
          </div>
        )}
        <div style={{display:"flex",gap:8,marginTop:6,alignItems:"center"}}>
          <button onClick={()=>setShowAll(v=>!v)} style={{background:"none",border:"none",color:TH.T3,fontSize:11,cursor:"pointer",padding:0,textDecoration:"underline"}}>{showAll?"접기":(regionGrapes?"전체 품종 보기":"더 많은 품종")}</button>
          <input list="dl-grapes" placeholder="직접 입력 후 Enter" onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){toggle(e.target.value.trim());e.target.value="";}}}
            style={{flex:1,border:`1px solid ${TH.BD}`,borderRadius:6,padding:"5px 8px",fontSize:12,outline:"none",minWidth:0}}/>
          <datalist id="dl-grapes">{GRAPE_LIST.map(g=><option key={g} value={g}/>)}</datalist>
        </div>
      </div>
    );
  };
  // Plain field (vintage)
  const G = ({label,field,ph})=>(
    <div style={{marginBottom:10}}>
      <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>{label}</div>
      <input value={gval(field)} onChange={e=>updateGuess(field,e.target.value)} placeholder={ph} style={IST}/>
    </div>
  );

  // ── 정답 입력 컴포넌트 팩토리 (출제자용 — 참가자 추측과 동일 UX) ────
  const makeAnswerComponents = (wno) => {
    const ans = cur?.answers?.[wno] || {};
    const upd = (field, val) => updateAnswer(wno, field, val);
    const ISTA = {width:"100%",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"7px 10px",fontSize:13,outline:"none",boxSizing:"border-box"};

    const ACountry = () => (
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>국가</div>
        <select value={ans.country||""} onChange={e=>{upd("country",e.target.value);upd("region","");upd("subRegion","");}} style={{...ISTA,background:"#fff"}}>
          <option value="">선택...</option>
          {Object.keys(WINE_ORIGINS).map(cc=><option key={cc} value={cc}>{cc}</option>)}
        </select>
      </div>
    );

    const ARegion = () => {
      const regions = WINE_ORIGINS[ans.country] ? Object.keys(WINE_ORIGINS[ans.country]) : [];
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
        || [...new Set(Object.values(WINE_ORIGINS).flatMap(rg=>Object.values(rg).flat()))];
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
      const allCls = {regional:"지역급",village:"빌라주",premiercru:"1er Cru",grandcru:"그랑크뤼",other:"기타"};
      const allowed = REGION_CLASSES[ans.region] || DEFAULT_CLASSES;
      return (
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>
            등급{ans.region&&REGION_CLASSES[ans.region]&&<span style={{fontWeight:400,color:TH.T3,fontSize:10}}> · {ans.region} 체계</span>}
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {allowed.map(v=>(
              <button key={v} onClick={()=>upd("classification",v==="other"?"기타":v)}
                style={{padding:"6px 11px",border:`1px solid ${ans.classification===v?RED:"#ddd"}`,borderRadius:18,fontSize:12,fontWeight:ans.classification===v?700:400,background:ans.classification===v?RED:"#fff",color:ans.classification===v?"#fff":"#666",cursor:"pointer"}}>
                {allCls[v]}
              </button>
            ))}
          </div>
        </div>
      );
    };

    const AGrape = () => {
      const sel = (ans.grapeVariety||"").split(",").map(s=>s.trim()).filter(Boolean);
      const toggle = (g) => {const next=sel.includes(g)?sel.filter(x=>x!==g):[...sel,g]; upd("grapeVariety",next.join(", "));};
      const regionGrapes = REGION_GRAPES[ans.region] || null;
      const Chip = ({g}) => (
        <button onClick={()=>toggle(g)} style={{padding:"5px 10px",border:`1px solid ${sel.includes(g)?RED:"#ddd"}`,borderRadius:16,fontSize:12,fontWeight:sel.includes(g)?700:400,background:sel.includes(g)?RED:"#fff",color:sel.includes(g)?"#fff":"#666",cursor:"pointer",marginBottom:4}}>{g}</button>
      );
      return (
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>품종 <span style={{fontWeight:400,color:TH.T3}}>(복수 선택 가능)</span></div>
          {sel.length>0&&<div style={{fontSize:12,color:RED,fontWeight:600,marginBottom:6}}>선택: {sel.join(", ")}</div>}
          {regionGrapes
            ? <><div style={{fontSize:10,color:GOLD,fontWeight:600,margin:"4px 0 3px"}}>⭐ {ans.region} 대표 품종</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{regionGrapes.map(g=><Chip key={g} g={g}/>)}</div></>
            : <><div style={{fontSize:10,color:TH.T3,margin:"4px 0 3px"}}>🍷 레드</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{GRAPE_CATEGORIES.red.slice(0,8).map(g=><Chip key={g} g={g}/>)}</div><div style={{fontSize:10,color:TH.T3,margin:"6px 0 3px"}}>🥂 화이트</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{GRAPE_CATEGORIES.white.slice(0,8).map(g=><Chip key={g} g={g}/>)}</div></>
          }
          <input list={`dl-ans-g-${wno}`} placeholder="직접 입력 후 Enter"
            onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){toggle(e.target.value.trim());e.target.value="";}}}
            style={{...ISTA,marginTop:6}}/>
          <datalist id={`dl-ans-g-${wno}`}>{GRAPE_LIST.map(g=><option key={g} value={g}/>)}</datalist>
        </div>
      );
    };

    const AVintage = () => (
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>빈티지</div>
        <input type="number" min="1900" max="2030" value={ans.vintage||""} onChange={e=>upd("vintage",e.target.value)}
          placeholder="예: 2019" style={{...ISTA,width:120}}/>
      </div>
    );

    return {ACountry,ARegion,AVillage,AClassification,AGrape,AVintage};
  };

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

          const sc=scoreGuessVsAnswer(g,ans,s.rubric,ans.depth,g.villageAILevel);
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
          <div style={{background:"rgba(0,0,0,.25)",padding:"6px 18px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:"rgba(255,255,255,.7)",fontSize:11}}>초대 코드</span>
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
            {/* 모임 스타일 — 2열 그리드 */}
            <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:8}}>모임 스타일</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
              <button onClick={()=>setSPartyMode(false)}
                style={{padding:"12px 10px",border:`2px solid ${!sPartyMode?RED:"#ddd"}`,borderRadius:12,background:!sPartyMode?"#FDF1F2":TH.CARD,cursor:"pointer",textAlign:"left"}}>
                <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>🎯 Expert</div>
                <div style={{fontSize:11,color:TH.T2,lineHeight:1.4}}>6 fields · AI scoring · detailed</div>
              </button>
              <button onClick={()=>setSPartyMode(true)}
                style={{padding:"12px 10px",border:`2px solid ${sPartyMode?"#D97706":"#ddd"}`,borderRadius:12,background:sPartyMode?"#FEF3C7":TH.CARD,cursor:"pointer",textAlign:"left"}}>
                <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>🎉 Party</div>
                <div style={{fontSize:11,color:TH.T2,lineHeight:1.4}}>4 fields · emoji results · casual</div>
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
          <div style={{background:"rgba(0,0,0,.25)",padding:"6px 18px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:"rgba(255,255,255,.7)",fontSize:11}}>초대 코드</span>
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
          <div style={{background:"rgba(0,0,0,.25)",padding:"6px 18px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:"rgba(255,255,255,.7)",fontSize:11}}>초대 코드</span>
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
            <div style={{fontSize:13,fontWeight:700,color:TH.T2,marginBottom:12}}>{cur.partyMode?"🎉 내 픽":"🔍 추론"}</div>
            {/* 공통: 국가 + 지역 */}
            {GCountry()}
            {GRegion()}
            {cur.partyMode ? (
              /* ── Party 모드: 품종 + 빈티지만 ── */
              <>
                {GGrape()}
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>빈티지 추정</div>
                  <input value={gval("vintage")} onChange={e=>updateGuess("vintage",e.target.value)}
                    placeholder="예: 2019" style={{...IST,width:120}}/>
                </div>
              </>
            ) : (
              /* ── Expert 모드: 전체 항목 ── */
              <>
                {GVillage()}
                {/* Classification */}
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>등급{gval("region")&&REGION_CLASSES[gval("region")]&&<span style={{fontWeight:400,color:TH.T3,fontSize:10}}> · {gval("region")} 체계</span>}</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {(()=>{
                      const allClasses={regional:"지역급",village:"빌라주",premiercru:"1er Cru",grandcru:"그랑크뤼",other:"기타"};
                      const region=gval("region");
                      const allowed=REGION_CLASSES[region]||DEFAULT_CLASSES;
                      return allowed.map(v=>[v,allClasses[v]]);
                    })().map(([v,l])=>{
                      const cur_v=cur.guesses[p_]?.[wno_]?.classification||"";
                      const sel=cur_v===v||(v==="other"&&cur_v&&!["regional","village","premiercru","grandcru"].includes(cur_v));
                      return (
                        <button key={v} onClick={()=>updateGuess("classification",v==="other"?"기타":v)}
                          style={{padding:"6px 11px",border:`1px solid ${sel?RED:TH.BD}`,borderRadius:18,fontSize:12,fontWeight:sel?700:400,background:sel?RED:TH.CARD,color:sel?"#fff":TH.T2,cursor:"pointer"}}>{l}</button>
                      );
                    })}
                  </div>
                </div>
                {GGrape()}
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,fontWeight:600,color:TH.T2,marginBottom:4}}>빈티지 추정</div>
                  <input value={gval("vintage")} onChange={e=>updateGuess("vintage",e.target.value)}
                    placeholder="예: 2018~2020 또는 2019" style={IST}/>
                </div>
                <div style={{marginBottom:0}}>
                  <div style={{fontSize:11,fontWeight:600,color:RED,marginBottom:4}}>💭 이렇게 픽한 이유 <span style={{fontWeight:400,color:TH.T3}}>(선택)</span></div>
                  <textarea value={cur.guesses[p]?.[wno]?.reason||""} onChange={e=>updateGuess("reason",e.target.value)}
                    placeholder="예: 높은 산도와 미네랄, 환원 뉘앙스 → 부르고뉴 샤르도네"
                    rows={3} style={{width:"100%",border:`1px solid ${TH.BD}`,borderRadius:6,padding:"7px 10px",fontSize:12,outline:"none",resize:"vertical",boxSizing:"border-box",background:TH.INP,color:TH.T1}}/>
                </div>
              </>
            )}
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


  // ── Party 모드 결과 화면 ────────────────────────────────────────
  if(view==="summary"&&cur&&cur.partyMode) {
    const emojiScore = (lvl) => lvl==="exact"?"⭕":lvl==="close"?"△":"✕";
    const funMsg = (hits, total) => {
      const r = hits/total;
      if(r===1)  return "🏆 퍼펙트!";
      if(r>=0.75) return "🎉 거의 다 맞혔어요!";
      if(r>=0.5)  return "🍷 꽤 잘했어요!";
      if(r>=0.25) return "😄 감이 잡혀가네요!";
      return "😂 와인이 너무 어려워!";
    };
    // Compute party scores (country/region/grape/vintage only)
    const partyScores = {};
    for(const p of cur.participants) {
      partyScores[p] = {total:0, hits:0, wines:[]};
      for(let i=0;i<cur.wineCount;i++) {
        const wno=i+1, ans=cur.answers?.[wno]||{};
        if(ans.bringer===p) continue;
        const g=cur.guesses?.[p]?.[wno]||{};
        if(!(g.country||g.region||g.grape||g.vintage)) continue;
        const fields = [
          {label:"국가", lvl:levelField(g.country,ans.country)},
          {label:"지역", lvl:levelField(g.region,ans.region)},
          {label:"품종", lvl:levelGrape(g.grape,ans.grapeVariety)},
          {label:"빈티지", lvl:levelVintage(g.vintage,ans.vintage,cur.rubric?.vintageTol??2)},
        ];
        const hits = fields.filter(f=>f.lvl.level!=="miss"&&f.lvl.level!=="none").length;
        const valid = fields.filter(f=>f.lvl.level!=="none").length;
        partyScores[p].wines.push({wno,ans,g,fields,hits,valid});
        partyScores[p].total+=valid; partyScores[p].hits+=hits;
      }
    }
    const ranked = Object.entries(partyScores)
      .filter(([,v])=>v.total>0)
      .sort((a,b)=>b[1].hits/b[1].total - a[1].hits/a[1].total);
    const winner = ranked[0]?.[0];

    return (
      <div style={{minHeight:"100vh",background:TH.BG,fontFamily:"system-ui,sans-serif"}}>
        {/* Header */}
        <div style={{background:RED,color:"#fff",padding:"14px 16px",display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setView("list")} style={{background:"none",border:"none",color:"#fff",fontSize:20,cursor:"pointer"}}>←</button>
          <div style={{flex:1}}>
            <div style={{fontSize:15,fontWeight:700}}>{cur.name}</div>
            <div style={{fontSize:11,opacity:.8}}>🎉 Party 모드 · 와인 {cur.wineCount}종</div>
          </div>
          <button onClick={()=>{setActive(null);setView("list");}}
            style={{background:"rgba(255,255,255,.2)",border:"none",color:"#fff",borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer"}}>목록</button>
        </div>
        {cur?.accessCode&&(
          <div style={{background:"rgba(0,0,0,.25)",padding:"6px 18px",display:"flex",alignItems:"center",gap:10}}>
            <span style={{color:"rgba(255,255,255,.7)",fontSize:11}}>초대 코드</span>
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

        <div style={{padding:16,maxWidth:640,margin:"0 auto"}}>
          {/* 오늘의 소믈리에 */}
          {winner&&(
            <div style={{...CS,textAlign:"center",background:"linear-gradient(135deg,#FEF3C7,#FBF4E4)",border:"2px solid #D97706",marginBottom:16}}>
              <div style={{fontSize:32,marginBottom:4}}>👑</div>
              <div style={{fontSize:18,fontWeight:800,color:"#92400E"}}>오늘의 소믈리에</div>
              <div style={{fontSize:24,fontWeight:700,color:"#D97706",marginTop:4}}>{winner}</div>
              <div style={{fontSize:12,color:"#92400E",marginTop:4}}>
                {partyScores[winner].hits}/{partyScores[winner].total} 적중
              </div>
            </div>
          )}

          {/* 참가자별 카드 */}
          {ranked.map(([p,ps])=>(
            <div key={p} style={{...CS,marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                {p===winner&&<span style={{fontSize:16}}>👑</span>}
                <span style={{fontSize:16,fontWeight:700,color:TH.T1}}>{p}</span>
                <span style={{marginLeft:"auto",fontSize:20}}>{funMsg(ps.hits,ps.total)}</span>
              </div>
              {ps.wines.map(({wno,ans,fields})=>(
                <div key={wno} style={{marginBottom:10,padding:"10px",background:TH.BG,borderRadius:10}}>
                  <div style={{fontSize:12,fontWeight:700,color:TH.T2,marginBottom:6}}>
                    #{wno} {ans.nameKR||""}
                  </div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {fields.map(({label,lvl})=>lvl.level!=="none"&&(
                      <div key={label} style={{
                        padding:"4px 10px",borderRadius:20,fontSize:12,fontWeight:600,
                        background:lvl.level==="exact"?"#D1FAE5":lvl.level==="close"?"#FEF3C7":"#FEE2E2",
                        color:lvl.level==="exact"?"#065F46":lvl.level==="close"?"#92400E":"#991B1B"
                      }}>
                        {emojiScore(lvl.level)} {label}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* 와인별 정답 공개 */}
          {cur.revealed&&(
            <div style={CS}>
              <div style={{fontSize:13,fontWeight:700,color:TH.T1,marginBottom:10}}>🍾 오늘의 와인</div>
              {Array.from({length:cur.wineCount}).map((_,i)=>{
                const wno=i+1, ans=cur.answers?.[wno]||{};
                return (
                  <div key={wno} style={{display:"flex",gap:10,alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${TH.BD}`}}>
                    <span style={{fontSize:22,flexShrink:0}}>🍷</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:TH.T1}}>#{wno} {ans.nameKR||"?"}</div>
                      <div style={{fontSize:11,color:TH.T2}}>{[ans.country,ans.region,ans.grapeVariety,ans.vintage].filter(Boolean).join(" · ")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <ToastContainer toasts={toasts}/>
      </div>
    );
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
                <div style={{fontSize:11,color:TH.T3,marginTop:2}}>
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
                  {qualLoading?"🤖 평가 중...":"🤖 AI 채점 실행 (마을 의미판정 + 정성 평가)"}
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
              return {p, g, score:scoreGuessVsAnswer(g, ans, cur.rubric, ans.depth, g.villageAILevel)};
            });
            // Rank by score for this wine
            const validScored=scored.filter(s=>!s.skip&&s.score);
            const bestPct=validScored.length?Math.max(...validScored.map(s=>s.score.pct)):0;
            return (
              <div key={wno} style={CS}>
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
                const s=scoreGuessVsAnswer(g,ans,cur.rubric,ans.depth,g.villageAILevel);
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
  const [qualLoading, setQualLoading] = useState(false);

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

  async function runQualEval(active, onSaveSessions) {
    // ── 사전 검사 ──────────────────────────────────────────────
    if (!geminiKey) {
      toast("⚙️ Gemini API 키를 먼저 설정해주세요", "error"); return null;
    }
    const qr = active?.rubric?.qualRatio || 0;
    if (qr === 0) {
      toast("세션 설정에서 AI 정성 평가 비율을 설정해주세요", "warn"); return null;
    }
    // 평가 대상이 있는지 확인 (이유 텍스트 작성 여부)
    let evalTargets = 0;
    for (let i = 0; i < active.wineCount; i++) {
      const wno = i + 1;
      const ans = active.answers[wno] || {};
      for (const p of active.participants) {
        if (ans.bringer === p) continue;
        const g = active.guesses[p]?.[wno] || {};
        const hasVillage = (g.village||"").trim() && (ans.subRegion||"").trim();
        const hasReason  = g.reason?.trim();
        if (hasVillage || hasReason) evalTargets++;
      }
    }
    if (evalTargets === 0) {
      toast("평가할 내용이 없습니다 — 참가자 추론 또는 마을 항목 입력 필요", "warn"); return null;
    }
    // ── 실행 ──────────────────────────────────────────────────
    setQualLoading(true);
    try {
      const updated = {...active, guesses: JSON.parse(JSON.stringify(active.guesses||{}))};
      // 배치 처리: 와인 1병당 1회 API 호출 (16회→4회)
      for (let i = 0; i < active.wineCount; i++) {
        const wno = i + 1;
        const ans = active.answers[wno] || {};
        if (!(ans.region || ans.grapeVariety)) continue;

        // 이 와인에 대해 평가 대상 참가자 수집
        const batchTargets = active.participants
          .filter(p => ans.bringer !== p)
          .map(p => {
            const g = active.guesses[p]?.[wno] || {};
            return { name:p, village:(g.village||"").trim(), reason:(g.reason||"").trim(), g };
          })
          .filter(t => t.village || t.reason);

        if (batchTargets.length === 0) continue;

        console.log(`[AI채점] 와인 #${wno} — ${batchTargets.length}명 배치 평가`);
        const results = await callGeminiForBatchWines(geminiKey, ans, batchTargets);

        if (results) {
          Object.entries(results).forEach(([pName, res]) => {
            if (!res) return;
            const patch = {...(updated.guesses[pName]?.[wno]||{})};
            if (res.village_level) {
              patch.villageAILevel = res.village_level;
              patch.villageNote    = res.village_note || "";
            }
            if (res.aroma != null) {
              const a = Math.max(0,Math.min(8,  res.aroma    ||0));
              const s = Math.max(0,Math.min(12, res.structure||0));
              const l = Math.max(0,Math.min(10, res.logic    ||0));
              patch.aroma = a; patch.structure = s; patch.logic = l;
              patch.qualScore    = Math.round((a+s+l)/QUAL_MAX*100);
              patch.qualFeedback = res.feedback || "";
            }
            if (!updated.guesses[pName]) updated.guesses[pName] = {};
            updated.guesses[pName][wno] = patch;
          });
        }
        // 와인 간 1.5초 딜레이 (429 방지, 분당 15RPM 여유)
        if (i < active.wineCount - 1) await new Promise(r => setTimeout(r, 1500));
      }
      onSaveSessions([updated, ...sessions.filter(s => s.id !== updated.id)]);
      return updated;
    } catch(err) {
      toast("AI 채점 오류: " + err.message, "error", 5000);
      return null;
    } finally {
      setQualLoading(false); // 항상 로딩 해제
    }
  }


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
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:TH.T3}}>
        🍷 불러오는 중...
      </div>
    );
  }

  return (
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
      runQualEval={runQualEval}
      qualLoading={qualLoading}
    />
  );
}

export default App;
