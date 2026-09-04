(function () {
  'use strict';

  /* ---------------- 常量与状态 ---------------- */
  const LS_KEY = 'habit-tracker-v2';
  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
  const RING_RADIUS = 48;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  // 常见关键词到图标的映射，匹配不到就统一用太阳
  const EMOJI_RULES = [
    ['水', '💧'],
    ['喝', '💧'],
    ['运动', '🏃'],
    ['跑', '🏃'],
    ['健身', '🏃'],
    ['书', '📚'],
    ['读', '📚'],
    ['学', '📚'],
    ['睡', '🌙'],
    ['冥想', '🧘'],
    ['写', '✍️'],
    ['日记', '✍️'],
    ['拉伸', '🤸'],
    ['瑜伽', '🤸'],
    ['单词', '📝'],
    ['背', '📝'],
    ['早', '🌙'],
  ];

  const ENCOURAGEMENTS = {
    empty: '先添加一个想坚持的习惯吧',
    started: '新的一天，从第一件小事开始',
    progress: '已经完成 {done}/{total}，继续保持',
    almost: '只差最后一步啦，再加把劲',
    done: '全部完成，今天真棒',
  };

  const CELEBRATION_PHRASES = [
    '今天也超棒',
    '给自己点个赞',
    '又迈出了一小步',
    '坚持的样子真好看',
  ];

  /* ---------------- DOM ---------------- */
  const headerTimeEl = document.getElementById('headerTime');
  const headerDateEl = document.getElementById('headerDate');
  const encouragementEl = document.getElementById('encouragement');
  const ringProgressEl = document.getElementById('ringProgress');
  const ringDoneEl = document.getElementById('ringDone');
  const ringTotalEl = document.getElementById('ringTotal');
  const habitGridEl = document.getElementById('habitGrid');
  const addForm = document.getElementById('addForm');
  const habitInput = document.getElementById('habitInput');
  const inputWrap = document.getElementById('inputWrap');
  const presetPanel = document.getElementById('presetPanel');
  const addBtn = document.getElementById('addBtn');
  const resetBtn = document.getElementById('resetBtn');
  const celebrationBanner = document.getElementById('celebrationBanner');
  const celebrationTextEl = document.getElementById('celebrationText');
  const toastEl = document.getElementById('toast');
  const confettiLayer = document.getElementById('confettiLayer');
  const bubbleCanvas = document.getElementById('bubbleCanvas');

  /* ---------------- 本地数据层 ---------------- */
  function emptyData() {
    return { habits: [], checkins: {}, celebrated: {} };
  }

  function readData() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return emptyData();
      const parsed = JSON.parse(raw);
      return {
        habits: Array.isArray(parsed.habits) ? parsed.habits : [],
        checkins: parsed.checkins && typeof parsed.checkins === 'object' ? parsed.checkins : {},
        celebrated: parsed.celebrated && typeof parsed.celebrated === 'object' ? parsed.celebrated : {},
      };
    } catch (err) {
      return emptyData();
    }
  }

  function writeData(data) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (err) {
      showToast('保存失败，浏览器可能阻止了本地存储');
    }
  }

  let data = readData();
  let today = todayKey();
  let lastCelebrationAt = 0;

  function sortedHabits() {
    return data.habits
      .slice()
      .sort(function (a, b) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });
  }

  function todayCheckins() {
    return data.checkins[today] || {};
  }

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  /* ---------------- 时间工具 ---------------- */
  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function timeNow() {
    const d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function formatHeaderTime() {
    const d = new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function formatHeaderDate() {
    const d = new Date();
    return d.getMonth() + 1 + '月' + d.getDate() + '日 · 星期' + WEEKDAYS[d.getDay()];
  }

  /* ---------------- 提示 ---------------- */
  let toastTimer = null;
  function showToast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.hidden = true;
    }, 2600);
  }

  /* ---------------- 图标匹配 ---------------- */
  function guessEmoji(name) {
    for (let i = 0; i < EMOJI_RULES.length; i += 1) {
      if (name.indexOf(EMOJI_RULES[i][0]) !== -1) {
        return EMOJI_RULES[i][1];
      }
    }
    return '☀️';
  }

  /* ---------------- 渲染：头部、统计、习惯 ---------------- */
  function updateClock() {
    headerTimeEl.textContent = formatHeaderTime();
    headerDateEl.textContent = formatHeaderDate();
  }

  function updateStats() {
    const habits = sortedHabits();
    const checkins = todayCheckins();
    const habitIds = new Set(habits.map(function (h) { return h.id; }));
    const done = Object.keys(checkins).filter(function (id) { return habitIds.has(id); }).length;
    const total = habits.length;
    const percent = total ? done / total : 0;

    ringDoneEl.textContent = done;
    ringTotalEl.textContent = '/' + total;
    ringProgressEl.style.strokeDasharray = RING_CIRCUMFERENCE;
    ringProgressEl.style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - percent);

    if (!total) {
      encouragementEl.textContent = ENCOURAGEMENTS.empty;
    } else if (done === 0) {
      encouragementEl.textContent = ENCOURAGEMENTS.started;
    } else if (done === total) {
      encouragementEl.textContent = ENCOURAGEMENTS.done;
    } else if (done === total - 1) {
      encouragementEl.textContent = ENCOURAGEMENTS.almost;
    } else {
      encouragementEl.textContent = ENCOURAGEMENTS.progress
        .replace('{done}', done)
        .replace('{total}', total);
    }
  }

  function checkSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M5.5 12.8l4 4L18.5 7.5');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
  }

  function createHabitElement(habit) {
    const checkins = todayCheckins();
    const completed = Boolean(checkins[habit.id]);
    const timeText = checkins[habit.id] || '';

    const li = document.createElement('li');
    li.className = 'habit-item' + (completed ? ' completed' : '');
    li.id = 'habit-' + habit.id;
    li.dataset.id = habit.id;
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.setAttribute('aria-pressed', completed ? 'true' : 'false');

    const del = document.createElement('button');
    del.className = 'habit-delete';
    del.type = 'button';
    del.textContent = '×';
    del.setAttribute('aria-label', '删除「' + habit.name + '」');
    del.setAttribute('data-action', 'delete');

    const icon = document.createElement('span');
    icon.className = 'habit-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = habit.emoji || guessEmoji(habit.name);

    const main = document.createElement('div');
    main.className = 'habit-main';

    const name = document.createElement('span');
    name.className = 'habit-name';
    name.textContent = habit.name;

    const time = document.createElement('span');
    time.className = 'habit-time';
    time.textContent = timeText ? '完成于 ' + timeText : '';

    const check = document.createElement('span');
    check.className = 'habit-check';
    check.setAttribute('aria-hidden', 'true');
    check.appendChild(checkSvg());

    main.appendChild(name);
    main.appendChild(time);
    li.appendChild(del);
    li.appendChild(icon);
    li.appendChild(main);
    li.appendChild(check);
    return li;
  }

  function renderHabits() {
    const habits = sortedHabits();
    habitGridEl.textContent = '';

    if (!habits.length) {
      const empty = document.createElement('li');
      empty.className = 'empty-state';
      const icon = document.createElement('div');
      icon.className = 'empty-icon';
      icon.textContent = '🌱';
      const title = document.createElement('p');
      title.className = 'empty-title';
      title.textContent = '还没有习惯';
      const sub = document.createElement('p');
      sub.className = 'empty-sub';
      sub.textContent = '点输入框选一个快捷标签，或者自己输入想坚持的事情。';
      empty.appendChild(icon);
      empty.appendChild(title);
      empty.appendChild(sub);
      habitGridEl.appendChild(empty);
      return;
    }

    habits.forEach(function (habit) {
      habitGridEl.appendChild(createHabitElement(habit));
    });
  }

  function renderAll() {
    updateClock();
    updateStats();
    renderHabits();
  }

  /* ---------------- 打卡与局部更新 ---------------- */
  function findHabit(id) {
    return data.habits.find(function (habit) { return habit.id === id; });
  }

  function toggleHabit(id) {
    const habit = findHabit(id);
    if (!habit) return;

    const element = document.getElementById('habit-' + id);
    const wasDone = Boolean(todayCheckins()[id]);
    const nextDone = !wasDone;
    const checkins = todayCheckins();
    const time = timeNow();

    if (nextDone) {
      checkins[id] = time;
    } else {
      delete checkins[id];
      // 取消勾选后允许当天再次触发庆祝，方便测试和补救没看到的动画
      delete data.celebrated[today];
    }
    data.checkins[today] = checkins;
    writeData(data);

    // 只更新被点击的这张卡片，避免整列表重渲染
    if (element) {
      element.classList.toggle('completed', nextDone);
      element.setAttribute('aria-pressed', nextDone ? 'true' : 'false');
      const timeEl = element.querySelector('.habit-time');
      if (timeEl) timeEl.textContent = nextDone ? '完成于 ' + time : '';

      element.classList.remove('pop');
      void element.offsetWidth;
      element.classList.add('pop');
    }

    updateStats();
    maybeCelebrate();
  }

  function addHabit(name, emojiOverride) {
    const cleanName = name.trim();
    if (!cleanName) {
      showToast('先输入一个想坚持的习惯吧');
      habitInput.focus();
      return;
    }

    let maxOrder = 0;
    data.habits.forEach(function (habit) {
      if ((habit.sortOrder || 0) >= maxOrder) maxOrder = (habit.sortOrder || 0) + 1;
    });

    const habit = {
      id: newId(),
      name: cleanName,
      emoji: emojiOverride || guessEmoji(cleanName),
      sortOrder: maxOrder,
    };
    data.habits.push(habit);
    writeData(data);
    habitInput.value = '';
    renderAll();
    hidePresetPanel();
  }

  function deleteHabit(id) {
    const habit = findHabit(id);
    if (!habit) return;
    const confirmed = window.confirm('删除「' + habit.name + '」？它的历史打卡记录也会一并删除。');
    if (!confirmed) return;

    data.habits = data.habits.filter(function (item) { return item.id !== id; });
    Object.keys(data.checkins).forEach(function (day) {
      if (data.checkins[day] && data.checkins[day][id]) {
        delete data.checkins[day][id];
      }
    });
    writeData(data);
    renderAll();
  }

  function resetAll() {
    const confirmed = window.confirm('确定清空所有习惯和打卡记录吗？此操作无法恢复。');
    if (!confirmed) return;
    data = emptyData();
    writeData(data);
    renderAll();
    showToast('已清空所有数据');
  }

  /* ---------------- 庆祝：横幅 + 彩纸 + 音效 ---------------- */
  function maybeCelebrate() {
    const total = sortedHabits().length;
    if (!total) return;
    const done = Object.keys(todayCheckins()).filter(function (id) { return findHabit(id); }).length;
    if (done !== total) return;
    if (data.celebrated[today]) return;
    if (Date.now() - lastCelebrationAt < 3000) return;

    data.celebrated[today] = true;
    lastCelebrationAt = Date.now();
    writeData(data);
    showCelebrationBanner();
    launchConfetti();
    playCelebrationSound();
  }

  function showCelebrationBanner() {
    celebrationTextEl.textContent =
      CELEBRATION_PHRASES[Math.floor(Math.random() * CELEBRATION_PHRASES.length)];
    celebrationBanner.hidden = false;
    celebrationBanner.classList.remove('show');
    void celebrationBanner.offsetWidth;
    celebrationBanner.classList.add('show');
    setTimeout(function () {
      celebrationBanner.hidden = true;
      celebrationBanner.classList.remove('show');
    }, 3000);
  }

  function launchConfetti() {
    confettiLayer.textContent = '';
    const colors = ['#2fbd8d', '#f4c95d', '#5fb8d8', '#f28f7b', '#9b8ce0', '#f4a2c1', '#79c7a2'];
    const count = 130;

    for (let i = 0; i < count; i += 1) {
      const piece = document.createElement('span');
      piece.className = 'confetti-piece';
      const size = 7 + Math.random() * 9;
      const isCircle = Math.random() > 0.65;
      piece.style.left = Math.random() * 100 + '%';
      piece.style.width = isCircle ? size + 'px' : size + 'px';
      piece.style.height = isCircle ? size + 'px' : size * 1.7 + 'px';
      piece.style.borderRadius = isCircle ? '50%' : '2px';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.opacity = 0.65 + Math.random() * 0.35;
      piece.style.setProperty('--drift', (Math.random() - 0.5) * 320 + 'px');
      piece.style.setProperty('--spin', (Math.random() * 1080 - 360) + 'deg');
      piece.style.animationDuration = 2.4 + Math.random() * 1.6 + 's';
      piece.style.animationDelay = Math.random() * 0.45 + 's';
      confettiLayer.appendChild(piece);
    }

    setTimeout(function () {
      confettiLayer.textContent = '';
    }, 4600);
  }

  let audioContext = null;
  function playCelebrationSound() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContext) audioContext = new AudioContextClass();
      if (audioContext.state === 'suspended') audioContext.resume();

      const now = audioContext.currentTime;
      const arpeggio = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
      arpeggio.forEach(function (frequency, index) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'triangle';
        osc.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, now + index * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.16, now + index * 0.08 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.55);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(now + index * 0.08);
        osc.stop(now + index * 0.08 + 0.6);
      });

      // 闪亮装饰音：短促的高频轻响
      for (let i = 0; i < 6; i += 1) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        osc.frequency.value = 1100 + Math.random() * 900;
        gain.gain.setValueAtTime(0.0001, now + 0.45 + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.045, now + 0.45 + i * 0.04 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45 + i * 0.04 + 0.18);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start(now + 0.45 + i * 0.04);
        osc.stop(now + 0.45 + i * 0.04 + 0.2);
      }
    } catch (err) {
      // 音效失败不影响打卡流程
    }
  }

  /* ---------------- 物理碰撞气泡 ---------------- */
  const bubbleColors = [
    'rgba(47, 189, 141, 0.38)',
    'rgba(95, 184, 216, 0.38)',
    'rgba(244, 201, 93, 0.34)',
    'rgba(242, 143, 123, 0.34)',
    'rgba(155, 140, 224, 0.32)',
    'rgba(244, 162, 193, 0.32)',
    'rgba(121, 199, 162, 0.42)',
  ];
  let bubbles = [];
  let bubbleCtx = null;
  let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setupBubbles() {
    if (!bubbleCanvas.getContext) return;
    bubbleCtx = bubbleCanvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      bubbleCanvas.width = window.innerWidth * dpr;
      bubbleCanvas.height = window.innerHeight * dpr;
      bubbleCanvas.style.width = window.innerWidth + 'px';
      bubbleCanvas.style.height = window.innerHeight + 'px';
      bubbleCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener('resize', resize);

    bubbles = bubbleColors.map(function (color, index) {
      return {
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        r: 18 + Math.random() * 18,
        color: color,
        hue: index,
      };
    });

    if (reducedMotion) drawBubbles();
    requestAnimationFrame(tickBubbles);
  }

  function drawBubbles() {
    if (!bubbleCtx) return;
    bubbleCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    bubbles.forEach(function (bubble) {
      bubbleCtx.beginPath();
      bubbleCtx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
      bubbleCtx.fillStyle = bubble.color;
      bubbleCtx.fill();
    });
  }

  function tickBubbles() {
    if (!reducedMotion) {
      bubbles.forEach(function (bubble) {
        bubble.x += bubble.vx;
        bubble.y += bubble.vy;
        if (bubble.x < bubble.r || bubble.x > window.innerWidth - bubble.r) {
          bubble.vx *= -1;
          bubble.x = Math.max(bubble.r, Math.min(window.innerWidth - bubble.r, bubble.x));
        }
        if (bubble.y < bubble.r || bubble.y > window.innerHeight - bubble.r) {
          bubble.vy *= -1;
          bubble.y = Math.max(bubble.r, Math.min(window.innerHeight - bubble.r, bubble.y));
        }
      });

      // 两两弹性碰撞，假设质量相等
      for (let i = 0; i < bubbles.length; i += 1) {
        for (let j = i + 1; j < bubbles.length; j += 1) {
          const a = bubbles[i];
          const b = bubbles[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.r + b.r;
          if (dist && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = (minDist - dist) / 2;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;

            const aNormal = a.vx * nx + a.vy * ny;
            const bNormal = b.vx * nx + b.vy * ny;
            a.vx -= aNormal * nx;
            a.vy -= aNormal * ny;
            b.vx -= bNormal * nx;
            b.vy -= bNormal * ny;
            a.vx += bNormal * nx;
            a.vy += bNormal * ny;
            b.vx += aNormal * nx;
            b.vy += aNormal * ny;
          }
        }
      }
    }

    drawBubbles();
    requestAnimationFrame(tickBubbles);
  }

  /* ---------------- 快捷预设面板 ---------------- */
  let presetHideTimer = null;

  function showPresetPanel() {
    clearTimeout(presetHideTimer);
    presetPanel.hidden = false;
  }

  function hidePresetPanel() {
    presetPanel.hidden = true;
  }

  // 用“鼠标进入/离开整个弹窗区域”判定，避免从输入框滑到候选词时提前关闭
  let pointerInsidePreset = false;

  function presetPointerEnter() {
    pointerInsidePreset = true;
    clearTimeout(presetHideTimer);
    showPresetPanel();
  }

  function presetPointerLeave() {
    pointerInsidePreset = false;
    clearTimeout(presetHideTimer);
    presetHideTimer = setTimeout(hidePresetPanel, 260);
  }

  /* ---------------- 事件绑定 ---------------- */
  addForm.addEventListener('submit', function (event) {
    event.preventDefault();
    addHabit(habitInput.value, null);
  });

  habitInput.addEventListener('focus', showPresetPanel);
  habitInput.addEventListener('click', showPresetPanel);
  inputWrap.addEventListener('mouseenter', presetPointerEnter);
  inputWrap.addEventListener('mouseleave', presetPointerLeave);
  presetPanel.addEventListener('mouseenter', presetPointerEnter);
  presetPanel.addEventListener('mouseleave', presetPointerLeave);

  document.addEventListener('click', function (event) {
    if (!inputWrap.contains(event.target)) hidePresetPanel();
  });

  document.getElementById('presetTags').addEventListener('click', function (event) {
    const tag = event.target.closest('.preset-tag');
    if (!tag) return;
    addHabit(tag.dataset.name, tag.dataset.emoji);
  });

  habitGridEl.addEventListener('click', function (event) {
    const card = event.target.closest('.habit-item');
    if (!card) return;
    if (event.target.closest('.habit-delete')) {
      deleteHabit(card.dataset.id);
    } else {
      toggleHabit(card.dataset.id);
    }
  });

  habitGridEl.addEventListener('keydown', function (event) {
    if (event.target.closest('.habit-delete')) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('.habit-item');
    if (!card) return;
    event.preventDefault();
    toggleHabit(card.dataset.id);
  });

  resetBtn.addEventListener('click', resetAll);

  function checkDateChanged() {
    const next = todayKey();
    if (next !== today) {
      today = next;
      renderAll();
    } else {
      updateClock();
    }
  }

  window.addEventListener('focus', checkDateChanged);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) checkDateChanged();
  });

  /* ---------------- 启动 ---------------- */
  updateClock();
  renderAll();
  setInterval(updateClock, 1000);
  setInterval(checkDateChanged, 30000);
  setupBubbles();
})();
