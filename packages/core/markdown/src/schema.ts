import { ExtensionManager, createSchema } from "lumenpage-core";
import { Image } from "lumenpage-extension-image";
import { Link } from "lumenpage-extension-link";
import { Table, TableCell, TableHeader, TableRow } from "lumenpage-extension-table";
import { Underline } from "lumenpage-extension-underline";
import { Video } from "lumenpage-extension-video";
import { StarterKit } from "lumenpage-starter-kit";

const markdownSchemaExtensions = [
  StarterKit,
  Underline,
  Link,
  Image,
  Video,
  Table,
  TableRow,
  TableCell,
  TableHeader,
] as const;

const extensionManager = new ExtensionManager(markdownSchemaExtensions);

export const schema = createSchema(extensionManager.resolveStructure());
