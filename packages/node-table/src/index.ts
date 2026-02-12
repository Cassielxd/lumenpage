/*
 * 文件说明：表格节点渲染器。
 * 主要职责：计算表格单元格布局与行高；绘制表格网格与文本行。
 */

import { docToRuns } from "lumenpage-core";


import { breakLines } from "lumenpage-core";





const getTableShape = (node) => {


  const rows = node.childCount;


  let cols = 0;


  node.forEach((row) => {


    cols = Math.max(cols, row.childCount);


  });


  return {


    rows: Math.max(1, rows),


    cols: Math.max(1, cols),


  };


};





const getCellTextLength = (cell) =>


  cell ? cell.textBetween(0, cell.content.size, "\n").length : 0;





const layoutCell = (cell, settings, registry, maxWidth) => {


  if (!cell) {


    return { lines: [{ text: "", start: 0, end: 0, width: 0, runs: [] }], length: 0 };


  }





  const { runs, length } = docToRuns(cell, settings, registry);


  const lines = breakLines(


    runs,


    maxWidth,


    settings.font,


    length,


    settings.wrapTolerance || 0,


    settings.minLineWidth || 0,

    settings.measureTextWidth


  );


  if (lines.length === 0) {


    lines.push({ text: "", start: 0, end: 0, width: 0, runs: [] });


  }


  return { lines, length };


};





export const tableRenderer = {


  /* 表格布局：计算单元格文本行与行高，生成表格块行列表 */


  layoutBlock({ node, settings, registry }) {


    const { rows, cols } = getTableShape(node);


    const tableWidth = settings.pageWidth - settings.margin.left - settings.margin.right;


    const colWidth = tableWidth / cols;


    const padding = 8;


    const paddingY = 10;


    const minRowHeight = Math.max(settings.lineHeight * 1.6, settings.lineHeight + paddingY * 2);


    const maxCellWidth = Math.max(0, colWidth - padding * 2);


    const rowHeights = [];


    const rowMaxLines = [];


    const cellLayouts = [];





    let tableOffset = 0;





    for (let r = 0; r < rows; r += 1) {


      const row = node.child(r);


      const rowCells = [];


      let maxLines = 1;





      for (let c = 0; c < cols; c += 1) {


        const cell = c < row.childCount ? row.child(c) : null;


        const cellLayout = layoutCell(cell, settings, registry, maxCellWidth);


        const cellLength = getCellTextLength(cell);


        maxLines = Math.max(maxLines, cellLayout.lines.length || 1);





        rowCells.push({


          rowIndex: r,


          colIndex: c,


          startOffset: tableOffset,


          length: cellLength,


          layout: cellLayout,


        });





        tableOffset += cellLength;


        if (c < cols - 1) {


          tableOffset += 1;


        }


      }





      rowHeights[r] = Math.max(


        maxLines * settings.lineHeight + paddingY * 2,


        minRowHeight


      );


      rowMaxLines[r] = maxLines;


      cellLayouts.push(rowCells);





      if (r < rows - 1) {


        tableOffset += 1;


      }


    }





    const lines = [];


    let tableTop = 0;


    const tableHeight = rowHeights.reduce((sum, h) => sum + h, 0);





    for (let r = 0; r < rows; r += 1) {


      const rowCells = cellLayouts[r];


      const maxLines = Math.max(1, rowMaxLines[r] || 1);


      const rowContentHeight = maxLines * settings.lineHeight + paddingY * 2;


      const rowExtra = Math.max(0, rowHeights[r] - rowContentHeight);


      const rowInset = paddingY + rowExtra / 2;





      for (let lineIndex = 0; lineIndex < maxLines; lineIndex += 1) {


        for (const cell of rowCells) {


          const cellLine = cell.layout.lines[lineIndex] || {


            text: "",


            start: 0,


            end: 0,


            width: 0,


            runs: [],


          };





          const cellLineStart = Number.isFinite(cellLine.start)


            ? cellLine.start


            : 0;


          const cellLineEnd = Number.isFinite(cellLine.end)


            ? cellLine.end


            : cellLineStart;


          const adjustedRuns = cellLine.runs


            ? cellLine.runs.map((run) => ({


                ...run,


                start: (Number.isFinite(run.start) ? run.start : 0) + cell.startOffset,


                end: (Number.isFinite(run.end) ? run.end : 0) + cell.startOffset,


              }))


            : cellLine.runs;





          const line = {


            ...cellLine,


            runs: adjustedRuns,


            start: cell.startOffset + cellLineStart,


            end: cell.startOffset + cellLineEnd,


            x: settings.margin.left + cell.colIndex * colWidth + padding,


            relativeY: tableTop + rowInset + lineIndex * settings.lineHeight,


            blockType: "table",


            blockAttrs: {


              rows,


              cols,


              rowIndex: r,


              colIndex: cell.colIndex,


              colWidth,


              rowHeights,


              tableWidth,


              padding,


              paddingY,


            },


            cellWidth: maxCellWidth,


            cellPadding: padding,


            cellPaddingY: paddingY,


          };





          if (r === 0 && cell.colIndex === 0 && lineIndex === 0) {


            line.tableMeta = {


              rows,


              cols,


              rowHeights,


              colWidth,


              tableWidth,


              tableHeight,


              padding,


              paddingY,


              tableTop: 0,


            };


          }





          lines.push(line);


        }


      }





      tableTop += rowHeights[r];


    }





    return {


      lines,


      length: tableOffset,


      height: tableHeight,


      blockType: "table",


      blockAttrs: { rows, cols, rowHeights, colWidth, tableWidth, padding },


    };


  },


  /* 表格渲染：绘制网格，文本仍复用默认渲染 */


  renderLine({ ctx, line, pageX, pageTop, layout, defaultRender }) {


    if (line.tableMeta) {


      const tableX = pageX + layout.margin.left;


      const relativeY = typeof line.relativeY === "number" ? line.relativeY : 0;


      const tableTop = line.tableMeta.tableTop || 0;


      const tableY = pageTop + line.y - relativeY + tableTop;


      const { rows, cols, rowHeights, tableWidth, colWidth, tableHeight } = line.tableMeta;





      ctx.save();


      ctx.strokeStyle = "#6b7280";


      ctx.lineWidth = 1;


      ctx.strokeRect(tableX, tableY, tableWidth, tableHeight);





      let y = tableY;


      for (let r = 0; r < rows - 1; r += 1) {


        y += rowHeights[r];


        ctx.beginPath();


        ctx.moveTo(tableX, y);


        ctx.lineTo(tableX + tableWidth, y);


        ctx.stroke();


      }





      for (let c = 1; c < cols; c += 1) {


        const x = tableX + c * colWidth;


        ctx.beginPath();


        ctx.moveTo(x, tableY);


        ctx.lineTo(x, tableY + tableHeight);


        ctx.stroke();


      }





      ctx.restore();


    }





    defaultRender(line, pageX, pageTop, layout);


  },


};


