import { BlockIdExtension } from "lumenpage-extension-block-id";
import { Collaboration } from "lumenpage-extension-collaboration";
import {
  CollaborationCaret,
  type CollaborationCaretUser,
} from "lumenpage-extension-collaboration-caret";
import { DocumentLock } from "lumenpage-extension-document-lock";
import { Image } from "lumenpage-extension-image";
import { Link } from "lumenpage-extension-link";
import { Table, TableCell, TableHeader, TableRow } from "lumenpage-extension-table";
import { Underline } from "lumenpage-extension-underline";
import { Video } from "lumenpage-extension-video";
import { StarterKit } from "lumenpage-starter-kit";

export type PlaygroundCollaborationExtensionsOptions = {
  document: any;
  field?: string;
  provider: any;
  user: Record<string, any>;
  onUsersChange?: (users: CollaborationCaretUser[]) => void;
};

const baseDocumentExtensions = [
  BlockIdExtension,
  DocumentLock,
  Underline,
  Link,
  Image,
  Video,
  Table,
  TableRow,
  TableCell,
  TableHeader,
] as const;

export const createPlaygroundDocumentExtensions = (
  options: {
    collaboration?: PlaygroundCollaborationExtensionsOptions | null;
  } = {}
) => {
  const collaboration = options.collaboration ?? null;
  const starterKit = collaboration ? StarterKit.configure({ undoRedo: false }) : StarterKit;
  const extensions = [starterKit, ...baseDocumentExtensions];

  if (collaboration) {
    extensions.push(
      Collaboration.configure({
        document: collaboration.document,
        field: collaboration.field || "default",
        provider: collaboration.provider,
      }),
      CollaborationCaret.configure({
        provider: collaboration.provider,
        user: collaboration.user,
        onUpdate: collaboration.onUsersChange || (() => undefined),
      })
    );
  }

  return extensions;
};

export const playgroundDocumentExtensions = createPlaygroundDocumentExtensions();
