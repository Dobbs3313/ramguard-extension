const DEFAULT_CONFIG = {
  autoSuspend: true,
  idleMinutes: 20,
  protectPinned: true,
  protectAudible: true,
  minTabsThreshold: 4,
  whitelist: ["mail.google.com", "calendar.google.com", "meet.google.com"],
  regexWhitelist: []
};

async function touchTab(tabId) {
  if (!tabId) return;
  const { rg_activity = {} } = await chrome.storage.local.get("rg_activity");
  rg_activity[String(tabId)] = Date.now();
  await chrome.storage.local.set({ rg_activity });
}

function isWhitelisted(urlStr, cfg, isPro) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    if ((cfg.whitelist || []).some(d => host === d.toLowerCase() || host.endsWith(`.${d.toLowerCase()}`))) return true;
    if (isPro) {
      for (const pat of cfg.regexWhitelist || []) {
        try { if (new RegExp(pat, "i").test(urlStr)) return true; } catch { /* ignore */ }
      }
    }
  } catch {
    return true; // Non-http internal URLs
  }
  return false;
}

function isDiscardable(tab, cfg, isPro) {
  if (!tab?.id || tab.active || tab.discarded || !tab.url) return false;
  if (!/^https?:/.test(tab.url)) return false;
  if (cfg.protectPinned && tab.pinned) return false;
  if (cfg.protectAudible && tab.audible) return false;
  if (isWhitelisted(tab.url, cfg, isPro)) return false;
  return true;
}

async function sweepIdleTabs(forceAllOthers = false) {
  const {
    rg_config = DEFAULT_CONFIG,
    rg_activity = {},
    rg_stats = { totalSuspended: 0 },
    aris_pro_ramguard
  } = await chrome.storage.local.get(["rg_config", "rg_activity", "rg_stats", "aris_pro_ramguard"]);

  const cfg = { ...DEFAULT_CONFIG, ...rg_config };
  const isPro = aris_pro_ramguard?.tier === "pro";
  if (!forceAllOthers && !cfg.autoSuspend) return { suspended: 0 };

  const tabs = await chrome.tabs.query({});
  if (!forceAllOthers && tabs.length < (cfg.minTabsThreshold || 4)) return { suspended: 0 };

  const now = Date.now();
  const maxIdleMs = Math.max(1, Number(cfg.idleMinutes || 20)) * 60 * 1000;
  let suspended = 0;

  for (const tab of tabs) {
    if (!isDiscardable(tab, cfg, isPro)) continue;
    const lastSeen = rg_activity[String(tab.id)] || tab.lastAccessed || (now - maxIdleMs - 1000);
    if (forceAllOthers || (now - lastSeen) >= maxIdleMs) {
      try {
        await chrome.tabs.discard(tab.id);
        suspended++;
      } catch {
        // Tab cannot be discarded right now
      }
    }
  }

  if (suspended > 0) {
    rg_stats.totalSuspended = (rg_stats.totalSuspended || 0) + suspended;
    await chrome.storage.local.set({ rg_stats });
  }
  await updateBadge();
  return { suspended };
}

async function updateBadge() {
  const tabs = await chrome.tabs.query({});
  const discarded = tabs.filter(t => t.discarded).length;
  chrome.action.setBadgeText({ text: discarded > 0 ? `${discarded}` : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
}

chrome.runtime.onInstalled.addListener(async () => {
  const { rg_config } = await chrome.storage.local.get("rg_config");
  if (!rg_config) await chrome.storage.local.set({ rg_config: DEFAULT_CONFIG });
  chrome.alarms.create("ramguard-sweep", { periodInMinutes: 1 });
  const tabs = await chrome.tabs.query({});
  const act = {};
  const now = Date.now();
  tabs.forEach(t => { if (t.id) act[String(t.id)] = now; });
  await chrome.storage.local.set({ rg_activity: act });
  await updateBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "ramguard-sweep") sweepIdleTabs(false);
});

chrome.tabs.onActivated.addListener(({ tabId }) => { touchTab(tabId); updateBadge(); });
chrome.tabs.onUpdated.addListener((tabId, info) => { if (info.status === "complete") touchTab(tabId); updateBadge(); });
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { rg_activity = {} } = await chrome.storage.local.get("rg_activity");
  delete rg_activity[String(tabId)];
  await chrome.storage.local.set({ rg_activity });
  updateBadge();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "RAMGUARD_SUSPEND_OTHERS") {
    sweepIdleTabs(true).then(res => sendResponse({ ok: true, ...res }));
    return true;
  }
  if (msg?.type === "RAMGUARD_WAKE_ALL") {
    (async () => {
      const tabs = await chrome.tabs.query({ discarded: true });
      for (const t of tabs) {
        if (t.id) await chrome.tabs.reload(t.id).catch(() => {});
      }
      await updateBadge();
      sendResponse({ ok: true, woken: tabs.length });
    })();
    return true;
  }
});
