import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";
import { memoryAdapter } from "./helpers/learning-adapter.mjs";

async function load(path) {
  const bundle = await build({entryPoints:[path],bundle:true,write:false,format:"esm",platform:"node"});
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
}
const {LearningStore}=await load("src/learning-store.ts");
const {learningData,pruneLearning,settingsOnly,LEARNING_FIELDS,retentionDays}=await load("src/learning-data.ts");
const {dataFolder}=await load("src/data-folder.ts");
const now=()=>new Date("2026-10-29T12:00:00Z").getTime();
const store=(io,id="a",folder="Data")=>new LearningStore(io,folder,id.repeat(32),id==="a"?"macos":"ios",now);
const event=(id,date="2026-10-29")=>({id,date,timestamp:`${date}T12:00:00Z`,precision:"time",type:"syntax",filePath:"a.md",label:"Q",memberKeys:["syntax:a"],grade:3,retention:90});
const seed=()=>({...learningData({}),reviewPlans:[{id:"p",name:"Plan",content:"syntax"}],syntaxCardStates:{a:{s:12,d:5,reps:8,last:"2026-10-29",due:"2026-11-10"}},suspendedReviewItems:{"syntax:b":true}});

test("learning folders are visible and vault-relative; retention is finite",()=>{
  assert.equal(dataFolder(""),"Lexis-data");assert.equal(dataFolder("99_assets/data/"),"99_assets/data");
  for(const path of [".obsidian/data","A/.hidden","/tmp/data","../data","A//B","C:\\data","a.json"])assert.throws(()=>dataFolder(path));
  assert.equal(retentionDays(NaN),90);assert.equal(retentionDays(0),1);assert.equal(retentionDays(Infinity),90);assert.equal(retentionDays(9999),3650);
});

test("retention has an inclusive calendar boundary and never changes current states or plans",()=>{
  const data=seed();data.reviewEvents=[event("old","2026-07-31"),event("edge","2026-08-01"),event("today")];
  data.reviewHistory={a:[{date:"2026-07-31",s:1,grade:3},{date:"2026-08-01",s:2,grade:3}]};
  data.reviewLog={"2026-07-31":5,"2026-08-01":2};
  const recent=pruneLearning(data,90,"2026-10-29");
  assert.deepEqual(recent.reviewEvents.map(x=>x.id),["edge","today"]);assert.equal(recent.reviewHistory.a.length,1);
  assert.deepEqual(recent.reviewLog,{"2026-08-01":2});
  for(const field of ["syntaxCardStates","suspendedReviewItems","reviewPlans"])assert.deepEqual(recent[field],data[field]);
  assert.equal(data.reviewEvents.length,3);
});

test("configuration never contains learning records or the old path key",()=>{
  const config=settingsOnly({...seed(),language:"zh",dataFolder:"Data",encounterFolder:"old"});
  for(const key of LEARNING_FIELDS)assert.equal(key in config,false);
  assert.equal("encounterFolder" in config,false);assert.equal(config.dataFolder,"Data");assert.equal(config.language,"zh");
});

test("migration is one-time; a marker rejects stale settings and missing/future data",async()=>{
  const io=memoryAdapter(),a=store(io),data=seed();data.reviewEvents=[event("kept"),event("expired","2026-01-01")];
  await a.initialize(data,90);
  assert.ok([...io.files.keys()].every(path=>!path.startsWith(".")));
  const reloaded=await store(io,"b").initialize(learningData({}),90);
  assert.equal(reloaded.syntaxCardStates.a.reps,8);assert.deepEqual(reloaded.reviewEvents.map(x=>x.id),["kept"]);
  await assert.rejects(store(memoryAdapter()).initialize(seed(),90,true),/missing/);
  await io.write("Data/reviews/storage.json",JSON.stringify({schema:99}));
  await assert.rejects(store(io).initialize(seed(),90),/Unsupported/);
});

