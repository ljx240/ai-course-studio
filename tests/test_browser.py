"""可选浏览器回归：无需网络，需本机 Chromium + Python Playwright。运行 python tests/test_browser.py。"""
import asyncio
import base64
import os
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
OUT = ROOT / "design" / "实际运行截图"


def stylesheet():
    css = (WEB / "css/app.css").read_text(encoding="utf-8")
    for file in ["mountains.svg", "field.svg"]:
        b64 = base64.b64encode((WEB / "assets" / file).read_bytes()).decode("ascii")
        css = css.replace("../assets/" + file, "data:image/svg+xml;base64," + b64)
    return css


async def main():
    OUT.mkdir(exist_ok=True, parents=True)
    async with async_playwright() as pw:
        args = ["--no-sandbox"]
        preferred = "/usr/bin/chromium"
        browser = await pw.chromium.launch(headless=True, executable_path=preferred if Path(preferred).exists() else None, args=args)
        page = await browser.new_page(viewport={"width": 1600, "height": 980}, device_scale_factor=1)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        # 通过 set_content / add_script_tag 测试同一份真实源码，规避部分沙箱阻止 localhost 导航的问题
        await page.set_content('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body><div id="app"></div></body></html>')
        await page.add_style_tag(content=stylesheet())
        for name in ["data.js", "store.js", "engines/physics.js", "engines/math.js", "views.js", "app.js"]:
            await page.add_script_tag(content=(WEB / "js" / name).read_text(encoding="utf-8"))
        assert await page.locator(".section-label").count() > 0
        await page.screenshot(path=str(OUT / "01-互动教材-实际运行.png"))
        for name, file in [
            ("outline", "02-教学大纲-实际运行.png"),
            ("lab", "03-实验室-实际运行.png"),
            ("editor", "04-教材创作-实际运行.png"),
            ("quiz", "05-随堂练习-实际运行.png"),
        ]:
            await page.locator(f'.rail [data-view="{name}"]').click()
            await page.screenshot(path=str(OUT / file))
        # 数学计算交互
        await page.locator('.rail [data-view="reader"]').click()
        await page.locator('[data-subject="math"]').first.click()
        old_path = await page.locator('[data-math-stage] svg path[stroke="#5968d8"]').get_attribute('d')
        await page.locator('[data-math-control="mathA"]').evaluate('(e) => {e.value="-1";e.dispatchEvent(new Event("input",{bubbles:true}));}')
        new_path = await page.locator('[data-math-stage] svg path[stroke="#5968d8"]').get_attribute('d')
        assert old_path != new_path
        await page.screenshot(path=str(OUT / '06-数学互动教材-实际运行.png'))
        # AI 教材生成（本地模板）
        await page.locator('.rail [data-view="outline"]').click()
        await page.locator('[data-action="generate-modal"]').first.click()
        await page.locator('#generate-form button[type="submit"]').click()
        assert await page.get_by_text('AI 教材创作工作台').count() > 0
        assert await page.locator('#edit-body').count() == 1
        # 练习判分
        await page.locator('.rail [data-view="quiz"]').click()
        await page.locator('[data-answer="1"]').click()
        await page.locator('[data-action="submit-answer"]').click()
        assert await page.get_by_text("回答正确").count() > 0
        assert not errors, f"Browser errors: {errors}"
        print('PASS: 6 screenshots, math curve, lesson-generation template, quiz grading; no JS pageerrors')
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
