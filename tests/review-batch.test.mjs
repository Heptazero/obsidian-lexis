import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

async function load(entry) {
  const result = await build({entryPoints:[entry],bundle:true,write:false,format:"esm",platform:"node"});
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
const batch = await load("src/review-batch.ts"), model = await load("src/review-setup-model.ts"), dashboard = await load("src/review-dashboard-data.ts");
const note = (name) => ({type:"note",file:{path:name},card:{s:2,due:"2026-12-01",reps:3}});
const keys = (items) => items.flatMap(item=>item.type === "note" ? [item.file.path] : item.syntax.memberIds);
const config = () => ({reviewPracticeProgress:{},reviewDailyTargets:{},reviewEvents:[],reviewDailyGoal:20,reviewMinimumGoal:5,newPerDay:20});

test("batches split atomic clozes and preserve all remainder without duplicates", () => {
  const cloze = {type:"syntax",file:{path:"cloze.md"},card:{},syntax:{kind:"cloze",id:"group",memberIds:["a","b"],front:"q",back:"a"}};
  const selected = batch.takeReviewBatch([cloze,note("c.md")],1);
  assert.deepEqual(keys(selected.selected),["a"]);
  assert.deepEqual(keys(selected.remaining),["b","c.md"]);
  assert.equal(batch.takeReviewBatch([cloze,note("c.md")],null).remaining.length,0);
});

test("practice completes exactly the requested rounds, honors mid-session suspension, and leaves FSRS untouched", async () => {
  const a = note("a.md"), b=note("b.md"), c=note("c.md"), settings=config();
  const state=JSON.stringify([a.card,b.card,c.card]);
  const options={mode:"cram",batchSize:2,rounds:2,planId:"plan"};
  const session=new batch.ReviewBatch([a,b,c],options);
  const host={settings,saveSettings:async()=>{}};
  assert.deepEqual(keys(session.queue()),["a.md","b.md"]);
  assert.deepEqual(keys(session.remaining),["c.md"]);
  await session.grade(a,1,host,options,"2026-10-20");
  assert.equal(settings.reviewPracticeProgress.plan,undefined);
  await session.grade(a,3,host,options,"2026-10-20");
  await session.grade(b,3,host,options,"2026-10-20");
  assert.deepEqual(keys(session.nextRound({"note:b.md":true})),["a.md"]);
  assert.equal(session.round,2);
  await session.grade(a,4,host,options,"2026-10-20");
  assert.deepEqual(session.nextRound({"note:b.md":true}),[]);
  assert.deepEqual(settings.reviewPracticeProgress.plan.counts,{"a.md":2,"b.md":1});
  assert.equal(JSON.stringify([a.card,b.card,c.card]),state);
  assert.equal(settings.reviewEvents.length,0);
});

test("practice resumes per-plan counts after reload and resets only daily counts at the date boundary", async () => {
  const settings=config();settings.reviewPracticeProgress.p={date:"2026-10-20",counts:{"a.md":2,"b.md":1}};
  const options={mode:"cram",rounds:2,batchSize:null,planId:"p"};
  const session=new batch.ReviewBatch([note("a.md"),note("b.md")],options,batch.practiceCounts(settings,"p","2026-10-20"));
  assert.deepEqual(keys(session.queue()),["b.md"]);
  assert.deepEqual(batch.practiceCounts(settings,"p","2026-10-21"),{});
  const host={settings,saveSettings:async()=>{}};
  const before=structuredClone(settings.reviewPracticeProgress.p);
  const snapshot=await session.grade(note("b.md"),3,host,options,"2026-10-21");
  assert.deepEqual(settings.reviewPracticeProgress.p,{date:"2026-10-21",counts:{"b.md":1}});
  batch.restorePracticeStore(settings.reviewPracticeProgress,"p",snapshot);session.restore(snapshot);
  assert.deepEqual(settings.reviewPracticeProgress.p,before);
});

test("practice save failure rolls back, and undo snapshots retain only the graded keys", async () => {
  const settings=config();settings.reviewPracticeProgress.p={date:"2026-10-20",counts:{"old.md":2}};
  const options={mode:"cram",rounds:3,batchSize:null,planId:"p"};
  const session=new batch.ReviewBatch([note("a.md"),note("b.md")],options);
  const before=JSON.stringify(settings);
  await assert.rejects(session.grade(note("a.md"),3,{settings,saveSettings:async()=>{throw Error("disk");}},options,"2026-10-20"),/disk/);
  assert.equal(JSON.stringify(settings),before);assert.deepEqual(session.counts,{});
  const snapshot=await session.grade(note("a.md"),3,{settings,saveSettings:async()=>{}},options,"2026-10-20");
  assert.deepEqual(Object.keys(snapshot.counts),["a.md"]);
  assert.deepEqual(Object.keys(snapshot.stored.counts),["a.md"]);
  batch.restorePracticeStore(settings.reviewPracticeProgress,"p",snapshot);session.restore(snapshot);
  assert.deepEqual(settings.reviewPracticeProgress.p.counts,{"old.md":2});
});

test("plan scope, mode, daily count and optional deadline remain independent", () => {
  const plan={id:"p",name:"Exam",scope:"current",file:"exam.md",content:"syntax",mode:"cram",batchSize:2,rounds:3,deadline:"2026-11-01"};
  const options=dashboard.planOptions(plan), settings=config(), items=[note("a"),note("b"),note("c")];
  assert.equal(options.file,"exam.md");assert.equal(options.planId,"p");assert.equal(options.dictionaryIds,undefined);
  const target=dashboard.createDailyTarget(items,settings,"2026-10-20",options);
  assert.equal(target.goal,6);assert.deepEqual(target.keys,["a","b"]);
  settings.reviewPracticeProgress.p={date:"2026-10-20",counts:{a:2,b:3,c:99}};
  const summary=dashboard.dashboardSummary(items,settings,target,options);
  assert.equal(summary.completed,5);assert.equal(summary.remaining,1);assert.equal(summary.options.mode,"cram");
  assert.equal(model.deadlineDays(undefined,"2026-10-20"),null);
  assert.equal(model.deadlineDays("2026-10-23","2026-10-20"),3);
  assert.equal(model.deadlineDays("2026-10-19","2026-10-20"),-1);
  assert.equal(model.planSelectionChanged(plan,{...plan,name:"Renamed",deadline:undefined}),false);
  assert.equal(model.validReviewOptions({...options,rounds:0}),false);
  assert.equal(model.validReviewOptions({...options,batchSize:1.5}),false);
  assert.equal(model.validReviewOptions(options),true);
  const restored=JSON.parse(JSON.stringify({reviewPlans:[plan],reviewPracticeProgress:settings.reviewPracticeProgress}));
  assert.equal(restored.reviewPlans[0].deadline,"2026-11-01");assert.equal(restored.reviewPracticeProgress.p.counts.a,2);
});

test("renaming plan sources and card keys preserves today's practice and target membership", () => {
  const plans=[{scope:"current",file:"A/file.md"},{scope:"links",linkSource:"A/hub.md"},{scope:"folder",folder:"A"},{scope:"tag",tag:"A"}];
  assert.equal(model.renameReviewPlanPaths(plans,"A","B"),true);
  assert.equal(plans[0].file,"B/file.md");assert.equal(plans[1].linkSource,"B/hub.md");assert.equal(plans[2].folder,"B");assert.equal(plans[3].tag,"A");
  const settings=config();settings.reviewPracticeProgress.p={date:"2026-10-20",counts:{"syntax:old":2}};settings.reviewDailyTargets.p={keys:["syntax:old"]};
  assert.equal(batch.renamePracticeKey(settings,"syntax:old","syntax:new"),true);
  assert.equal(settings.reviewPracticeProgress.p.counts["syntax:new"],2);assert.deepEqual(settings.reviewDailyTargets.p.keys,["syntax:new"]);
});

test("actual review grading and undo in practice mode do not invoke the scheduler or formal history", async () => {
  const result=await build({entryPoints:["src/review-view.ts"],bundle:true,write:false,format:"cjs",platform:"node",external:["obsidian"]});
  const env={module:{exports:{}},require:()=>({ItemView:class{},Notice:class{}})};
  vm.runInNewContext(result.outputFiles[0].text,env);
  const settings=config();settings.suspendedReviewItems={};
  const plugin={settings,saveSettings:async()=>{},scheduleCard(){throw Error("practice must not schedule");},logReviewItem(){throw Error("practice must not log formal review");},t:key=>key};
  const View=env.module.exports.createReviewView({reviewViewType:"test",todayStr:()=>"2026-10-20",renderLexisMarkdown(){}});
  const view=new View({},plugin);view.options={mode:"cram",rounds:1,planId:"p"};view.batch=new batch.ReviewBatch([note("a.md")],view.options);view.queue=view.batch.queue();view.currentItem=view.queue[0];view.revealed=true;view.render=()=>{};
  await view.grade(3);assert.equal(view.pos,1);assert.equal(settings.reviewPracticeProgress.p.counts["a.md"],1);
  await view.undo();assert.equal(view.pos,0);assert.equal(settings.reviewPracticeProgress.p,undefined);assert.equal(settings.reviewEvents.length,0);
});
