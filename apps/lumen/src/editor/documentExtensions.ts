import { BlockIdExtension } from "lumenpage-extension-block-id";
import { StarterKit } from "lumenpage-starter-kit";
import { Image } from "lumenpage-extension-image";
import { Link } from "lumenpage-extension-link";
import { PageBreak } from "lumenpage-extension-page-break";
import { Subscript } from "lumenpage-extension-subscript";
import { Superscript } from "lumenpage-extension-superscript";
import { Table, TableCell, TableHeader, TableRow } from "lumenpage-extension-table";
import { TaskItem } from "lumenpage-extension-task-item";
import { TaskList } from "lumenpage-extension-task-list";
import { TextStyle } from "lumenpage-extension-text-style";
import { Underline } from "lumenpage-extension-underline";
import { Video } from "lumenpage-extension-video";

export const lumenDocumentExtensions = [
  StarterKit,
  BlockIdExtension,
  Underline,
  Link,
  TextStyle,
  Subscript,
  Superscript,
  Image,
  Video,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  TableHeader,
  TaskList,
  TaskItem,
] as const;
