(function () {
  'use strict';

  /* ---------------- 元素 ---------------- */
  const listEl = document.getElementById('habitList');
  const bannerEl = document.getElementById('banner');
  const bannerTextEl = document.getElementById('bannerText');
  const dateLabelEl = document.getElementById('dateLabel');
  const doneCountEl = document.getElementById('doneCount');
  const totalCountEl = document.getElementById('totalCount');
  const allDoneEl = document.getElementById('allDone');
  const progressWrapEl = document.getElementById('progressWrap');
  const progressFillEl = document.getElementById('progressFill');
  const manageBtn = document.getElementById('manageBtn');
  const manageHintEl = document.getElementById('manageHint');
  const addForm = document.getElementById('addForm');
  const habitInput = document.getElementById('habitInput');
  const addBtn = document.getElementById('addBtn');

  /* ---------------- 工具函数 ---------------- */
  const LS_KEY = 'habit-tracker-local-v1';
  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function formatToday() {
    const d = new Date();
    return d.getMonth() + 1 + '月' + d.getDate() + '日 · 星期' + WEEKDAYS[d.getDay()];
  }

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  let bannerTimer = null;
  function showBanner(message, type) {
    const kind = type === 'success' ? 'is-success' : '';
    bannerEl.className = 'banner ' + kind;
    bannerTextEl.textContent = message;
    bannerEl.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () {
      bannerEl.hidden = true;
    }, type === 'success' ? 2600 : 4600);
  }

  /* ---------------- 状态 ---------------- */
  const state = {
    today: todayKey(),
    habits: [],
    doneIds: new Set(),
    manage: false,
    loading: true,
    busy: false,
    pending: new Set(),
  };

  /* ---------------- 本地数据层 ---------------- */
  function readLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) {
        return { habits: [], days: {} };
      }
      const data = JSON.parse(raw);
      return {
        habits: Array.isArray(data.habits) ? data.habits : [],
        days: data.days && typeof data.days === 'object' ? data.days : {},
      };
    } catch (err) {
      return { habits: [], days: {} };
    }
  }

  function writeLocal(data) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (err) {
      throw new Error('本地存储不可用');
    }
  }

  function makeLocalStore() {
    return {
      async load() {
        const data = readLocal();
        const habits = data.habits
          .slice()
          .sort(function (a, b) {
            return (a.sortOrder || 0) - (b.sortOrder || 0);
          })
          .map(function (h) {
            return { id: h.id, name: h.name, sortOrder: h.sortOrder || 0 };
          });
        const todayIds = Array.isArray(data.days[todayKey()]) ? data.days[todayKey()] : [];
        const habitIds = new Set(habits.map(function (h) { return h.id; }));
        const doneIds = new Set(todayIds.filter(function (id) { return habitIds.has(id); }));
        return { habits: habits, doneIds: doneIds };
      },

      async add(name) {
        const data = readLocal();
        let maxOrder = 0;
        data.habits.forEach(function (h) {
          if ((h.sortOrder || 0) >= maxOrder) maxOrder = (h.sortOrder || 0) + 1;
        });
        const habit = { id: newId(), name: name, sortOrder: maxOrder };
        data.habits.push(habit);
        writeLocal(data);
        return habit;
      },

      async setDone(id, done) {
        const data = readLocal();
        const day = todayKey();
        if (!data.days[day]) data.days[day] = [];
        if (done) {
          if (data.days[day].indexOf(id) === -1) data.days[day].push(id);
        } else {
          data.days[day] = data.days[day].filter(function (habitId) {
            return habitId !== id;
          });
        }
        writeLocal(data);
      },

      async remove(id) {
        const data = readLocal();
        data.habits = data.habits.filter(function (h) {
          return h.id !== id;
        });
        Object.keys(data.days).forEach(function (day) {
          data.days[day] = data.days[day].filter(function (habitId) {
            return habitId !== id;
          });
        });
        writeLocal(data);
      },
    };
  }

  const store = makeLocalStore();

  /* ---------------- 渲染 ---------------- */
  function svgCheck() {
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

  function makeRow(habit) {
    const li = document.createElement('li');
    const done = state.doneIds.has(habit.id);
    li.className = 'habit-row' + (done ? ' done' : '') + (state.manage ? ' managing' : '');
    li.dataset.id = habit.id;
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.setAttribute('aria-pressed', done ? 'true' : 'false');

    const check = document.createElement('span');
    check.className = 'check';
    check.setAttribute('aria-hidden', 'true');
    check.appendChild(svgCheck());

    const name = document.createElement('span');
    name.className = 'habit-name';
    name.textContent = habit.name;

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.type = 'button';
    delBtn.textContent = '删除';
    delBtn.setAttribute('aria-label', '删除「' + habit.name + '」');

    li.appendChild(check);
    li.appendChild(name);
    li.appendChild(delBtn);
    return li;
  }

  function renderList() {
    listEl.textContent = '';

    if (state.loading) {
      const li = document.createElement('li');
      li.className = 'state-note';
      const p = document.createElement('p');
      p.className = 'sub';
      p.textContent = '正在加载…';
      li.appendChild(p);
      listEl.appendChild(li);
      return;
    }

    if (state.loadError) {
      const li = document.createElement('li');
      li.className = 'state-note';
      const p = document.createElement('p');
      p.className = 'sub';
      p.textContent = state.loadError;
      const retry = document.createElement('button');
      retry.className = 'retry-btn';
      retry.type = 'button';
      retry.textContent = '重试';
      retry.setAttribute('data-action', 'retry');
      li.appendChild(p);
      li.appendChild(retry);
      listEl.appendChild(li);
      return;
    }

    if (!state.habits.length) {
      const li = document.createElement('li');
      li.className = 'state-note';
      const icon = document.createElement('div');
      icon.className = 'icon';
      icon.textContent = '🌱';
      const title = document.createElement('p');
      title.className = 'title';
      title.textContent = '还没有习惯';
      const sub = document.createElement('p');
      sub.className = 'sub';
      sub.textContent = '在下方输入想坚持的事情，比如喝水、运动、看书';
      li.appendChild(icon);
      li.appendChild(title);
      li.appendChild(sub);
      listEl.appendChild(li);
      return;
    }

    state.habits.forEach(function (habit) {
      listEl.appendChild(makeRow(habit));
    });
  }

  function renderMeta() {
    dateLabelEl.textContent = formatToday();
    const total = state.habits.length;
    let done = 0;
    state.habits.forEach(function (h) {
      if (state.doneIds.has(h.id)) done += 1;
    });
    doneCountEl.textContent = done;
    totalCountEl.textContent = total;

    const hasHabits = total > 0 && !state.loading;
    progressWrapEl.hidden = !hasHabits;
    progressFillEl.style.width = hasHabits ? Math.round((done / total) * 100) + '%' : '0%';
    allDoneEl.hidden = !(hasHabits && done === total);
    manageBtn.hidden = !hasHabits;
    manageBtn.textContent = state.manage ? '完成' : '管理';
    manageHintEl.hidden = !state.manage;
  }

  function renderAll() {
    renderMeta();
    renderList();
  }

  /* ---------------- 数据加载与操作 ---------------- */
  async function loadAll() {
    state.loading = true;
    state.loadError = null;
    renderAll();
    try {
      const data = await store.load();
      state.habits = data.habits;
      state.doneIds = data.doneIds;
    } catch (err) {
      state.loadError = '数据加载失败，请检查网络后重试。';
      state.habits = [];
      state.doneIds = new Set();
    } finally {
      state.loading = false;
      renderAll();
    }
  }

  async function addHabit() {
    if (!store || state.busy) return;
    const name = habitInput.value.trim();
    if (!name) {
      showBanner('先输入一个想坚持的习惯吧');
      habitInput.focus();
      return;
    }
    const duplicated = state.habits.some(function (h) {
      return h.name.toLowerCase() === name.toLowerCase();
    });
    if (duplicated) {
      showBanner('已经添加过「' + name + '」了');
      return;
    }

    state.busy = true;
    addBtn.disabled = true;
    try {
      const habit = await store.add(name);
      state.habits.push(habit);
      habitInput.value = '';
      renderAll();
    } catch (err) {
      showBanner('添加失败，请检查网络后重试');
    } finally {
      state.busy = false;
      addBtn.disabled = false;
      habitInput.focus();
    }
  }

  async function toggleHabit(habit) {
    if (!store || state.manage || state.pending.has(habit.id)) return;
    const wasDone = state.doneIds.has(habit.id);
    if (wasDone) {
      state.doneIds.delete(habit.id);
    } else {
      state.doneIds.add(habit.id);
    }
    renderAll();

    state.pending.add(habit.id);
    try {
      await store.setDone(habit.id, !wasDone);
    } catch (err) {
      if (wasDone) {
        state.doneIds.add(habit.id);
      } else {
        state.doneIds.delete(habit.id);
      }
      showBanner('保存失败，刚才的勾选可能没生效，请检查网络');
    } finally {
      state.pending.delete(habit.id);
      renderAll();
    }
  }

  async function deleteHabit(habit) {
    if (!store || state.pending.has(habit.id)) return;
    if (!window.confirm('删除「' + habit.name + '」？它的历史打卡记录也会一并删除。')) {
      return;
    }
    state.pending.add(habit.id);
    try {
      await store.remove(habit.id);
      state.habits = state.habits.filter(function (h) {
        return h.id !== habit.id;
      });
      state.doneIds.delete(habit.id);
      if (!state.habits.length) state.manage = false;
      renderAll();
    } catch (err) {
      showBanner('删除失败，请检查网络后重试');
    } finally {
      state.pending.delete(habit.id);
    }
  }

  /* ---------------- 事件 ---------------- */
  addForm.addEventListener('submit', function (e) {
    e.preventDefault();
    addHabit();
  });

  manageBtn.addEventListener('click', function () {
    if (!state.habits.length) return;
    state.manage = !state.manage;
    renderAll();
  });

  listEl.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="retry"]')) {
      loadAll();
      return;
    }
    const row = e.target.closest('.habit-row');
    if (!row) return;
    const habit = state.habits.find(function (h) {
      return h.id === row.dataset.id;
    });
    if (!habit) return;
    if (e.target.closest('.delete-btn')) {
      deleteHabit(habit);
    } else if (!state.manage) {
      toggleHabit(habit);
    }
  });

  listEl.addEventListener('keydown', function (e) {
    if (e.target.closest('.delete-btn')) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.habit-row');
    if (!row) return;
    const habit = state.habits.find(function (h) {
      return h.id === row.dataset.id;
    });
    if (!habit) return;
    e.preventDefault();
    if (!state.manage) toggleHabit(habit);
  });

  function checkDateChanged() {
    const next = todayKey();
    if (next !== state.today) {
      state.today = next;
      state.manage = false;
      if (store) {
        loadAll();
      } else {
        renderAll();
      }
    } else {
      dateLabelEl.textContent = formatToday();
    }
  }

  window.addEventListener('focus', checkDateChanged);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) checkDateChanged();
  });
  setInterval(checkDateChanged, 30000);

  /* ---------------- 启动 ---------------- */
  if (store) {
    loadAll();
  } else {
    renderAll();
  }
})();
