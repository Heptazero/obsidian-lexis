import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const bundle = await build({stdin:{contents:`export * from "./src/dictionary-sources";
  export * from "./src/dictionary-migration"; export * from "./src/review-queue";
  export * from "./src/review-library-groups"; export * from "./src/review-dashboard-data";
  export * from "./src/marginnote-scope";`,resolveDir:process.cwd(),loader:"ts"},bundle:true,write:false,format:"esm",platform:"node"});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const file = path=>({path,basename:path.split("/").pop().replace(/\.md$/,""),extension:path.split(".").pop()});
const rule = (kind,value)=>({kind,value});
const dict = (id,sources,extra={})=>({id,name:id,folder:"",template:"",sources,...extra});
function fixture() {
  const files=[file("Words/a.md"),file("Words/nested/b.md"),file("Words2/c.md"),file("Else/d.md"),file("Hub.md")];
  const [a,b,c,d,hub]=files;
  const destinations={a,b,d,pdf:file("a.pdf"),self:hub};
  const app={vault:{getMarkdownFiles:()=>files,getFileByPath:path=>files.find(f=>f.path===path),cachedRead:async f=>`${f.basename}::answer`},
    metadataCache:{getFileCache:f=>f===hub?{links:[{link:"a"},{link:"a"},{link:"d"},{link:"pdf"},{link:"missing"},{link:"self"}]}:{},
      getFirstLinkpathDest:link=>destinations[link]}};
  const getTags=f=>new Set(f===c||f===a?["study"]:[]);
  const dictionaries=[dict("folder",[rule("folder","Words")]),dict("tag",[rule("tag","study")],{highlight:false}),
    dict("file",[rule("file",d.path)]),dict("hub",[rule("links",hub.path)]),dict("mixed",[rule("folder","Words"),rule("tag","study"),rule("links",hub.path)])];
  return {files,a,b,c,d,hub,app,getTags,dictionaries,destinations};
}

test("one metadata resolver combines all four sources and retains overlaps without false path matches",()=>{
  const f=fixture();let reads=0;
  const result=api.resolveDictionaries(f.app,f.dictionaries,file=>{reads++;return f.getTags(file);});
  assert.deepEqual([...result.paths.get("folder")],[f.a.path,f.b.path]);
  assert.deepEqual([...result.paths.get("tag")],[f.a.path,f.c.path]);
  assert.deepEqual([...result.paths.get("file")],[f.d.path]);
  assert.deepEqual([...result.paths.get("hub")],[f.a.path,f.d.path]);
  assert.equal(result.paths.get("mixed").size,4);
  assert.deepEqual(result.byFile.get(f.a.path).map(api.dictionaryId),["folder","tag","hub","mixed"]);
  assert.equal(reads,f.files.length,"tag metadata read once per file, not per dictionary");
  assert.equal(result.specificity.get(f.dictionaries[4]).get(f.b.path),"Words".length,"unmatched Hub/tag sources cannot inflate color priority");
  assert.equal(result.specificity.get(f.dictionaries[4]).get(f.a.path),50000);
});

test("membership follows new Hub links and canonical Unicode paths on the next snapshot",()=>{
  const f=fixture();
  f.destinations.a=f.c;
  assert.deepEqual([...api.resolveDictionaries(f.app,f.dictionaries,f.getTags).paths.get("hub")],[f.c.path,f.d.path]);
  const unicode=file("Café/a.md".normalize("NFD"));
  assert.equal(api.resolveDictionaries(f.app,[dict("unicode",[rule("file","Café/a.md")])],f.getTags,[unicode]).byFile.has(unicode.path),true);
});

test("any enabled dictionary keeps shared terms visible; matched specificity and row order choose color",()=>{
  const f=fixture();
  const rows=[dict("broad",[rule("folder","Words")],{color:"#aaa"}),dict("exact",[rule("file",f.a.path)],{highlight:false,color:"#bbb"})];
  let snapshot=api.resolveDictionaries(f.app,rows,f.getTags);
  assert.equal(api.preferredDictionary(snapshot,f.a.path).id,"broad");
  rows[1].highlight=true;
  snapshot=api.resolveDictionaries(f.app,rows,f.getTags);
  assert.equal(api.preferredDictionary(snapshot,f.a.path).id,"exact");
  rows.forEach(row=>{row.highlight=false;});
  assert.equal(api.preferredDictionary(snapshot,f.a.path).highlight,false);
  assert.equal(api.preferredDictionary(snapshot,"Unlisted.md"),null);
});

