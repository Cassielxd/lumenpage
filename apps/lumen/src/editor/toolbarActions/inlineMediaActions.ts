import type { RequestToolbarInputDialog } from "./ui/inputDialog";
import { resolveImageInsertAttrs } from "./mediaDimensions";

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
  requestInputDialog,
}: {
  getView: GetView;
  run: RunCommand;
  getToolbarTexts: () => ToolbarTexts;
  requestInputDialog: RequestToolbarInputDialog;
}) => {
  const toggleLink = async () => {
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
    const result = await requestInputDialog({
      title: "Link",
      fields: [
        {
          key: "url",
          label: toolbarTexts.promptLinkUrl,
          defaultValue,
        },
      ],
    });
    if (!result) {
      return false;
    }
    const url = String(result.url || "");
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

  const insertImage = async () => {
    const toolbarTexts = getToolbarTexts();
    const result = await requestInputDialog({
      title: "Image",
      fields: [{ key: "src", label: toolbarTexts.promptImageUrl, defaultValue: "", required: true }],
    });
    if (!result?.src) {
      return false;
    }
    const src = String(result.src || "").trim();
    if (!src) {
      return false;
    }
    return run("insertImage", await resolveImageInsertAttrs({ src }));
  };

  const insertVideo = async () => {
    const toolbarTexts = getToolbarTexts();
    const result = await requestInputDialog({
      title: "Video",
      fields: [{ key: "src", label: toolbarTexts.promptVideoUrl, defaultValue: "", required: true }],
    });
    if (!result?.src) {
      return false;
    }
    const src = String(result.src || "").trim();
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
