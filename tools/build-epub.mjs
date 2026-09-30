// 生成 EPUB 3 电子书：dist/大学生生活指南.epub
// 用法：node tools/build-epub.mjs
//
// 结构：封面 / 目录页 / 怎么读 / 10 节正文 / 三个附录清单
// 同时写 nav.xhtml（EPUB3）与 toc.ncx（EPUB2 兼容，Kindle 用），兼容面更宽。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { makeZip } from "./lib/zip.mjs";
import { inlineMD, esc, GRADE_LABEL, KOUMAP } from "./lib/book.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = join(root, "dist", "book.json");
if(!existsSync(dataPath)){
  throw new Error("缺少 dist/book.json，请先运行：node tools/build-data.mjs");
}
const B = JSON.parse(readFileSync(dataPath, "utf8"));

const BOOK_ID = "college-guide-" + B.buildTime;
const secFile = (sec) => "sec-" + String(sec).padStart(2, "0") + ".xhtml";

// 互链映射：把「第X节第Y条」变成 EPUB 内部可点的锚点
const entryIndex = new Map();
B.sections.forEach((s) => s.entries.forEach((e) => entryIndex.set(e.id, { file: secFile(s.sec), id: "e-" + e.id })));
function anchorFor(sec, no){
  const hit = entryIndex.get(sec + "-" + no);
  return hit ? hit.file + "#" + hit.id : null;
}
const md = (s, selfSec) => inlineMD(s, selfSec, "doc", anchorFor);

/* ---------- 样式 ---------- */
const CSS = `@charset "utf-8";
html{font-family:"Songti SC","Songti TC",serif;}
body{line-height:1.75;margin:0 1em;}
h1,h2,h3{font-family:"Heiti SC","PingFang SC",sans-serif;font-weight:600;line-height:1.45;}
a{color:#2f4bb0;text-decoration:none;}
.cover{text-align:center;padding:22% 0;}
.cover h1{font-size:2.1em;margin:0 0 .5em;}
.cover .sub{font-size:1.05em;color:#555;}
.cover .meta{font-size:.9em;color:#777;margin-top:3em;line-height:2;}
nav[epub|type="toc"] ol{list-style:none;padding-left:1em;}
nav[epub|type="toc"] ol ol{font-size:.92em;}
nav[epub|type="toc"] li{margin:.25em 0;}
.sec-h{border-bottom:2px solid #222;padding-bottom:.4em;margin:1.6em 0 .8em;}
.sec-no{font-size:.82em;color:#888;margin:0;}
.sec-h h1{font-size:1.5em;margin:.1em 0 0;}
.sec-pre{font-size:.93em;color:#666;margin:.6em 0 1.4em;}
.sec-pre p{margin:.35em 0;}
.lens{display:inline;color:#555;}
.ent{margin:0 0 2em;padding-bottom:1em;border-bottom:1px solid #e2e2e2;}
.ent-t{font-size:1.12em;margin:0 0 .35em;}
.ent-t .no{color:#999;font-weight:400;font-size:.85em;margin-right:.5em;}
.tags{margin:0 0 .7em;}
.tg{font-size:.78em;padding:.1em .5em;border:1px solid #999;border-radius:.25em;margin-right:.4em;white-space:nowrap;}
.tgA{border-color:#166a44;color:#166a44;}
.tgB{border-color:#2f4bb0;color:#2f4bb0;}
.tgC{border-color:#8a5320;color:#8a5320;}
.tgD{border-color:#777;color:#666;}
.tgx{font-size:.78em;color:#888;font-family:monospace;}
.plain{margin:0 0 .8em;padding-left:.8em;border-left:3px solid #ccc;font-size:1.02em;}
dl.flds{margin:0;font-size:.95em;}
dl.flds dt{font-weight:600;color:#444;font-size:.85em;margin-top:.6em;}
dl.flds dd{margin:.15em 0 0;color:#333;}
dl.flds dd.src{font-size:.85em;color:#666;word-break:break-all;}
.ref{font-weight:inherit;}
.refext{color:#888;}
.appendix h2{border-top:2px solid #222;padding-top:.5em;margin-top:1.8em;}
.appendix ol{padding-left:1.4em;}
.appendix li{margin:.3em 0;}
.appendix .note{font-size:.92em;color:#666;}
`;

