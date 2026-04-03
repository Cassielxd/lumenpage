import { AiAssistant } from "lumenpage-extension-ai";
import { Bookmark } from "lumenpage-extension-bookmark";
import { BlockIdExtension } from "lumenpage-extension-block-id";
import { Callout } from "lumenpage-extension-callout";
import { Comments } from "lumenpage-extension-comment";
import { Columns } from "lumenpage-extension-columns";
import { Audio } from "lumenpage-extension-audio";
import { EmbedPanel } from "lumenpage-extension-embed-panel";
import { File } from "lumenpage-extension-file";
import { Math } from "lumenpage-extension-math";
import { OptionBox } from "lumenpage-extension-option-box";
import { Signature } from "lumenpage-extension-signature";
import { Collaboration } from "lumenpage-extension-collaboration";
import {
  CollaborationCaret,
  type CollaborationCaretUser,
} from "lumenpage-extension-collaboration-caret";
import { UndoRedo } from "lumenpage-extension-undo-redo";
import { StarterKit } from "lumenpage-starter-kit";
import { Image } from "lumenpage-extension-image";
import { Link } from "lumenpage-extension-link";
import { PageBreak } from "lumenpage-extension-page-break";
import { Subscript } from "lumenpage-extension-subscript";
import { Superscript } from "lumenpage-extension-superscript";
import { Table, TableCell, TableHeader, TableRow } from "lumenpage-extension-table";
import { TaskItem } from "lumenpage-extension-task-item";
import { TaskList } from "lumenpage-extension-task-list";
import { Tag } from "lumenpage-extension-tag";
import { Template } from "lumenpage-extension-template";
import { TrackChanges } from "lumenpage-extension-track-change";
import { TextBox } from "lumenpage-extension-text-box";
import { TextStyle } from "lumenpage-extension-text-style";
import { Underline } from "lumenpage-extension-underline";
import { Video } from "lumenpage-extension-video";
import { WebPage } from "lumenpage-extension-web-page";

import { lumenCommentsStore } from "./commentsStore";
import { createLumenAiAssistantProvider } from "./aiAssistantProviders";
import type { PlaygroundLocale } from "./i18n";

export type LumenCollaborationExtensionsOptions = {
  document: any;
  field?: string;
  provider?: any | null;
  user: Record<string, any>;
  onUsersChange?: (users: CollaborationCaretUser[]) => void;
};

const baseDocumentExtensions = [
  BlockIdExtension,
  Audio,
  EmbedPanel,
  File,
  Bookmark,
  Callout,
  Columns,
  Comments.configure({
    store: lumenCommentsStore,
    showResolved: true,
  }),
  TrackChanges,
  Math,
  OptionBox,
  Signature,
  Underline,
  Link,
  Tag,
  Template,
  TextBox,
  TextStyle,
  Subscript,
  Superscript,
  Image,
  Video,
  WebPage,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  TableHeader,
  TaskList,
  TaskItem,
] as const;

export const createLumenDocumentExtensions = (
  options: {
    collaboration?: LumenCollaborationExtensionsOptions | null;
    locale?: PlaygroundLocale;
  } = {}
) => {
  const collaboration = options.collaboration ?? null;
  const locale = options.locale || "zh-CN";
  const starterKit = StarterKit.configure({ undoRedo: false });
  const extensions = [
    starterKit,
    ...(collaboration ? [] : [UndoRedo]),
    AiAssistant.configure({
      provider: createLumenAiAssistantProvider({
        locale,
      }),
    }),
    ...baseDocumentExtensions,
  ];

  if (collaboration) {
    extensions.push(
      Collaboration.configure({
        document: collaboration.document,
        field: collaboration.field || "default",
      })
    );
    if (collaboration.provider) {
      extensions.push(
        CollaborationCaret.configure({
          provider: collaboration.provider,
          user: collaboration.user,
          onUpdate: collaboration.onUsersChange || (() => undefined),
        })
      );
    }
  }

  return extensions;
};

export const lumenDocumentExtensions = createLumenDocumentExtensions();