test("different devices preserve independent edits; stale replicas do not overwrite newer cards",async()=>{
  const io=memoryAdapter(),a=store(io),b=store(io,"b");
  const av=await a.initialize(seed(),90),bv=await b.initialize(seed(),90);
  av.syntaxCardStates.a.reps=9;av.reviewEvents.push(event("mac"));await a.save(av,90);
  bv.syntaxCardStates.b={s:2,reps:1};bv.reviewEvents.push(event("phone"));
  const merged=await b.save(bv,90);
  assert.equal(merged.syntaxCardStates.a.reps,9);assert.equal(merged.syntaxCardStates.b.reps,1);
  assert.deepEqual(merged.reviewEvents.map(x=>x.id),["mac","phone"]);
  const synced=b.rebase(bv,bv,merged);
  synced.reviewEvents=synced.reviewEvents.filter(x=>x.id!=="mac");await b.save(synced,90);
  const refreshed=await a.save(av,90);
  assert.deepEqual(refreshed.reviewEvents.map(x=>x.id),["phone"]);
  assert.equal(refreshed.syntaxCardStates.a.reps,9);
});

test("expired history is physically removed and cannot return by extending retention",async()=>{
  const io=memoryAdapter(),a=store(io),data=seed();
  data.reviewEvents=[event("yesterday","2026-10-28"),event("today")];
  data.reviewHistory={a:[{date:"2026-10-28",s:2,grade:3}]};
  const loaded=await a.initialize(data,90);await a.save(loaded,1);
  assert.ok(![...io.files.values()].join("\n").includes("yesterday"));
  const extended=await store(io).initialize(seed(),3650,true);
  assert.deepEqual(extended.reviewEvents.map(x=>x.id),["today"]);assert.deepEqual(extended.reviewHistory,{});
});

test("write failure keeps pending edits for retry; invalid peer data never becomes an empty snapshot",async()=>{
  const io=memoryAdapter(),a=store(io),data=await a.initialize(seed(),90);
  data.reviewEvents.push(event("retry"));
  const process=io.process,write=io.write;io.process=async()=>{throw Error("disk full");};io.write=async()=>{throw Error("disk full");};
  await assert.rejects(a.save(data,90),/disk full/);
  io.process=process;io.write=write;
  assert.equal((await a.save(data,90)).reviewEvents[0].id,"retry");
  const peer=`Data/reviews/state--ios--${"b".repeat(32)}.json`;
  await io.write(peer,"not JSON");const before=[...io.files.entries()];
  await assert.rejects(a.save(data,90));assert.deepEqual([...io.files.entries()],before);
});

test("rebase preserves edits made during a write, and the next save persists them",async()=>{
  const io=memoryAdapter(),a=store(io),live=await a.initialize(seed(),90);
  const before=structuredClone(live);live.syntaxCardStates.a.reps=9;
  const requested=structuredClone(live),saving=a.save(live,90);
  live.syntaxCardStates.a.reps=10;
  const merged=await saving,rebased=a.rebase(live,requested,merged);
  assert.equal(rebased.syntaxCardStates.a.reps,10);
  await a.save(rebased,90);
  assert.equal((await store(io).initialize(before,90,true)).syntaxCardStates.a.reps,10);
});

test("unchanged saves do not rewrite learning files",async()=>{
  const io=memoryAdapter(),a=store(io),data=await a.initialize(seed(),90);
  const count=io.writes.length;await a.save(data,90);await a.save(data,90);
  assert.equal(io.writes.length,count);
});

const pluginBundle=await build({entryPoints:["src/plugin-data-storage.ts"],bundle:true,write:false,format:"cjs",platform:"node",external:["obsidian"]});
const environment={module:{exports:{}},console,require:()=>({Platform:{isMacOS:true},Notice:class{}})};
vm.runInNewContext(pluginBundle.outputFiles[0].text,environment);
const {PluginDataStorage}=environment.module.exports;
function host(io,id="a") {
  const result={app:{vault:{adapter:io,configDir:".obsidian"},loadLocalStorage:()=>id.repeat(32)},manifest:{id:"lexis"},
    settings:{...seed(),language:"zh",reviewEventsRetentionDays:90,dataFolder:"Data",encounterFolder:"Data"},configs:[]};
  result.saveData=async config=>{result.configs.push(structuredClone(config));};
  result.loadData=async()=>result.configs.at(-1);
  return result;
}

