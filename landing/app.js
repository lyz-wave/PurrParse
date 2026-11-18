import { VIDEO_CHAPTERS, WORKBENCH_MODES, LIBRARY_DOCS, MODULE_SHOWCASES } from './data.js';

const state = {
  theme: 'paper',
  modeId: 'academic',
  depth: 'intensive', // 'intensive' | 'pure'
  pureLang: 'zh',     // 'en' | 'zh'
  hlFilter: 'all',    // 'all' | 'core' | 'concept' | 'evidence' | 'method'
  selectedDagIdx: 0,
  evals: {},          // unitId -> 'ok' | 'fuzzy' | 'bad'
  qaHistory: {},      // unitId -> Array<{scope, snippet, question, answerText, evidenceTarget, evidenceLabel}>
  libraryGroup: 'domain',
  stickerTilted: true,
  stickersVisible: true,
  activeQaModal: null, // { unitId, snippet, defaultPrompt, answerHtml, evidenceTarget, evidenceLabel, scope }
  journalDraft: '',
  checkedSteps: {},
  moduleShots: Object.fromEntries(MODULE_SHOWCASES.map(m => [m.id, m.defaultShot || 0])),
};

// Seed default Q&A history from data
for (const mode of Object.values(WORKBENCH_MODES)) {
  for (const unit of mode.units) {
    state.qaHistory[unit.id] = [...unit.defaultQaHistory];
  }
}

// ── 1. Theme Controller (Synced across Whole Page + Interactive Sticker Workbench) ──
function applyTheme(next) {
  state.theme = next;
  document.documentElement.setAttribute('data-theme', next);
  document.querySelectorAll('[data-set-theme]').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.setTheme === next));
  });
}

document.querySelectorAll('[data-set-theme]').forEach(btn => {
  btn.addEventListener('click', () => applyTheme(btn.dataset.setTheme));
});

// ── 2. StickItUp-Inspired 3D Vinyl Peel Sticker Hover + Bilibili HQ Cat Meow Engine ──
const SFX_URLS = [
  './media/sfx/meow.mp3',
];
let audioCtx = null;
const rawSfxBuffers = [];
const decodedSfx = [];
const htmlAudioPool = [];
let preloadingSfx = false;
let sfxIdx = 0;
let poolCursor = 0;
let meowPlayedOnce = false;

function preloadHtmlAudioPool() {
  if (htmlAudioPool.length > 0) return;
  for (let i = 0; i < 4; i++) {
    const url = SFX_URLS[i % SFX_URLS.length];
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = 0.88;
    try { audio.load(); } catch { /* ignore */ }
    htmlAudioPool.push(audio);
  }
}

function preloadRawSfx() {
  preloadHtmlAudioPool();
  if (preloadingSfx) return;
  preloadingSfx = true;
  SFX_URLS.forEach(async (url, idx) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const arr = await res.arrayBuffer();
      rawSfxBuffers[idx] = arr;
      if (audioCtx && !decodedSfx[idx]) {
        decodedSfx[idx] = await audioCtx.decodeAudioData(arr.slice(0));
      }
    } catch {
      // Ignore; persistent HTMLAudio pool handles offline/file:// paths
    }
  });
}

function ensureAudioContext() {
  preloadRawSfx();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
    audioCtx.resume().catch(() => {});
  }
  rawSfxBuffers.forEach((arr, idx) => {
    if (arr && !decodedSfx[idx]) {
      audioCtx.decodeAudioData(arr.slice(0))
        .then(buf => { decodedSfx[idx] = buf; })
        .catch(() => {});
    }
  });
  return audioCtx;
}

function playViaHtmlAudio(rate) {
  preloadHtmlAudioPool();
  const audio = htmlAudioPool[poolCursor++ % htmlAudioPool.length];
  if (!audio) return false;
  try {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = 0.88;
    // Keep playbackRate 1.0 on HTMLAudioElement to prevent short-clip Safari glitches
    audio.playbackRate = 1.0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Last-resort fresh Audio element if pooled node became stale
        const fresh = new Audio(SFX_URLS[0]);
        fresh.volume = 0.88;
        fresh.playbackRate = rate;
        fresh.play().catch(() => {});
      });
    }
    return true;
  } catch {
    return false;
  }
}

function playCatMeow() {
  const ctx = ensureAudioContext();
  const pickIdx = (sfxIdx++) % SFX_URLS.length;
  const buf = decodedSfx[pickIdx];
  const rate = meowPlayedOnce ? (0.97 + Math.random() * 0.06) : 1.0;
  meowPlayedOnce = true;

  // Only fire Web Audio synchronously when AudioContext is actively running;
  // otherwise use synchronous HTMLAudioElement inside this click gesture while resume() unlocks Web Audio.
  if (ctx && buf && ctx.state === 'running') {
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = 0.88;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
      return true;
    } catch {
      // fall through to HTMLAudio pool
    }
  }

  return playViaHtmlAudio(rate);
}

const MEOW_LABELS = ['喵——！', '喵呜~', '咪——！', '喵~！'];

function triggerStickerMeow(el) {
  playCatMeow();
  el.classList.remove('is-squawking');
  void el.offsetWidth;
  el.classList.add('is-squawking');
  el.querySelectorAll('.squeak-pop').forEach(n => n.remove());
  const pop = document.createElement('span');
  pop.className = 'squeak-pop';
  pop.textContent = MEOW_LABELS[Math.floor(Math.random() * MEOW_LABELS.length)];
  el.appendChild(pop);
  setTimeout(() => pop.remove(), 650);
}

function bindVinylHover(root = document) {
  root.querySelectorAll('.vinyl-sticker').forEach(el => {
    if (el.dataset.vinylBound) return;
    el.dataset.vinylBound = '1';
    if (!el.getAttribute('title')) {
      el.setAttribute('title', '点击听猫咪叫声（喵~）');
    }
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--rx', `${(-ny * 20).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${(nx * 22).toFixed(2)}deg`);
      el.style.setProperty('--gx', `${(50 + nx * 70).toFixed(1)}%`);
      el.style.setProperty('--gy', `${(50 + ny * 70).toFixed(1)}%`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
      el.style.removeProperty('--gx');
      el.style.removeProperty('--gy');
    });
    el.addEventListener('click', e => {
      if (e.target.closest('.sticker-bubble')) return;
      triggerStickerMeow(el);
    });
  });
}

function initVinylStickers() {
  bindVinylHover(document);
  preloadRawSfx();
  // Unlock Web Audio cleanly on genuine click/keydown/touchend gestures (safer than pointerdown in Safari)
  const unlock = () => ensureAudioContext();
  window.addEventListener('click', unlock, { once: true, passive: true });
  window.addEventListener('touchend', unlock, { once: true, passive: true });

  const stickerToggle = document.getElementById('toggle-stickers');
  if (stickerToggle) {
    stickerToggle.addEventListener('click', () => {
      state.stickersVisible = !state.stickersVisible;
      document.body.classList.toggle('stickers-hidden', !state.stickersVisible);
      stickerToggle.textContent = state.stickersVisible ? '隐藏桌面贴纸' : '显示桌面贴纸';
    });
  }

  const tiltToggle = document.getElementById('toggle-tilt');
  const wbShell = document.getElementById('workbench-shell');
  if (tiltToggle && wbShell) {
    tiltToggle.addEventListener('click', () => {
      state.stickerTilted = !state.stickerTilted;
      wbShell.classList.toggle('is-tilted', state.stickerTilted);
      tiltToggle.textContent = state.stickerTilted ? '展平正视视角' : '恢复贴纸微倾';
    });
  }
}

