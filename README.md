# RamGuard

> **Reliable MV3 Tab Suspender that Frees RAM Without Breaking Work**

A fast, privacy-first Chrome Manifest V3 extension built by **ARIS PARTY LLC** to outperform **Auto Tab Discard** (`jhnleheckmknfcgijgkadoemagpecfol`, 100K+ users, 4.1★).

## Competitive Advantages
- Replaces Auto Tab Discard (100K users, 4.1★, Oct 2026 breakage & post-update promo ad tabs)
- Built cleanly on MV3 chrome.alarms so idle discarding fires reliably after service-worker sleep
- Zero post-update promotional tabs or ad redirects — ever
- Clear visual feedback on protected vs discardable tabs and estimated RAM reclaimed

## Free vs RamGuard Pro
### Free
- Reliable MV3 chrome.alarms + native chrome.tabs.discard auto-suspender
- Smart protection: never suspends active, pinned, audible, or form-dirty tabs
- 1-click 'Suspend Other Tabs' & 'Wake All Tabs' that work reliably on latest Chrome
- Live active vs suspended tab counter and estimated RAM saved readout
- Up to 5 protected whitelist domains

### Pro (Monetized via Stripe)
- Unlimited domain & regex whitelist patterns
- Per-domain custom idle timeout overrides
- Automatic tab-count threshold suspension & memory savings history
- JSON rules export/import

| Plan | Price | Stripe Product / Price ID | Live Checkout Link |
|---|---|---|---|
| Monthly | $2.99/mo | `price_1UeE3RFtqvN4GZH3f81PL4OE` | [Checkout](https://buy.stripe.com/14A8wPejR09r8ebauSg3608) |
| Yearly | $19.99/yr | `price_1UeE4UFtqvN4GZH3IaUSYHlj` | [Checkout](https://buy.stripe.com/dRm00j3Fd09r2TRfPcg360i) |
| Lifetime | $29.99 one-time | `price_1UeE5eFtqvN4GZH3AIiB3K2u` | [Checkout](https://buy.stripe.com/28EaEX7Vt5tLeCz5ayg360s) |

- **Stripe Product ID:** `prod_VfZAev4Vk6qhtW`

## Local Installation (Chrome)
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this repository root

## Verification & Chrome Web Store Packaging
```bash
node tests/verify.mjs .
```
Outputs a store-ready archive at `dist/ramguard-extension-v1.0.0.zip`.