test("actual plugin storage moves legacy fields out of settings, retains plans, and ignores later stale settings",async()=>{
  const io=memoryAdapter(),h=host(io),storage=new PluginDataStorage(h);
  await storage.initialize({encounterFolder:"Data"});
  const config=h.configs.at(-1);
  for(const key of LEARNING_FIELDS)assert.equal(key in config,false);
  assert.equal(config.learningStorageVersion,1);assert.equal(config.dataFolder,"Data");
  const stale=host(io,"b");stale.settings.syntaxCardStates.a.reps=1;stale.settings.reviewPlans=[];
  await new PluginDataStorage(stale).initialize({encounterFolder:"Data"});
  assert.equal(stale.settings.syntaxCardStates.a.reps,8);assert.equal(stale.settings.reviewPlans.length,1);
});

const {EncounterStore}=await load("src/encounter-store.ts");
test("moving the folder verifies all devices' files, commits the pointer, and removes exact originals",async()=>{
  const io=memoryAdapter(),h=host(io),storage=new PluginDataStorage(h);
  await storage.initialize({encounterFolder:"Data"});
  const encounters=new EncounterStore(io,"Data","a".repeat(32),"macos");
  await encounters.apply([{path:"a.md",changedAt:123,encounteredAt:123,day:"2026-10-29"}]);
  const next=await storage.move("Other-data",encounters);
  assert.equal(next.folder,"Other-data");assert.equal(h.settings.dataFolder,"Other-data");
  assert.ok(![...io.files.keys()].some(path=>path.startsWith("Data/")));
  assert.equal((await next.load())["a.md"].lastEncounter,"2026-10-29");
  assert.equal(h.configs.at(-1).dataFolder,"Other-data");
  await assert.rejects(storage.move("Other-data/nested",next),/contain/);
});

test("failed folder moves retain source and pointer, and remove only operation-created copies",async()=>{
  const io=memoryAdapter(),h=host(io),storage=new PluginDataStorage(h);
  await storage.initialize({encounterFolder:"Data"});
  const encounters=new EncounterStore(io,"Data","a".repeat(32),"macos"),before=[...io.files.entries()];
  h.saveData=async()=>{throw Error("config write failed");};
  // Unchanged configuration is not rewritten by the pre-move flush.
  await assert.rejects(storage.move("New-data",encounters),/config write failed/);
  assert.equal(h.settings.dataFolder,"Data");assert.equal(storage.store.folder,"Data");
  assert.deepEqual([...io.files.entries()],before);
  assert.ok(![...io.dirs].some(path=>path.startsWith("New-data")));
});

test("partial copy failures roll back files without deleting the valid source",async()=>{
  const io=memoryAdapter(),h=host(io),storage=new PluginDataStorage(h);
  await storage.initialize({encounterFolder:"Data"});
  const encounters=new EncounterStore(io,"Data","a".repeat(32),"macos"),before=[...io.files.entries()];
  const write=io.write;let copied=0;
  io.write=async(path,text)=>{if(path.startsWith("New-data/")&&++copied===2)throw Error("disk full");await write(path,text);};
  await assert.rejects(storage.move("New-data",encounters),/disk full/);
  assert.equal(h.settings.dataFolder,"Data");assert.deepEqual([...io.files.entries()],before);
});

