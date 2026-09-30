// 把 book/ 里的正文规范化成 dist/book.json，供 EPUB 与 PDF 生成器共用。
// 目的：解析逻辑只写一遍（tools/lib/book.mjs），两个渲染器吃同一份数据，
// 保证电子书和纸质版的条目、顺序、字段完全一致。
import { writeFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readBook, FILES, GRADE_LABEL, DIM_LABEL, KOUMAP, upstreamRefs, UPSTREAM } from "./lib/book.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "dist");
mkdirSync(outDir, { recursive: true });

const book = readBook(root);
if(book.missing.length){
  throw new Error("book/ 里缺少这些文件：" + book.missing.join("、"));
}
if(book.extra.length){
  console.warn("提示：book/ 里有未登记进 FILES 的文件，会被忽略：" + book.extra.join("、"));
}

const sections = book.sections.map((s) => ({
  sec: s.sec,
  file: s.file,
  title: s.title,
  pre: s.pre,
  count: s.entries.length,
  entries: s.entries.map((e) => ({
    id: e.id,
    no: e.no,
    sec: e.sec,
    secTitle: e.secTitle,
    title: e.title,
    grade: e.grade,
    gkey: e.gkey,
    cost: e.cost,
    plain: e.plain,
    benefit: e.benefit,
    path: e.path,
    source: e.source,
    note: e.note,
    tags: e.tags,
    // 预先把展示用的派生字段算好，避免每个渲染器各算一遍
    gradeLabel: GRADE_LABEL[e.gkey] || e.grade,
    tagList: ["钱", "时间", "毅力", "收益"]
      .filter((k) => e.tags[k] !== undefined)
      .map((k) => k + "=" + e.tags[k]),
    dims: Object.keys(DIM_LABEL)
      .filter((k) => e.tags[k] !== undefined)
      .map((k) => DIM_LABEL[k][e.tags[k]] || (k + "=" + e.tags[k])),
    kou: e.tags["口径"] ? KOUMAP[e.tags["口径"]] || e.tags["口径"] : "",
    kouRaw: e.tags["口径"] || ""
  }))
}));

const entries = sections.flatMap((s) => s.entries);
const byGrade = { A: 0, B: 0, C: 0, D: 0 };
entries.forEach((e) => { if(byGrade[e.gkey] !== undefined) byGrade[e.gkey]++; });

// 原著引用统计：署名要用的数字，从正文自动算出来，不手写
const upstreamCited = entries.filter((e) => upstreamRefs(e).cited);
const upstreamSections = [...new Set(upstreamCited.flatMap((e) => upstreamRefs(e).refs.map((r) => +r.split(" ")[0])))].sort((a, b) => a - b);

const picks = {
  lazy: entries.filter((e) => e.tags["钱"] === "0" && e.tags["时间"] === "0" && e.tags["毅力"] === "否" && e.tags["收益"] === "大")
               .map((e) => e.id),
  red: entries.filter((e) => e.kouRaw.indexOf("安全") > -1).map((e) => e.id),
  edge: entries.filter((e) => e.gkey === "D").map((e) => e.id),
  cross: entries.filter((e) => e.path).map((e) => e.id)
};

const payload = {
  title: "大学生生活指南",
  subtitle: "按性价比排序的在校生决策清单",
  buildTime: new Date().toISOString().slice(0, 10),
  upstream: {
    title: UPSTREAM.title,
    author: UPSTREAM.author,
    repo: UPSTREAM.repo,
    site: UPSTREAM.site,
    license: UPSTREAM.license,
    licenseUrl: UPSTREAM.licenseUrl,
    citedCount: upstreamCited.length,
    citedSections: upstreamSections,
    citedIds: upstreamCited.map((e) => e.id)
  },
  stats: {
    entries: entries.length,
    sections: sections.length,
    byGrade,
    migrated: upstreamCited.length,
    picks: { lazy: picks.lazy.length, red: picks.red.length, edge: picks.edge.length, cross: picks.cross.length }
  },
  picks,
  sections
};

const outPath = join(outDir, "book.json");
writeFileSync(outPath, JSON.stringify(payload, null, 1), "utf8");

// 一致性自检：各节条数之和必须等于总条目数
const sum = sections.reduce((a, s) => a + s.count, 0);
if(sum !== entries.length) throw new Error("节内条数之和 " + sum + " 与总条目数 " + entries.length + " 不一致");
const sumGrade = byGrade.A + byGrade.B + byGrade.C + byGrade.D;
if(sumGrade !== entries.length) throw new Error("等级分布之和 " + sumGrade + " 与总条目数 " + entries.length + " 不一致");

console.log("已生成：" + outPath);
console.log("  " + sections.length + " 节 " + entries.length + " 条 · A " + byGrade.A + " B " + byGrade.B + " C " + byGrade.C + " D " + byGrade.D);
console.log("  快捷清单：最省力 " + picks.lazy.length + " · 红线 " + picks.red.length + " · 证据边界 " + picks.edge.length + " · 分叉 " + picks.cross.length);
console.log("  引用原著 " + upstreamCited.length + " 条（原著第 " + upstreamSections.join("、") + " 节）");
