/* 쿠션어 자동 생성기 — 규칙 기반 말투 변환(서버·AI 호출 없음)
   핵심 동작(요청 문장의 동사) + 받는 사람 + 상황 + 정중도로 문장을 조립합니다. */
'use strict';

const TARGETS = [
  { id: 'prof', name: '교수님', hon: true },
  { id: 'boss', name: '상사', hon: true },
  { id: 'client', name: '거래처', hon: true },
  { id: 'senior', name: '선배', hon: true },
  { id: 'friend', name: '친구', hon: false }
];
const SITUATIONS = [
  { id: 'ask', name: '부탁' }, { id: 'push', name: '재촉' }, { id: 'no', name: '거절' }, { id: 'sorry', name: '사과' }, { id: 'check', name: '확인' }, { id: 'thanks', name: '감사' }
];
const LEVELS = ['담백', '공손', '정중', '극진', '황송'];
const EXAMPLES = [
  ['보고서 내일까지 내', 'ask'], ['자료 아직이야? 빨리 보내', 'push'], ['그거 못 해', 'no'],
  ['늦어서 미안', 'sorry'], ['회의 3시 맞지?', 'check'], ['이거 좀 고쳐줘', 'ask']
];

/* ---------- 한글 도우미 ---------- */
const HG = 0xac00;
const syl = ch => { const c = (ch || '').charCodeAt(0) - HG; return c >= 0 && c <= 11171 ? c : -1; };
const jong = ch => { const c = syl(ch); return c < 0 ? -1 : c % 28; };
const jung = ch => { const c = syl(ch); return c < 0 ? -1 : Math.floor(c / 28) % 21; };
const last = s => (s || '').trim().slice(-1);
function hasBatchim(word) { return jong(last(word)) > 0; }
function endsWithRieul(word) { return jong(last(word)) === 8; }
const josa = (w, a, b) => w + (hasBatchim(w) ? a : b);           // 은/는, 을/를, 이/가
const dropJong = ch => String.fromCharCode(ch.charCodeAt(0) - jong(ch)); // 갈 → 가, 갔 → 가

/* ---------- 문장 분해(어미 활용 엔진) ----------
   마지막 서술어를 보고 요청의 종류(kind)를 정함
   do: 아/어형 동사(보내, 고쳐) + 주다 · give: 주다 자체 · dont: ~지 마 · please: ~ 부탁해 · suggest: ~ㄹ래 */
