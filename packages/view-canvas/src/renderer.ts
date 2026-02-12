/*
 * 文件说明：渲染主引擎。
 * 主要职责：页缓存管理、离屏渲染、主画布拼合、选区与光标叠加。
 */

import { getVisiblePages } from "./virtualization";


import { measureTextWidth, getFontSize } from "./measure";





const getLineHeight = (line, layout) =>


  Number.isFinite(line.lineHeight) ? line.lineHeight : layout.lineHeight;





const getBaselineOffset = (lineHeight, fontSize) =>


  Math.max(0, (lineHeight - fontSize) / 2);





const hashNumber = (hash, value) => {


  const num = Number.isFinite(value) ? Math.round(value) : 0;


  return (hash * 31 + num) | 0;


};





const hashString = (hash, value) => {


  if (!value) {


    return hash;


  }


  for (let i = 0; i < value.length; i += 1) {


    hash = (hash * 31 + value.charCodeAt(i)) | 0;


  }


  return hash;


};





export class Renderer {


  constructor(pageLayer, overlayCanvas, settings, registry = null) {


    this.pageLayer = pageLayer;


    this.overlayCanvas = overlayCanvas;


    this.overlayCtx = overlayCanvas.getContext("2d");


    this.settings = settings;


    this.registry = registry;


    this.pageCache = new Map();


    this.pageCanvases = [];


    this.lastDpr = 1;


  }





  /* 页签名：用于判断页缓存是否失效 */


  getPageSignature(page) {


    let hash = 0;


    for (const line of page.lines) {


      hash = hashNumber(hash, line.start);


      hash = hashNumber(hash, line.end);


      hash = hashNumber(hash, line.x);


      hash = hashNumber(hash, line.y);


      hash = hashNumber(hash, line.width);


      hash = hashNumber(hash, line.lineHeight);


      hash = hashString(hash, line.blockType || "");


      hash = hashString(hash, line.text || "");


      if (line.runs) {


        for (const run of line.runs) {


          hash = hashNumber(hash, run.start);


          hash = hashNumber(hash, run.end);


          hash = hashString(hash, run.text || "");


          hash = hashString(hash, run.font || "");


          hash = hashString(hash, run.color || "");


          hash = hashNumber(hash, run.underline ? 1 : 0);


        }


      }


    }


    return hash;


  }





  prunePageCache(pageCount) {


    for (const key of this.pageCache.keys()) {


      if (key >= pageCount) {


        this.pageCache.delete(key);


      }


    }


  }





  touchPage(pageIndex, entry) {


    if (!this.pageCache.has(pageIndex)) {


      return;


    }


    this.pageCache.delete(pageIndex);


    this.pageCache.set(pageIndex, entry);


  }





  enforceCacheLimit(activeSet, maxCache) {


    if (!Number.isFinite(maxCache) || maxCache <= 0) {


      return;


    }


    while (this.pageCache.size > maxCache) {


      const oldestKey = this.pageCache.keys().next().value;


      if (oldestKey === undefined) {


        return;


      }


      if (activeSet && activeSet.has(oldestKey)) {


        const entry = this.pageCache.get(oldestKey);


        this.pageCache.delete(oldestKey);


        this.pageCache.set(oldestKey, entry);


        continue;


      }


      this.pageCache.delete(oldestKey);


    }


  }





  ensureCanvasPool(count) {


    const current = this.pageCanvases.length;


    if (current < count) {


      for (let i = current; i < count; i += 1) {


        const canvas = document.createElement("canvas");


        canvas.className = "page-canvas";


        this.pageLayer.appendChild(canvas);


        this.pageCanvases.push({ canvas, ctx: canvas.getContext("2d") });


      }


    } else if (current > count) {


      const removed = this.pageCanvases.splice(count);


      for (const entry of removed) {


        entry.canvas.remove();


      }


    }


  }





  getPageCache(pageIndex, layout, dpr) {


    let entry = this.pageCache.get(pageIndex);


    const width = layout.pageWidth;


    const height = layout.pageHeight;





    if (


      !entry ||


      entry.width != width ||


      entry.height != height ||


      entry.dpr != dpr


    ) {


      const canvas =


        typeof OffscreenCanvas !== "undefined"


          ? new OffscreenCanvas(width * dpr, height * dpr)


          : document.createElement("canvas");


      if (!(canvas instanceof OffscreenCanvas)) {


        canvas.width = Math.max(1, Math.floor(width * dpr));


        canvas.height = Math.max(1, Math.floor(height * dpr));


      }


      const ctx = canvas.getContext("2d");


      entry = {


        canvas,


        ctx,


        width,


        height,


        dpr,


        dirty: true,


        signature: null,


      };


      this.pageCache.set(pageIndex, entry);


    }





    this.touchPage(pageIndex, entry);


    return entry;


  }





