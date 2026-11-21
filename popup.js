import { BillingManager } from "./lib/billing.js";
import { BILLING_CONFIG } from "./lib/billing-config.js";

const FREE_WL_LIMIT = 5;
const DEFAULT_CONFIG = {
  autoSuspend: true,
  idleMinutes: 20,
  protectPinned: true,
  protectAudible: true,
  minTabsThreshold: 4,
  whitelist: ["mail.google.com", "calendar.google.com", "meet.google.com"],
  regexWhitelist: []
};

const billing = new BillingManager(BILLING_CONFIG);
let config = structuredClone(DEFAULT_CONFIG);
let toastTimer = null;

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === `panel-${name}`));
}

async function save() {
  await chrome.storage.local.set({ rg_config: config });
  render();
}

async function refreshStats() {
  const tabs = await chrome.tabs.query({});
  const discarded = tabs.filter(t => t.discarded).length;
  document.getElementById("suspendedNow").textContent = `${discarded}/${tabs.length}`;
  const mb = discarded * 85;
  document.getElementById("ramSaved").textContent = mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;
}

function render() {
  const pill = document.getElementById("tierPill");
  pill.textContent = billing.isPro() ? "PRO" : "FREE";
  pill.classList.toggle("pro", billing.isPro());

  document.getElementById("autoSuspendToggle").checked = !!config.autoSuspend;
  document.getElementById("idleSelect").value = String(config.idleMinutes || 20);
  document.getElementById("protectPinnedToggle").checked = !!config.protectPinned;
  document.getElementById("protectAudibleToggle").checked = !!config.protectAudible;

  const list = document.getElementById("wlList");
  list.innerHTML = "";
  for (const dom of config.whitelist) {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `<span class="truncate">🛡️ ${dom}</span><button class="btn btn-danger btn-sm">Remove</button>`;
    div.querySelector("button").addEventListener("click", () => {
      config.whitelist = config.whitelist.filter(d => d !== dom);
      save();
    });
    list.appendChild(div);
  }
  for (const re of config.regexWhitelist || []) {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `<span class="truncate">.* ${re}</span><button class="btn btn-danger btn-sm">Remove</button>`;
    div.querySelector("button").addEventListener("click", () => {
      config.regexWhitelist = config.regexWhitelist.filter(x => x !== re);
      save();
    });
    list.appendChild(div);
  }
}

async function init() {
  await billing.init();
  const { rg_config } = await chrome.storage.local.get("rg_config");
  if (rg_config) config = { ...DEFAULT_CONFIG, ...rg_config };

  document.querySelectorAll(".tab-btn").forEach(b => b.addEventListener("click", () => switchTab(b.dataset.tab)));
  document.getElementById("tierPill").addEventListener("click", () => switchTab("pro"));
  billing.mountProPanel(document.getElementById("panel-pro"), { onToast: showToast, onTierChange: render });

  document.getElementById("suspendOthersBtn").addEventListener("click", async () => {
    const res = await chrome.runtime.sendMessage({ type: "RAMGUARD_SUSPEND_OTHERS" });
    showToast(`Suspended ${res?.suspended || 0} inactive tabs (~${(res?.suspended || 0) * 85} MB freed).`);
    refreshStats();
  });

  document.getElementById("wakeAllBtn").addEventListener("click", async () => {
    const res = await chrome.runtime.sendMessage({ type: "RAMGUARD_WAKE_ALL" });
    showToast(`Reloading ${res?.woken || 0} suspended tabs.`);
    refreshStats();
  });

  document.getElementById("autoSuspendToggle").addEventListener("change", e => { config.autoSuspend = e.target.checked; save(); });
  document.getElementById("idleSelect").addEventListener("change", e => { config.idleMinutes = Number(e.target.value); save(); });
  document.getElementById("protectPinnedToggle").addEventListener("change", e => { config.protectPinned = e.target.checked; save(); });
  document.getElementById("protectAudibleToggle").addEventListener("change", e => { config.protectAudible = e.target.checked; save(); });

  function addEntry(val, isRegex) {
    const clean = String(val || "").trim();
    if (!clean) return;
    if (isRegex) {
      if (!billing.isPro()) { showToast("Regex whitelist requires RamGuard Pro."); return switchTab("pro"); }
      try { new RegExp(clean); } catch { return showToast("Invalid regex."); }
      config.regexWhitelist = [clean, ...(config.regexWhitelist || []).filter(x => x !== clean)];
    } else {
      const dom = clean.toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
      if (!billing.isPro() && config.whitelist.length >= FREE_WL_LIMIT && !config.whitelist.includes(dom)) {
        showToast(`Free plan includes ${FREE_WL_LIMIT} domains. Upgrade to Pro for unlimited.`);
        return switchTab("pro");
      }
      if (!config.whitelist.includes(dom)) config.whitelist.unshift(dom);
    }
    save();
    showToast(`Protected ${clean}`);
  }

  document.getElementById("addWlBtn").addEventListener("click", () => {
    const inp = document.getElementById("wlInput");
    addEntry(inp.value, document.getElementById("wlRegexCb").checked);
    inp.value = "";
  });

  document.getElementById("wlCurrentBtn").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try { addEntry(new URL(tab.url).hostname, false); } catch { showToast("Open an HTTP/HTTPS tab first."); }
  });

  render();
  refreshStats();
}

init();
