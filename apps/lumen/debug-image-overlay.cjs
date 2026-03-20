const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    globalThis.__lumenTestApi.setJSON({
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { id: 'before-image-shift' }, content: [{ type: 'text', text: 'Lead paragraph before image shift case.' }] },
        { type: 'image', attrs: { id: 'image-shift-regression', src: 'https://example.com/demo.png', alt: 'Image shift regression', width: 360, height: 220 } },
        { type: 'paragraph', attrs: { id: 'after-image-shift' }, content: [{ type: 'text', text: 'Paragraph after image shift case.' }] },
      ],
    });
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const view = globalThis.__lumenView;
    let pos = null;
    view.state.doc.descendants((node, p) => {
      if (node.attrs?.id === 'before-image-shift') {
        pos = p + (node.content?.size || 0);
        return false;
      }
      return true;
    });
    globalThis.__lumenTestApi.setSelection(pos, pos);
  });
  const input = page.locator('main [role="textbox"]').first();
  await input.focus();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Enter');
    await page.keyboard.insertText(`Push image ${i + 1}. ` + 'This inserted paragraph should force the image onto the next page. '.repeat(8));
  }
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const view = globalThis.__lumenView;
    const layout = view._internals.getLayout();
    const scrollArea = view._internals.dom.scrollArea;
    const matchBox = (boxes) => {
      if (!Array.isArray(boxes)) return null;
      for (const box of boxes) {
        if (String(box?.blockId ?? '') === 'image-shift-regression' || String(box?.nodeId ?? '') === 'image-shift-regression') return box;
        const child = matchBox(box?.children);
        if (child) return child;
      }
      return null;
    };
    const pageIndex = layout.pages.findIndex((p) => !!matchBox(p?.boxes));
    const box = matchBox(layout.pages[pageIndex]?.boxes);
    const pageSpan = Number(layout.pageHeight || 0) + Number(layout.pageGap || 0);
    scrollArea.scrollTop = Math.max(0, pageIndex * pageSpan + Math.max(0, Number(box?.y || 0) - 48));
  });
  const dump = async (label) => {
    const data = await page.evaluate(() => {
      const overlays = Array.from(document.querySelectorAll('.lumenpage-image-overlay')).map((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          blockId: el.getAttribute('data-node-view-block-id'),
          width: rect.width,
          height: rect.height,
          x: rect.x,
          y: rect.y,
          display: style.display,
          visibility: style.visibility,
          styleWidth: el.style.width,
          styleHeight: el.style.height,
        };
      });
      const view = globalThis.__lumenView;
      const layout = view._internals.getLayout();
      const scrollArea = view._internals.dom.scrollArea;
      const boxes = [];
      const collect = (boxList, pageIndex, depth = 0) => {
        if (!Array.isArray(boxList)) return;
        for (const box of boxList) {
          if (!box || typeof box !== 'object') continue;
          if (String(box.blockId ?? '') === 'image-shift-regression' || String(box.nodeId ?? '') === 'image-shift-regression') {
            boxes.push({ pageIndex, depth, x: box.x, y: box.y, width: box.width, height: box.height, role: box.role, type: box.type });
          }
          collect(box.children, pageIndex, depth + 1);
        }
      };
      layout.pages.forEach((p, index) => collect(p.boxes, index));
      return { scrollTop: scrollArea.scrollTop, overlays, boxes };
    });
    console.log(label, JSON.stringify(data, null, 2));
  };
  await dump('immediate');
  await page.waitForTimeout(100);
  await dump('after100');
  await page.waitForTimeout(500);
  await dump('after600');
  await browser.close();
})();
