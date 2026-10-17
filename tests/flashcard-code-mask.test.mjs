import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const result = await build({ entryPoints: ["src/flashcard-syntax.ts"], bundle: true, write: false, format: "esm", platform: "node" });
const { parseSyntaxCards, maskSyntaxAnswers, findClozeAnswerRanges, maskClozeAnswers } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
const templates = { inline: "{{question}}::{{answer}}", bidirectional: "{{sideA}}:::{{sideB}}", block: "{{question}}??\n{{answer}}", cloze: "=={{answer}}==" };
const parse = (markdown) => parseSyntaxCards(markdown, "example.md", templates);

test("all card syntaxes ignore backtick, tilde, quoted and indented code blocks", () => {
  for (const source of [
    "```cpp\nQ::A\nB:::C\nQuestion??\nAnswer\n==hidden==\n```",
    "~~~~md\nQ::A\n~~~\n==hidden==\n~~~~",
    "> ```cpp\n> Q::A\n> ==hidden==\n> ```",
    "    Q::A\n    ==hidden==\n\n    B:::C",
    "\tQ::A\n\t==hidden==",
  ]) {
    assert.equal(parse(source).length, 0);
    assert.equal(maskSyntaxAnswers(source, templates), source);
    assert.equal(findClozeAnswerRanges(source, templates).length, 0);
    assert.equal(maskClozeAnswers(source, templates), source);
  }
});

test("inline code never triggers questions, bidirectional cards, block markers or clozes", () => {
  const source = ["- **作用域解析**：`::` 用于指定作用域", "- **避免歧义**：在代码中，`::` 可以帮助编译器", "展示 `Q:::A`", "展示 `Q??`", "Answer", "字面量 `==hidden==`", "双反引号 ``Q::A 和 `nested` ==hidden==``", "`Q\n::A`"].join("\n\n");
  assert.equal(parse(source).length, 0);
  assert.equal(maskSyntaxAnswers(source, templates), source);
  assert.equal(findClozeAnswerRanges(source, templates).length, 0);
});

test("code inside genuine card questions and answers survives outside-delimiter recognition", () => {
  const cards = parse("`std::deque` 的作用::`双端队列`\n`A:::B`:::翻译\n`code??` 的意义??\n`答案`\n\n`==literal==` 与 ==`real`==");
  assert.deepEqual(cards.map((card) => card.kind), ["block", "inline", "bidirectional", "bidirectional", "cloze"]);
  const inline = cards.find((card) => card.kind === "inline");
  assert.equal(inline.front, "`std::deque` 的作用"); assert.equal(inline.back, "`双端队列`");
  assert.equal(cards[0].front, "`code??` 的意义"); assert.equal(cards[0].back, "`答案`");
  const cloze = cards.at(-1);
  assert.equal(cloze.front, "`==literal==` 与 […]");
  assert.equal(cloze.back, "`==literal==` 与 ==`real`==");
  assert.equal(cloze.clozeAnswer, "`real`");
  assert.match(maskSyntaxAnswers("`std::deque`::双端队列", templates), /^`std::deque`::<span class="lexis-rv-answer-mask">双端队列<\/span>$/);
});

test("cloze masking keeps exact original offsets, including CRLF and excluded blocks", () => {
  const source = "```md\r\n==code==\r\n```\r\n\r\n`==literal==` 与 ==real==";
  const ranges = findClozeAnswerRanges(source, templates);
  assert.deepEqual(ranges.map((range) => range.answer), ["real"]);
  assert.equal(source.slice(ranges[0].start, ranges[0].end), "==real==");
  assert.equal(maskClozeAnswers(source, templates), source.replace("==real==", '==<span class="lexis-rv-answer-mask">real</span>=='));
});

test("inline-code exclusion preserves heading labels and ordinary card identities", () => {
  const plain = parse("Q::A")[0];
  const cards = parse("# `std::deque`\nQ::A\n\n`not::card`\n\nB::C");
  assert.equal(cards.length, 2); assert.equal(cards[0].id, plain.id);
  assert.deepEqual(cards[0].headingPath, ["`std::deque`"]);
  assert.ok(cards.every((card) => !JSON.stringify(card).includes("\\u0000")));
});

test("unmatched backticks do not disable cards while std scope operators stay ordinary text", () => {
  assert.equal(parse("unmatched `Q::A").length, 1);
  assert.equal(parse("std::deque").length, 0);
  assert.equal(parse("- **std::deque 的矛盾**：std::deque 不是连续存储").length, 0);
  assert.equal(parse("English::definition").length, 1, "ordinary Latin-script cards remain valid");
  const source = "代码 `value` 的含义::解释";
  assert.equal(parse(source)[0].front, "代码 `value` 的含义");
});

test("a colliding inline-entry rule takes precedence only inside marked entry files", () => {
  const source = "萨拉斯第 / Salas:: 忒修斯号船员";
  assert.equal(parse(source).length, 1, "ordinary notes still use the flashcard rule");
  assert.equal(parseSyntaxCards(source, "People.md", templates, { inlineEntryDelimiter: "::" }).length, 0);
  assert.equal(maskSyntaxAnswers(source, templates, { inlineEntryDelimiter: "::" }), source);
  assert.equal(parseSyntaxCards(source, "People.md", templates, { inlineEntryDelimiter: "=>" }).length, 1);
});

test("a heading or list marker alone is not a question, while actual formatted questions stay valid", () => {
  const source = "### :: 的用途\n- :: 解释\n\n### 正常问题::答案";
  const cards = parse(source);
  assert.equal(cards.length, 1); assert.equal(cards[0].front, "### 正常问题");
  assert.equal(maskSyntaxAnswers(source, templates).split("\n")[0], "### :: 的用途");
  assert.equal(parse("`###`::标题符号")[0].front, "`###`");
});
