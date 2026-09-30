// 生成 NOTICE.md：署名与逐条对照。
// 用小脚本生成而不是手写，是为了让「哪几条引用了原著」这件事随正文自动保持准确——
// 手写的对照表迟早会和正文脱节，那是最不该出错的地方。
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readBook, GRADE_LABEL, upstreamRefs, UPSTREAM } from "./lib/book.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const book = readBook(root);

// 从来源与备注里抽出对原著的引用（判断逻辑在 lib/book.mjs，build-data.mjs 共用同一份）
const rows = [];
for(const sec of book.sections){
  for(const e of sec.entries){
    const u = upstreamRefs(e);
    if(!u.cited) continue;
    rows.push({
      id: e.id,
      title: e.title,
      grade: e.gkey,
      refs: u.refs,
      kind: u.direct ? "直接迁移" : "引用或改写"
    });
  }
}

const upstreamSections = [...new Set(rows.flatMap((r) => r.refs.map((x) => +x.split(" ")[0])))].sort((a, b) => a - b);

const gradeCount = { A: 0, B: 0, C: 0, D: 0 };
book.entries.forEach((e) => { if(gradeCount[e.gkey] !== undefined) gradeCount[e.gkey]++; });

const md = `# 署名与来源对照（NOTICE）

本作品《大学生生活指南》**改编自 ${UPSTREAM.author} 的《${UPSTREAM.title}》**，采用与原作相同的
**${UPSTREAM.license}** 许可发布。

## 原作

| | |
|---|---|
| 名称 | ${UPSTREAM.title} |
| 作者 | ${UPSTREAM.author} |
| 仓库 | <${UPSTREAM.repo}> |
| 在线版 | <${UPSTREAM.site}> |
| 许可 | ${UPSTREAM.license} — <${UPSTREAM.licenseUrl}> |

原作是一份按性价比排序的循证生活指南，覆盖 33 个章节，每条都写明成本、收益、证据等级和原始出处，
只引期刊论文与官方文件。本作品沿用了它的条目模板、证据等级体系和「给等级要说明理由」的写作规矩。

## 本作品做了什么修改

CC BY 4.0 要求在署名中说明是否作了修改。本作品对原作做了三类修改：

**一、更换了面向人群和计算口径。** 原作的读者是成年人，口径为「死亡率／金钱／人身自由」；
本作品的读者是在校生，口径改为「时间／学业／钱／就业／安全／健康」，性价比排序的第一权重
给了时间而非金钱。原书条目迁入时，其数字属于原书语境（成年人、死亡率口径），
条目内均注明了如何换算。

**二、新增了原著完全没有的章节。** 本作品共 10 节 80 条，全部为新写或改写；其中引用了原作的 ${rows.length} 条。
新增内容包括：上课与听课、四六级、考驾照、学生会社团、实习与劳动权益（依《职业学校学生实习管理规定》）、
学生医保、奖助学金与助学贷款。原著没有对应章节。

**三、新增了证据的 D 级，并改写了等级体系。** 原作只有 A/B/C 三级。本作品新增 D 级，
定义为「没有直接证据，来自明文规定或公开共识」，并强制要求每条 D 级在备注里写明为什么只到 D——
因为「该不该进学生会」这类问题没有随机对照试验，硬标 A 级就是造假。

当前等级分布：A ${gradeCount.A} 条、B ${gradeCount.B} 条、C ${gradeCount.C} 条、D ${gradeCount.D} 条。

## 逐条对照

以下 ${rows.length} 条在正文的「来源」或「备注」栏里明确标注了对原作的引用，分布在原作的
${upstreamSections.map((s) => "第 " + s + " 节").join("、")}。表中「关系」一列是粗略归类，
准确的关系以每条自己的「来源」栏和「备注」栏为准。

| 本作品条目 | 标题 | 本作品等级 | 原著位置 | 关系 |
|---|---|---|---|---|
${rows.map((r) => `| ${r.id} | ${r.title.replace(/\|/g, "\\|")} | ${GRADE_LABEL[r.grade] || r.grade} | ${r.refs.join("、")} | ${r.kind} |`).join("\n")}

> 上表由 \`node tools/build-notice.mjs\` 从正文自动生成，不是手写的——手写的对照表迟早会和正文脱节。

## 其余条目

未出现在上表的条目，其数据来自本作品自行查证的原始出处（期刊论文、荟萃分析、法律法规、部委文件、
省级考试院与医保部门公告等），每条的「来源」栏都给出了可点击的链接。这些条目与原作无关，
不承担原作的任何责任。

## 许可

- 本作品中**源自原作的部分**，版权归原作者，依 ${UPSTREAM.license} 使用。
- 本作品**新增与改写的部分**，同样依 ${UPSTREAM.license} 发布，署名见下。
- 完整许可文本见仓库根目录的 [LICENSE](LICENSE)。

你可以自由地共享和改编本作品，包括商用，条件是**署名**：请注明本作品及其原作
（${UPSTREAM.author}《${UPSTREAM.title}》，<${UPSTREAM.repo}>），并标明是否作了修改。

## 免责

这是一份**决策参考**，不是法律意见、医疗建议或官方口径。文中涉及的法律法规、政策数字、
报销比例、补贴标准等均可能随时间和地区变化，**引用前请以官方最新文件为准**。
凡标注「待核实」的内容不要直接引用。作者不对依据本书作出的任何决定承担责任。
`;

const out = join(root, "NOTICE.md");
writeFileSync(out, md, "utf8");
console.log("已生成：" + out);
console.log("  引用原著的条目 " + rows.length + " 条，涉及原著 " + upstreamSections.length + " 个章节");
console.log("  等级分布 A " + gradeCount.A + " B " + gradeCount.B + " C " + gradeCount.C + " D " + gradeCount.D);
