import { Component } from "obsidian";
import { ReviewMobileLayout } from "../../src/review-mobile-layout";

export async function checkReviewMobileLayout(check: (value: unknown, message: string) => void): Promise<void> {
  const original = document.body.className;
  document.body.className = "is-phone";
  const leaf = document.body.createDiv({ cls: "workspace-leaf-content", attr: { "data-type": "lexis-review-view" } });
  Object.assign(leaf.style, { position: "fixed", inset: "0 0 58px", zIndex: "100" });
  const content = leaf.createDiv({ cls: "view-content lexis-review" });
  Object.assign(content.style, { height: "100%", overflowY: "auto", maxWidth: "none" });
  const card = content.createDiv({ cls: "lexis-rv-card" });
  for (let index = 0; index < 70; index++) card.createEl("p", { text: `Long review paragraph ${index}: mathematical notes and explanations.` });
  const last = card.createEl("p", { text: "THE LAST LINE MUST REMAIN VISIBLE" });
  const rate = content.createDiv({ cls: "lexis-rv-rate" });
  for (const label of ["Again", "Hard", "Good", "Easy"]) rate.createEl("button", { cls: "lexis-rv-btn" }).createSpan({ text: label });
  const navbar = document.body.createDiv({ cls: "mobile-navbar" });
  Object.assign(navbar.style, { position: "fixed", left: "0", right: "0", bottom: "0", height: "58px" });
  const component = new Component(); component.load();
  const layout = new ReviewMobileLayout(component, leaf, content, () => rate);
  const tick = () => new Promise((resolve) => setTimeout(resolve, 80));
  layout.update(); await tick();
  const verifyEnd = (message: string) => {
    content.scrollTop = content.scrollHeight;
    check(last.getBoundingClientRect().bottom <= rate.getBoundingClientRect().top - 8, message);
  };
  verifyEnd("scrolling to the end leaves the final text above the rating buttons");
  const spacer = content.querySelector<HTMLElement>(".lexis-rv-bottom-spacer")!;
  const before = parseFloat(spacer.style.height);
  rate.querySelectorAll<HTMLElement>("button").forEach((button) => { button.style.minHeight = "130px"; });
  await tick();
  check(parseFloat(spacer.style.height) > before, "rating-bar resize automatically increases the reserved scroll space");
  verifyEnd("taller rating buttons still do not cover the final paragraph");
  leaf.style.setProperty("--lexis-review-bottom-space", "160px");
  await tick();
  verifyEnd("changing the configured bottom offset updates scroll clearance without a window resize");
  document.body.className = "is-tablet";
  layout.update();
  verifyEnd("tablet layout uses the same measured clearance");
  rate.style.display = "none"; await tick();
  check(spacer.style.height === "12px", "hidden rating controls release their reserved space");
  component.unload(); leaf.remove(); navbar.remove(); document.body.className = original;
}
