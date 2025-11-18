import type { PrefillMessage } from '../common/messaging';

const MSG_PREFILL = 'MSG_PREFILL' as PrefillMessage['type'];
// 日志前缀，方便在控制台过滤
const LOG_PREFIX = '[AI-Reply-Bubble]';
// 浮窗延迟展示时间，避免频繁闪烁
const BUBBLE_DELAY = 80;
// 浮窗相对选区的垂直偏移
const BUBBLE_VERTICAL_GAP = 8;
// 浮窗距离视口左右边缘的最小间隔
const BUBBLE_HORIZONTAL_MARGIN = 8;

// 当前浮窗 DOM 引用
let bubbleEl: HTMLDivElement | null = null;
// 最近一次选中的文本内容
let lastText = '';
// 标记当前是否正由指针（鼠标/触摸）调整选区
let pointerSelecting = false;
// 控制延迟展示的定时器
let showTimer: number | null = null;
// 控制延迟隐藏/移除浮窗的定时器
let hideTimer: number | null = null;
// 记录最近一次指针事件的屏幕坐标，用于选区 rect 过小时的定位兜底
let lastPointerClient: { x: number; y: number } | null = null;

// 选区信息（文本、矩形、方向）
type SelectionInfo = {
  text: string;
  rect: DOMRect;
  isForward: boolean;
};

// 用于描述 fixed 定位在当前页面上的缩放/平移
type FixedPositionTransform = {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
};

// 清除隐藏定时器，避免旧的 hide 影响新的展示
function clearHideTimer() {
  if (hideTimer != null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
}

// 统一的调试日志输出
function logDebug(label: string, detail?: Record<string, unknown> | string) {
  if (detail === undefined) {
    console.debug(LOG_PREFIX, label);
  } else {
    console.debug(LOG_PREFIX, label, detail);
  }
}

// 判断是否为主要指针（鼠标左键/触摸/手写笔）
function isPrimaryPointerEvent(e: PointerEvent): boolean {
  return e.button === 0 || e.pointerType === 'touch' || e.pointerType === 'pen';
}

// 将当前选中的文本发送到后台，让侧边栏预填
function dispatchPrefill(text: string) {
  const normalized = text.trim();
  if (!normalized) return;
  const message: PrefillMessage = { type: MSG_PREFILL, text: normalized, autoSend: false };
  chrome.runtime.sendMessage(message).then(
    () => {},
    () => {}
  );
}

// 创建或复用浮窗 DOM 节点
function ensureBubble() {
  if (bubbleEl) return bubbleEl;
  bubbleEl = document.createElement('div');
  bubbleEl.className = 'ai-chat-sidebar-bubble';
  
  // 创建图片元素
  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('content/logo.png');
  img.alt = 'AI';
  img.className = 'ai-chat-sidebar-bubble-icon';
  
  // 创建文案元素
  const text = document.createElement('span');
  text.textContent = 'AI 建议回复';
  text.className = 'ai-chat-sidebar-bubble-text';
  
  bubbleEl.appendChild(img);
  bubbleEl.appendChild(text);
  
  bubbleEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  bubbleEl.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const text = lastText || readSelection()?.text;
    if (!text) return;
    dispatchPrefill(text);
    hideBubble('bubble-click');
  });
  document.documentElement.appendChild(bubbleEl);
  return bubbleEl;
}

// 通过插入零尺寸的 fixed 节点，计算页面对 fixed 坐标的缩放/平移
function measureFixedPositionTransform(): FixedPositionTransform {
  const docEl = document.documentElement;
  if (!docEl) {
    return { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 };
  }
  const probe = document.createElement('div');
  probe.style.setProperty('all', 'initial');
  probe.style.position = 'fixed';
  probe.style.left = '0px';
  probe.style.top = '0px';
  probe.style.width = '0';
  probe.style.height = '0';
  probe.style.opacity = '0';
  probe.style.pointerEvents = 'none';
  probe.style.zIndex = '-1';
  docEl.appendChild(probe);

  const originRect = probe.getBoundingClientRect();

  probe.style.left = '100px';
  const xRect = probe.getBoundingClientRect();

  probe.style.left = '0px';
  probe.style.top = '100px';
  const yRect = probe.getBoundingClientRect();

  probe.remove();

  const deltaX = xRect.left - originRect.left;
  const deltaY = yRect.top - originRect.top;

  return {
    scaleX: Math.abs(deltaX) < 1e-4 ? 1 : deltaX / 100,
    scaleY: Math.abs(deltaY) < 1e-4 ? 1 : deltaY / 100,
    translateX: originRect.left,
    translateY: originRect.top,
  };
}

