import { Component, Setting } from "obsidian";
import { renderPluginMaintenance } from "../../src/settings-maintenance";
import { createI18n } from "../../src/i18n";

export async function checkSettingsMaintenance(check: (value: unknown, message: string) => void): Promise<void> {
  const root = document.body.createDiv({ cls: "lexis-settings-root" });
  const title = new Setting(root).setName("Lexis"); title.settingEl.addClass("lexis-settings-title-row");
  const component = new Component(); component.load();
  const requests: string[] = [], loads: string[] = [];
  let saves = 0;
  const manifest = { id: "lexis", version: "1.17.23", minAppVersion: "1.8.7", dir: ".obsidian/plugins/lexis" };
  const next = { ...manifest, version: "1.17.24" };
  (globalThis as any).__lexisMaintenanceRequest = async ({ url }: { url: string }) => {
    requests.push(url);
    return { status: 200, text: JSON.stringify(url.endsWith("latest") ? { tag_name: next.version, assets: ["main.js", "styles.css", "manifest.json"].map((name) => ({ name })) } : next) };
  };
  const app = { vault: { configDir: ".obsidian" }, plugins: {
    unloadPlugin: async (id: string) => { loads.push(`unload:${id}`); },
    loadManifest: async () => {}, loadPlugin: async (id: string) => { loads.push(`load:${id}`); return { manifest }; },
  }, setting: { openTabById(id: string) { loads.push(`settings:${id}`); } } };
  renderPluginMaintenance(title.controlEl, { app, manifest, prepareReload: async () => { saves++; }, t: createI18n(() => "zh").t } as any, component);
  const reload = root.querySelector<HTMLButtonElement>('[data-maintenance-action="maintenance.reload"]')!;
  const update = root.querySelector<HTMLButtonElement>('[data-maintenance-action="maintenance.check"]')!;
  const status = root.querySelector<HTMLElement>(".lexis-maintenance-status")!;
  check(requests.length === 0 && saves === 0 && loads.length === 0, "opening settings never checks updates or reloads automatically");
  check(reload.getAttribute("aria-label") === "重新加载插件" && update.getAttribute("aria-label") === "检查更新", "maintenance actions have distinct translated names and keyboard buttons");
  check(status.textContent==="1.17.23 · 未检查"&&status.getAttribute("role")==="status","version status starts with the installed version and never claims an unchecked release is current");
  const rowRect = title.settingEl.getBoundingClientRect(), toolsRect = update.parentElement!.getBoundingClientRect();
  check(Math.abs(toolsRect.right - rowRect.right) < 2 && toolsRect.top >= rowRect.top && toolsRect.bottom <= rowRect.bottom, "reload and update stay at the top-right of the settings heading");
  check(status.getBoundingClientRect().left>=update.getBoundingClientRect().right&&root.scrollWidth<=root.clientWidth+1,"the version hint sits to the right of download without overflowing mobile settings");
  if (window.innerWidth <= 700) check(reload.getBoundingClientRect().height >= 44 && update.getBoundingClientRect().width >= 44, "mobile maintenance controls have touch-sized targets");
  update.click();
  check(reload.disabled && update.disabled, "one pending maintenance operation locks both buttons");
  check(status.textContent==="检查中…","checking state appears immediately without waiting for the network");
  for (let attempt = 0; attempt < 100 && !document.querySelector(".lexis-fixture-modal"); attempt++) await new Promise((resolve) => setTimeout(resolve, 10));
  const modal = document.querySelector<HTMLElement>(".lexis-fixture-modal")!;
  check(!!modal && modal.textContent?.includes("1.17.23 → 1.17.24") && modal.textContent?.includes("下载并更新"), "new updates show version comparison and require an explicit download confirmation");
  check(status.textContent==="待更新至 1.17.24","an available release remains visible beside download");
  check(requests.length === 2 && requests.every((url) => !url.endsWith("main.js") && !url.endsWith("styles.css")) && saves === 0 && loads.length === 0, "before confirmation only release metadata is downloaded; installed code stays untouched");
  modal.querySelector<HTMLButtonElement>("button")!.click();
  await new Promise((resolve) => setTimeout(resolve, 10));
  check(!update.disabled && !reload.disabled && loads.length === 0 && saves === 0, "canceling the confirmation performs no installation and unlocks controls");
  check(status.textContent==="待更新至 1.17.24","canceling installation retains the pending-update hint");
  (globalThis as any).__lexisMaintenanceRequest = async () => ({status:200,text:JSON.stringify({tag_name:manifest.version,assets:["main.js","styles.css","manifest.json"].map(name=>({name}))})});
  update.click();
  for(let attempt=0;attempt<100&&update.disabled;attempt++)await new Promise(resolve=>setTimeout(resolve,10));
  check(status.textContent==="1.17.23 · 暂无更新"&&!document.querySelector(".lexis-fixture-modal"),"a successful no-update check has a persistent inline result without an installation dialog");
  (globalThis as any).__lexisMaintenanceRequest = async () => {throw new Error("Fixture offline");};
  update.click();
  for(let attempt=0;attempt<100&&update.disabled;attempt++)await new Promise(resolve=>setTimeout(resolve,10));
  check(status.textContent==="检查失败"&&status.title==="Fixture offline","network failure cannot be mistaken for the latest version or no update");
  (globalThis as any).__lexisMaintenanceRequest=async({url}:{url:string})=>{
    if(url.endsWith("main.js")||url.endsWith("styles.css"))throw new Error("Fixture download failed");
    return {status:200,text:JSON.stringify(url.endsWith("latest")?{tag_name:next.version,assets:["main.js","styles.css","manifest.json"].map(name=>({name}))}:next)};
  };
  update.click();
  for(let attempt=0;attempt<100&&!document.querySelector(".lexis-fixture-modal");attempt++)await new Promise(resolve=>setTimeout(resolve,10));
  document.querySelector<HTMLElement>(".lexis-fixture-modal")!.querySelectorAll<HTMLButtonElement>("button")[1].click();
  for(let attempt=0;attempt<100&&update.disabled;attempt++)await new Promise(resolve=>setTimeout(resolve,10));
  check(status.textContent==="更新失败"&&status.title==="Fixture download failed"&&loads.length===0&&saves===0,"a failed confirmed download is distinct from checking failure and never unloads or writes learning data");
  reload.click();
  for (let attempt = 0; attempt < 100 && reload.disabled; attempt++) await new Promise((resolve) => setTimeout(resolve, 10));
  check(loads.join("|") === "unload:lexis|load:lexis|settings:lexis" && requests.length === 2 && saves === 1, "reload reloads only Lexis and returns to its settings without networking");
  let finish: (response: { status: number; text: string }) => void;
  (globalThis as any).__lexisMaintenanceRequest = () => new Promise((resolve) => { finish = resolve; });
  update.click(); component.unload();
  finish!({ status: 200, text: JSON.stringify({ tag_name: manifest.version, assets: ["main.js", "styles.css", "manifest.json"].map((name) => ({ name })) }) });
  await new Promise((resolve) => setTimeout(resolve, 10));
  check(!document.querySelector(".lexis-fixture-modal")&&status.textContent==="检查中…", "a closed settings page never opens a delayed update dialog or changes its status");
  delete (globalThis as any).__lexisMaintenanceRequest;
  root.remove();
}