function stripPunct(s) { return s.trim().replace(/[.!?~ㅋㅎㅠㅜ\s]+$/g, ''); }
function cleanup(raw) {
  let s = stripPunct(raw);
  s = s.replace(/^(야|저기|아니|근데|그리고|혹시|있잖아)\s*,?\s*/, '');
  s = s.replace(/(^|\s)(빨리|당장|얼른|좀|제발|꼭|후딱)(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}
function splitCore(raw) {
  let s = cleanup(raw);
  let m = s.match(/^(.*?)(\S+)지\s*(마|마라|말아|말아라|말아줘|말아 줘|말아줄래|말아 줄래|말아주세요|말아 주세요|마세요|마요)$/);
  if (m) return { rest: m[1].trim(), verb: m[2], kind: 'dont', raw: s };
  m = s.match(/^(.*?)\s*(부탁해|부탁할게|부탁합니다|부탁해요|부탁드려요|부탁드립니다|부탁)$/);
  if (m && m[1].trim()) return { rest: m[1].trim(), verb: '', kind: 'please', raw: s };
  s = s.replace(/(\S)야\s*(돼|해|함|된다|한다|될 듯)$/, '$1');      // 내야 돼 → 내, 해야 해 → 해
  let verb = '', rest = s;
  m = s.match(/^(.*?)(\S+)$/);
  if (m) { rest = m[1].trim(); verb = m[2]; }
  let base = verb, kind = 'do';
  if (/^(줘|줄래|주세요|주라|주십시오|줄래요)$/.test(base)) { base = '주'; kind = 'give'; }
  else if (/(줘|줄래|주세요|주십시오|줄래요|주라)$/.test(base) && base.length > 1) base = base.replace(/(줘|줄래|주세요|주십시오|줄래요|주라)$/, '');
  else if (/(해라|하세요|하셈|해요|하십시오|하쇼|하자)$/.test(base)) base = base.replace(/(해라|하세요|하셈|해요|하십시오|하쇼|하자)$/, '해');
  else if (/(어라|아라|여라)$/.test(base)) base = base.slice(0, -1);   // 먹어라 → 먹어
  else if (/[을갈할쉴볼올둘울]게$/.test(base) && base.length > 1) {                // 쉴게 → 쉬려고 하는데 괜찮을까요
    const pre = base.slice(0, -1);
    const hstem = /을$/.test(pre) ? pre.slice(0, -1) + '으' : pre.slice(0, -1) + dropJong(last(pre));
    return { rest, verb: base, hstem, kind: 'notice', raw: s };
  }
  else if (/래$/.test(base) && base.length > 1) {                          // 갈래 → 가실래요, 먹을래 → 드실래요
    const pre = base.slice(0, -1);
    if (/(먹을|마실)$/.test(pre)) return { rest, verb: base, hstem: pre.replace(/(먹을|마실)$/, '드'), kind: 'suggest', raw: s };
    if (/먹을$/.test(pre)) return { rest, verb: base, hstem: pre.replace(/먹을$/, '드'), kind: 'suggest', raw: s };
    if (/을$/.test(pre)) return { rest, verb: base, hstem: pre.slice(0, -1) + '으', kind: 'suggest', raw: s };
    if (endsWithRieul(pre)) return { rest, verb: base, hstem: pre.slice(0, -1) + dropJong(last(pre)), kind: 'suggest', raw: s };
  }
  else if (/라$/.test(base) && base.length > 1) base = base.replace(/라$/, '');
  else if (/요$/.test(base) && base.length > 1) base = base.replace(/요$/, '');
  return { rest, verb: base, kind, raw: s };
}
const isRequestEnd = raw => /(줄래|줄 수 있어|주세요|줘|주라|줄래요|주실래요|부탁해|[을갈볼할마실]래)\s*\??$/.test(stripPunct(raw) + (raw.trim().endsWith('?') ? '?' : ''));
const isQuestion = raw => /\?\s*$/.test(raw.trim()) || /(맞지|맞아|거야|했어|됐어|있어|없어|아직이야|이야|니|냐|나요|까)\s*\??$/.test(stripPunct(raw));
function looksNo(raw) { return /(못 ?[가-힣]|안 ?돼|안 ?해|안 ?가|싫어|어려워|힘들어|불가|빠질게)/.test(raw) && !/(않을래|안 될까)/.test(raw); }
function looksSorry(raw) { return /(미안|죄송|잘못했|늦어서|늦었|깜빡)/.test(raw); }
function detectSituation(raw) {
  if (looksSorry(raw)) return 'sorry';
  if (/(고마워|고맙|감사|땡큐|덕분에)/.test(raw)) return 'thanks';
  if (/(아직|언제 (돼|와|줘|보내|끝나)|빨리|얼른|당장|후딱)/.test(raw)) return 'push';
  if (looksNo(raw)) return 'no';
  if (isRequestEnd(raw)) return 'ask';
  if (isQuestion(raw)) return 'check';
  return 'ask';
}

/* 반말 의문문 → 해요체 의문문(회의 몇 시야 → 회의 몇 시예요) */
function toPolite(s) {
  s = s.trim();
  const ch = last(s);
  if (/지$/.test(s)) return s.slice(0, -1) + '죠';
  if (/(니|냐)$/.test(s)) return s.slice(0, -1) + '나요';
  if (/까$/.test(s)) return s + '요';
  if (/이야$/.test(s) && hasBatchim(s.slice(0, -2))) return s.slice(0, -2) + '이에요';
  if (/야$/.test(s)) return s.slice(0, -1) + '예요';
  if (/(래|게|네|데)$/.test(s)) return s + '요';
  if (jong(ch) === 0 && [0, 1, 4, 6, 9, 10, 14].includes(jung(ch))) return s + '요';
  return s + (syl(ch) >= 0 ? '인가요' : '인가요');
}
/* 반말 사과 이유 → ~해서 (깜빡했어 → 깜빡해서, 늦었다 → 늦어서) */
function toReason(s) {
  s = s.trim();
  const m = s.match(/(.)(어|다)$/);
  if (m && jong(m[1]) === 20) return s.slice(0, -2) + dropJong(m[1]) + '서';
  return s;
}

/* ---------- 조립 ---------- */
const objOf = core => core.rest ? core.rest + ' ' : '';
function request(core, hon) {           // 물음형 부탁(뒤에 ? 붙임)
  const obj = objOf(core), v = core.verb || '확인해';
  switch (core.kind) {
    case 'give': return hon ? `${obj}주실 수 있을까요` : `${obj}줄 수 있어`;
    case 'dont': return hon ? `${obj}${v}지 말아 주실 수 있을까요` : `${obj}${v}지 말아 줄 수 있어`;
    case 'please': return hon ? `${obj}부탁드려도 될까요` : `${obj}부탁해도 될까`;
    case 'suggest': return hon ? `${obj}${core.hstem}실래요` : `${obj}${v}`;
    case 'notice': return hon ? `${obj}${core.hstem}려고 하는데 괜찮을까요` : `${obj}${core.hstem}려고 하는데 괜찮아`;
    default: return hon ? `${obj}${v} 주실 수 있을까요` : `${obj}${v} 줄 수 있어`;
  }
}
function requestPlain(core, hon) {      // 평서형 부탁
  const obj = objOf(core), v = core.verb || '확인해';
  switch (core.kind) {
    case 'give': return hon ? `${obj}주세요` : `${obj}줘`;
    case 'dont': return hon ? `${obj}${v}지 말아 주세요` : `${obj}${v}지 말아 줘`;
    case 'please': return hon ? `${obj}부탁드립니다` : `${obj}부탁해`;
    case 'suggest': { const p = v.replace(/래$/, ''); return hon ? `${obj}${core.hstem}시면 좋겠어요` : `${obj}${/을$/.test(p) ? p.slice(0, -1) : p.slice(0, -1) + dropJong(last(p))}자`; }
    case 'notice': return hon ? `${obj}${core.hstem}려고 합니다` : `${obj}${v}`;
    default: return hon ? `${obj}${v} 주세요` : `${obj}${v} 줘`;
  }
}
function requestThanks(core) {          // "~ 주시면" (뒤에 감사하겠습니다)
  const obj = objOf(core), v = core.verb || '확인해';
  switch (core.kind) {
    case 'give': return `${obj}주시면`;
    case 'dont': return `${obj}${v}지 않아 주시면`;
    case 'please': return `${josa(core.rest, '을', '를')} 부탁드릴 수 있다면`;
    case 'suggest': return `${obj}${core.hstem}시면`;
    case 'notice': return `${obj}${core.hstem}려고 하는데 양해해 주시면`;
    default: return `${obj}${v} 주시면`;
  }
}
function topicOf(raw, sit) {
  // 거절·사과에 쓸 "무엇"을 뽑음
  let s = stripPunct(raw).replace(/^(그거|이거|저거)\s*/, '').replace(/^(아|아이고|헐)\s+/, '');
  if (sit === 'sorry') s = s.replace(/\s*(정말|진짜|너무)?\s*(미안해?요?|미안하다|죄송해요|죄송합니다|죄송|잘못했어)\s*$/, '');
  else s = s.replace(/\s*(그건|그거)?\s*(못\s*\S*|안\s*돼|안\s*\S+|\S*기\s*(싫어|어려워|힘들어)|싫어|어려워|힘들어|불가|빠질게)\s*$/, '');
  s = s.trim();
  if (sit === 'no') { s = s.replace(/(은|는|를)$/, ''); if (/을$/.test(s) && s.length > 2) s = s.slice(0, -1); }
  return s.trim();
}

const CUSHION = {
  ask: [[''], ['혹시 '], ['바쁘시겠지만 ', '번거로우시겠지만 '], ['정말 번거로우시겠지만, 혹시 시간이 괜찮으시다면 '], ['하늘같이 바쁘신 와중에 이런 말씀 올리기 너무나 송구하오나, 혹시라도 여유가 허락하신다면 ']],
  askF: [[''], ['혹시 '], ['바쁜데 미안하지만 '], ['진짜 바쁜 거 알지만, 혹시 시간 되면 '], ['우리 우정에 기대어 정말 염치없지만, 혹시 정말 혹시 괜찮다면 ']]
};

function generateBase(raw, targetId, sitId, level) {
  const t = TARGETS.find(x => x.id === targetId) || TARGETS[0];
  const hon = t.hon;
  const core = splitCore(raw);
  const L = Math.max(0, Math.min(4, level | 0));
  const out = [];
  const add = s => { s = s.replace(/\s+/g, ' ').replace(/\s([,.?!])/g, '$1').replace(/\?\?+/g, '?').trim(); if (s && !out.includes(s)) out.push(s); };

  if (sitId === 'ask' || sitId === 'push') {
    const pre = (hon ? CUSHION.ask : CUSHION.askF)[L];
    if (sitId === 'push') {
      const parts = raw.split(/[?.!]+/).map(x => x.trim()).filter(Boolean);
      if (!parts.length) parts.push(raw);
      const lastCore = splitCore(parts[parts.length - 1]);
      if (parts.length > 1) Object.assign(core, { rest: lastCore.rest, verb: lastCore.verb, kind: lastCore.kind, hstem: lastCore.hstem });
      const first = cleanup(parts[0]).replace(/\s*(아직이야|아직이에요|아직도|아직|언제 돼|언제 와|언제 줘|언제 보내|언제 끝나|언제|어떻게 됐어|안 끝났어|다 됐어|됐어|안 왔어|안 됐어)\s*/g, ' ').trim();
      const lastIsQ = /(아직|언제|됐어|끝났어|왔어)/.test(parts[parts.length - 1]);
      if (lastIsQ) Object.assign(core, { rest: first, verb: '', kind: first ? 'please' : 'do' });
      else if (parts.length === 1 && core.kind === 'give' && /\S*해$/.test(core.rest)) { const mm = core.rest.match(/^(.*?)\s*(\S*해)$/); Object.assign(core, { rest: mm[1], verb: mm[2], kind: 'do' }); }
      if (!core.rest && (core.verb === '해' || !core.verb)) core.verb = '마무리해';
      const DEF = hon ? '부탁드린 건' : '그거';
      let what = (parts.length > 1 ? first : core.rest.replace(/\s*\S*해$/, '')) || DEF;
      what = what.replace(/(은|는|이|가)$/, m => (what.length > 2 ? '' : m)).trim() || DEF;
      if (parts.length > 1 && !core.rest && what !== DEF) core.rest = what;
      if (hon) {
        add(['', '혹시 ', '바쁘신 와중에 죄송하지만, ', '번거롭게 해 드려 정말 죄송하지만, ', '거듭 여쭙게 되어 몸 둘 바를 모르겠사오나, '][L] + `${what} 진행 상황 여쭤봐도 될까요?`);
        add(['', '혹시 ', '바쁘시겠지만 ', '정말 번거로우시겠지만 ', '송구스럽기 그지없으나 '][L] + requestThanks(core) + ' 감사하겠습니다.');
        add(`앞서 ${what === DEF ? DEF : '부탁드린 ' + what} 관련해서 ${['확인 부탁드려요.', '한 번 확인 부탁드립니다.', '혹시 확인 가능하실지 여쭙습니다.', '시간 되실 때 확인해 주시면 정말 감사하겠습니다.', '언제든 편하실 때 살펴 주신다면 그 은혜 잊지 않겠습니다.'][L]}`);
      } else {
        add(['', '혹시 ', '바쁜데 미안! ', '정말 미안한데 ', '이렇게 자꾸 물어봐서 진짜 미안한데, '][L] + `${what} 어떻게 되고 있어?`);
        add(['', '혹시 ', '시간 될 때 ', '진짜 시간 될 때 ', '너무너무 미안하지만 '][L] + request(core, false) + '?');
      }
    } else {
      pre.forEach(p => add(p + request(core, hon) + '?'));
      if (hon) add((L >= 2 ? pick(pre) : '') + requestThanks(core) + [' 좋겠습니다.', ' 감사하겠습니다.', ' 정말 감사하겠습니다.', ' 큰 도움이 될 것 같습니다. 감사합니다.', ' 이 은혜는 평생 잊지 않겠습니다.'][L]);
      else add((L >= 2 ? pick(pre) : '') + requestPlain(core, false) + ['!', '~ 고마워!', '~ 진짜 고마워!', '~ 밥 한 번 살게!', '~ 이 은혜 평생 갚을게!'][L]);
      if (L <= 1) add(requestPlain(core, hon) + (hon ? '.' : '!'));
    }
  } else if (sitId === 'no') {
    const topic = topicOf(raw, 'no');
    const what = topic || (hon ? '말씀하신 건' : '그건');
    const wn = topic ? josa(what, '은', '는') : what;
    if (hon) {
      add(['', '말씀 주셔서 감사합니다. ', '좋은 제안 주셔서 감사합니다. ', '이렇게 먼저 생각해 주셔서 진심으로 감사드립니다. ', '저를 떠올려 주신 것만으로도 영광이옵니다. '][L] + `다만 ${wn} ${['어렵습니다.', '어려울 것 같습니다.', '이번에는 어려울 것 같습니다.', '여러 사정으로 이번에는 정말 어려울 것 같아 죄송합니다.', '하늘이 무너져도 이번만큼은 어려울 듯하여 송구한 마음 금할 길이 없습니다.'][L]}`);
      add(`${['', '아쉽지만 ', '정말 아쉽지만 ', '마음은 굴뚝같지만 ', '천 번 만 번 돕고 싶은 마음이지만 '][L]}${wn} 이번에 함께하기 어려울 것 같습니다. ${['', '양해 부탁드립니다.', '너그러이 양해 부탁드립니다.', '다른 방법이 있으면 함께 찾아보겠습니다.', '부디 넓은 아량으로 헤아려 주시옵소서.'][L]}`);
    } else {
      add(['', '아 ', '미안 ', '진짜 미안한데 ', '너무너무 미안한데 '][L] + `${wn} ${['안 될 것 같아.', '좀 어려울 것 같아.', '이번엔 어려울 것 같아 ㅠ', '이번엔 진짜 어려울 것 같아. 다음엔 꼭 할게!', '우리 우정을 걸고 이번만은 봐줘…'][L]}`);
      add(`${['', '아쉽지만 ', '마음은 굴뚝같은데 ', '진짜 아쉬운데 ', '눈물을 머금고 '][L]}${wn} 이번엔 패스할게${L >= 2 ? '. 다음엔 꼭 같이하자!' : '.'}`);
    }
  } else if (sitId === 'sorry') {
    const what = toReason(topicOf(raw, 'sorry'));
    if (hon) {
      add(`${what ? what + ' ' : ''}${['죄송합니다.', '정말 죄송합니다.', '심려를 끼쳐 드려 정말 죄송합니다.', '불편을 드린 점 진심으로 사과드립니다. 다음에는 이런 일이 없도록 하겠습니다.', '제 불찰로 이런 일이 생겨 석고대죄하는 심정으로 사죄드립니다.'][L]}`);
      add(`${['', '먼저 ', '무엇보다 먼저 ', '변명의 여지 없이 ', '천만번 엎드려 '][L]}${['사과드립니다.', '사과드립니다. 바로 챙기겠습니다.', '사과드립니다. 앞으로 더 신경 쓰겠습니다.', '사과드리며, 재발하지 않도록 꼼꼼히 챙기겠습니다.', '용서를 구하옵니다. 앞으로는 시계를 세 개 차고 다니겠습니다.'][L]}`);
    } else {
      add(`${what ? what + ' ' : ''}${['미안.', '미안해!', '진짜 미안해 ㅠ', '정말 미안해. 다음엔 안 그럴게!', '내가 죽을 죄를 졌다… 밥 살게 용서해 줘'][L]}`);
    }
  } else if (sitId === 'thanks') {
    const why = cleanup(raw).replace(/\s*(정말|진짜|너무)?\s*(고마워요?|고맙다|고맙습니다|감사해요|감사합니다|감사|땡큐)\s*$/, '').trim();
    const w = why ? why.replace(/(해 줘서|해줘서)$/, '해 주셔서').replace(/줘서$/, '주셔서') + ' ' : '';
    if (hon && w) {
      add([`${w}감사합니다.`, `${w}정말 감사합니다.`, `${w}큰 도움이 되었습니다. 진심으로 감사드립니다.`, `바쁘신 와중에 ${w}진심으로 감사드립니다. 꼭 보답하겠습니다.`, `${w}그 은혜 백골이 진토되어도 잊지 않겠사옵니다.`][L]);
      add(['늘 감사합니다.', '덕분입니다. 감사합니다.', '세심하게 챙겨 주셔서 감사합니다.', '말씀해 주신 덕분에 많이 배웠습니다. 감사합니다.', '이 감사함을 어찌 말로 다 하겠습니까. 평생 잊지 않겠습니다.'][L]);
    } else if (hon) {
      add(w + ['감사합니다.', '정말 감사합니다.', '덕분에 큰 도움이 되었습니다. 진심으로 감사드립니다.', '바쁘신 와중에 마음 써 주셔서 진심으로 감사드립니다. 꼭 보답하겠습니다.', '그 은혜 백골이 진토되어도 잊지 않겠사옵니다.'][L]);
      add(['늘 감사합니다.', '덕분입니다. 감사합니다.', '세심하게 챙겨 주셔서 감사합니다.', '말씀해 주신 덕분에 많이 배웠습니다. 감사합니다.', '이 감사함을 어찌 말로 다 하겠습니까. 평생 잊지 않겠습니다.'][L]);
    } else {
      add(why.replace(/주셔서$/, '줘서') + (why ? ' ' : '') + ['고마워!', '진짜 고마워!', why ? '진짜 고마워! 덕분에 살았다 ㅠ' : '덕분에 살았다 ㅠ 고마워!', '너 없었으면 어쩔 뻔했어. 진짜 고마워!', '이 은혜 평생 갚을게… 사랑한다 친구야'][L]);
    }
  } else if (sitId === 'check') {
    const base = cleanup(raw);
    if (/(맞지|맞아|맞나|맞죠|맞냐|맞니|맞나요)$/.test(base)) {
      const what = base.replace(/\s*(맞지|맞아|맞나|맞죠|맞냐|맞니|맞나요)$/, '');
      if (hon) {
        add(`${['', '혹시 ', '확인차 여쭙습니다. ', '번거로우시겠지만 확인 한 번 부탁드려도 될까요? ', '감히 여쭙건대, '][L]}${what} 맞을까요?`);
        const ro = what + (hasBatchim(what) && !endsWithRieul(what) ? '으로' : '로');
        const ra = what + (hasBatchim(what) ? '이라' : '라');
        add([`${what} 맞나요?`, `${ro} 알고 있는데, 맞을까요?`, `${ro} 알고 있는데 혹시 변동이 있을까요?`, `${ro} 이해하고 있는데, 제가 잘못 알고 있다면 말씀 부탁드립니다.`, `${ra} 굳게 믿고 있사오나 혹여 제 착오라면 너그러이 바로잡아 주시옵소서.`][L]);
      } else {
        add(`${['', '혹시 ', '확인차! ', '혹시 내가 잘못 알고 있을까 봐 ', '귀찮게 해서 미안한데 '][L]}${what} 맞지?`);
      }
    } else {
      const q = toPolite(base) + '?';
      if (hon) {
        add(['', '혹시 ', '확인차 여쭙습니다. ', '번거로우시겠지만 하나만 여쭤봐도 될까요? ', '감히 여쭙건대, '][L] + q);
        add([`${q} 확인 부탁드려요.`, `${q} 확인 부탁드립니다.`, `${q} 시간 되실 때 알려 주시면 감사하겠습니다.`, `${q} 알려 주시면 큰 도움이 될 것 같습니다.`, `${q} 하문하여 주신다면 가문의 영광이겠습니다.`][L]);
      } else {
        add(['', '혹시 ', '궁금해서 그러는데 ', '바쁠 텐데 미안, ', '귀찮게 해서 미안한데 '][L] + base + '?');
      }
    }
  }
  let res = out.slice(0, 3);
  if (sitId === 'no' && /이번/.test(topicOf(raw, 'no'))) res = res.map(x => x.replace(/(\S+) 이번(에는|에|엔|만큼은|만은) /, (m, w) => /이번/.test(w) ? m : `${w} `));
  return res.map(s => s.replace(/\s{2,}/g, ' '));
}

/* ---------- 톤 3종: 메신저(기본) · 메일 · 캐주얼 ---------- */
const TONES = [
  { id: 'msg', name: '💬 메신저' }, { id: 'mail', name: '✉️ 메일' }, { id: 'casual', name: '😊 캐주얼' }
];
const SIT_SUBJECT = { ask: '요청', push: '확인 요청', no: '회신', sorry: '사과', check: '문의', thanks: '감사' };
const MAIL = {
  prof: { hi: '안녕하세요, 교수님.\n[이름]입니다.', bye: '감사합니다.\n[이름] 드림' },
  boss: { hi: '안녕하세요.\n[이름]입니다.', bye: '감사합니다.\n[이름] 드림' },
  client: { hi: '안녕하세요.\n[회사] [이름]입니다. 늘 도움 주셔서 감사합니다.', bye: '좋은 하루 보내세요.\n[이름] 드림' },
  senior: { hi: '선배님, 안녕하세요!\n[이름]입니다.', bye: '늘 감사합니다!\n[이름] 드림' },
  friend: { hi: '안녕! 잘 지내지?', bye: '그럼 답장 기다릴게!' }
};
const CASUAL_HON = [
  [/주실 수 있을까요\?/g, '주실 수 있나요?'], [/바쁘시겠지만/g, '바쁘실 텐데'], [/번거로우시겠지만/g, '번거로우실 텐데'], [/확인차 여쭙습니다\. /g, '확인차 여쭤봐요! '],
  [/정말 감사하겠습니다/g, '정말 감사할 것 같아요'], [/감사하겠습니다/g, '감사하겠어요'], [/감사합니다/g, '감사해요'], [/감사드립니다/g, '감사드려요'],
  [/좋겠습니다/g, '좋겠어요'], [/어렵습니다/g, '어려워요'], [/같습니다/g, '같아요'], [/죄송합니다/g, '죄송해요'],
  [/여쭙습니다/g, '여쭤봐요'], [/드립니다/g, '드려요'], [/하겠습니다/g, '할게요'], [/챙기겠습니다/g, '챙길게요'],
  [/찾아보겠습니다/g, '찾아볼게요'], [/않겠습니다/g, '않을게요'], [/없습니다/g, '없어요'], [/있습니다/g, '있어요'],
  [/되었습니다/g, '됐어요'], [/했습니다/g, '했어요'], [/었습니다/g, '었어요'], [/았습니다/g, '았어요'], [/됩니다/g, '돼요'], [/겠습니다/g, '겠어요'], [/입니다/g, '이에요']
];
const CASUAL_EMOJI = { ask: ' 🙏', push: ' 🙏', no: ' 🥲', sorry: ' 🙇', check: ' 😊', thanks: ' 💐' };
const CASUAL_F = { ask: ' ㅎㅎ', push: ' ㅎㅎ', no: ' ㅠㅠ', sorry: ' ㅠㅠ', check: '', thanks: ' 💛' };
function applyTone(list, tone, targetId, sitId, raw) {
  const t = TARGETS.find(x => x.id === targetId) || TARGETS[0];
  if (tone === 'mail') {
    const m = MAIL[t.id] || MAIL.boss;
    const topic = (sitId === 'no' || sitId === 'sorry') ? topicOf(raw, sitId) : sitId === 'thanks' ? '' : splitCore(raw).rest;
    const st = (topic || '').split(' ').filter(w => !/^(오늘|내일|모레|지금|이번|다음|주|주말에?|다시|같이|먼저|일찍|대신|혹시)$|까지$|에$/.test(w)).join(' ');
    const subj = t.hon && st && st.length <= 20 ? `제목: [${SIT_SUBJECT[sitId]}] ${st} 관련\n\n` : '';
    return list.map(s => `${subj}${m.hi}\n\n${s}\n\n${m.bye}`);
  }
  if (tone === 'casual') {
    return list.map(s => {
      if (t.hon) { CASUAL_HON.forEach(([a, b]) => { s = s.replace(a, b); }); s = s.replace(/^감히 여쭙건대, /, '혹시 '); return s + CASUAL_EMOJI[sitId]; }
      s = s.replace(/줄 수 있어\?/g, '줄 수 있을까?');
      return s.replace(/[.!]$/, '') + (/[ㅠㅎ…]$/.test(s) ? '' : CASUAL_F[sitId]);
    }).map(s => s.trim());
  }
  return list;
}
function generate(raw, targetId, sitId, level, tone) {
  const list = generateBase(raw, targetId, sitId, level);
  return applyTone(list, tone || 'msg', targetId, sitId, raw);
}

/* ---------- 변환기 ---------- */
const MORE_EXAMPLES = ['보고서 내일까지 내', '자료 아직이야? 빨리 보내', '그거 못 해', '늦어서 미안', '회의 3시 맞지?', '이거 좀 고쳐줘',
  '회의 몇 시야?', '단톡방에서 떠들지 마', '확인 부탁해', '이번 회식 못 가', '깜빡했어 미안', '점심 같이 먹을래?', '파일 다시 보내줘',
  '견적서 언제 와? 오늘까지 줘', '주말 출근은 안 돼', '내일 시간 돼?', '발표 자료 검토해줘', '답장 좀 빨리 해', '마감 미뤄줘', '과제 늦게 내서 미안해',
  '이 문서 수정해야 돼', '자리 좀 바꿔줘', '회의록 공유해 주세요', '그 일은 하기 싫어', '도와줘서 고마워', '내일 쉴게'];
const st = store.get('cw-state', { target: 'prof', sit: 'auto', level: 2, tone: 'msg' });
if (!TONES.some(t => t.id === st.tone)) st.tone = 'msg';
const saveSt = () => store.set('cw-state', st);

Router.on('/', root => {
  root.append(h(`
    <section class="stack">
      <div class="hero"><h1>그 말,<br>조금만 <span class="soft">말랑하게</span></h1>
      <p class="muted">하고 싶은 말을 그대로 적으면, 받는 사람과 말투에 맞게 부드럽게 바꿔 드려요.</p></div>
      <div class="split"><div class="card stack sticky">
        <textarea id="in" rows="2" maxlength="80" placeholder="예) 보고서 내일까지 내" aria-label="바꿀 문장"></textarea>
        <div class="row ex">${EXAMPLES.map(([e]) => `<button class="chip small" data-ex="${esc(e)}">${esc(e)}</button>`).join('')}<button class="chip small dice" id="dice" title="다른 예시 넣기" aria-label="다른 예시 넣기">🎲 다른 예시</button></div>
        <div><label class="field">받는 사람</label><div class="row" id="tg">${TARGETS.map(t => `<button class="chip ${st.target === t.id ? 'on' : ''}" data-t="${t.id}">${t.name}</button>`).join('')}</div></div>
        <div><label class="field">상황</label><div class="row" id="si"><button class="chip ${st.sit === 'auto' ? 'on' : ''}" data-s="auto">자동</button>${SITUATIONS.map(s => `<button class="chip ${st.sit === s.id ? 'on' : ''}" data-s="${s.id}">${s.name}</button>`).join('')}</div></div>
        <div><label class="field">말투</label><div class="row" id="tn">${TONES.map(t => `<button class="chip ${st.tone === t.id ? 'on' : ''}" data-tone="${t.id}">${t.name}</button>`).join('')}</div></div>
        <div><label class="field" for="lvl">정중도 <b id="lv">${LEVELS[st.level]}</b></label><input type="range" id="lvl" min="0" max="4" value="${st.level}"><div class="row small muted"><span>담백</span><span class="grow"></span><span>황송 🙇</span></div></div>
      </div>
      <div id="out" class="results" aria-live="polite"></div></div>
    </section>`));
  const inp = $('#in');
  inp.value = store.sget('cw-input', '');
  function render() {
    const raw = inp.value.trim();
    store.sset('cw-input', inp.value);
    const out = $('#out');
    if (!raw) { out.innerHTML = '<p class="muted center">문장을 입력하거나 위의 예시를 눌러 보세요.</p>'; return; }
    const sit = st.sit === 'auto' ? detectSituation(raw) : st.sit;
    const list = generate(raw, st.target, sit, st.level, st.tone);
    const toneName = TONES.find(t => t.id === st.tone).name;
    out.innerHTML = `<div class="muted small">${st.sit === 'auto' ? `상황 자동 판단: <b>${SITUATIONS.find(s => s.id === sit).name}</b> · ` : ''}말투: <b>${toneName}</b>${st.tone === 'mail' ? ' · [이름]은 직접 바꿔 주세요' : ''}</div>` +
      list.map((s, k) => `<div class="res card ${st.tone === 'mail' ? 'mail' : ''}"><div class="rt">${esc(s)}</div><div class="row"><span class="muted small">버전 ${k + 1}</span><span class="grow"></span><button class="btn ghost small" data-copy="${k}">복사</button><button class="btn ghost small" data-card="${k}">카드</button></div></div>`).join('');
    $$('[data-copy]').forEach(b => b.onclick = () => copyText(list[Number(b.dataset.copy)]));
    $$('[data-card]').forEach(b => b.onclick = () => { store.sset('cw-card', { before: raw, after: list[Number(b.dataset.card)], target: TARGETS.find(t => t.id === st.target).name, tone: st.tone }); Router.go('/share'); });
  }
  inp.oninput = render;
  $$('[data-ex]').forEach(b => b.onclick = () => { inp.value = b.dataset.ex; render(); });
  $('#dice').onclick = () => { const pool = MORE_EXAMPLES.filter(x => x !== inp.value.trim()); inp.value = pool[Math.floor(Math.random() * pool.length)]; render(); };
  $$('#tg .chip').forEach(b => b.onclick = () => { st.target = b.dataset.t; saveSt(); $$('#tg .chip').forEach(x => x.classList.toggle('on', x === b)); render(); });
  $$('#si .chip').forEach(b => b.onclick = () => { st.sit = b.dataset.s; saveSt(); $$('#si .chip').forEach(x => x.classList.toggle('on', x === b)); render(); });
  $$('#tn .chip').forEach(b => b.onclick = () => { st.tone = b.dataset.tone; saveSt(); $$('#tn .chip').forEach(x => x.classList.toggle('on', x === b)); render(); });
  $('#lvl').oninput = e => { st.level = Number(e.target.value); $('#lv').textContent = LEVELS[st.level]; saveSt(); render(); };
  render();
});

/* ---------- 상황별 모음 ---------- */
// [모음 이름, 아이콘, 예시 문장(변환기로 보내기), 문구들]
const PHRASES = [
  ['부탁할 때', '🙏', '발표 자료 검토해줘', ['바쁘시겠지만', '번거로우시겠지만', '혹시 시간 괜찮으시다면', '괜찮으시다면', '부담 갖지 마시고', '가능하실 때', '어려우시면 편하게 말씀해 주세요']],
  ['재촉할 때', '⏰', '자료 아직이야? 빨리 보내', ['혹시 진행 상황 여쭤봐도 될까요?', '확인 차 다시 연락드립니다.', '혹시 놓치셨을까 해서 다시 말씀드립니다.', '편하실 때 회신 부탁드립니다.', '일정상 ○일까지 받을 수 있으면 큰 도움이 됩니다.', '바쁘신 줄 알지만 한 번 더 여쭙습니다.']],
  ['거절할 때', '🙅', '이번 회식 못 가', ['말씀은 정말 감사하지만', '아쉽지만 이번에는', '마음은 굴뚝같지만', '다음 기회에 꼭', '지금은 맡은 일이 많아 어렵습니다.', '제안해 주셔서 감사합니다. 다만', '대신 ○○는 도와드릴 수 있어요.']],
  ['사과할 때', '🙇', '깜빡했어 미안', ['불편을 드려 죄송합니다.', '제가 미처 챙기지 못했습니다.', '앞으로 더 신경 쓰겠습니다.', '양해 부탁드립니다.', '확인이 늦어 죄송합니다.', '바로 바로잡겠습니다.', '번거롭게 해 드려 죄송합니다.']],
  ['확인·문의할 때', '❓', '회의 몇 시야?', ['확인차 여쭙습니다.', '혹시 제가 잘못 알고 있다면 말씀 부탁드립니다.', '한 가지 여쭤봐도 될까요?', '궁금한 점이 있어 연락드립니다.', '○○로 이해했는데 맞을까요?']],
  ['일정 조율할 때', '📅', '내일 시간 돼?', ['편하신 시간 알려 주시면 맞추겠습니다.', '혹시 ○일 ○시는 괜찮으실까요?', '일정이 바뀌어 다시 연락드립니다.', '어려우시면 다른 날로 조정해도 괜찮습니다.', '시간 내주셔서 감사합니다.']],
  ['감사할 때', '💐', '도와줘서 고마워', ['덕분에 잘 마무리했습니다.', '바쁘신 와중에 시간 내주셔서 감사합니다.', '세심하게 챙겨 주셔서 감사합니다.', '말씀해 주신 덕분에 많이 배웠습니다.', '다음에 꼭 보답하겠습니다.']],
  ['의견 줄 때', '📝', '이 부분 다시 해', ['전체적으로 좋은데, 한 가지만 덧붙이자면', '이 부분은 이렇게 바꿔 보면 어떨까요?', '제 생각에는 ○○도 함께 보면 좋을 것 같아요.', '좋은 방향이라고 생각합니다. 다만', '혹시 이런 방법도 고려해 보셨을까요?']],
  ['휴가·조퇴 말할 때', '🌴', '내일 쉴게', ['개인 사정으로 ○일 하루 쉬려고 합니다.', '급한 일은 미리 정리해 두겠습니다.', '부재 중 연락은 ○○님께 부탁드려 두었습니다.', '갑작스럽게 말씀드려 죄송합니다.', '양해해 주시면 감사하겠습니다.']],
  ['단톡방에서', '💬', '단톡방에서 떠들지 마', ['혹시 이 내용은 따로 이야기해 볼까요?', '공지 위주로 써 주시면 확인이 쉬울 것 같아요!', '다들 바쁘실 텐데 짧게 공유드릴게요.', '확인하신 분은 이모지 하나만 남겨 주세요 🙏', '늦은 시간에 죄송합니다.']],
  ['마무리할 때', '🌙', '확인 부탁해', ['늘 감사합니다.', '좋은 하루 보내세요.', '확인 부탁드립니다.', '궁금하신 점은 언제든 말씀 주세요.', '편안한 저녁 보내세요.', '다음 주에 뵙겠습니다.']]
];
Router.on('/templates', root => {
  const total = PHRASES.reduce((n, p) => n + p[3].length, 0);
  root.append(h(`<section class="stack"><h1>상황별 쿠션어</h1><p class="muted">${PHRASES.length}가지 상황 · ${total}개 문구. 누르면 바로 복사돼요.</p>
    <input id="tq" type="search" placeholder="문구 찾기 (예: 감사, 일정)" aria-label="문구 찾기">
    <div class="row tabs" id="tt"><button class="chip small on" data-cat="all">전체</button>${PHRASES.map(([k, ic], i) => `<button class="chip small" data-cat="${i}">${ic} ${k}</button>`).join('')}</div>
    <div class="tgrid" id="tl">${PHRASES.map(([k, ic, ex, arr], i) => `<div class="card tcat" data-i="${i}"><div class="row"><b>${ic} ${k}</b><span class="grow"></span><button class="btn ghost small" data-try="${esc(ex)}" title="이 상황 예시를 변환기에서 보기">“${esc(ex)}” 바꿔 보기 →</button></div><div class="row phr">${arr.map(p => `<button class="chip" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div></div>`).join('')}</div>
    <p class="muted center hidden" id="tnone">찾는 문구가 없어요. 다른 낱말로 찾아보세요.</p></section>`));
  let cat = 'all';
  function filter() {
    const q = $('#tq').value.trim();
    let shown = 0;
    $$('.tcat').forEach(c => {
      const okCat = cat === 'all' || c.dataset.i === cat;
      let any = 0;
      c.querySelectorAll('[data-p]').forEach(b => { const ok = !q || b.dataset.p.includes(q) || c.querySelector('b').textContent.includes(q); b.classList.toggle('hidden', !ok); any += ok; });
      const vis = okCat && any > 0; c.classList.toggle('hidden', !vis); shown += vis;
    });
    $('#tnone').classList.toggle('hidden', shown > 0);
  }
  $('#tq').oninput = filter;
  $$('#tt .chip').forEach(b => b.onclick = () => { cat = b.dataset.cat; $$('#tt .chip').forEach(x => x.classList.toggle('on', x === b)); filter(); });
  $$('[data-p]').forEach(b => b.onclick = () => copyText(b.dataset.p));
  $$('[data-try]').forEach(b => b.onclick = () => { store.sset('cw-input', b.dataset.try); Router.go('/'); });
});

/* ---------- 비포/애프터 카드 ---------- */
Router.on('/share', root => {
  const c = store.sget('cw-card', null);
  if (!c) { Router.go('/'); return; }
  const tn = (TONES.find(t => t.id === c.tone) || TONES[0]).name;
  root.append(h(`
    <section class="stack">
      <div class="ba card" id="card">
        <div class="lab">원래 하고 싶던 말</div><div class="before">${esc(c.before)}</div>
        <div class="arrow">↓ 쿠션 장착 (${esc(c.target)}께 · ${esc(tn)})</div>
        <div class="after ${c.tone === 'mail' ? 'mail' : ''}">${esc(c.after)}</div>
        <div class="muted small">쿠션어 자동 생성기</div>
      </div>
      <div class="row"><button class="btn primary grow" id="save">이미지 저장</button><button class="btn grow" id="cp">문장 복사</button></div>
      <a class="btn ghost block" href="#/">← 다시 바꾸기</a>
    </section>`));
  $('#save').onclick = () => saveImage($('#card'), 'cushion.png');
  $('#cp').onclick = () => copyText(c.after);
});

if (typeof module === 'object') module.exports = { generate, generateBase, applyTone, splitCore, toPolite, toReason, topicOf, detectSituation, TARGETS, SITUATIONS, TONES, PHRASES, MORE_EXAMPLES };
else Router.start($('#app'));
