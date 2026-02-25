type GetView = () => any;
type RunCommand = (name: string, ...args: unknown[]) => boolean;

type ToolbarTexts = {
  promptLinkUrl: string;
  alertLinkRequiresSelection: string;
  promptImageUrl: string;
  promptVideoUrl: string;
};

export const createInlineMediaActions = ({
  getView,
  run,
  getToolbarTexts,
}: {
  getView: GetView;
  run: RunCommand;
  getToolbarTexts: () => ToolbarTexts;
}) => {
  const toggleLink = () => {
    const view = getView();
    if (!view) {
      return false;
    }
    const markType = view.state.schema.marks.link;
    if (!markType) {
      return false;
    }
    const { from, to, empty, $cursor } = view.state.selection as any;
    const hasLink = empty
      ? !!markType.isInSet(view.state.storedMarks || $cursor?.marks() || [])
      : view.state.doc.rangeHasMark(from, to, markType);
    const defaultValue = hasLink ? "" : "https://";
    const toolbarTexts = getToolbarTexts();
    const url = window.prompt(toolbarTexts.promptLinkUrl, defaultValue);
    if (url === null) {
      return false;
    }
    if (!url.trim()) {
      return run("toggleLink");
    }
    const href = url.trim();
    if (empty) {
      let tr = view.state.tr.insertText(href, from, to);
      tr = tr.addMark(from, from + href.length, markType.create({ href, title: href }));
      view.dispatch(tr.scrollIntoView());
      return true;
    }
    const ok = run("toggleLink", { href, title: href });
    if (!ok) {
      window.alert(toolbarTexts.alertLinkRequiresSelection);
    }
    return ok;
  };

  const insertImage = () => {
    const toolbarTexts = getToolbarTexts();
    const src = window.prompt(toolbarTexts.promptImageUrl, "");
    if (!src) {
      return false;
    }
    return run("insertImage", { src });
  };

  const insertVideo = () => {
    const toolbarTexts = getToolbarTexts();
    const src = window.prompt(toolbarTexts.promptVideoUrl, "");
    if (!src) {
      return false;
    }
    return run("insertVideo", { src, embed: false });
  };

  return {
    toggleLink,
    insertImage,
    insertVideo,
  };
};