  drawLine(ctx, line, pageX, pageTop, layout) {


    const lineHeight = getLineHeight(line, layout);





    if (line.runs && line.runs.length > 0) {


      let cursorX = pageX + line.x;


      for (const run of line.runs) {


        const font = run.font || layout.font;


        const color = run.color || "#111827";


        const fontSize = getFontSize(font);


        const baselineOffset = getBaselineOffset(lineHeight, fontSize);


        const width =


          typeof run.width === "number"


            ? run.width


            : measureTextWidth(font, run.text);


        const textY = pageTop + line.y + baselineOffset;





        ctx.font = font;


        ctx.fillStyle = color;


        ctx.fillText(run.text, cursorX, textY);





        if (run.underline && run.text.length > 0) {


          const underlineY = textY + fontSize - 2;


          ctx.strokeStyle = color;


          ctx.lineWidth = 1;


          ctx.beginPath();


          ctx.moveTo(cursorX, underlineY);


          ctx.lineTo(cursorX + width, underlineY);


          ctx.stroke();


        }





        cursorX += width;


      }


    } else {


      const font = layout.font;


      const fontSize = getFontSize(font);


      const baselineOffset = getBaselineOffset(lineHeight, fontSize);


      const textY = pageTop + line.y + baselineOffset;





      ctx.font = font;


      ctx.fillStyle = "#111827";


      ctx.fillText(line.text, pageX + line.x, textY);


    }


  }





  renderPage(pageIndex, layout, entry) {


    const { ctx, width, height, dpr } = entry;


    const page = layout.pages[pageIndex];





    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);


    ctx.clearRect(0, 0, width, height);


    ctx.fillStyle = "#ffffff";


    ctx.fillRect(0, 0, width, height);


    ctx.strokeStyle = "#d1d5db";


    ctx.strokeRect(0, 0, width, height);


    ctx.textBaseline = "top";





    const defaultRender = (line, pageX, pageTop, layoutRef) =>


      this.drawLine(ctx, line, pageX, pageTop, layoutRef);





    for (const line of page.lines) {


      const renderer = this.registry?.get(line.blockType);


      if (renderer?.renderLine) {


        renderer.renderLine({


          ctx,


          line,


          pageTop: 0,


          pageX: 0,


          layout,


          defaultRender,


        });


      } else {


        defaultRender(line, 0, 0, layout);


      }


    }





    entry.dirty = false;


  }





  /* 主渲染：离屏缓存 + 主画布/叠加层绘制 */


  render(layout, viewport, caret, selectionRects = []) {


    if (!layout) {


      return;


    }





    const { clientWidth, clientHeight, scrollTop } = viewport;


    const dpr = window.devicePixelRatio || 1;





    if (this.lastDpr !== dpr) {


      this.pageCache.clear();


      this.lastDpr = dpr;


    }





    this.overlayCanvas.width = Math.max(1, Math.floor(clientWidth * dpr));


    this.overlayCanvas.height = Math.max(1, Math.floor(clientHeight * dpr));


    this.overlayCanvas.style.width = `${clientWidth}px`;


    this.overlayCanvas.style.height = `${clientHeight}px`;





    this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);


    this.overlayCtx.clearRect(0, 0, clientWidth, clientHeight);





    const pageX = Math.max(0, (clientWidth - layout.pageWidth) / 2);


    const pageSpan = layout.pageHeight + layout.pageGap;


    const visible = getVisiblePages(layout, scrollTop, clientHeight);


    const buffer = this.settings.pageBuffer ?? 1;


    const startIndex = Math.max(0, visible.startIndex - buffer);


    const endIndex = Math.min(layout.pages.length - 1, visible.endIndex + buffer);


    const activePages = new Set();


    for (let i = startIndex; i <= endIndex; i += 1) {


      activePages.add(i);


    }





    this.prunePageCache(layout.pages.length);


    this.ensureCanvasPool(activePages.size);





    const pageIndices = Array.from(activePages.values());


    pageIndices.sort((a, b) => a - b);





    for (let i = 0; i < pageIndices.length; i += 1) {


      const pageIndex = pageIndices[i];


      const entry = this.getPageCache(pageIndex, layout, dpr);


      const signature = this.getPageSignature(layout.pages[pageIndex]);


      if (entry.signature !== signature) {


        entry.signature = signature;


        entry.dirty = true;


      }


      if (entry.dirty) {


        this.renderPage(pageIndex, layout, entry);


      }





      const canvasEntry = this.pageCanvases[i];


      const canvas = canvasEntry.canvas;


      const ctx = canvasEntry.ctx;


      const pageTop = pageIndex * pageSpan - scrollTop;





      canvas.width = Math.max(1, Math.floor(layout.pageWidth * dpr));


      canvas.height = Math.max(1, Math.floor(layout.pageHeight * dpr));


      canvas.style.width = `${layout.pageWidth}px`;


      canvas.style.height = `${layout.pageHeight}px`;


      canvas.style.left = `${pageX}px`;


      canvas.style.top = `${pageTop}px`;





      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);


      ctx.clearRect(0, 0, layout.pageWidth, layout.pageHeight);


      ctx.drawImage(


        entry.canvas,


        0,


        0,


        entry.width * dpr,


        entry.height * dpr,


        0,


        0,


        entry.width,


        entry.height


      );


    }





    const maxCache = this.settings.maxPageCache ?? Math.max(activePages.size * 2, 12);


    this.enforceCacheLimit(activePages, maxCache);





    if (selectionRects && selectionRects.length > 0) {


      this.overlayCtx.fillStyle = "rgba(191, 219, 254, 0.4)";


      for (const rect of selectionRects) {


        this.overlayCtx.fillRect(rect.x, rect.y, rect.width, rect.height);


      }


    }





    if (caret) {


      const caretBottom = caret.y + caret.height;


      if (caretBottom >= 0 && caret.y <= clientHeight) {


        this.overlayCtx.fillStyle = "#111827";


        this.overlayCtx.fillRect(caret.x, caret.y, 1, caret.height);


      }


    }


  }


}


