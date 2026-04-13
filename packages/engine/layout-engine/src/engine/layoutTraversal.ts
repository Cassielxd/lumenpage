import { layoutLeafBlockOnPage } from "./layoutLeafTraversal.js";
import { resolveContainerLayoutContext, isLeafLayoutNode } from "lumenpage-render-engine";
import { updateChangedBoundaryProgress } from "./changeBoundary.js";

export type LayoutTraversalSession = {
  page: any;
  pageBoxCollector: any;
  cursorY: number;
  textOffset: number;
  startBlockIndex: number;
  shouldStop: boolean;
  canSync: boolean;
  syncAfterIndex: number | null;
  syncAfterTextOffset: number | null;
  passedChangedRange: boolean;
  resumeFromAnchor: boolean;
  resumeAnchorApplied: boolean;
  resumeAnchorTargetY: { y: number; relativeY: number } | null;
};

export const createLayoutTraversalController = ({
  session,
  registry,
  baseSettings,
  blockCache,
  measureTextWidth,
  perf,
  now,
  logLayout,
  blockSpacing,
  rootMarginLeft,
  pageHeight,
  margin,
  lineHeight,
  finalizePage,
}: {
  session: LayoutTraversalSession;
  registry: any;
  baseSettings: any;
  blockCache: Map<any, any>;
  measureTextWidth: (font: string, text: string) => number;
  perf: any;
  now: () => number;
  logLayout: (...args: any[]) => void;
  blockSpacing: number;
  rootMarginLeft: number;
  pageHeight: number;
  margin: { top: number; bottom: number };
  lineHeight: number;
  finalizePage: () => boolean;
}) => {
  const layoutLeafBlock = (block: any, context: any) =>
    layoutLeafBlockOnPage({
      session,
      block,
      context,
      registry,
      baseSettings,
      blockCache,
      measureTextWidth,
      perf,
      now,
      logLayout,
      blockSpacing,
      pageHeight,
      margin,
      lineHeight,
      finalizePage,
    });

  const walkBlocks = (node: any, context: any): boolean => {
    if (session.shouldStop) {
      return true;
    }
    const renderer = registry?.get(node.type.name);
    const isLeaf = isLeafLayoutNode(renderer, node);

    if (isLeaf) {
      return layoutLeafBlock(node, context);
    }
    const { nextContext } = resolveContainerLayoutContext({
      renderer,
      node,
      settings: baseSettings,
      registry,
      context,
      baseX: rootMarginLeft,
    });

    for (let index = 0; index < node.childCount; index += 1) {
      const child = node.child(index);
      if (walkBlocks(child, nextContext)) {
        return true;
      }
      if (index < node.childCount - 1) {
        session.textOffset += 1;
        updateChangedBoundaryProgress(session);
      }
    }

    return session.shouldStop;
  };

  const walkRootBlocks = (doc: any) => {
    for (let index = session.startBlockIndex; index < doc.childCount; index += 1) {
      if (session.shouldStop) {
        break;
      }
      const block = doc.child(index);
      const renderer = registry?.get(block.type.name);
      const isLeaf = isLeafLayoutNode(renderer, block);
      if (walkBlocks(block, { indent: 0, containerStack: [], rootIndex: index })) {
        break;
      }
      if (!isLeaf && blockSpacing > 0 && index < doc.childCount - 1) {
        session.cursorY += blockSpacing;
        if (session.cursorY + lineHeight > pageHeight - margin.bottom) {
          if (finalizePage()) {
            break;
          }
        }
      }
      if (index < doc.childCount - 1) {
        session.textOffset += 1;
        updateChangedBoundaryProgress(session);
      }
    }
  };

  return {
    layoutLeafBlock,
    walkBlocks,
    walkRootBlocks,
  };
};
