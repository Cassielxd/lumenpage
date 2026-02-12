/*
 * 文件说明：分页布局引擎。
 * 主要职责：块级布局与分页；行高/对齐/缩进处理；支持表格自定义布局。
 */

import { docToRuns, textToRuns } from "./textRuns";


import { breakLines } from "./lineBreaker";





function newPage(index) {


  return { index, lines: [] };


}





const computeLineX = (line, settings) => {


  const { pageWidth, margin } = settings;


  const maxWidth = pageWidth - margin.left - margin.right;


  const align = line.blockAttrs?.align || "left";


  const indent = line.blockAttrs?.indent || 0;





  let x = margin.left;


  if (align === "center") {


    x += Math.max(0, (maxWidth - line.width) / 2);


  } else if (align === "right") {


    x += Math.max(0, maxWidth - line.width);


  }





  if (indent && line.blockStart === line.start) {


    x += indent;


  }





  return x;


};





const adjustLineOffsets = (line, blockStart) => {


  if (typeof line.start === "number") {


    line.start += blockStart;


  }


  if (typeof line.end === "number") {


    line.end += blockStart;


  }


  if (line.runs) {


    for (const run of line.runs) {


      if (typeof run.start === "number") {


        run.start += blockStart;


      }


      if (typeof run.end === "number") {


        run.end += blockStart;


      }


    }


  }


  if (line.blockStart == null) {


    line.blockStart = blockStart;


  }


  return line;


};





export class LayoutPipeline {
  settings;
  registry;


  constructor(settings, registry = null) {


    this.settings = settings;


    this.registry = registry;


  }





  /* 文档布局入口：按块计算行与分页（支持表格自定义布局） */