test("data folders cannot be a notes folder or another plugin's data directory",async()=>{
  const io=memoryAdapter(),h=host(io);await io.mkdir("Data");await io.write("Data/novel.md","do not touch");
  await assert.rejects(new PluginDataStorage(h).initialize({encounterFolder:"Data"}),/dedicated/);
  assert.deepEqual([...io.files.entries()],[["Data/novel.md","do not touch"]]);
});

test("expired daily files from offline devices are removed, without touching their latest state",async()=>{
  const io=memoryAdapter(),past=()=>new Date("2026-09-01T12:00:00Z").getTime();
  const phone=new LearningStore(io,"Data","b".repeat(32),"ios",past),data=seed();
  data.reviewEvents=[event("old","2026-09-01")];data.reviewHistory={a:[{date:"2026-09-01",s:12,grade:3}]};
  await phone.initialize(data,90);
  assert.ok([...io.files.keys()].some(path=>path.includes("day-2026-09-01")));
  const mac=store(io),loaded=await mac.initialize(seed(),1,true);
  assert.ok(![...io.files.keys()].some(path=>path.includes("day-2026-09-01")));
  assert.equal(loaded.syntaxCardStates.a.reps,8);assert.deepEqual(loaded.reviewHistory,{});
  assert.ok([...io.files.keys()].some(path=>path.includes("state--ios")));
});

test("missing latest-state files do not silently load an empty schedule from history",async()=>{
  const io=memoryAdapter(),a=store(io),data=seed();data.reviewEvents=[event("today")];await a.initialize(data,90);
  for(const path of [...io.files.keys()].filter(path=>path.includes("/state--")))await io.remove(path);
  await assert.rejects(store(io).initialize(seed(),90,true),/missing/);
});

test("data writes do not recreate expired daily files, and review totals merge distinct devices",async()=>{
  const io=memoryAdapter(),a=store(io),b=store(io,"b");
  const av=await a.initialize(seed(),90),bv=await b.initialize(seed(),90);
  av.reviewEvents.push(event("one"));av.reviewLog["2026-10-29"]=1;await a.save(av,90);
  bv.reviewEvents.push(event("two"));bv.reviewLog["2026-10-29"]=1;
  const merged=await b.save(bv,90);assert.equal(merged.reviewLog["2026-10-29"],2);
});

test("hidden legacy encounter snapshots move to the visible default with no hidden learning files left",async()=>{
  const io=memoryAdapter(),h=host(io);h.settings.dataFolder="";
  const oldFolder=".obsidian/plugins/lexis/encounters";
  const old=new EncounterStore(io,oldFolder,"a".repeat(32),"macos");
  await old.apply([{path:"a.md",changedAt:123,encounteredAt:123,day:"2026-10-29"}]);
  await new PluginDataStorage(h).initialize({encounterFolder:oldFolder});
  assert.equal(h.settings.dataFolder,"Lexis-data");
  assert.ok([...io.files.keys()].every(path=>!path.startsWith(".")));
  const encounters=new EncounterStore(io,"Lexis-data","a".repeat(32),"macos");
  assert.equal((await encounters.load())["a.md"].lastEncounter,"2026-10-29");
});

test("synced legacy configuration is sanitized but its stale study records are never reimported",async()=>{
  const io=memoryAdapter(),h=host(io),storage=new PluginDataStorage(h);await storage.initialize({encounterFolder:"Data"});
  h.loadData=async()=>({...seed(),encounterFolder:"Data",syntaxCardStates:{a:{reps:1}}});
  await storage.externalSettingsChanged();
  assert.equal(h.settings.syntaxCardStates.a.reps,8);
  for(const field of LEARNING_FIELDS)assert.equal(field in h.configs.at(-1),false);
});

test("synced retention changes apply immediately; changed data folders block writes until reload",async()=>{
  const io=memoryAdapter(),h=host(io),storage=new PluginDataStorage(h);await storage.initialize({encounterFolder:"Data"});
  const config=structuredClone(h.configs.at(-1));config.reviewEventsRetentionDays=30;h.loadData=async()=>config;
  await storage.externalSettingsChanged();assert.equal(h.settings.reviewEventsRetentionDays,30);
  config.dataFolder="Other-data";
  await assert.rejects(storage.externalSettingsChanged(),/reload|重新加载/);
  const before=io.writes.length;await assert.rejects(storage.save(),/reload|重新加载/);assert.equal(io.writes.length,before);
});

