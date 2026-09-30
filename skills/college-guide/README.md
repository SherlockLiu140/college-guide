# 让 AI 照《大学生生活指南》回答

装上之后，可以直接问 AI「替朋友担保签不签」「大一要不要进学生会」「实习被安排上夜班怎么办」这类问题。它会**先把相关条目从 `book/` 里查出来**，再照书里的算账方式排序回答，并注明出自第几节第几条。查不到就说查不到，不自己编数字。

## 装到 Claude Code

把 `skills/college-guide/` 整个目录复制到项目的 skills 目录：

```bash
# 项目级
mkdir -p .claude/skills && cp -r skills/college-guide .claude/skills/

# 或用户级（所有项目都能用）
mkdir -p ~/.claude/skills && cp -r skills/college-guide ~/.claude/skills/
```

## 装到 Codex

```bash
mkdir -p ~/.codex/skills && cp -r skills/college-guide ~/.codex/skills/
```

具体目录以你所用工具的文档为准——形态都一样：一个含 `SKILL.md` 的目录。

## 为什么它不会乱答

`SKILL.md` 里定死了几条规矩，其中两条最关键：

1. **回答前必须先去 `book/` 查条目**，不许凭记忆答。
2. **必须带上证据等级**，而且看到 D 级要主动说清楚「这几条没有对照研究支持，只是把变量列出来」。不许为了让答案显得有底气而隐去等级。

指南本身是这套规矩的来源：80 条里 47 条 A 级、12 条 B 级、7 条 C 级、14 条 D 级，每条 D 级都在备注里写明了为什么只到 D。AI 沿用同一套标准，就不会把那些没有证据的条目讲成定论。

## 改完正文记得重建

```bash
node tools/build-all.mjs
```
