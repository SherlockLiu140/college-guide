// 共享的正文读取与解析。EPUB / PDF / 离线版的生成脚本都从这里取数据，
// 避免把同一套解析逻辑写三遍。
//
// 注意：index.html 里有一份等价的 parseBook（浏览器端），两者必须保持一致。
// tools/build-all.mjs 里有一道 preflight 会拿真实正文对比两边结果，不一致就报错。
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const FILES = [
  "01-上课与听课.md",
  "02-复习考试与绩点.md",
  "03-四六级与英语.md",
  "04-考证竞赛与技能.md",
  "05-考驾照.md",
  "06-学生会社团与学生工作.md",
  "07-医保看病与体检.md",
  "08-兼职实习与劳动权益.md",
  "09-生活费奖助学金与防骗.md",
  "10-宿舍作息与身体.md"
];

export function esc(s){
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function splitDoc(text){
  const hm = text.match(/^#\s+第\s*\d+\s*节\s+(.+?)\s*$/m);
  const title = hm ? hm[1] : "";
  const start = hm ? hm.index + hm[0].length : 0;
  const cut = text.indexOf("\n### ", start);
  let pre = text.slice(start, cut === -1 ? text.length : cut);
  pre = pre.split("\n").filter((l) => !/^\s*-{3,}\s*$/.test(l)).join("\n").trim();
  return { title, pre };
}

export function parseBook(text, secIndex, secTitle, file){
  const out = [];
  const re = /^###\s+(\d+)\.\s+(.+?)\s*$/gm;
  const marks = [];
  let m;
  while((m = re.exec(text)) !== null) marks.push({ no: +m[1], title: m[2], bodyStart: re.lastIndex });

  marks.forEach((mk, i) => {
    const nextIdx = i + 1 < marks.length ? text.indexOf("\n### ", mk.bodyStart) : -1;
    const seg = text.slice(mk.bodyStart, nextIdx === -1 ? text.length : nextIdx);

    const tagM = seg.match(/<!--\s*成本标签:\s*([^>]*?)-->/);
    const tags = {};
    if(tagM){
      tagM[1].split(/\s+/).forEach((kv) => {
        const p = kv.split("=");
        if(p.length === 2) tags[p[0]] = p[1];
      });
    }
    const fields = {};
    seg.split("\n").forEach((line) => {
      const fm = line.match(/^-\s*([^\s:：][^：]*?)：\s*([\s\S]*)$/);
      if(fm && !fields[fm[1].trim()]) fields[fm[1].trim()] = fm[2].trim();
    });
    const grade = fields["证据等级"] || "未标注";
    out.push({
      id: secIndex + "-" + mk.no,
      no: mk.no,
      file,
      title: mk.title,
      sec: secIndex,
      secTitle,
      grade,
      gkey: (grade.trim()[0] || "?").toUpperCase(),
      cost: fields["成本"] || "",
      plain: fields["说人话"] || "",
      benefit: fields["收益"] || "",
      path: fields["路径"] || "",
      source: fields["来源"] || "",
      note: fields["备注"] || "",
      tags
    });
  });
  return out;
}

export function readBook(root){
  const bookDir = join(root, "book");
  const onDisk = readdirSync(bookDir).filter((f) => f.endsWith(".md")).sort();
  const missing = FILES.filter((f) => !onDisk.includes(f));
  const extra = onDisk.filter((f) => !FILES.includes(f));
  const sections = [];
  FILES.forEach((f, i) => {
    const text = readFileSync(join(bookDir, f), "utf8");
    const { title, pre } = splitDoc(text);
    const entries = parseBook(text, i + 1, title || f.replace(/^\d+-|\.md$/g, ""), f);
    sections.push({ sec: i + 1, file: f, title: title || f.replace(/^\d+-|\.md$/g, ""), pre, entries });
  });
  return { sections, missing, extra, entries: sections.flatMap((s) => s.entries) };
}

/* ---------- 行内标记 ----------
   mode: "web"   内部引用渲染成 <a class="reflink">（检索页用）
         "doc"   内部引用渲染成真实锚点链接（EPUB / PDF 用，能点）
         "plain" 内部引用只留文字（不支持链接的场合）            */
export function inlineMD(s, selfSec, mode, anchorFor){
  let h = esc(s);
  h = h.replace(/&lt;(https?:\/\/[^<>\s]+)&gt;/g, (a, u) => {
    const label = u.replace(/^https?:\/\//, "");
    return '<a href="' + u + '">' + label + "</a>";
  });
  h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  h = h.replace(/(原书|《高性价比人生指南》)\s*第\s*(\d+)\s*节第\s*(\d+)\s*条/g,
    (a, who, s, n) => '<span class="refext">' + who + " 第 " + s + " 节第 " + n + " 条（不在本指南内）</span>");

  const mk = (sec, no, label) => {
    if(mode === "web") return '<a class="reflink" data-sec="' + sec + '" data-no="' + no + '">' + label + "</a>";
    if(mode === "doc" && anchorFor){
      const a = anchorFor(sec, no);
      if(a) return '<a class="ref" href="' + a + '">' + label + "</a>";
    }
    return '<span class="ref-plain">' + label + "</span>";
  };

  h = h.replace(/第\s*(\d+)\s*节第\s*(\d+)\s*条/g, (a, s, n) => mk(s, n, "第 " + s + " 节第 " + n + " 条"));
  h = h.replace(/本节第\s*(\d+)\s*条/g, (a, n) => mk(selfSec, n, "本节第 " + n + " 条"));
  return h;
}

/* ---------- 原著引用探测（署名用）----------
   从条目的「来源」和「备注」里找出对原著《高性价比人生指南》的引用。
   build-data.mjs（统计）与 build-notice.mjs（生成比对表）共用这一份判断，
   避免署名清单和正文脱节。 */
const UPSTREAM_REF_RE = /(?:原书|《高性价比人生指南》)\s*第\s*(\d+)\s*节第\s*(\d+)\s*条/g;

export function upstreamRefs(entry){
  const hay = (entry.source || "") + " " + (entry.note || "");
  const refs = [...new Set([...hay.matchAll(UPSTREAM_REF_RE)].map((m) => m[1] + " 节第 " + m[2] + " 条"))];
  return {
    refs,
    direct: /迁移自原书/.test(hay),
    cited: refs.length > 0
  };
}

export const UPSTREAM = {
  title: "高性价比人生指南",
  author: "eternity4719",
  repo: "https://github.com/eternity4719/HowToLiveBetter",
  site: "https://eternity4719.github.io/HowToLiveBetter/",
  license: "知识共享 署名 4.0 国际 (CC BY 4.0)",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/"
};

/* ---------- 成本维度分组，供 PDF / EPUB 的汇总章节使用 ---------- */
export const DIM_LABEL = {
  钱: { 0: "不花钱", 少: "花一点钱", 中: "花中等", 大: "花大钱" },
  时间: { 0: "不花时间", 少: "花一点时间", 中: "花中等时间", 大: "花很多时间" },
  毅力: { 否: "不要毅力", 些: "要一点毅力", 是: "要毅力" },
  收益: { 负: "负收益", 小: "收益小", 中: "收益中", 大: "收益大" }
};
export const GRADE_LABEL = { A: "A 硬证据", B: "B 观察性数据", C: "C 规定或公开数据", D: "D 无直接证据" };
export const KOUMAP = { 时间: "省时间", 学业: "学业绩点", 安全: "安全与资格", 钱: "省钱与权益", 就业: "就业与收入", 健康: "健康" };
