import React from "react";
import { useAtomValue } from "jotai";
import { SplitView, SplitViewCol } from "../components/split-view.js";
import { Heading } from "../components/heading.js";
import JSONTree from "../components/json-tree.js";
import { InfoPanel } from "../components/info-panel.js";
import { editorViewAtom } from "../state/editor-view.js";
import { editorStateAtom } from "../state/editor-state.js";

const buildFallbackPaginationInfo = (view: any) => {
  const layout = view?._internals?.getLayout?.() ?? null;
  const settings = view?._internals?.settings ?? null;
  const scrollArea = view?._internals?.dom?.scrollArea ?? null;
  if (!layout || !settings || !scrollArea) {
    return null;
  }
  return {
    pageCount: layout.pages?.length ?? 0,
    totalHeight: layout.totalHeight ?? 0,
    pageWidth: layout.pageWidth ?? settings.pageWidth ?? 0,
    pageHeight: layout.pageHeight ?? settings.pageHeight ?? 0,
    pageGap: layout.pageGap ?? settings.pageGap ?? 0,
    margin: layout.margin ?? settings.margin ?? null,
    scrollTop: scrollArea.scrollTop ?? 0,
    viewportHeight: scrollArea.clientHeight ?? 0,
    pages: (layout.pages || []).map((page: any, index: number) => ({
      index,
      lineCount: page?.lines?.length ?? 0,
      rootIndexMin: Number.isFinite(page?.rootIndexMin) ? page.rootIndexMin : null,
      rootIndexMax: Number.isFinite(page?.rootIndexMax) ? page.rootIndexMax : null,
    })),
  };
};

export default function PagesTab() {
  // Depend on editor state updates so page metrics refresh while editing.
  useAtomValue(editorStateAtom);
  const editorView = useAtomValue(editorViewAtom) as any;
  if (!editorView) {
    return <InfoPanel>No editor view found.</InfoPanel>;
  }

  const paginationInfo =
    (typeof editorView.getPaginationInfo === "function"
      ? editorView.getPaginationInfo()
      : null) || buildFallbackPaginationInfo(editorView);

  if (!paginationInfo) {
    return <InfoPanel>Pagination info is unavailable.</InfoPanel>;
  }

  const summary = {
    pageCount: paginationInfo.pageCount ?? 0,
    totalHeight: paginationInfo.totalHeight ?? 0,
    pageWidth: paginationInfo.pageWidth ?? 0,
    pageHeight: paginationInfo.pageHeight ?? 0,
    pageGap: paginationInfo.pageGap ?? 0,
    margin: paginationInfo.margin ?? null,
    lineHeight: paginationInfo.lineHeight ?? null,
    blockSpacing: paginationInfo.blockSpacing ?? null,
    scrollTop: paginationInfo.scrollTop ?? 0,
    viewportHeight: paginationInfo.viewportHeight ?? 0,
    visibleRange: paginationInfo.visibleRange ?? null,
    stats: paginationInfo.stats ?? null,
  };

  return (
    <SplitView testId="__prosemirror_devtools_tabs_pages__">
      <SplitViewCol grow>
        <Heading>Pagination Summary</Heading>
        <JSONTree data={summary} hideRoot />
      </SplitViewCol>
      <SplitViewCol grow sep>
        <Heading>Pages</Heading>
        <JSONTree data={paginationInfo.pages || []} hideRoot />
      </SplitViewCol>
    </SplitView>
  );
}

