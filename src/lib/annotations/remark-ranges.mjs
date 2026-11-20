import { decodeString } from "micromark-util-decode-string";

const marker = /<!--c:([\w-]+):(start|end)-->/g;

function codeSpans(node, spans) {
  if (["code", "inlineCode", "math", "inlineMath"].includes(node.type)) {
    spans.push([node.position.start.offset, node.position.end.offset]);
  } else {
    node.children?.forEach(child => codeSpans(child, spans));
  }
}

export function parseRanges(source, parse, path) {
  const spans = [];
  codeSpans(parse(source.replace(marker, m => "x".repeat(m.length))), spans);
  const starts = new Map();
  const ranges = new Map();
  let clean = "", cursor = 0;
  function fail(pos, message) {
    throw new Error(path + ":" + source.slice(0, pos).split("\n").length + " " + message);
  }
  for (const match of source.matchAll(marker)) {
    const pos = match.index;
    if (spans.some(([a,b]) => a <= pos && pos < b)) continue;
    clean += source.slice(cursor, pos);
    cursor = pos + match[0].length;
    const [,id,side] = match;
    if (side === "start") {
      if (starts.has(id) || ranges.has(id)) fail(pos, "重复起点 " + id);
      starts.set(id, {offset:clean.length, pos});
    } else {
      const start = starts.get(id);
      if (!start) fail(pos, "没有起点 " + id);
      ranges.set(id, {id, start:start.offset, end:clean.length, pos:start.pos});
      starts.delete(id);
    }
  }
  for (const [id,start] of starts) fail(start.pos, "缺少终点 " + id);
  clean += source.slice(cursor);
  const tree = parse(clean);
  const covered = new Set();
  function split(node) {
    if (node.children) node.children = node.children.flatMap(split);
    if (!["text","inlineCode","code"].includes(node.type) || !node.position) return [node];
    const a = node.position.start.offset, b = node.position.end.offset;
    const hits = [...ranges.values()].filter(r => r.start < b && r.end > a);
    if (!hits.length) return [node];
    const cuts = [...new Set([a,b,...hits.flatMap(r => [Math.max(a,r.start),Math.min(b,r.end)])])].sort((x,y)=>x-y);
    let previous = 0;
    const parts = [];
    for (let i=1; i<cuts.length; i++) {
      const end = cuts[i] === b ? node.value.length : decodeString(clean.slice(a,cuts[i])).length;
      const value = node.value.slice(previous,end);
      previous = end;
      if (!value) continue;
      const piece = {...node,value};
      const ids = hits.filter(r => r.start <= cuts[i-1] && r.end >= cuts[i]).map(r => r.id);
      if (!ids.length) { parts.push(piece); continue; }
      for (const id of ids) {
        if (!covered.has(id)) parts.push({type:"html",value:'<span id="range-'+id+'" tabindex="-1"></span>'});
        covered.add(id);
      }
      // Keep children as Markdown nodes so later Veka plugins still see them.
      parts.push({type:node.type==="code"?"blockquote":"emphasis",data:{hName:node.type==="code"?"div":"mark",hProperties:{dataThreads:ids.join(" ")}},children:[piece]});
    }
    return parts;
  }
  split(tree);
  for (const r of ranges.values()) if (!covered.has(r.id)) fail(r.pos, "选区没有可显示文字 " + r.id);
  return { tree, ids:[...ranges.keys()] };
}

/** @type {import("@astrojs/markdown-remark").RemarkPlugin} */
export const remarkRanges = function () {
  const parse = this.parser;
  this.parser = (source, file) => {
    if (!source.includes("<!--c:") || file.path?.endsWith(".mdx")) return parse(source,file);
    const {tree,ids} = parseRanges(source, text=>parse(text,file),file.path || "Markdown");
    file.data.astro ??= {};
    file.data.astro.frontmatter ??= {};
    file.data.astro.frontmatter.rangeThreadIds = ids;
    return tree;
  };
};