// ── 3. Showreel Video Player + 6-Chapter Synchronized Navigation ──
function initVideoShowreel() {
  const video = document.getElementById('showcase-video');
  const centerPlay = document.getElementById('video-center-play');
  const playBtn = document.getElementById('v-play-btn');
  const muteBtn = document.getElementById('v-mute-btn');
  const scrub = document.getElementById('v-scrub');
  const scrubFill = document.getElementById('v-scrub-fill');
  const timeLabel = document.getElementById('v-time-label');
  const chapterContainer = document.getElementById('chapter-strip');

  if (!video || !chapterContainer) return;

  // Render chapter buttons
  chapterContainer.innerHTML = '';
  VIDEO_CHAPTERS.forEach((ch, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chapter-pill' + (idx === 0 ? ' is-active' : '');
    btn.dataset.start = String(ch.start);
    btn.innerHTML = `<span class="c-t">${ch.timeLabel}</span><span class="c-name">${ch.name}</span>`;
    btn.addEventListener('click', () => {
      video.currentTime = ch.start;
      video.muted = false;
      video.play().catch(() => {});
      syncVideoUI();
    });
    chapterContainer.appendChild(btn);
  });

  const fmt = sec => {
    const s = Math.max(0, Math.floor(sec));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  function syncVideoUI() {
    const playing = !video.paused && !video.ended;
    centerPlay?.classList.toggle('is-hidden', playing);
    if (playBtn) playBtn.textContent = playing ? '暂停' : '播放';
    if (muteBtn) muteBtn.textContent = video.muted ? '开启原声' : '配乐已开';
    const dur = video.duration || 45;
    const pct = Math.min(100, Math.max(0, (video.currentTime / dur) * 100));
    if (scrubFill) scrubFill.style.width = `${pct}%`;
    if (timeLabel) timeLabel.textContent = `${fmt(video.currentTime)} / ${fmt(dur)}`;

    // Highlight active chapter synced to playback time
    let activeIdx = 0;
    for (let i = 0; i < VIDEO_CHAPTERS.length; i++) {
      if (video.currentTime + 0.15 >= VIDEO_CHAPTERS[i].start) activeIdx = i;
    }
    chapterContainer.querySelectorAll('.chapter-pill').forEach((el, i) => {
      el.classList.toggle('is-active', i === activeIdx);
    });
  }

  const togglePlay = () => {
    if (video.paused || video.ended) {
      video.muted = false;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    syncVideoUI();
  };

  centerPlay?.addEventListener('click', togglePlay);
  video.addEventListener('click', togglePlay);
  playBtn?.addEventListener('click', togglePlay);
  muteBtn?.addEventListener('click', () => {
    video.muted = !video.muted;
    syncVideoUI();
  });

  scrub?.addEventListener('click', e => {
    const r = scrub.getBoundingClientRect();
    const k = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    video.currentTime = k * (video.duration || 45);
    syncVideoUI();
  });

  video.addEventListener('timeupdate', syncVideoUI);
  video.addEventListener('play', syncVideoUI);
  video.addEventListener('pause', syncVideoUI);
  video.addEventListener('ended', syncVideoUI);
  syncVideoUI();
}

// ── 4. Live Interactive Mini Prism Workbench Rendering ──
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function engageWorkbench() {
  document.getElementById('workbench-shell')?.classList.add('is-engaged');
}

function scrollToUnit(unitId) {
  engageWorkbench();
  if (state.depth === 'pure') {
    state.depth = 'intensive';
    renderWorkbench();
  }
  requestAnimationFrame(() => {
    const card = document.getElementById(`wb-unit-${unitId}`);
    const viewport = document.getElementById('wb-viewport');
    if (card && viewport) {
      const top = card.offsetTop - 16;
      viewport.scrollTo({ top, behavior: 'smooth' });
      card.classList.add('is-targeted');
      setTimeout(() => card.classList.remove('is-targeted'), 1600);
    }
  });
}

function renderBespokeFooter(mode) {
  const b = mode.bespokeFooter;
  if (!b) return '';
  if (b.kind === 'socratic') {
    return `
      <div class="wb-bespoke-card">
        <div class="wb-bespoke-head">
          <span class="wb-bespoke-tag">${escapeHtml(b.tag)}</span>
          <strong style="font-size:0.84rem;color:var(--heading);">${escapeHtml(b.title)}</strong>
        </div>
        <div style="font-size:0.84rem;font-weight:700;color:var(--heading);margin-bottom:8px;">Q：${escapeHtml(b.question)}</div>
        <details>
          <summary style="cursor:pointer;font-size:0.78rem;color:var(--accent);font-weight:600;">[展开审稿人级参考解析]</summary>
          <p style="margin:8px 0 0;font-size:0.8rem;line-height:1.6;color:var(--ink-muted);">${escapeHtml(b.answer)}</p>
        </details>
      </div>
    `;
  }
  if (b.kind === 'journal') {
    return `
      <div class="wb-bespoke-card">
        <div class="wb-bespoke-head">
          <span class="wb-bespoke-tag">${escapeHtml(b.tag)}</span>
          <strong style="font-size:0.84rem;color:var(--heading);">${escapeHtml(b.title)}</strong>
        </div>
        <label style="display:block;font-size:0.8rem;font-weight:600;color:var(--heading);margin-bottom:6px;">${escapeHtml(b.promptLabel)}</label>
        <textarea id="wb-journal-mini" rows="2" placeholder="${escapeHtml(b.placeholder)}" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface-subtle);color:var(--ink);font:inherit;font-size:0.8rem;margin-bottom:10px;">${escapeHtml(state.journalDraft)}</textarea>
        <div style="display:grid;gap:5px;">
          ${b.checklist
            .map(
              (item, idx) => `
              <label style="display:flex;align-items:center;gap:8px;font-size:0.78rem;color:var(--ink-muted);cursor:pointer;">
                <input type="checkbox" data-mini-chk="c${idx}" ${state.checkedSteps[`c${idx}`] ? 'checked' : ''} />
                <span>${escapeHtml(item)}</span>
              </label>`,
            )
            .join('')}
        </div>
      </div>
    `;
  }
  if (b.kind === 'diff') {
    return `
      <div class="wb-bespoke-card">
        <div class="wb-bespoke-head">
          <span class="wb-bespoke-tag">${escapeHtml(b.tag)}</span>
          <strong style="font-size:0.84rem;color:var(--heading);">${escapeHtml(b.title)}</strong>
        </div>
        <div class="wb-diff-grid">
          <pre class="wb-diff-box is-before">${escapeHtml(b.beforeCode)}</pre>
          <pre class="wb-diff-box is-after">${escapeHtml(b.afterCode)}</pre>
        </div>
      </div>
    `;
  }
  return '';
}

function renderWorkbench() {
  const mode = WORKBENCH_MODES[state.modeId];
  const viewport = document.getElementById('wb-viewport');
  if (!mode || !viewport) return;

  // Update toolbar states
  document.querySelectorAll('[data-wb-mode]').forEach(btn => {
    btn.setAttribute('aria-selected', String(btn.dataset.wbMode === state.modeId));
  });
  document.querySelectorAll('[data-wb-depth]').forEach(btn => {
    const active = btn.dataset.wbDepth === state.depth;
    btn.classList.toggle('depth-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  // Pure Zen Mode view inside the interactive window
  if (state.depth === 'pure') {
    const isEn = state.pureLang === 'en';
    const title = isEn ? mode.pureTitleEn : mode.pureTitleZh;
    const paragraphsHtml = mode.units
      .map(u => {
        const text = isEn
          ? u.segments.map(s => s.text).join('')
          : u.zh;
        return `<p data-pure-unit="${u.id}">${escapeHtml(text)}</p>`;
      })
      .join('');

    viewport.innerHTML = `
      <div class="wb-pure-container">
        <div class="wb-pure-topbar">
          <div>
            <div style="font-size:0.74rem;color:var(--ink-muted);margin-bottom:4px;">${escapeHtml(mode.tabLabel)} · 通读纯净模式（760px 无干扰居中版式）</div>
            <h2 class="wb-pure-title">${escapeHtml(title)}</h2>
          </div>
          <div class="wb-lang-switch">
            <button type="button" data-pure-lang="en" aria-pressed="${isEn}">英文/原稿</button>
            <button type="button" data-pure-lang="zh" aria-pressed="${!isEn}">中文稿</button>
          </div>
        </div>
        <div class="wb-pure-body">${paragraphsHtml}</div>
        <div class="wb-pure-dock">
          <span style="font-size:0.72rem;color:var(--ink-muted);">按 Esc 或点击返回</span>
          <button type="button" id="wb-exit-pure">切换精读工作台</button>
        </div>
      </div>
    `;

    viewport.querySelectorAll('[data-pure-lang]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.pureLang = btn.dataset.pureLang;
        renderWorkbench();
      });
    });
    viewport.querySelector('#wb-exit-pure')?.addEventListener('click', () => {
      state.depth = 'intensive';
      renderWorkbench();
    });
    return;
  }

  // Compute live mastery counter across active doc units
  const okCount = mode.units.filter(u => state.evals[u.id] === 'ok').length;
  const qaTotal = mode.units.reduce((acc, u) => acc + (state.qaHistory[u.id]?.length || 0), 0);

  const dagHtml = mode.dag
    .map((node, i) => `
      ${i > 0 ? '<span class="wb-dag-arrow">-></span>' : ''}
      <button type="button" class="wb-dag-node ${state.selectedDagIdx === i ? 'is-selected' : ''}" data-dag-idx="${i}" data-target-unit="${node.targetUnit}">
        <span class="n-title">${escapeHtml(node.title)}</span>
        <span class="n-sub">${escapeHtml(node.sub)}</span>
      </button>
    `)
    .join('');

  const unitsHtml = mode.units
    .map(u => {
      const evalState = state.evals[u.id] || null;
      const qas = state.qaHistory[u.id] || [];
      const segsHtml = u.segments
        .map((seg, sIdx) => {
          if (!seg.kind) return escapeHtml(seg.text);
          const dim = state.hlFilter !== 'all' && state.hlFilter !== seg.kind ? 'hl-dimmed' : '';
          return `<span class="hl-span hl-${seg.kind} is-clickable ${dim}" data-qa-unit="${u.id}" data-qa-seg="${sIdx}" title="点击向 AI 追问该片段">${escapeHtml(seg.text)}</span>`;
        })
        .join('');

      const qaCornerHtml = qas.length
        ? `<button type="button" class="wb-qa-corner" data-open-qa-unit="${u.id}">[已追问 ${qas.length} 次]</button>`
        : '';

      const qaDrawerHtml = qas.length
        ? `<div class="wb-qa-drawer">
            <div style="font-weight:700;color:var(--heading);font-size:0.75rem;">[本段 AI 追问与证据记录]（累计 ${qas.length} 次）</div>
            ${qas
              .map(
                q => `<div class="wb-qa-entry">
                  <div style="font-weight:700;margin-bottom:4px;">Q：${escapeHtml(q.question)}</div>
                  <div style="color:var(--ink-muted);font-size:0.78rem;line-height:1.55;">${q.answerHtml}</div>
                </div>`,
              )
              .join('')}
          </div>`
        : '';

      return `
        <article id="wb-unit-${u.id}" class="wb-unit-card ${qas.length ? 'has-qa' : ''}">
          ${qaCornerHtml}
          <div class="wb-unit-grid">
            <div>
              <div class="wb-unit-meta">
                <span class="wb-unit-id">${escapeHtml(u.unitLabel)}</span>
                <span class="wb-core-tag">${escapeHtml(u.coreBadge)}</span>
                <button type="button" class="wb-action-qa" data-open-qa-unit="${u.id}">AI 追问</button>
                <div class="wb-eval-group">
                  <button type="button" class="wb-eval-btn ${evalState === 'ok' ? 'active-ok' : ''}" data-eval-unit="${u.id}" data-eval-val="ok">懂了</button>
                  <button type="button" class="wb-eval-btn ${evalState === 'fuzzy' ? 'active-fuzzy' : ''}" data-eval-unit="${u.id}" data-eval-val="fuzzy">模糊</button>
                  <button type="button" class="wb-eval-btn ${evalState === 'bad' ? 'active-bad' : ''}" data-eval-unit="${u.id}" data-eval-val="bad">不懂</button>
                </div>
              </div>
              <div style="font-weight:700;font-size:0.86rem;color:var(--heading);margin-bottom:8px;">${escapeHtml(u.summary)}</div>
              ${u.codeSnippet ? `<pre class="wb-code-block">${escapeHtml(u.codeSnippet)}</pre>` : ''}
              <p class="wb-source-text" data-selectable-unit="${u.id}">${segsHtml}</p>
              <div class="wb-zh-box">${escapeHtml(u.zh)}</div>
            </div>
            <div class="wb-right-col">
              <div class="wb-col-head">
                <span style="font-size:0.76rem;font-weight:700;color:var(--heading);">四维结构与认识论拆解</span>
                <button type="button" class="wb-jump-btn" data-jump-unit="${u.jumpTarget}">${escapeHtml(u.jumpLabel)}</button>
              </div>
              <div class="wb-dim-list">
                ${u.dims
                  .map(
                    d => `<div class="wb-dim-item">
                      <h5><span class="wb-dim-num">${d.num}</span>${escapeHtml(d.name)}</h5>
                      <p><span class="wb-epistemic">[${escapeHtml(d.tag)}]</span>${escapeHtml(d.text)}</p>
                    </div>`,
                  )
                  .join('')}
              </div>
            </div>
          </div>
          ${qaDrawerHtml}
        </article>
      `;
    })
    .join('');

  viewport.innerHTML = `
    <div class="wb-doc-hero ${mode.heroClass}">
      <div>
        <div class="wb-doc-tags">${mode.tags.map(t => `<span class="wb-tag">${escapeHtml(t)}</span>`).join('')}</div>
        <h3 class="wb-doc-title">${escapeHtml(mode.title)}</h3>
        <p class="wb-doc-sub">${escapeHtml(mode.subtitle)}</p>
      </div>
      <div class="wb-mastery-box">
        <div>已掌握 ${okCount} / ${mode.units.length} 单元</div>
        <div style="opacity:0.8;margin-top:2px;">已沉淀 ${qaTotal} 条划词证据</div>
      </div>
    </div>

    <div class="wb-content">
      <section class="wb-mental-panel">
        <div class="wb-mental-head">
          <h4>${escapeHtml(mode.scaffoldTitle)}</h4>
        </div>
        <div class="wb-scaffold-grid">
          ${mode.scaffolds
            .map(
              s => `<div class="wb-scaf-card">
                <div class="wb-scaf-k">${escapeHtml(s.k)}</div>
                <p class="wb-scaf-v">${escapeHtml(s.v)}</p>
              </div>`,
            )
            .join('')}
        </div>
        <div class="wb-dag-wrap">
          <div class="wb-dag-row">${dagHtml}</div>
        </div>
      </section>

      <div class="wb-filter-strip">
        <div class="wb-hl-pills">
          <button type="button" class="wb-hl-chip" data-hl-filter="all" aria-pressed="${state.hlFilter === 'all'}">全部高亮</button>
          <button type="button" class="wb-hl-chip" data-hl-filter="core" aria-pressed="${state.hlFilter === 'core'}">核心论点</button>
          <button type="button" class="wb-hl-chip" data-hl-filter="concept" aria-pressed="${state.hlFilter === 'concept'}">关键概念</button>
          <button type="button" class="wb-hl-chip" data-hl-filter="evidence" aria-pressed="${state.hlFilter === 'evidence'}">实证数据</button>
          <button type="button" class="wb-hl-chip" data-hl-filter="method" aria-pressed="${state.hlFilter === 'method'}">机制方法</button>
        </div>
      </div>

      ${unitsHtml}
      ${renderBespokeFooter(mode)}
    </div>
  `;

  viewport.querySelector('#wb-journal-mini')?.addEventListener('input', e => {
    state.journalDraft = e.target.value;
  });
  viewport.querySelectorAll('[data-mini-chk]').forEach(chk => {
    chk.addEventListener('change', () => {
      state.checkedSteps[chk.dataset.miniChk] = chk.checked;
    });
  });

  // Wire up interactive listeners inside viewport
  viewport.querySelectorAll('[data-dag-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedDagIdx = Number(btn.dataset.dagIdx);
      scrollToUnit(btn.dataset.targetUnit);
    });
  });

  viewport.querySelectorAll('[data-hl-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.hlFilter = btn.dataset.hlFilter;
      renderWorkbench();
    });
  });

  viewport.querySelectorAll('[data-eval-unit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const uid = btn.dataset.evalUnit;
      const val = btn.dataset.evalVal;
      state.evals[uid] = state.evals[uid] === val ? null : val;
      engageWorkbench();
      renderWorkbench();
    });
  });

  viewport.querySelectorAll('[data-jump-unit]').forEach(btn => {
    btn.addEventListener('click', () => scrollToUnit(btn.dataset.jumpUnit));
  });

  viewport.querySelectorAll('[data-qa-unit]').forEach(span => {
    span.addEventListener('click', () => {
      const unit = mode.units.find(u => u.id === span.dataset.qaUnit);
      const seg = unit?.segments[Number(span.dataset.qaSeg)];
      if (unit && seg) {
        openQaModal({
          unitId: unit.id,
          unitLabel: unit.unitLabel,
          snippet: seg.text,
          defaultPrompt: seg.qaPrompt || '这段核心逻辑在整个结构中承担什么角色？',
          answerHtml: seg.qaAnswer,
          evidenceTarget: unit.jumpTarget,
          evidenceLabel: unit.jumpLabel,
          scope: '全文跨节证据',
        });
      }
    });
  });

  viewport.querySelectorAll('[data-open-qa-unit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const unit = mode.units.find(u => u.id === btn.dataset.openQaUnit);
      if (!unit) return;
      const firstHl = unit.segments.find(s => s.qaPrompt) || unit.segments[0];
      openQaModal({
        unitId: unit.id,
        unitLabel: unit.unitLabel,
        snippet: firstHl.text,
        defaultPrompt: firstHl.qaPrompt || `请结合上下文精讲 ${unit.unitLabel} 的核心要点与边界条件`,
        answerHtml:
          firstHl.qaAnswer ||
          `<span class="wb-epistemic">[原文明示]</span> ${escapeHtml(unit.summary)}。<br><span class="wb-epistemic">[分析推断]</span> 可点击下方证据锚点跳转对照验证该结论在不同章节中的推导前提。`,
        evidenceTarget: unit.jumpTarget,
        evidenceLabel: unit.jumpLabel,
        scope: '全文跨节证据',
      });
    });
  });

  // Real drag-select detection inside paragraph
  viewport.querySelectorAll('[data-selectable-unit]').forEach(p => {
    p.addEventListener('mouseup', () => {
      const sel = window.getSelection()?.toString().trim();
      if (!sel || sel.length < 4) return;
      const unit = mode.units.find(u => u.id === p.dataset.selectableUnit);
      if (!unit) return;
      openQaModal({
        unitId: unit.id,
        unitLabel: unit.unitLabel,
        snippet: sel,
        defaultPrompt: `请结合上下文解释选中片段「${sel.slice(0, 36)}${sel.length > 36 ? '...' : ''}」的准确含义`,
        answerHtml: `<span class="wb-epistemic">[原文明示]</span> 所选片段锚定于 ${escapeHtml(unit.unitLabel)}，核心结论为「${escapeHtml(unit.summary)}」。<br><span class="wb-epistemic">[分析推断]</span> 可点击下方证据锚点跳转对照前后端推导上下文，关闭弹窗后本条线索会自动折叠沉淀在卡片下方。`,
        evidenceTarget: unit.jumpTarget,
        evidenceLabel: unit.jumpLabel,
        scope: '本段精讲 + 原文溯源',
      });
    });
  });
}

