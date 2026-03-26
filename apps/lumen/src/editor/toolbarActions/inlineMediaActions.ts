import type { RequestToolbarInputDialog } from "./ui/inputDialog";
import { showToolbarMessage } from "./ui/message";
import type { GetEditorCommandMap } from "./commandUtils";
import { invokeCommand } from "./commandUtils";

type GetView = () => any;

type ToolbarTexts = {
  promptLinkUrl: string;
  alertLinkRequiresSelection: string;
  promptImageUrl: string;
  promptVideoUrl: string;
};

export const createInlineMediaActions = ({
  getView,
  getEditorCommands,
  getToolbarTexts,
  requestInputDialog,
}: {
  getView: GetView;
  getEditorCommands: GetEditorCommandMap;
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
      return invokeCommand(getEditorCommands()?.unsetLink);
    }
    const href = url.trim();
    if (empty) {
      let tr = view.state.tr.insertText(href, from, to);
      tr = tr.addMark(from, from + href.length, markType.create({ href, title: href }));
      view.dispatch(tr.scrollIntoView());
      return true;
    }
    const ok = invokeCommand(getEditorCommands()?.setLink, { href, title: href });
    if (!ok) {
      showToolbarMessage(toolbarTexts.alertLinkRequiresSelection, "warning");
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
    return invokeCommand(getEditorCommands()?.insertImage, { src, width: 320, height: 240 });
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
    return invokeCommand(getEditorCommands()?.insertVideo, { src, embed: false });
  };

  return {
    toggleLink,
    insertImage,
    insertVideo,
  };
};