/* ---------- XHTML 片段 ---------- */
function page(title, body, extraClass){
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN" lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>${esc(title)}</title>
<link rel="stylesheet" type="text/css" href="../style.css"/>
</head>
<body${extraClass ? ' class="' + extraClass + '"' : ""}>
${body}
</body>
</html>
`;
}

function coverPage(){
  const s = B.stats;
  return page("封面", `<section class="cover" epub:type="frontmatter">
  <h1>${esc(B.title)}</h1>
  <p class="sub">${esc(B.subtitle)}</p>
  <p class="meta">${s.sections} 节 · ${s.entries} 条<br/>
  A 级 ${s.byGrade.A} · B 级 ${s.byGrade.B} · C 级 ${s.byGrade.C} · D 级 ${s.byGrade.D}<br/>
  生成日期 ${esc(B.buildTime)}</p>
</section>`);
}

function frontPage(){
  return page("怎么读", `<section epub:type="preface">
<h1>怎么读</h1>
<p>改写自 eternity4719/HowToLiveBetter《高性价比人生指南》。每一条都回答两个问题：<strong>花掉什么，换回什么。</strong></p>
<h2>不用全做</h2>
<p>这是一份按性价比排好的备选单，不是任务清单。挑走一两条就算数，剩下的放着，需要时再回来查。本节内的条目按性价比从高到低排列。</p>
<h2>三个快捷读法</h2>
<p><strong>只想看最省力的</strong>——既不花钱、不花时间、不需要毅力，收益又落在最大一档，共 ${B.stats.picks.lazy} 条，见书末附录一。</p>
<p><strong>只看证据最硬的</strong>——证据等级 A，共 ${B.stats.byGrade.A} 条。A 级的意思是：有具体数字，而且来自随机试验、荟萃分析或官方文件。</p>
<p><strong>只看证据边界</strong>——证据等级 D，共 ${B.stats.picks.edge} 条，见附录三。本书和普通攻略最大的区别就在这几条：它标出了自己不靠谱的地方。每条 D 级都在备注里写明了为什么只到 D。别把 D 级当成警告，它只是诚实。</p>
<h2>字段说明</h2>
<p>每条包含六栏，一栏都不省。</p>
<dl class="flds">
<dt>成本</dt><dd>按钱、时间、毅力三个维度给。条目标签里的 <span class="tgx">钱=0 时间=少 毅力=否</span> 就是这三项。</dd>
<dt>说人话</dt><dd>把「收益」栏里的研究口径翻成日常说法。只用「收益」栏已有的内容，不添新数字。只想拿主意的话，看这一栏就够。</dd>
<dt>收益</dt><dd>具体数字、研究设计和可信范围。原样保留研究的写法，想自己核对就看这一栏。</dd>
<dt>路径</dt><dd>只有高职与本科走法不同的地方才出现，共 ${B.stats.picks.cross} 处。</dd>
<dt>证据等级</dt><dd><strong>A</strong> 有具体数字，来自随机试验、荟萃分析或官方文件；<strong>B</strong> 有具体数字，但来自观察性研究或官方统计；<strong>C</strong> 有明文规定或公开数据，但没有量化效果；<strong>D</strong> 没有直接证据，来自明文规定或公开共识，并写明为什么只到 D。</dd>
<dt>来源</dt><dd>原始出处，可直接查证。一句话里有两层不同强度的结论时，等级会写成两个。</dd>
<dt>备注</dt><dd>为什么给这个等级、与原文的分歧、以及待核实项。</dd>
</dl>
<h2>关于原著与许可</h2>
<p>本书改编自 eternity4719 的《高性价比人生指南》（<a href="https://github.com/eternity4719/HowToLiveBetter">github.com/eternity4719/HowToLiveBetter</a>），
采用与原作相同的「知识共享 署名 4.0 国际（CC BY 4.0）」许可发布。</p>
<p>标注为「原书」的条目出自该原作，迁移时保留了它原本的数据和结论并注明来源。那些条目里的数字属于原书语境
（成年人、死亡率口径），套到学生场景时请按条目内的说明换算。全书共 ${B.stats.migrated || 14} 条引用了原作，
分布在原作的第 1、5、9、14、24、30 节，每条都在「来源」或「备注」栏里标明了出处；
完整的逐条对照见仓库根目录的 NOTICE.md。</p>
<p>本书对原作的三处主要修改：一，换掉了面向人群与计算口径（成年人 → 在校生，
死亡率/金钱/人身自由 → 时间/学业/钱/就业/安全/健康）；二，新增了原著完全没有的章节
（上课与听课、四六级、考驾照、学生会社团、实习与劳动权益、学生医保、奖助学金与助学贷款）；
三，新增了 D 级证据等级，并要求每条 D 级写明为什么只到 D。</p>
<p><strong>免责：</strong>这是一份决策参考，不是法律意见、医疗建议或官方口径。文中涉及的法律法规、政策数字、
报销比例、补贴标准等均可能随时间和地区变化，引用前请以官方最新文件为准。凡标注「待核实」的内容不要直接引用。</p>
</section>`);
}

function colophonPage(){
  const s = B.stats;
  return page("关于这本书", `<section epub:type="colophon">
<h1>关于这本书</h1>
<p>《大学生生活指南》· ${s.sections} 节 ${s.entries} 条 · 生成日期 ${esc(B.buildTime)}</p>
<dl class="flds">
<dt>改编自</dt><dd>eternity4719《高性价比人生指南》<br/><a href="https://github.com/eternity4719/HowToLiveBetter">github.com/eternity4719/HowToLiveBetter</a></dd>
<dt>原作在线阅读</dt><dd><a href="https://eternity4719.github.io/HowToLiveBetter/">eternity4719.github.io/HowToLiveBetter</a></dd>
<dt>许可</dt><dd>知识共享 署名 4.0 国际（CC BY 4.0）<br/><a href="https://creativecommons.org/licenses/by/4.0/">creativecommons.org/licenses/by/4.0/</a></dd>
<dt>署名对照</dt><dd>逐条对照见仓库根目录的 NOTICE.md；完整许可文本见 LICENSE。</dd>
<dt>等级分布</dt><dd>A ${s.byGrade.A} · B ${s.byGrade.B} · C ${s.byGrade.C} · D ${s.byGrade.D}</dd>
<dt>免责</dt><dd>决策参考，不构成法律意见、医疗建议或官方口径。政策数字随时间和地区变化，引用前请以官方最新文件为准。</dd>
</dl>
</section>`);
}

function tocPage(){
  const items = B.sections.map((s) => `<li><a href="${secFile(s.sec)}">第 ${s.sec} 节　${esc(s.title)}（${s.count} 条）</a>
<ol>${s.entries.map((e) => `<li><a href="${secFile(s.sec)}#e-${e.id}">${e.sec}-${e.no}　${esc(e.title)}</a></li>`).join("")}</ol>
</li>`).join("\n");
  return page("目录", `<nav epub:type="toc" id="toc"><h1>目录</h1><ol>${items}
<li><a href="appendix.xhtml">附录　三个快捷清单</a></li>
<li><a href="colophon.xhtml">关于这本书（署名与许可）</a></li>
</ol></nav>`);
}

function sectionPage(s){
  const preHTML = s.pre
    ? `<div class="sec-pre">${s.pre.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const lm = l.match(/^\*\*口径\*\*：\s*(.+)$/);
        return lm ? `<p><span class="lens">口径：</span>${md(lm[1], s.sec)}</p>` : `<p>${md(l, s.sec)}</p>`;
      }).join("")}</div>`
    : "";

  const entries = s.entries.map((e) => {
    const rows = [];
    const row = (k, v, cls) => { if(v) rows.push(`<dt>${k}</dt><dd${cls ? ' class="' + cls + '"' : ""}>${md(v, e.sec)}</dd>`); };
    row("成本", e.cost);
    row("收益", e.benefit);
    row("路径", e.path);
    row("备注", e.note);
    row("来源", e.source, "src");
    return `<article class="ent" id="e-${e.id}" epub:type="subsection">
