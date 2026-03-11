import { BlockIdExtension } from "lumenpage-extension-block-id";
import { StarterKit } from "lumenpage-starter-kit";
import { Image } from "lumenpage-extension-image";
import { Link } from "lumenpage-extension-link";
import { Table, TableCell, TableHeader, TableRow } from "lumenpage-extension-table";
import { Underline } from "lumenpage-extension-underline";
import { Video } from "lumenpage-extension-video";

export const playgroundDocumentExtensions = [
  StarterKit,
  BlockIdExtension,
  Underline,
  Link,
  Image,
  Video,
  Table,
  TableRow,
  TableCell,
  TableHeader,
] as const;