// 将屏幕坐标转换成当前文档布局坐标，抵消 transform/zoom
function convertScreenToLayout(screenX: number, screenY: number, transform: FixedPositionTransform) {
  const denoX = Math.abs(transform.scaleX) < 1e-4 ? 1 : transform.scaleX;
  const denoY = Math.abs(transform.scaleY) < 1e-4 ? 1 : transform.scaleY;
  return {
    left: (screenX - transform.translateX) / denoX,
    top: (screenY - transform.translateY) / denoY,
  };
}

// 读取浏览器当前选区，兼容 Chrome 的 Selection.type
function readSelection(): SelectionInfo | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const selectionType = (sel as Selection & { type?: string }).type;
  const hasRange = !sel.isCollapsed || selectionType === 'Range';
  if (!hasRange) return null;
  const text = sel.toString().trim();
  if (!text) return null;
  const range = sel.getRangeAt(0);
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width || rect.height);
  const rect = rects[rects.length - 1] ?? range.getBoundingClientRect();
  if (!rect) return null;
  const isForward =
    sel.anchorNode === range.startContainer && sel.anchorOffset === range.startOffset;
  return { text, rect, isForward };
}

// 根据选区信息在页面展示浮窗
function renderBubble(selection: SelectionInfo) {
  const bubble = ensureBubble();
  clearHideTimer();
  const transform = measureFixedPositionTransform();
  const scaleX = Math.abs(transform.scaleX) < 1e-4 ? 1 : transform.scaleX;
  const scaleY = Math.abs(transform.scaleY) < 1e-4 ? 1 : transform.scaleY;
  const bubbleWidth = Math.abs((bubble.offsetWidth || 0) * scaleX);
  const bubbleHeight = Math.abs((bubble.offsetHeight || 0) * scaleY);
  const visualViewport = window.visualViewport;
  const viewportOffsetLeft = visualViewport?.offsetLeft ?? 0;
  const viewportOffsetTop = visualViewport?.offsetTop ?? 0;
  const viewportWidth =
    visualViewport?.width ?? window.innerWidth ?? document.documentElement.clientWidth ?? bubbleWidth;
  const viewportHeight =
    visualViewport?.height ?? window.innerHeight ?? document.documentElement.clientHeight ?? bubbleHeight;

  const rect = selection.rect;
  const rectIsTiny = Math.abs(rect.width) < 1 && Math.abs(rect.height) < 1;
  const anchorLeft = rectIsTiny
    ? lastPointerClient?.x ?? rect.right
    : selection.isForward
      ? rect.right
      : rect.left;
  const anchorTop = rectIsTiny ? lastPointerClient?.y ?? rect.bottom : rect.bottom;
  const unclampedLeft = anchorLeft - bubbleWidth;
  const minLeft = viewportOffsetLeft + BUBBLE_HORIZONTAL_MARGIN;
  const maxLeft = viewportOffsetLeft + viewportWidth - bubbleWidth - BUBBLE_HORIZONTAL_MARGIN;
  const targetScreenLeft = Math.min(Math.max(unclampedLeft, minLeft), Math.max(minLeft, maxLeft));

  const unclampedTop = anchorTop + BUBBLE_VERTICAL_GAP;
  const minTop = viewportOffsetTop + BUBBLE_VERTICAL_GAP;
  const maxTop = viewportOffsetTop + viewportHeight - bubbleHeight - BUBBLE_VERTICAL_GAP;
  const targetScreenTop = Math.min(Math.max(unclampedTop, minTop), Math.max(minTop, maxTop));

  const layoutCoords = convertScreenToLayout(targetScreenLeft, targetScreenTop, transform);

  bubble.style.top = `${layoutCoords.top}px`;
  bubble.style.left = `${layoutCoords.left}px`;
  bubble.style.opacity = '1';
  bubble.style.pointerEvents = 'auto';
  // 重置 CSS 位置属性，避免被宿主页面外层 transform 污染
  bubble.style.position = 'fixed';
  bubble.style.transform = 'none';
  logDebug('浮窗展示', {
    textLength: selection.text.length,
    layoutTop: layoutCoords.top,
    layoutLeft: layoutCoords.left,
  });
}