<h2 class="ent-t"><span class="no">${e.sec}-${e.no}</span>${esc(e.title)}</h2>
<p class="tags"><span class="tg tg${e.gkey}">${esc(e.gradeLabel)}</span><span class="tgx">${esc(e.tagList.join(" "))}</span></p>
<p class="plain">${md(e.plain, e.sec)}</p>
<dl class="flds">${rows.join("")}</dl>
</article>`;
  }).join("\n");

  return page("第 " + s.sec + " 节 " + s.title, `<section class="sec" id="s-${s.sec}" epub:type="chapter">
<div class="sec-h"><p class="sec-no">第 ${s.sec} 节</p><h1>${esc(s.title)}</h1></div>
${preHTML}
${entries}
</section>`);
}

function appendixPage(){
  const find = (id) => {
    for(const s of B.sections) for(const e of s.entries) if(e.id === id) return { s, e };
    return null;
  };
  const list = (ids) => `<ol>${ids.map((id) => {
    const hit = find(id);
    if(!hit) return "";
    return `<li><a href="${secFile(hit.s.sec)}#e-${hit.e.id}">${esc(hit.e.title)}</a>　<span class="tgx">${esc(hit.e.gradeLabel)}</span></li>`;
  }).join("")}</ol>`;

  return page("附录", `<section class="appendix">
