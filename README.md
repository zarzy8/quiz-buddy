# 刷题搭子 · quiz-buddy

给一份文档，就能复习或刷题。这是一个 DeepSeek Harness 插件包（bundle），装完后给会话提供一个 `quiz-buddy` 技能。

出题类型：**单项选择题、多项选择题、判断题**（现版本）。

## 安装

```sh
dsh plugin add zarzy8/quiz-buddy
```

或装上预构建的 tarball（跳过源码构建，无需 `allowBuilds` 授权）：

```sh
dsh plugin add https://github.com/zarzy8/quiz-buddy/releases/latest/download/quiz-buddy.tgz
```

也可以在本机「插件 → 添加插件」里选这个包的目录。装好后**开一个新会话**，技能目录里会出现 `quiz-buddy`。

## 用法

1. 你发一个文件（笔记、讲义、教材 PDF、试卷、自备题库）
2. 它先判断：**复习资料** 还是 **题库**，并问你确认
3. 复习资料 → 再问「总结要点并出题」还是「只出题」
4. 题库 → 直接开考，一次一题
5. 答完给：总题数、错题数、准确率、每道错题的题目 / 你的答案 / 正确答案 / 解析

```
@我的笔记.pdf 帮我总结并出题
```

```
@题库.docx 开始考试
```

也可以点名：`用 quiz-buddy 处理这个文件`。

## 两种答题界面

- **答题卡片**：聊天里一次一题，选 A/B/C/D 即判分，答错当场给正确答案和解析。
- **独立窗口**：卡片不显示、或你想要「小程序」那种界面时，起一个本地网页窗口（只监听 `127.0.0.1`），点选项即判分，进度和错题在页面上实时更新。

## 它不会做什么

- 不会替你编造文件里没有的内容：扫描版 PDF 没有文字层时会直说读不到
- 出题阶段不会提前给答案
- 不会把你的文件上传到任何地方；独立窗口只监听 `127.0.0.1`
- 题库、PDF、答题记录都不进包，只随你的工作区走

## 依赖

- 读 `.docx` / `.pptx` / `.xlsx` / `.pdf` 依赖宿主的 `office` 技能
- 独立窗口模式需要本机有 Python 3（只用标准库，不装任何包）

## 结构

| 路径 | 作用 |
|---|---|
| `index.js` | Host 半：把 `assets/quiz-buddy` 注册成一个技能 provider |
| `cordis.patch.yml` | `dsh.bundle` 清单指向的补丁，插入插件条目 |
| `assets/quiz-buddy/SKILL.md` | 技能正文：判定、提问、出题、记分规则 |
| `assets/quiz-buddy/question-card.json` / `result-card.json` | 答题卡片与结算卡片的 schema |
| `assets/quiz-buddy/webapp/` | 独立窗口模式的本地网页与 stdlib HTTP 服务 |
| `locale/` | 市场卡片的中英文标题与描述 |

## License

MIT