test("one-way migration preserves schedules, daily targets and settings, and is idempotent",()=>{
  const settings={dicts:[{folder:"Words",template:"Template.md",color:"#123456",opacity:.3,highlight:false},{folder:"",template:"",tag:"#study"}],vocabTags:"study extra",
    reviewPlans:[{id:"plan",name:"Original",content:"syntax",sources:[{scope:"folder",value:"Words"},{scope:"links",value:"Hub.md"}]},
      {id:"all",name:"All",content:"notes",sources:[{scope:"vocab",value:""}]}],
    marginNoteSources:["folder:Words","tag:extra","file:inline.md"],
    syntaxCardStates:{old:{s:7,due:"2026-10-21"}},reviewHistory:{old:[{grade:3}]},reviewDailyTargets:{plan:{date:"2026-10-15",keys:["syntax:old"],goal:1}},reviewEvents:[{memberKeys:["syntax:old"]}]};
  const before=structuredClone(settings);
  assert.equal(api.migrateDictionaryCollections(settings),true);
  assert.equal(settings.dicts[0].template,"Template.md");
  assert.equal(settings.dicts[0].color,"#123456");
  assert.equal(settings.dicts[0].opacity,.3);
  assert.equal(settings.dicts[0].highlight,false);
  assert.equal(settings.dicts.some(row=>row.tag!==undefined),false);
  assert.equal(settings.vocabTags,"");
  assert.equal(settings.reviewPlans[0].id,"plan");
  assert.equal(settings.reviewPlans[0].name,"Original");
  assert.equal(settings.reviewPlans[0].content,"syntax");
  assert.equal(settings.reviewPlans[0].sources,undefined);
  assert.equal(settings.reviewPlans[1].dictionaryIds,null);
  assert.deepEqual(api.planOptions(settings.reviewPlans[0]),{dictionaryIds:settings.reviewPlans[0].dictionaryIds,content:"syntax"});
  for(const key of ["syntaxCardStates","reviewHistory","reviewDailyTargets","reviewEvents"])assert.deepEqual(settings[key],before[key]);
  assert.equal(settings.marginNoteSources.at(-1),"file:inline.md");
  assert.ok(settings.marginNoteSources.slice(0,2).every(id=>id.startsWith("dictionary:")));
  const snapshot=JSON.stringify(settings);
  assert.equal(api.migrateDictionaryCollections(settings),false);
  assert.equal(JSON.stringify(settings),snapshot);
  const id=settings.dicts[0].id;settings.dicts[0].name="Renamed";settings.dicts.reverse();
  api.migrateDictionaryCollections(settings);
  assert.equal(settings.dicts.find(row=>row.name==="Renamed").id,id);
});

test("renaming a source or its folder preserves dictionary IDs and does not rewrite tags",()=>{
  const rows=[dict("stable",[rule("file","Café/A.md"),rule("links","Café/Hub.md"),rule("tag","Café")],{folder:"Café",template:"Café/Template.md"}),dict("other",[rule("folder","Café2")])];
  assert.equal(api.renameDictionaryPaths(rows,"Café".normalize("NFD"),"Moved"),true);
  assert.equal(rows[0].id,"stable");
  assert.deepEqual(rows[0].sources,[rule("file","Moved/A.md"),rule("links","Moved/Hub.md"),rule("tag","Café")]);
  assert.equal(rows[0].folder,"Moved");assert.equal(rows[0].template,"Moved/Template.md");
  assert.equal(rows[1].sources[0].value,"Café2");
  assert.equal(api.renameDictionaryPaths(rows,"Unknown","Else"),false);
});