<h1>附录　三个快捷清单</h1>
<h2>附录一　最省力的 ${B.stats.picks.lazy} 条</h2>
<p class="note">既不花钱、不花时间、不需要毅力，收益又落在最大一档。挑走一两条就算数。</p>
${list(B.picks.lazy)}
<h2>附录二　红线：后果涉及学籍、刑事或人身安全的 ${B.stats.picks.red} 条</h2>
<p class="note">这一组不按性价比看，按底线看。</p>
${list(B.picks.red)}
<h2>附录三　证据边界：没有直接证据的 ${B.stats.picks.edge} 条</h2>
<p class="note">这 ${B.stats.picks.edge} 条没有随机试验或大型研究支持，来源是明文规定或公开共识。它们的价值在于提醒你别漏掉某个变量，不是给你结论。每条的备注里都写明了为什么只到 D。</p>
${list(B.picks.edge)}
</section>`);
}

/* ---------- OPF / NCX ---------- */
const manifestItems = [];
const spineItems = [];
function add(id, href, media, extra){
  manifestItems.push(`<item id="${id}" href="${href}" media-type="${media}"${extra || ""}/>`);
}
function spine(id, linear){
  spineItems.push(`<itemref idref="${id}"${linear === false ? ' linear="no"' : ""}/>`);
}

add("nav", "text/nav.xhtml", "application/xhtml+xml", ' properties="nav"');
add("ncx", "toc.ncx", "application/x-dtbncx+xml");
add("css", "style.css", "text/css");
add("cover", "text/cover.xhtml", "application/xhtml+xml");
add("front", "text/front.xhtml", "application/xhtml+xml");
add("appendix", "text/appendix.xhtml", "application/xhtml+xml");
add("colophon", "text/colophon.xhtml", "application/xhtml+xml");
B.sections.forEach((s) => add("sec" + s.sec, "text/" + secFile(s.sec), "application/xhtml+xml"));

spine("cover");
spine("nav");
spine("front");
B.sections.forEach((s) => spine("sec" + s.sec));
spine("appendix");
spine("colophon");

const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="zh-CN">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${BOOK_ID}</dc:identifier>
<dc:title>${esc(B.title)}</dc:title>
<dc:language>zh-CN</dc:language>
<dc:description>${esc(B.subtitle)}。${B.stats.entries} 条，每条写明成本、收益、证据等级与原始出处。</dc:description>
<dc:date>${B.buildTime}</dc:date>
<meta property="dcterms:modified">${B.buildTime}T00:00:00Z</meta>
</metadata>
<manifest>
${manifestItems.join("\n")}
</manifest>
<spine toc="ncx">
${spineItems.join("\n")}
</spine>
</package>
`;

