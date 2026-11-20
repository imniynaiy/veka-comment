import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parse } from "node-html-parser";

test("静态 HTML 包含重叠范围、跨段标题和对应的讨论", async () => {
  const file = new URL("../dist/wiki/notes/margins/index.html", import.meta.url);
  const doc = parse(await readFile(file, "utf8"));
  assert.equal(doc.querySelector('[data-threads="repeat pace"]')?.text, "安排时间");
  assert.equal(doc.querySelector("h2 [data-threads=space]")?.text, "给下一位读者");
  assert.ok(doc.querySelector("p [data-threads=space]"));
  assert.equal(doc.querySelector("strong [data-threads=repeat]")?.text, "重复");
  for (const id of ["repeat", "pace", "space"]) {
    assert.ok(doc.querySelector("#range-" + id));
    assert.ok(doc.querySelector("#thread-" + id + ' a[href="#range-' + id + '"]'));
  }
});
