# 贡献指南 / Contributing

欢迎修正教学勘误、改善离线体验、补充课程和实验，或提交可复现的缺陷。请在 GitHub Issue 中写明使用的是工程版还是离线版、浏览器、课次或页面、复现步骤和预期结果。提交截图或示例时，请使用可公开的教学数据。

1. 按 [README](README.md#快速体验) 启动项目。修改示例教材时，可从 [`content/lessons`](content/lessons) 和 [Lesson DSL](docs/LESSON-DSL.md) 开始。
2. 新增实验先定义单位、模型假设、参数范围和学科注册场景；计算放在 Subject Pack，交互展示放在 Renderer。说明模型的边界，并为新计算补充相应测试。见 [Subject Pack SDK](docs/SUBJECT-SDK.md)。
3. 提交 Pull Request 时说明问题、实现后的行为及验证结果。界面改动附实际运行截图，教材内容补充依据与来源。用到第三方资源时，请记录许可和署名要求。

### 本地检查

按 [README 的验证命令](README.md#开发与验证) 运行与改动相关的检查。工程版浏览器验收可按以下方式运行：

```bash
uv run --locked --with playwright python -m playwright install chromium
uv run --locked --with playwright python tests/run_studio_acceptance.py
```

验收用本机协议夹具测试模型响应，使用独立临时数据库。可设 `ZJ_BROWSER_EXECUTABLE` 使用已有的 Chrome；截图默认写入 `design/工程化运行截图`，可设 `ZJ_STUDIO_SCREENSHOTS` 指向其他目录。只验证学伴时，在第二条命令末尾加 `--tutor-only`。

English issues and pull requests are welcome. Include the affected lesson or screen, steps to reproduce, and the checks you ran. For new teaching content or simulations, document your sources, units, and model assumptions.