const navPoints = B.sections.map((s, i) => `<navPoint id="np${s.sec}" playOrder="${i + 1}">
<navLabel><text>第 ${s.sec} 节 ${esc(s.title)}</text></navLabel>
<content src="text/${secFile(s.sec)}"/>
${s.entries.map((e, j) => `<navPoint id="np${e.id}" playOrder="${i + 1}.${j + 1}">
<navLabel><text>${e.sec}-${e.no} ${esc(e.title)}</text></navLabel>
<content src="text/${secFile(s.sec)}#e-${e.id}"/>
</navPoint>`).join("\n")}
</navPoint>`).join("\n");

const ncx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="zh-CN">
<head>
<meta name="dtb:uid" content="${BOOK_ID}"/>
<meta name="dtb:depth" content="2"/>
<meta name="dtb:totalPageCount" content="0"/>
<meta name="dtb:maxPageNumber" content="0"/>
</head>
<docTitle><text>${esc(B.title)}</text></docTitle>
<navMap>
<navPoint id="npfront" playOrder="0"><navLabel><text>怎么读</text></navLabel><content src="text/front.xhtml"/></navPoint>
${navPoints}
<navPoint id="npapp" playOrder="99"><navLabel><text>附录　三个快捷清单</text></navLabel><content src="text/appendix.xhtml"/></navPoint>
<navPoint id="npcol" playOrder="100"><navLabel><text>关于这本书</text></navLabel><content src="text/colophon.xhtml"/></navPoint>
</navMap>
</ncx>
`;

const container = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`;

/* ---------- 打包 ---------- */
const files = [
  { name: "mimetype", data: "application/epub+zip", store: true }, // 必须第一条且不压缩
  { name: "META-INF/container.xml", data: container },
  { name: "OEBPS/content.opf", data: opf },
  { name: "OEBPS/toc.ncx", data: ncx },
  { name: "OEBPS/style.css", data: CSS },
  { name: "OEBPS/text/nav.xhtml", data: tocPage() },
  { name: "OEBPS/text/cover.xhtml", data: coverPage() },
  { name: "OEBPS/text/front.xhtml", data: frontPage() },
  { name: "OEBPS/text/appendix.xhtml", data: appendixPage() },
  { name: "OEBPS/text/colophon.xhtml", data: colophonPage() }
];
B.sections.forEach((s) => files.push({ name: "OEBPS/text/" + secFile(s.sec), data: sectionPage(s) }));

mkdirSync(join(root, "dist"), { recursive: true });
const outPath = join(root, "dist", "大学生生活指南.epub");
const buf = makeZip(files);
writeFileSync(outPath, buf);

const kb = (buf.length / 1024).toFixed(0);
console.log("已生成：" + outPath);
console.log("  " + files.length + " 个文件，体积约 " + kb + " KB");
console.log("  " + B.sections.length + " 节 " + B.stats.entries + " 条 · 目录页 + 3 个附录 · nav.xhtml + toc.ncx");