type UpdateOptions = {
  force?: boolean;
  reason?: string;
};

// 根据当前选区状态决定是否展示/更新浮窗
function updateBubble({ force = false, reason = 'unknown' }: UpdateOptions = {}) {
  logDebug('更新浮窗', { force, reason, pointerSelecting });
  const selection = readSelection();
  if (!selection) {
    hideBubble('无有效选区');
    return;
  }

  lastText = selection.text;

  if (!force && pointerSelecting) {
    logDebug('更新浮窗:等待指针结束');
    return;
  }

  if (showTimer != null) {
    window.clearTimeout(showTimer);
    showTimer = null;
  }

  const run = () => {
    renderBubble(selection);
    showTimer = null;
  };

  if (force) {
    run();
  } else {
    showTimer = window.setTimeout(run, BUBBLE_DELAY);
  }
}

// 隐藏并延迟移除浮窗
function hideBubble(reason = 'unknown') {
  if (!bubbleEl) return;
  logDebug('浮窗隐藏', { reason });
  bubbleEl.style.opacity = '0';
  bubbleEl.style.pointerEvents = 'none';
  if (showTimer != null) {
    window.clearTimeout(showTimer);
    showTimer = null;
  }
  clearHideTimer();
  hideTimer = window.setTimeout(() => {
    bubbleEl?.remove();
    bubbleEl = null;
    hideTimer = null;
  }, 200);
}

// 简单节流：限制高频事件回调的执行频率
function throttle<T extends (...args: any[]) => void>(fn: T, wait: number): T {
  let last = 0;
  let timer: number | null = null;
  return function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn.apply(this, args);
    } else if (timer == null) {
      timer = window.setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, wait - (now - last));
    }
  } as T;
}

// 将 selectionchange 事件节流，避免文本输入场景触发过快
const throttledSelectionUpdate = throttle(
  () => updateBubble({ force: false, reason: 'selectionchange' }),
  120
);

// 选区发生变更时尝试更新浮窗
document.addEventListener('selectionchange', throttledSelectionUpdate);
// 页面滚动时重新计算浮窗位置（若仍有选区）
document.addEventListener(
  'scroll',
  () => {
    updateBubble({ force: false, reason: 'scroll' });
  },
  true
);

// 指针按下时记录坐标并标记“正处于拖拽状态”
document.addEventListener('pointerdown', (e) => {
  if (!isPrimaryPointerEvent(e)) return;
  pointerSelecting = true;
  lastPointerClient = { x: e.clientX, y: e.clientY };
  logDebug('指针按下', { pointerX: e.clientX, pointerY: e.clientY });
});

// 指针抬起：结束拖拽并强制更新一次浮窗
document.addEventListener(
  'pointerup',
  (e) => {
    if (!isPrimaryPointerEvent(e)) return;
    pointerSelecting = false;
    lastPointerClient = { x: e.clientX, y: e.clientY };
    updateBubble({ force: true, reason: 'pointerup' });
  },
  true
);

// 指针取消（例如系统手势中断）时重置状态
document.addEventListener('pointercancel', () => {
  pointerSelecting = false;
  lastPointerClient = null;
  updateBubble({ force: false, reason: 'pointercancel' });
});

// 开始新的选区：只记录状态，具体显隐交给 selectionchange
document.addEventListener(
  'selectstart',
  () => {
    pointerSelecting = true;
    logDebug('selectstart');
  },
  true
);

// 键盘调整选区（如 Shift+箭头）结束后刷新浮窗
document.addEventListener('keyup', () => {
  pointerSelecting = false;
  updateBubble({ force: true, reason: 'keyup' });
});