  layoutFromDoc(doc) {


    const { pageHeight, pageGap, margin, lineHeight, font } = this.settings;





    const pages = [];


    let pageIndex = 0;


    let page = newPage(pageIndex);


    let cursorY = margin.top;


    let textOffset = 0;





    doc.forEach((block, _pos, index) => {


      const renderer = this.registry?.get(block.type.name);


      let blockLines = [];


      let blockLength = 0;


      let blockHeight = 0;


      let blockAttrs = block.attrs || null;


      let blockLineHeight = null;





      if (renderer?.layoutBlock) {


        const result = renderer.layoutBlock({


          node: block,
          availableHeight: pageHeight - margin.bottom - cursorY,
          measureTextWidth: this.settings.measureTextWidth,


          settings: this.settings,


          registry: this.registry,


        });


        blockLines = result?.lines || [];


        blockLength = result?.length || 0;


        blockHeight = result?.height || 0;


        if (result?.blockAttrs) {


          blockAttrs = result.blockAttrs;


        }


        if (result?.blockAttrs?.lineHeight) {


          blockLineHeight = result.blockAttrs.lineHeight;


        }


      } else {


        const runsResult = renderer?.toRuns


          ? renderer.toRuns(block, this.settings)


          : docToRuns(block, this.settings, this.registry);


        const { runs, length } = runsResult;


        blockLength = length;


        if (runsResult?.blockAttrs) {


          blockAttrs = runsResult.blockAttrs;


        }


        if (runsResult?.blockAttrs?.lineHeight) {


          blockLineHeight = runsResult.blockAttrs.lineHeight;


        }


        blockLines = breakLines(


          runs,


          this.settings.pageWidth - margin.left - margin.right,


          font,


          length,


          this.settings.wrapTolerance || 0,


          this.settings.minLineWidth || 0,

          this.settings.measureTextWidth


        );


        blockHeight = blockLines.length * (blockLineHeight || lineHeight);


      }





      const lineHeightValue = blockLineHeight || lineHeight;
      const canSplit = renderer?.allowSplit ?? !renderer?.layoutBlock;
      const splitBlock = renderer?.splitBlock;
      const safeLines = blockLines.length > 0
        ? blockLines
        : [
            {
              text: "",
              start: 0,
              end: 0,
              width: 0,
              runs: [],
              blockType: block.type.name,
              blockAttrs,
            },
          ];

      let remainingLines = safeLines;
      let remainingLength = blockLength;
      let remainingHeight =
        Number.isFinite(blockHeight) && blockHeight > 0
          ? blockHeight
          : safeLines.length * lineHeightValue;

      const placeLines = (linesToPlace) => {
        linesToPlace.forEach((line, lineIndex) => {
          const lineCopy = { ...line };
          lineCopy.blockType = lineCopy.blockType || block.type.name;
          lineCopy.blockAttrs = lineCopy.blockAttrs || blockAttrs;
          adjustLineOffsets(lineCopy, textOffset);
          if (typeof lineCopy.relativeY === "number") {
            lineCopy.y = cursorY + lineCopy.relativeY;
          } else {
            lineCopy.y = cursorY + lineIndex * lineHeightValue;
          }
          lineCopy.lineHeight = lineHeightValue;
          if (typeof lineCopy.x !== "number") {
            lineCopy.x = computeLineX(lineCopy, this.settings);
          }
          page.lines.push(lineCopy);
        });
      };

      while (remainingLines.length > 0) {
        const availableHeight = pageHeight - margin.bottom - cursorY;
        if (page.lines.length > 0 && remainingHeight > availableHeight) {
          let splitResult = null;
          if (canSplit && availableHeight > 0) {
            if (splitBlock) {
              splitResult = splitBlock({
                node: block,
                lines: remainingLines,
                length: remainingLength,
                height: remainingHeight,
                availableHeight,
                lineHeight: lineHeightValue,
                settings: this.settings,
                registry: this.registry,
              });
            }
            if (!splitResult) {
              const maxLines = Math.max(1, Math.floor(availableHeight / lineHeightValue));
              if (maxLines < remainingLines.length) {
                const visibleLines = remainingLines.slice(0, maxLines);
                const lastLine = visibleLines[visibleLines.length - 1];
                const visibleLength =
                  typeof lastLine?.end === "number" ? lastLine.end : remainingLength;
                const visibleHeight = visibleLines.length * lineHeightValue;
                const overflowLines = remainingLines.slice(maxLines);
                const overflowLength = Math.max(0, remainingLength - visibleLength);
                const overflowHeight = overflowLines.length * lineHeightValue;
                splitResult = {
                  lines: visibleLines,
                  length: visibleLength,
                  height: visibleHeight,
                  overflow: {
                    lines: overflowLines,
                    length: overflowLength,
                    height: overflowHeight,
                  },
                };
              }
            }
          }
          if (splitResult && splitResult.lines.length > 0) {
            placeLines(splitResult.lines);
            cursorY += splitResult.height;
            pages.push(page);
            pageIndex += 1;
            page = newPage(pageIndex);
            cursorY = margin.top;
            if (splitResult.overflow && splitResult.overflow.lines.length > 0) {
              remainingLines = splitResult.overflow.lines;
              remainingLength = splitResult.overflow.length;
              remainingHeight = splitResult.overflow.height;
              continue;
            }
            remainingLines = [];
            break;
          }
          pages.push(page);
          pageIndex += 1;
          page = newPage(pageIndex);
          cursorY = margin.top;
          continue;
        }
        placeLines(remainingLines);
        cursorY += remainingHeight;
        remainingLines = [];
      }

      textOffset += blockLength;

      if (index < doc.childCount - 1) {
        textOffset += 1;
      }

      if (cursorY + lineHeight > pageHeight - margin.bottom) {
        pages.push(page);
        pageIndex += 1;
        page = newPage(pageIndex);
        cursorY = margin.top;
      }
    });
    if (page.lines.length > 0) {


      pages.push(page);


    }





    const totalHeight =


      pages.length * pageHeight + Math.max(0, pages.length - 1) * pageGap;





    return {


      pages,


      pageHeight,


      pageWidth: this.settings.pageWidth,


      pageGap,


      margin,


      lineHeight,


      font,


      totalHeight,


    };


  }





  layoutFromText(text) {


    const { runs, length } = textToRuns(text, this.settings);


    return this.layoutFromRuns(runs, length);


  }





  /* 纯 runs 分页：用于文本/调试场景 */


  layoutFromRuns(runs, totalLength) {


    const { pageHeight, pageGap, margin, lineHeight, font } = this.settings;


    const maxWidth =


      this.settings.pageWidth - margin.left - margin.right;





    const lines = breakLines(


      runs,


      maxWidth,


      font,


      totalLength,


      this.settings.wrapTolerance || 0,


      this.settings.minLineWidth || 0,

          this.settings.measureTextWidth


    );





    const pages = [];


    let pageIndex = 0;


    let page = newPage(pageIndex);


    let y = margin.top;





    for (const line of lines) {


      page.lines.push({


        ...line,


        x: computeLineX(line, this.settings),


        y,


      });


      y += lineHeight;


      if (y + lineHeight > pageHeight - margin.bottom) {


        pages.push(page);


        pageIndex += 1;


        page = newPage(pageIndex);


        y = margin.top;


      }


    }





    if (page.lines.length > 0) {


      pages.push(page);


    }





    const totalHeight =


      pages.length * pageHeight + Math.max(0, pages.length - 1) * pageGap;





    return {


      pages,


      pageHeight,


      pageWidth: this.settings.pageWidth,


      pageGap,


      margin,


      lineHeight,


      font,


      totalHeight,


    };


  }


}


