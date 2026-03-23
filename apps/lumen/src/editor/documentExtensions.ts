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

export const lumenDocumentExtensions = [
  StarterKit,
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