test("a running instance never recreates a removed data directory after a remote move",async()=>{
  const io=memoryAdapter(),a=store(io),data=await a.initialize(seed(),90);
  await io.remove("Data/reviews/storage.json");const before=io.writes.length;
  await assert.rejects(a.save(data,90),/missing|moving/);assert.equal(io.writes.length,before);
});

test("practice progress merges different cards within the same plan and preserves the latest date",async()=>{
  const io=memoryAdapter(),a=store(io),b=store(io,"b");
  const av=await a.initialize(seed(),90),bv=await b.initialize(seed(),90);
  av.reviewPracticeProgress.p={date:"2026-10-29",counts:{"a.md":1}};await a.save(av,90);
  bv.reviewPracticeProgress.p={date:"2026-10-29",counts:{"b.md":2}};
  const merged=await b.save(bv,90);assert.deepEqual(merged.reviewPracticeProgress.p.counts,{"a.md":1,"b.md":2});
  const synced=b.rebase(bv,bv,merged);synced.reviewPracticeProgress.p={date:"2026-10-30",counts:{"b.md":1}};
  await b.save(synced,90);
  const fresh=await a.save(av,90);assert.deepEqual(fresh.reviewPracticeProgress.p,{date:"2026-10-30",counts:{"b.md":1}});
});

test("rolling practice dates update fixed keys instead of growing the current-state file forever",async()=>{
  const io=memoryAdapter(),a=store(io),data=await a.initialize(seed(),90);
  let count;
  for(let day=1;day<=28;day++) {
    data.reviewPracticeProgress.p={date:`2026-10-${String(day).padStart(2,"0")}`,counts:{"a.md":1}};
    await a.save(data,90);
    const path=[...io.files.keys()].find(path=>path.includes("/state--"));
    const keys=Object.keys(JSON.parse(io.files.get(path)).entries).length;
    if(count==null)count=keys;else assert.equal(keys,count);
  }
});

test("existing users migrate all history first and only prune after explicitly confirming retention",async()=>{
  const io=memoryAdapter(),h=host(io),storage=new PluginDataStorage(h);
  h.settings.reviewEvents=[event("old","2020-01-01"),event("recent",new Date().toISOString().slice(0,10))];
  h.settings.reviewHistory={a:[{date:"2020-01-01",s:1,grade:3}]};
  await storage.initialize({encounterFolder:"Data"});
  assert.equal(h.settings.reviewRetentionConfirmed,false);assert.equal(h.settings.reviewEvents.length,2);assert.equal(h.settings.reviewHistory.a.length,1);
  await storage.save();assert.equal(h.settings.reviewEvents.length,2);
  const reloaded=host(io),next=new PluginDataStorage(reloaded);reloaded.settings.dataFolder="Data";
  await next.initialize({learningStorageVersion:1});
  assert.equal(reloaded.settings.reviewEvents.length,2);assert.equal(reloaded.settings.reviewRetentionConfirmed,false);
  reloaded.settings.reviewRetentionConfirmed=true;await next.save();
  assert.deepEqual(Array.from(reloaded.settings.reviewEvents,x=>x.id),["recent"]);assert.deepEqual(Object.keys(reloaded.settings.reviewHistory),[]);
  assert.ok(![...io.files.keys()].some(path=>path.includes("day-2020-01-01")));
});

test("an empty new installation enables default retention without requiring a migration decision",async()=>{
  const io=memoryAdapter(),h=host(io);Object.assign(h.settings,learningData({}));
  await new PluginDataStorage(h).initialize({});assert.equal(h.settings.reviewRetentionConfirmed,true);
});
