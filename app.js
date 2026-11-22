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
  { id: 'ask', name: '부탁' }, { id: 'push', name: '재촉' }, { id: 'no', name: '거절' }, { id: 'sorry', name: '사과' }, { id: 'check', name: '확인' }
];
const LEVELS = ['담백', '공손', '정중', '극진', '황송'];
const EXAMPLES = [
  ['보고서 내일까지 내', 'ask'], ['자료 아직이야? 빨리 보내', 'push'], ['그거 못 해', 'no'],
  ['늦어서 미안', 'sorry'], ['회의 3시 맞지?', 'check'], ['이거 좀 고쳐줘', 'ask']
];

/* ---------- 문장 분해 ---------- */
// 반말 명령·요청 끝맺음을 떼어 내고 "동사의 아/어형"과 앞부분(목적어 등)을 얻음
const ENDINGS = ['해주세요', '해 주세요', '해줄래', '해 줄래', '해줘', '해 줘', '해라', '하세요', '하셈', '해요', '해',
  '주세요', '줄래', '줘', '라', '요'];
function stripPunct(s) { return s.trim().replace(/[.!?~ㅋㅎㅠㅜ\s]+$/g, ''); }
function splitCore(raw) {
  let s = stripPunct(raw);
  s = s.replace(/^(야|저기|아니|근데|그리고)\s*,?\s*/, '');
  s = s.replace(/\s*(빨리|당장|얼른|좀)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  // "~해줘/~해 줘" 같은 보조 동사 정리
  let verb = '', rest = s;
  const m = s.match(/^(.*?)(\S+)$/);
  if (m) { rest = m[1].trim(); verb = m[2]; }
  // 끝맺음 정리: "보내줘" → 보내, "해라" → 해, "고쳐" → 고쳐
  let base = verb;
  if (/^(줘|줄래|주세요|주라)$/.test(base)) base = '주';
  else if (/줘$|줄래$|주세요$/.test(base) && base.length > 1) {
    base = base.replace(/(줘|줄래|주세요)$/, '');
    if (!base) { base = '주'; }
  } else if (/(해라|하세요|하셈|해요)$/.test(base)) base = base.replace(/(해라|하세요|하셈|해요)$/, '해');
  else if (/라$/.test(base) && base.length > 1 && !/(어라|아라)$/.test(base)) base = base.replace(/라$/, '');
  else if (/요$/.test(base) && base.length > 1) base = base.replace(/요$/, '');
  return { rest, verb: base, raw: s };
}
const isQuestion = raw => /\?\s*$/.test(raw.trim()) || /(맞지|맞아|거야|했어|됐어|있어|없어|아직이야|이야|니|냐|나요|까)\s*\??$/.test(stripPunct(raw));
function looksNo(raw) { return /(못|안 ?돼|안 ?해|싫어|어려워|불가|없어)/.test(raw); }
function looksSorry(raw) { return /(미안|죄송|잘못|늦어서|깜빡)/.test(raw); }
function detectSituation(raw) {
  if (looksSorry(raw)) return 'sorry';
  if (looksNo(raw)) return 'no';
  if (/(아직|언제|빨리|얼른|당장)/.test(raw)) return 'push';
  if (isQuestion(raw)) return 'check';
  return 'ask';
}

/* ---------- 조립 ---------- */
function request(core, hon) {
  // 아/어형 + 주실 수 있을까요 / 줄 수 있어?
  const obj = core.rest ? core.rest + ' ' : '';
  const v = core.verb || '확인해';
  if (v === '주') return hon ? `${obj}주실 수 있을까요` : `${obj}줄 수 있어`;
  return hon ? `${obj}${v} 주실 수 있을까요` : `${obj}${v} 줄 수 있어`;
}
function requestPlain(core, hon) {
  const obj = core.rest ? core.rest + ' ' : '';
  const v = core.verb || '확인해';
  if (v === '주') return hon ? `${obj}주세요` : `${obj}줘`;
  return hon ? `${obj}${v} 주세요` : `${obj}${v} 줘`;
}
function requestThanks(core) {
  const obj = core.rest ? core.rest + ' ' : '';
  const v = core.verb || '확인해';
  return v === '주' ? `${obj}주시면` : `${obj}${v} 주시면`;
}
function topicOf(raw) {
  // 거절·사과·확인에 쓸 "무엇"을 뽑음
  const s = stripPunct(raw).replace(/(그거|이거|저거)\s*/, '').replace(/\s*(못\s*해|안\s*돼|안\s*해|싫어|어려워|미안해?|죄송해?|맞지|맞아)\s*$/, '').trim();
  return s;
}

const CUSHION = {
  ask: [[''], ['혹시 '], ['바쁘시겠지만 ', '번거로우시겠지만 '], ['정말 번거로우시겠지만, 혹시 시간이 괜찮으시다면 '], ['하늘같이 바쁘신 와중에 이런 말씀 올리기 너무나 송구하오나, 혹시라도 여유가 허락하신다면 ']],
  askF: [[''], ['혹시 '], ['바쁜데 미안하지만 '], ['진짜 바쁜 거 알지만, 혹시 시간 되면 '], ['우리 우정에 기대어 정말 염치없지만, 혹시 정말 혹시 괜찮다면 ']]
};

function generate(raw, targetId, sitId, level) {
  const t = TARGETS.find(x => x.id === targetId);
  const hon = t.hon;
  const core = splitCore(raw);
  const topic = topicOf(raw);
  const L = level;                       // 0~4
  const out = [];
  const add = s => { s = s.replace(/\s+/g, ' ').replace(/\s([,.?!])/g, '$1').trim(); if (s && !out.includes(s)) out.push(s); };

  if (sitId === 'ask' || sitId === 'push') {
    const pre = (hon ? CUSHION.ask : CUSHION.askF)[L];
    if (sitId === 'push') {
      const parts = raw.split(/[?.!]+/).map(x => x.trim()).filter(Boolean);
      const lastCore = splitCore(parts[parts.length - 1]);
      if (parts.length > 1) { core.rest = lastCore.rest; core.verb = lastCore.verb; }
      const first = parts[0].replace(/\s*(아직이야|아직이에요|아직|언제 돼|언제 와|언제|됐어|어떻게 됐어)\s*/g, ' ').replace(/\s*(빨리|얼른|당장)\s*/g, ' ').trim();
      const what = (parts.length > 1 ? first : core.rest) || '말씀드린 건';
      if (parts.length > 1 && !core.rest && what !== '말씀드린 건') core.rest = what;
      if (hon) {
        add(['', '혹시 ', '바쁘신 와중에 죄송하지만, ', '번거롭게 해 드려 정말 죄송하지만, ', '거듭 여쭙게 되어 몸 둘 바를 모르겠사오나, '][L] + `${what} 진행 상황 여쭤봐도 될까요?`);
        add(['', '혹시 ', '바쁘시겠지만 ', '정말 번거로우시겠지만 ', '송구스럽기 그지없으나 '][L] + requestThanks(core) + ' 감사하겠습니다.');
        add(`앞서 부탁드린 ${what} 관련해서 ${['확인 부탁드려요.', '한 번 확인 부탁드립니다.', '혹시 확인 가능하실지 여쭙습니다.', '시간 되실 때 확인해 주시면 정말 감사하겠습니다.', '언제든 편하실 때 살펴 주신다면 그 은혜 잊지 않겠습니다.'][L]}`);
      } else {
        add(['', '혹시 ', '바쁜데 미안! ', '정말 미안한데 ', '이렇게 자꾸 물어봐서 진짜 미안한데, '][L] + `${what} 어떻게 되고 있어?`);
        add(['', '혹시 ', '시간 될 때 ', '진짜 시간 될 때 ', '너무너무 미안하지만 '][L] + request(core, false) + '?');
      }
    } else {
      pre.forEach(p => add(p + (hon ? request(core, true) + '?' : request(core, false) + '?')));
      if (hon) add((L >= 2 ? pick(pre) : '') + requestThanks(core) + [' 좋겠습니다.', ' 감사하겠습니다.', ' 정말 감사하겠습니다.', ' 큰 도움이 될 것 같습니다. 감사합니다.', ' 이 은혜는 평생 잊지 않겠습니다.'][L]);
      else add((L >= 2 ? pick(pre) : '') + requestPlain(core, false) + [' ', '~ 고마워!', '~ 진짜 고마워!', '~ 밥 한 번 살게!', '~ 이 은혜 평생 갚을게!'][L]);
      if (L <= 1) add(requestPlain(core, hon) + (hon ? '.' : '!'));
    }
  } else if (sitId === 'no') {
    const what = topic ? `${topic}` : (hon ? '말씀하신 건' : '그건');
    if (hon) {
      add(['', '말씀 주셔서 감사합니다. ', '좋은 제안 주셔서 감사합니다. ', '이렇게 먼저 생각해 주셔서 진심으로 감사드립니다. ', '저를 떠올려 주신 것만으로도 영광이옵니다. '][L] + `다만 ${what}${/[가-힣]$/.test(what) && hasBatchim(what) ? '은' : '는'} ${['어렵습니다.', '어려울 것 같습니다.', '이번에는 어려울 것 같습니다.', '여러 사정으로 이번에는 정말 어려울 것 같아 죄송합니다.', '하늘이 무너져도 이번만큼은 어려울 듯하여 송구한 마음 금할 길이 없습니다.'][L]}`);
      add(`${['', '아쉽지만 ', '정말 아쉽지만 ', '마음은 굴뚝같지만 ', '천 번 만 번 돕고 싶은 마음이지만 '][L]}${what}${hasBatchim(what) ? '은' : '는'} 제가 맡기 어려울 것 같습니다. ${['', '양해 부탁드립니다.', '너그러이 양해 부탁드립니다.', '다른 방법이 있으면 함께 찾아보겠습니다.', '부디 넓은 아량으로 헤아려 주시옵소서.'][L]}`);
    } else {
      add(['', '아 ', '미안 ', '진짜 미안한데 ', '너무너무 미안한데 '][L] + `${topic ? what + (hasBatchim(what) ? '은' : '는') : what} ${['안 될 것 같아.', '좀 어려울 것 같아.', '이번엔 어려울 것 같아 ㅠ', '이번엔 진짜 어려울 것 같아. 다음엔 꼭 할게!', '우리 우정을 걸고 이번만은 봐줘…'][L]}`);
    }
  } else if (sitId === 'sorry') {
    const what = topic.replace(/(해서|어서|아서)$/, '$1') || '';
    if (hon) {
      add(`${what ? what + ' ' : ''}${['죄송합니다.', '정말 죄송합니다.', '심려를 끼쳐 드려 정말 죄송합니다.', '불편을 드린 점 진심으로 사과드립니다. 다음에는 이런 일이 없도록 하겠습니다.', '제 불찰로 이런 일이 생겨 석고대죄하는 심정으로 사죄드립니다.'][L]}`);
      add(`${['', '먼저 ', '무엇보다 먼저 ', '변명의 여지 없이 ', '천만번 엎드려 '][L]}${['사과드립니다.', '사과드립니다. 바로 챙기겠습니다.', '사과드립니다. 앞으로 더 신경 쓰겠습니다.', '사과드리며, 재발하지 않도록 꼼꼼히 챙기겠습니다.', '용서를 구하옵니다. 앞으로는 시계를 세 개 차고 다니겠습니다.'][L]}`);
    } else {
      add(`${what ? what + ' ' : ''}${['미안.', '미안해!', '진짜 미안해 ㅠ', '정말 미안해. 다음엔 안 그럴게!', '내가 죽을 죄를 졌다… 밥 살게 용서해 줘'][L]}`);
    }
  } else if (sitId === 'check') {
    const what = stripPunct(raw).replace(/\s*(맞지|맞아|맞나|맞죠)\s*\??$/, '');
    if (hon) {
      add(`${['', '혹시 ', '확인차 여쭙습니다. ', '번거로우시겠지만 확인 한 번 부탁드려도 될까요? ', '감히 여쭙건대, '][L]}${what} 맞을까요?`);
      const ro = what + (hasBatchim(what) && !endsWithRieul(what) ? '으로' : '로');
      const ra = what + (hasBatchim(what) ? '이라' : '라');
      add([`${what} 맞나요?`, `${ro} 알고 있는데, 맞을까요?`, `${ro} 알고 있는데 혹시 변동이 있을까요?`, `${ro} 이해하고 있는데, 제가 잘못 알고 있다면 말씀 부탁드립니다.`, `${ra} 굳게 믿고 있사오나 혹여 제 착오라면 너그러이 바로잡아 주시옵소서.`][L]);
    } else {
      add(`${['', '혹시 ', '확인차! ', '혹시 내가 잘못 알고 있을까 봐 ', '귀찮게 해서 미안한데 '][L]}${what} 맞지?`);
    }
  }
  return out.slice(0, 3).map(s => s.replace(/\s{2,}/g, ' '));
}
function endsWithRieul(word) {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 === 8;
}
function hasBatchim(word) {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

/* ---------- 변환기 ---------- */
const st = store.get('cw-state', { target: 'prof', sit: 'auto', level: 2 });
const saveSt = () => store.set('cw-state', st);

Router.on('/', root => {
  root.append(h(`
    <section class="stack">
      <div class="hero"><h1>그 말,<br>조금만 <span class="soft">말랑하게</span></h1>
      <p class="muted">하고 싶은 말을 그대로 적으면, 받는 사람에 맞는 부드러운 말투로 바꿔 드려요.</p></div>
      <div class="split"><div class="card stack sticky">
        <textarea id="in" rows="2" maxlength="80" placeholder="예) 보고서 내일까지 내"></textarea>
        <div class="row ex">${EXAMPLES.map(([e]) => `<button class="chip small" data-ex="${esc(e)}">${esc(e)}</button>`).join('')}</div>
        <div><label class="field">받는 사람</label><div class="row" id="tg">${TARGETS.map(t => `<button class="chip ${st.target === t.id ? 'on' : ''}" data-t="${t.id}">${t.name}</button>`).join('')}</div></div>
        <div><label class="field">상황</label><div class="row" id="si"><button class="chip ${st.sit === 'auto' ? 'on' : ''}" data-s="auto">자동</button>${SITUATIONS.map(s => `<button class="chip ${st.sit === s.id ? 'on' : ''}" data-s="${s.id}">${s.name}</button>`).join('')}</div></div>
        <div><label class="field">정중도 <b id="lv">${LEVELS[st.level]}</b></label><input type="range" id="lvl" min="0" max="4" value="${st.level}"><div class="row small muted"><span>담백</span><span class="grow"></span><span>황송 🙇</span></div></div>
      </div>
      <div id="out" class="results"></div></div>
    </section>`));
  const inp = $('#in');
  inp.value = store.sget('cw-input', '');
  function render() {
    const raw = inp.value.trim();
    store.sset('cw-input', inp.value);
    const out = $('#out');
    if (!raw) { out.innerHTML = '<p class="muted center">문장을 입력하거나 위의 예시를 눌러 보세요.</p>'; return; }
    const sit = st.sit === 'auto' ? detectSituation(raw) : st.sit;
    const list = generate(raw, st.target, sit, st.level);
    out.innerHTML = `<div class="muted small">${st.sit === 'auto' ? `상황 자동 판단: <b>${SITUATIONS.find(s => s.id === sit).name}</b>` : ''}</div>` +
      list.map((s, k) => `<div class="res card"><div class="rt">${esc(s)}</div><div class="row"><span class="muted small">버전 ${k + 1}</span><span class="grow"></span><button class="btn ghost small" data-copy="${k}">복사</button><button class="btn ghost small" data-card="${k}">카드</button></div></div>`).join('');
    $$('[data-copy]').forEach(b => b.onclick = () => copyText(list[Number(b.dataset.copy)]));
    $$('[data-card]').forEach(b => b.onclick = () => { store.sset('cw-card', { before: raw, after: list[Number(b.dataset.card)], target: TARGETS.find(t => t.id === st.target).name }); Router.go('/share'); });
  }
  inp.oninput = render;
  $$('[data-ex]').forEach(b => b.onclick = () => { inp.value = b.dataset.ex; render(); });
  $$('#tg .chip').forEach(b => b.onclick = () => { st.target = b.dataset.t; saveSt(); $$('#tg .chip').forEach(x => x.classList.toggle('on', x === b)); render(); });
  $$('#si .chip').forEach(b => b.onclick = () => { st.sit = b.dataset.s; saveSt(); $$('#si .chip').forEach(x => x.classList.toggle('on', x === b)); render(); });
  $('#lvl').oninput = e => { st.level = Number(e.target.value); $('#lv').textContent = LEVELS[st.level]; saveSt(); render(); };
  render();
});

/* ---------- 상황별 모음 ---------- */
const PHRASES = {
  '부탁할 때': ['바쁘시겠지만', '번거로우시겠지만', '혹시 시간 괜찮으시다면', '괜찮으시다면', '부담 갖지 마시고'],
  '재촉할 때': ['혹시 진행 상황 여쭤봐도 될까요?', '확인 차 다시 연락드립니다.', '혹시 놓치셨을까 해서 다시 말씀드립니다.', '편하실 때 회신 부탁드립니다.'],
  '거절할 때': ['말씀은 정말 감사하지만', '아쉽지만 이번에는', '마음은 굴뚝같지만', '다음 기회에 꼭'],
  '사과할 때': ['불편을 드려 죄송합니다.', '제가 미처 챙기지 못했습니다.', '앞으로 더 신경 쓰겠습니다.', '양해 부탁드립니다.'],
  '마무리할 때': ['늘 감사합니다.', '좋은 하루 보내세요.', '확인 부탁드립니다.', '궁금하신 점은 언제든 말씀 주세요.']
};
Router.on('/templates', root => {
  root.append(h(`<section class="stack"><h1>상황별 쿠션어</h1><p class="muted">누르면 바로 복사돼요.</p>
    ${Object.entries(PHRASES).map(([k, arr]) => `<div class="card"><b>${k}</b><div class="row phr">${arr.map(p => `<button class="chip" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div></div>`).join('')}</section>`));
  $$('[data-p]').forEach(b => b.onclick = () => copyText(b.dataset.p));
});

/* ---------- 비포/애프터 카드 ---------- */
Router.on('/share', root => {
  const c = store.sget('cw-card', null);
  if (!c) { Router.go('/'); return; }
  root.append(h(`
    <section class="stack">
      <div class="ba card" id="card">
        <div class="lab">원래 하고 싶던 말</div><div class="before">${esc(c.before)}</div>
        <div class="arrow">↓ 쿠션 장착 (${esc(c.target)}께)</div>
        <div class="after">${esc(c.after)}</div>
        <div class="muted small">쿠션어 자동 생성기</div>
      </div>
      <div class="row"><button class="btn primary grow" id="save">이미지 저장</button><button class="btn grow" id="cp">문장 복사</button></div>
      <a class="btn ghost block" href="#/">← 다시 바꾸기</a>
    </section>`));
  $('#save').onclick = () => saveImage($('#card'), 'cushion.png');
  $('#cp').onclick = () => copyText(c.after);
});

if (typeof module === 'object') module.exports = { generate, detectSituation, TARGETS, SITUATIONS };
else Router.start($('#app'));