// ── 5. Selection Q&A Modal + Library Drawer + Studio Modal Overlays ──
function openQaModal(payload) {
  engageWorkbench();
  state.activeQaModal = payload;
  const overlay = document.getElementById('wb-qa-overlay');
  if (!overlay) return;
  overlay.classList.remove('is-hidden');
  renderQaModalBody();
}

function renderQaModalBody() {
  const overlay = document.getElementById('wb-qa-overlay');
  const p = state.activeQaModal;
  if (!overlay || !p) return;

  const history = state.qaHistory[p.unitId] || [];
  overlay.innerHTML = `
    <div class="wb-modal-center" role="dialog" aria-modal="true" aria-label="AI 划词追问与证据溯源">
      <div class="wb-modal-head">
        <span>${escapeHtml(p.unitLabel)} · [AI 划词追问与证据溯源]（本线索已追问 ${history.length} 次）</span>
        <button type="button" class="wb-btn" id="wb-qa-close">关闭</button>
      </div>
      <div class="wb-modal-body">
        <div style="font-size:0.76rem;color:var(--ink-muted);margin-bottom:6px;">[虚线定锚选中片段]</div>
        <div class="wb-snippet-dashed">${escapeHtml(p.snippet)}</div>

        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
          <span style="font-size:0.78rem;color:var(--ink-muted);">依据范围：</span>
          <button type="button" class="wb-hl-chip" data-qa-scope="本段上下文精讲" aria-pressed="${p.scope === '本段上下文精讲'}">基于本段精讲</button>
          <button type="button" class="wb-hl-chip" data-qa-scope="全文跨节证据" aria-pressed="${p.scope !== '本段上下文精讲'}">基于全文跨节证据解答</button>
        </div>

        <form id="wb-qa-form" style="display:flex;gap:8px;margin-bottom:14px;">
          <input id="wb-qa-input" type="text" value="${escapeHtml(p.defaultPrompt)}" style="flex:1;padding:9px 12px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface-subtle);color:var(--ink);font:inherit;font-size:0.84rem;" />
          <button type="submit" class="btn btn-primary" style="padding:8px 16px;font-size:0.82rem;">提交追问并钉入卡片</button>
        </form>

        <div class="wb-qa-entry" style="margin-bottom:12px;">
          <div style="font-size:0.74rem;font-family:'IBM Plex Mono',monospace;color:var(--accent);margin-bottom:4px;">[即时证据回溯解析 · ${escapeHtml(p.scope)}]</div>
          <div style="font-size:0.84rem;line-height:1.65;">${p.answerHtml}</div>
          <div style="margin-top:10px;">
            <button type="button" class="wb-jump-btn" id="wb-qa-jump-ev">${escapeHtml(p.evidenceLabel)}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  overlay.querySelector('#wb-qa-close')?.addEventListener('click', () => {
    overlay.classList.add('is-hidden');
    renderWorkbench();
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.add('is-hidden');
      renderWorkbench();
    }
  });
  overlay.querySelectorAll('[data-qa-scope]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeQaModal.scope = btn.dataset.qaScope;
      renderQaModalBody();
    });
  });
  overlay.querySelector('#wb-qa-jump-ev')?.addEventListener('click', () => {
    overlay.classList.add('is-hidden');
    scrollToUnit(p.evidenceTarget);
  });
  overlay.querySelector('#wb-qa-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const input = overlay.querySelector('#wb-qa-input');
    const qText = input?.value.trim() || p.defaultPrompt;
    state.qaHistory[p.unitId].push({
      scope: p.scope,
      snippet: p.snippet,
      question: qText,
      answerHtml: p.answerHtml,
      evidenceTarget: p.evidenceTarget,
      evidenceLabel: p.evidenceLabel,
    });
    overlay.classList.add('is-hidden');
    renderWorkbench();
    scrollToUnit(p.unitId);
  });
}

function renderLibraryDrawer() {
  const overlay = document.getElementById('wb-lib-overlay');
  if (!overlay) return;

  const groupedKey = state.libraryGroup === 'progress' ? 'progressLabel' : state.libraryGroup === 'paradigm' ? 'paradigm' : 'themeField';
  const groups = {};
  for (const doc of LIBRARY_DOCS) {
    const k = doc[groupedKey];
    (groups[k] ||= []).push(doc);
  }

  overlay.innerHTML = `
    <div class="wb-drawer" role="dialog" aria-modal="true" aria-label="个人精读文库">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div>
          <div style="font-weight:700;font-size:1rem;color:var(--heading);">个人精读文库</div>
          <div style="font-size:0.74rem;color:var(--ink-muted);">四维视图自动归档 · 点击任一文档直接载入下方工作台</div>
        </div>
        <button type="button" class="wb-hl-chip" id="wb-lib-close">关闭</button>
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">
        <button type="button" class="wb-hl-chip" data-lib-grp="domain" aria-pressed="${state.libraryGroup === 'domain'}">按主题领域</button>
        <button type="button" class="wb-hl-chip" data-lib-grp="progress" aria-pressed="${state.libraryGroup === 'progress'}">按消化进度</button>
        <button type="button" class="wb-hl-chip" data-lib-grp="paradigm" aria-pressed="${state.libraryGroup === 'paradigm'}">按研究范式</button>
      </div>

      <div style="display:grid;gap:12px;">
        ${Object.entries(groups)
          .map(
            ([grp, items]) => `
            <div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:var(--accent);font-weight:700;margin-bottom:6px;">${escapeHtml(grp)}</div>
              ${items
                .map(
                  d => `
                  <button type="button" data-pick-doc="${d.id}" style="width:100%;text-align:left;padding:12px;border-radius:10px;border:1.5px solid ${d.id === state.modeId ? 'var(--accent)' : 'var(--border)'};background:var(--surface-subtle);color:var(--ink);cursor:pointer;margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--ink-muted);margin-bottom:4px;">
                      <span>${escapeHtml(d.modeLabel)}</span>
                      <span>${escapeHtml(d.progressLabel)}</span>
                    </div>
                    <div style="font-weight:700;font-size:0.88rem;color:var(--heading);">${escapeHtml(d.title)}</div>
                    <div style="font-size:0.75rem;color:var(--ink-muted);margin:4px 0 8px;">${escapeHtml(d.subtitle)}</div>
                    <div style="display:flex;gap:4px;flex-wrap:wrap;">
                      ${d.tags.map(t => `<span style="font-family:'IBM Plex Mono',monospace;font-size:0.66rem;padding:2px 6px;border-radius:4px;background:var(--surface);border:1px solid var(--border);">${escapeHtml(t)}</span>`).join('')}
                    </div>
                  </button>`,
                )
                .join('')}
            </div>`,
          )
          .join('')}
      </div>
    </div>
  `;

  overlay.querySelector('#wb-lib-close')?.addEventListener('click', () => overlay.classList.add('is-hidden'));
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('is-hidden');
  });
  overlay.querySelectorAll('[data-lib-grp]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.libraryGroup = btn.dataset.libGrp;
      renderLibraryDrawer();
    });
  });
  overlay.querySelectorAll('[data-pick-doc]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.modeId = btn.dataset.pickDoc;
      state.depth = 'intensive';
      state.selectedDagIdx = 0;
      overlay.classList.add('is-hidden');
      renderWorkbench();
    });
  });
}

function initToolbar() {
  document.querySelectorAll('[data-wb-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      engageWorkbench();
      state.modeId = btn.dataset.wbMode;
      state.selectedDagIdx = 0;
      state.depth = 'intensive';
      renderWorkbench();
    });
  });

  document.querySelectorAll('[data-wb-depth]').forEach(btn => {
    btn.addEventListener('click', () => {
      engageWorkbench();
      state.depth = btn.dataset.wbDepth;
      renderWorkbench();
    });
  });

  document.getElementById('wb-open-lib')?.addEventListener('click', () => {
    engageWorkbench();
    const overlay = document.getElementById('wb-lib-overlay');
    overlay?.classList.remove('is-hidden');
    renderLibraryDrawer();
  });

  document.getElementById('wb-open-studio')?.addEventListener('click', () => {
    engageWorkbench();
    const overlay = document.getElementById('wb-studio-overlay');
    overlay?.classList.remove('is-hidden');
  });

  const studioOverlay = document.getElementById('wb-studio-overlay');
  studioOverlay?.querySelector('#wb-studio-close')?.addEventListener('click', () => {
    studioOverlay.classList.add('is-hidden');
  });
  studioOverlay?.addEventListener('click', e => {
    if (e.target === studioOverlay) studioOverlay.classList.add('is-hidden');
  });
  studioOverlay?.querySelectorAll('[data-compile-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.modeId = btn.dataset.compileMode;
      state.depth = 'intensive';
      studioOverlay.classList.add('is-hidden');
      renderWorkbench();
    });
  });

  // Esc exits Pure Reading mode or open modals cleanly
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.getElementById('wb-qa-overlay')?.classList.add('is-hidden');
    document.getElementById('wb-lib-overlay')?.classList.add('is-hidden');
    document.getElementById('wb-studio-overlay')?.classList.add('is-hidden');
    document.getElementById('shot-lightbox')?.classList.add('is-hidden');
    if (state.depth === 'pure') {
      state.depth = 'intensive';
      renderWorkbench();
    }
  });

  // CLI Copy button + Contact copy buttons + WeChat QR lightbox trigger
  const copyBtn = document.getElementById('cli-copy-btn');
  copyBtn?.addEventListener('click', () => {
    navigator.clipboard?.writeText('git clone https://github.com/lyz-wave/deep-reading-workbench.git && npm install && npm run dev').catch(() => {});
    const label = copyBtn.querySelector('span');
    if (label) {
      const old = label.textContent;
      label.textContent = '已复制';
      setTimeout(() => { label.textContent = old; }, 1600);
    }
  });

  document.querySelectorAll('[data-copy-val]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.copyVal;
      if (!val) return;
      navigator.clipboard?.writeText(val).catch(() => {});
      const label = btn.querySelector('span');
      if (label) {
        const old = label.textContent;
        label.textContent = '已复制';
        setTimeout(() => { label.textContent = old; }, 1600);
      }
    });
  });

  document.getElementById('wechat-qr-btn')?.addEventListener('click', () => {
    openLightbox('./media/wechat-qr.png', '微信扫码添加好友 · 浪（扫一扫右侧或手机长按识别）');
  });

  // Sticker Speech Bubble Interactive Triggers
  document.querySelectorAll('[data-wb-cue]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      engageWorkbench();
      const cue = btn.dataset.wbCue;
      if (cue === 'cycle-mode') {
        const order = ['academic', 'cognitive', 'repo'];
        const next = order[(order.indexOf(state.modeId) + 1) % order.length];
        state.modeId = next;
        state.depth = 'intensive';
        state.selectedDagIdx = 0;
        renderWorkbench();
      } else if (cue === 'dag') {
        const mode = WORKBENCH_MODES[state.modeId];
        if (!mode?.dag?.length) return;
        state.selectedDagIdx = (state.selectedDagIdx + 1) % mode.dag.length;
        scrollToUnit(mode.dag[state.selectedDagIdx].targetUnit);
      } else if (cue === 'pure') {
        state.depth = state.depth === 'pure' ? 'intensive' : 'pure';
        renderWorkbench();
      } else if (cue === 'qa') {
        if (state.depth === 'pure') state.depth = 'intensive';
        renderWorkbench();
        const mode = WORKBENCH_MODES[state.modeId];
        const firstUnit = mode?.units?.[0];
        const seg = firstUnit?.segments?.find(s => s.kind);
        if (firstUnit && seg) {
          openSelectionQaModal(
            firstUnit.id,
            seg.text,
            seg.qaPrompt,
            seg.qaAnswer,
            firstUnit.jumpTarget,
            firstUnit.jumpLabel,
            '划词片段上下文',
          );
        }
      }
    });
  });
}

// ── 5. Three Core Modules Screenshot Showcases + Lightbox ──
function openLightbox(src, caption) {
  const box = document.getElementById('shot-lightbox');
  const img = document.getElementById('shot-lightbox-img');
  const cap = document.getElementById('shot-lightbox-caption');
  if (!box || !img || !cap) return;
  img.src = src;
  img.alt = caption;
  cap.textContent = caption;
  box.classList.remove('is-hidden');
}

function initLightbox() {
  const box = document.getElementById('shot-lightbox');
  const closeBtn = document.getElementById('shot-lightbox-close');
  closeBtn?.addEventListener('click', () => box?.classList.add('is-hidden'));
  box?.addEventListener('click', e => {
    if (e.target === box) box.classList.add('is-hidden');
  });
}

function renderModuleShowcases() {
  const stack = document.getElementById('modules-stack');
  if (!stack) return;

  stack.innerHTML = MODULE_SHOWCASES.map(mod => {
    const activeIdx = state.moduleShots[mod.id] ?? 0;
    const activeShot = mod.shots[activeIdx] || mod.shots[0];

    return `
      <article class="module-showcase-card" id="showcase-${mod.id}">
        <div class="module-card-body">
          <div class="module-editorial">
            <div class="module-copy">
              <h3 class="font-serif module-stage-title">${escapeHtml(mod.title)}</h3>
              <p class="module-stage-lead">${escapeHtml(mod.lead)}</p>
              <div class="module-chips">
                ${mod.chips.map(c => `<span>${escapeHtml(c)}</span>`).join('')}
              </div>
            </div>

            ${mod.mascot ? `
            <div class="module-mascot-callout">
              <div class="vinyl-sticker module-mascot-sticker">
                <div class="vinyl-gloss"></div>
                <img src="${escapeHtml(mod.mascot.sticker)}" alt="${escapeHtml(mod.mascot.alt)}" />
              </div>
              <div class="mascot-speech-bubble">
                <span class="mascot-bubble-tag">${escapeHtml(mod.mascot.badge)}</span>
                <p class="mascot-bubble-line">${escapeHtml(mod.mascot.line)}</p>
              </div>
            </div>` : ''}
          </div>

          <div class="shot-stage">
            <div class="shot-toolbar">
              <div class="shot-tab-group" role="tablist" aria-label="${escapeHtml(mod.title)}实机视图切换">
                ${mod.shots
                  .map(
                    (s, idx) => `
                    <button type="button" class="shot-tab-btn ${idx === activeIdx ? 'is-active' : ''}" data-mod-shot="${mod.id}" data-shot-idx="${idx}" aria-selected="${idx === activeIdx}">
                      ${escapeHtml(s.tabLabel)}
                    </button>`,
                  )
                  .join('')}
              </div>
              <button type="button" class="shot-zoom-hint" data-zoom-mod="${mod.id}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                </svg>
                <span>查看大图</span>
              </button>
            </div>

            <div class="shot-frame" data-zoom-mod="${mod.id}" title="点击放大查看实机界面高清细节">
              <img src="${escapeHtml(activeShot.src)}" alt="${escapeHtml(activeShot.alt)}" />
            </div>

            <p class="shot-caption">${escapeHtml(activeShot.caption)}</p>
          </div>
        </div>
      </article>
    `;
  }).join('');

  stack.querySelectorAll('[data-mod-shot]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.moduleShots[btn.dataset.modShot] = Number(btn.dataset.shotIdx);
      renderModuleShowcases();
    });
  });

  stack.querySelectorAll('[data-zoom-mod]').forEach(el => {
    el.addEventListener('click', () => {
      const mod = MODULE_SHOWCASES.find(m => m.id === el.dataset.zoomMod);
      if (!mod) return;
      const shot = mod.shots[state.moduleShots[mod.id] ?? 0] || mod.shots[0];
      openLightbox(shot.src, `${mod.title} — ${shot.tabLabel}：${shot.caption}`);
    });
  });

  bindVinylHover(stack);
}

// ── 6. Live GitHub Stars Counter (lyz-wave/deep-reading-workbench) ──
function initGithubStars() {
  const countEl = document.getElementById('github-star-count');
  if (!countEl) return;

  const REPO = 'lyz-wave/deep-reading-workbench';
  const LEGACY_CACHE_KEY = 'prism_gh_stars_lyz_wave_v1';
  const CACHE_KEY = 'purrparse_gh_stars_v2';
  let lastFetchAt = 0;

  const parseStarValue = val => {
    if (typeof val === 'number') return val;
    if (typeof val !== 'string') return NaN;
    const s = val.trim().toLowerCase();
    if (s.endsWith('k')) return Math.round(parseFloat(s.slice(0, -1)) * 1000);
    if (s.endsWith('m')) return Math.round(parseFloat(s.slice(0, -1)) * 1_000_000);
    return Number(s);
  };

  const formatStars = n => {
    const num = parseStarValue(n);
    if (!Number.isFinite(num) || num < 0) return null;
    if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return String(Math.floor(num));
  };

  try {
    localStorage.removeItem(LEGACY_CACHE_KEY);
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached !== null) {
      const formatted = formatStars(cached);
      if (formatted !== null) countEl.textContent = formatted;
    }
  } catch {
    // Ignore storage access failures in private browsing
  }

  async function fetchLiveStars(force = false) {
    const now = Date.now();
    if (!force && now - lastFetchAt < 30_000) return;
    lastFetchAt = now;

    // Prioritize real-time GitHub API, then Shields.io, leaving aggressively cached ungh.cc as last fallback
    const sources = [
      async () => {
        const res = await fetch(`https://api.github.com/repos/${REPO}`, {
          cache: 'no-store',
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) throw new Error(`github ${res.status}`);
        const data = await res.json();
        return data?.stargazers_count;
      },
      async () => {
        const res = await fetch(`https://img.shields.io/github/stars/${REPO}.json`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`shields ${res.status}`);
        const data = await res.json();
        return data?.value;
      },
      async () => {
        const res = await fetch(`https://ungh.cc/repos/${REPO}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`ungh ${res.status}`);
        const data = await res.json();
        return data?.repo?.stars;
      },
    ];

    for (const reader of sources) {
      try {
        const rawCount = await reader();
        const num = parseStarValue(rawCount);
        const formatted = formatStars(num);
        if (formatted !== null) {
          countEl.textContent = formatted;
          try {
            localStorage.setItem(CACHE_KEY, String(Math.floor(num)));
          } catch {
            // ignore
          }
          return;
        }
      } catch {
        // try next source
      }
    }

    if (countEl.textContent === '--') countEl.textContent = '0';
  }

  void fetchLiveStars(true);
  setInterval(() => {
    if (document.visibilityState === 'visible') void fetchLiveStars(false);
  }, 300_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void fetchLiveStars(false);
  });
  window.addEventListener('focus', () => {
    void fetchLiveStars(false);
  });
}

// ── 7. Auto OS/Arch Detection + GitHub Release Download Picker (Doubao-Style Hover Menu) ──
function initDesktopDownloads() {
  const REPO = 'lyz-wave/deep-reading-workbench';
  const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;
  const SOURCE_ZIP_URL = `https://github.com/${REPO}/archive/refs/heads/main.zip`;
  const DEFAULT_VERSION = 'v1.1.0';

  const TARGETS = [
    {
      id: 'mac-arm64',
      os: 'mac',
      label: 'Mac ARM64',
      longLabel: 'Mac Apple Silicon (ARM64)',
      ext: 'dmg',
      pattern: /(?:mac[-_.]?arm64|arm64)\.dmg$/i,
      defaultAsset: 'PurrParse-1.1.0-mac-arm64.dmg',
    },
    {
      id: 'mac-x64',
      os: 'mac',
      label: 'Mac x64',
      longLabel: 'Mac Intel (x64)',
      ext: 'dmg',
      pattern: /(?:mac[-_.]?x64|x64)\.dmg$/i,
      defaultAsset: 'PurrParse-1.1.0-mac-x64.dmg',
    },
    {
      id: 'win-x64',
      os: 'win',
      label: 'Windows x64',
      longLabel: 'Windows x64',
      ext: 'exe',
      pattern: /(?:win[-_.]?x64|x64).*\.exe$/i,
      defaultAsset: 'PurrParse-1.1.0-win-x64-Setup.exe',
    },
    {
      id: 'win-arm64',
      os: 'win',
      label: 'Windows ARM64',
      longLabel: 'Windows ARM64',
      ext: 'exe',
      pattern: /(?:win[-_.]?arm64|arm64).*\.exe$/i,
      defaultAsset: 'PurrParse-1.1.0-win-arm64-Setup.exe',
    },
  ];

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const createPlatformIcon = os => {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', '15');
    svg.setAttribute('height', '15');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    if (os === 'mac') {
      path.setAttribute(
        'd',
        'M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43m4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z'
      );
    } else {
      path.setAttribute(
        'd',
        'M3 3h8.5v8.5H3V3zm9.5 0H21v8.5h-8.5V3zM3 12.5h8.5V21H3v-8.5zm9.5 0H21V21h-8.5v-8.5z'
      );
    }
    svg.appendChild(path);
    return svg;
  };

  function detectSyncPlatform() {
    const ua = String(navigator.userAgent || '');
    const plat = String(navigator.platform || '');
    const uad = navigator.userAgentData;
    const isWin = /win/i.test(uad?.platform || plat || ua);
    if (isWin) {
      return /arm64|aarch64|woa64/i.test(ua) ? 'win-arm64' : 'win-x64';
    }
    const isMac = /mac|darwin/i.test(uad?.platform || plat || ua);
    if (isMac) {
      if (/arm64|aarch64/i.test(ua)) return 'mac-arm64';
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        const dbg = gl?.getExtension?.('WEBGL_debug_renderer_info');
        const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
        if (/apple m|apple gpu/i.test(renderer)) return 'mac-arm64';
        if (/intel|amd|radeon/i.test(renderer)) return 'mac-x64';
      } catch {
        // Ignore blocked WebGL fingerprinting
      }
      return 'mac-arm64';
    }
    return 'mac-arm64';
  }

  let detectedId = detectSyncPlatform();
  let releaseTag = DEFAULT_VERSION;
  const resolvedAssets = Object.fromEntries(
    TARGETS.map(t => [
      t.id,
      {
        url: `https://github.com/${REPO}/releases/latest/download/${t.defaultAsset}`,
        available: true,
        sizeLabel: '',
      },
    ])
  );

  const pickers = Array.from(document.querySelectorAll('[data-download-picker]'));
  if (!pickers.length) return;

  function renderPickers() {
    const activeTarget = TARGETS.find(t => t.id === detectedId) || TARGETS[0];
    const activeAsset = resolvedAssets[activeTarget.id];

    pickers.forEach(wrap => {
      const kind = wrap.dataset.downloadPicker;
      const primary = wrap.querySelector('[data-dl-primary]');
      const primaryLabel = wrap.querySelector('[data-dl-primary-label]');
      const menu = wrap.querySelector('[data-dl-menu]');

      if (primary) {
        primary.href = activeAsset?.available ? activeAsset.url : RELEASES_PAGE;
        primary.title = `当前识别为 ${activeTarget.longLabel}（${releaseTag}），鼠标悬停可切换其他平台版本`;
      }
      if (primaryLabel) {
        primaryLabel.textContent =
          kind === 'nav'
            ? `下载 (${activeTarget.os === 'mac' ? 'Mac' : 'Win'})`
            : `下载 PurrParse Desktop（${activeTarget.label}）`;
      }

      if (!menu) return;
      menu.textContent = '';

      TARGETS.forEach(item => {
        const meta = resolvedAssets[item.id];
        const a = document.createElement('a');
        a.className = 'dl-menu-item';
        a.setAttribute('role', 'menuitem');
        a.dataset.dlOption = item.id;
        a.href = meta?.available ? meta.url : RELEASES_PAGE;
        a.target = '_blank';
        a.rel = 'noreferrer noopener';

        const left = document.createElement('span');
        left.className = 'dl-item-left';
        left.appendChild(createPlatformIcon(item.os));
        const labelSpan = document.createElement('span');
        labelSpan.textContent = item.label;
        left.appendChild(labelSpan);

        const right = document.createElement('span');
        right.className = 'dl-item-meta';
        if (item.id === detectedId) {
          const cur = document.createElement('span');
          cur.className = 'dl-current-tag';
          cur.textContent = '当前设备';
          right.appendChild(cur);
        }
        const badge = document.createElement('span');
        badge.className = 'dl-ext-tag';
        badge.textContent = meta?.sizeLabel || `.${item.ext}`;
        right.appendChild(badge);

        a.appendChild(left);
        a.appendChild(right);
        menu.appendChild(a);
      });

      const foot = document.createElement('div');
      foot.className = 'dl-menu-foot';
      const verSpan = document.createElement('span');
      verSpan.className = 'font-mono';
      verSpan.textContent = releaseTag;
      const linksWrap = document.createElement('span');
      const srcLink = document.createElement('a');
      srcLink.href = SOURCE_ZIP_URL;
      srcLink.textContent = '源码 (.zip)';
      srcLink.target = '_blank';
      srcLink.rel = 'noreferrer noopener';
      linksWrap.appendChild(srcLink);
      foot.appendChild(verSpan);
      foot.appendChild(linksWrap);
      menu.appendChild(foot);
    });

    const hintEl = document.getElementById('closing-detect-hint');
    if (hintEl) {
      hintEl.textContent = `已自动识别当前系统：${activeTarget.longLabel} · 鼠标悬停按钮可切换 Mac / Windows 其他版本（${releaseTag}）`;
    }
  }

  renderPickers();

  // Keyboard & touch convenience: toggle aria-expanded cleanly without interfering with mouse hover
  pickers.forEach(wrap => {
    const trigger = wrap.querySelector('[data-dl-primary]');
    if (!trigger) return;
    const setOpen = open => {
      wrap.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    wrap.addEventListener('mouseenter', () => trigger.setAttribute('aria-expanded', 'true'));
    wrap.addEventListener('mouseleave', () => setOpen(false));
    trigger.addEventListener('focus', () => trigger.setAttribute('aria-expanded', 'true'));
    wrap.addEventListener('focusout', e => {
      if (!wrap.contains(e.relatedTarget)) setOpen(false);
    });
  });

  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    pickers.forEach(wrap => {
      wrap.classList.remove('is-open');
      wrap.querySelector('[data-dl-primary]')?.setAttribute('aria-expanded', 'false');
    });
  });

  // High-entropy OS + CPU architecture refinement (Chromium on Apple Silicon / Windows ARM64)
  if (typeof navigator.userAgentData?.getHighEntropyValues === 'function') {
    navigator.userAgentData
      .getHighEntropyValues(['platform', 'architecture'])
      .then(info => {
        const p = String(info?.platform || '').toLowerCase();
        const a = String(info?.architecture || '').toLowerCase();
        let nextId = detectedId;
        if (p.includes('mac')) {
          nextId = a === 'arm' ? 'mac-arm64' : a === 'x86' ? 'mac-x64' : detectedId;
        } else if (p.includes('win')) {
          nextId = a === 'arm' ? 'win-arm64' : 'win-x64';
        }
        if (nextId !== detectedId) {
          detectedId = nextId;
          renderPickers();
        }
      })
      .catch(() => {});
  }

  // Sync live GitHub Releases latest tag & real downloadable assets
  fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json' },
  })
    .then(res => (res.ok ? res.json() : null))
    .then(rel => {
      if (!rel || !Array.isArray(rel.assets)) return;
      if (rel.tag_name) releaseTag = String(rel.tag_name);
      TARGETS.forEach(target => {
        const matched = rel.assets.find(asset => target.pattern.test(String(asset?.name || '')));
        if (matched && matched.browser_download_url) {
          const mb = Math.round(Number(matched.size || 0) / (1024 * 1024));
          resolvedAssets[target.id] = {
            url: String(matched.browser_download_url),
            available: true,
            sizeLabel: mb > 0 ? `${mb} MB` : `.${target.ext}`,
          };
        } else {
          resolvedAssets[target.id] = {
            url: String(rel.html_url || RELEASES_PAGE),
            available: false,
            sizeLabel: 'Release 页',
          };
        }
      });
      renderPickers();
    })
    .catch(() => {});
}

applyTheme('paper');
initVinylStickers();
initVideoShowreel();
initToolbar();
initLightbox();
initGithubStars();
initDesktopDownloads();
renderModuleShowcases();
renderWorkbench();
