import {
  type RendererPageDisplayList,
  type RendererPageDisplayListItem,
} from "./pageDisplayList.js";
import { renderPageLineCompatPass } from "./pageLineCompatPass.js";
import { renderPageFragmentPass } from "./pageFragmentPass.js";
import { renderPageShell } from "./pageDisplayListItems.js";

export const executeRendererPageDisplayListItem = ({
  ctx,
  item,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  item: RendererPageDisplayListItem;
}) => {
  switch (item.kind) {
    case "page-shell":
      renderPageShell({
        ctx,
        width: item.width,
        height: item.height,
        pageIndex: item.pageIndex,
        layout: item.layout,
        settings: item.settings,
      });
      return;
    case "fragment-pass":
      renderPageFragmentPass({
        ctx,
        layout: item.layout,
        registry: item.registry,
        defaultRender: item.createDefaultRender(ctx),
        plan: item.plan,
        runtime: item.runtime,
      });
      return;
    case "line-compat-pass":
      renderPageLineCompatPass({
        ctx,
        layout: item.layout,
        registry: item.registry,
        defaultRender: item.createDefaultRender(ctx),
        plan: item.plan,
        runtime: item.runtime,
      });
      return;
  }
};

export const executeRendererPageDisplayList = ({
  ctx,
  displayList,
}: {
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  displayList: RendererPageDisplayList;
}) => {
  for (const item of displayList.items) {
    executeRendererPageDisplayListItem({
      ctx,
      item,
    });
  }
};