test("merged dictionary review deduplicates syntax identities and shares their original state",async()=>{
  const f=fixture(), states={};
  const host={app:f.app,getTags:f.getTags,settings:{dicts:f.dictionaries,flashcardInlineTemplate:"{{question}}::{{answer}}",flashcardBidirectionalTemplate:"{{sideA}}:::{{sideB}}",flashcardBlockTemplate:"{{question}}??\n{{answer}}",flashcardClozeTemplate:"=={{answer}}==",suspendedReviewItems:{}},
    readLifecycle:()=>({archived:false,retired:false}),readSyntaxCardState:id=>states[id]||{},readCard:()=>({})};
  Object.defineProperties(host,api.createReviewQueue({todayStr:()=>"2026-10-15"}));
  const collect=ids=>host.collectReviewItems({dictionaryIds:ids,content:"syntax"});
  const combined=await collect(["folder","tag","hub"]);
  assert.equal(combined.length,4);
  assert.equal(new Set(combined.map(card=>card.syntax.id)).size,4);
  const inFolder=(await collect(["folder"])).find(card=>card.file.path===f.a.path);
  const inHub=(await collect(["hub"])).find(card=>card.file.path===f.a.path);
  assert.equal(inFolder.syntax.id,inHub.syntax.id);
  states[inFolder.syntax.id]={s:4,history:[{date:"2026-10-15",grade:3}]};
  assert.equal((await collect(["hub"])).some(card=>card.file.path===f.a.path),false,"already reviewed today through another dictionary");
  assert.deepEqual(await collect([]),[]);
  assert.equal((await collect(["deleted-id"])).length,0);
  assert.equal((await collect(null)).length,3);
  host.readLifecycle=file=>({archived:file===f.d,retired:false});
  assert.equal(host.reviewScopeFiles({dictionaryIds:["hub"]}).length,1);
});

test("classification changes presentation only; dictionary groups may overlap while source notes stay unique",()=>{
  const f=fixture();const cards=[f.a,f.b,f.c,f.d].map(file=>({key:`syntax:${file.path}`,type:"syntax",file,headingPath:["Chapter","Terms"]}));
  const before=JSON.stringify(cards);
  const grouped=api.groupLibraryCards(cards,"dictionary",f.dictionaries,f.app,f.getTags,"Ungrouped");
  assert.equal(grouped.find(group=>group.id==="folder").cards.length,2);
  assert.equal(grouped.find(group=>group.id==="hub").cards[0],cards[0]);
  assert.equal(api.groupLibraryCards(cards,"file",f.dictionaries,f.app,f.getTags,"Ungrouped").find(group=>group.id===f.a.path).cards.length,1);
  assert.equal(api.groupLibraryCards(cards,"heading",f.dictionaries,f.app,f.getTags,"Ungrouped")[0].label,"Chapter / Terms");
  assert.equal(JSON.stringify(cards),before);
  const membership=api.resolveDictionaries(f.app,f.dictionaries,f.getTags);
  assert.equal(api.inMarginNoteScope({file:f.a},["dictionary:hub"],membership.paths),true);
  assert.equal(api.inMarginNoteScope({file:f.b},["dictionary:hub"],membership.paths),false);
  assert.deepEqual(api.marginNoteSources({dicts:f.dictionaries,vocabTags:""},new Map()).map(row=>row.id),f.dictionaries.map(row=>`dictionary:${row.id}`));
});

test("bridge publishes named memberships separately from new-entry folder destinations",async()=>{
  const result=await build({entryPoints:["src/bridge-api.ts"],bundle:true,write:false,format:"esm",platform:"node"});
  const {createBridgeApi}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
  const f=fixture();
  const host={app:f.app,settings:{dicts:f.dictionaries,tagRules:[],highlightOpacity:.4,highlightStyle:"background",excludeTags:""},manifest:{version:"fixture"},getTags:f.getTags,
    index:new Map([["a",{display:"a",file:f.a,tags:f.getTags(f.a)}],["archived",{display:"old",file:f.b,archived:true}]]),
    colorForEntry:()=>"#abc",highlightAlphaForEntry:()=>.4,highlightVisibleForEntry:()=>true,styleKindForEntry:()=>"background",dictFolders:()=>["Capture"],dictColorMap:()=>({}),effectiveHighlightColor:()=>"#abc",parseTags:()=>[]};
  Object.defineProperties(host,createBridgeApi({}));
  const data=host.bridgeWordList();
  assert.equal(data.count,1);
  assert.deepEqual(data.words[0].dictionaries,["folder","tag","hub","mixed"]);
  assert.deepEqual(data.styleConfig.dicts,["Capture"]);
  assert.deepEqual(data.styleConfig.collections.map(row=>row.id),f.dictionaries.map(row=>row.id));
});
