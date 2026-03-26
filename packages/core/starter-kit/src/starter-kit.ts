import { Extension } from "lumenpage-core";
import {
  Blockquote,
  Bold,
  BulletList,
  Code,
  CodeBlock,
  Document,
  HardBreak,
  Heading,
  HorizontalRule,
  Italic,
  ListItem,
  OrderedList,
  Paragraph,
  SmartInputRules,
  Strike,
  Text,
  UndoRedo,
} from "./extensions";

type ExtensionOptions = Record<string, any> | false;

export interface StarterKitOptions {
  blockquote: ExtensionOptions;
  bold: ExtensionOptions;
  bulletList: ExtensionOptions;
  code: ExtensionOptions;
  codeBlock: ExtensionOptions;
  document: ExtensionOptions;
  hardBreak: ExtensionOptions;
  heading: ExtensionOptions;
  horizontalRule: ExtensionOptions;
  italic: ExtensionOptions;
  listItem: ExtensionOptions;
  orderedList: ExtensionOptions;
  paragraph: ExtensionOptions;
  strike: ExtensionOptions;
  text: ExtensionOptions;
  undoRedo: ExtensionOptions;
}

const configureExtension = (extension, options) => extension.configure(options || {});

export const StarterKit = Extension.create<StarterKitOptions>({
  name: "starterKit",
  addOptions() {
    return {
      blockquote: {},
      bold: {},
      bulletList: {},
      code: {},
      codeBlock: {},
      document: {},
      hardBreak: {},
      heading: {},
      horizontalRule: {},
      italic: {},
      listItem: {},
      orderedList: {},
      paragraph: {},
      strike: {},
      text: {},
      undoRedo: {},
    };
  },
  addExtensions() {
    const extensions = [];
    const listEnabled = this.options.bulletList !== false || this.options.orderedList !== false;

    if (this.options.document !== false) extensions.push(configureExtension(Document, this.options.document));
    if (this.options.text !== false) extensions.push(configureExtension(Text, this.options.text));
    if (this.options.paragraph !== false) extensions.push(configureExtension(Paragraph, this.options.paragraph));
    if (this.options.heading !== false) extensions.push(configureExtension(Heading, this.options.heading));
    if (this.options.blockquote !== false) extensions.push(configureExtension(Blockquote, this.options.blockquote));
    if (this.options.codeBlock !== false) extensions.push(configureExtension(CodeBlock, this.options.codeBlock));
    if (this.options.horizontalRule !== false) extensions.push(configureExtension(HorizontalRule, this.options.horizontalRule));
    if (this.options.hardBreak !== false) extensions.push(configureExtension(HardBreak, this.options.hardBreak));
    if (this.options.listItem !== false || listEnabled) {
      extensions.push(configureExtension(ListItem, this.options.listItem === false ? {} : this.options.listItem));
    }
    if (this.options.bulletList !== false) extensions.push(configureExtension(BulletList, this.options.bulletList));
    if (this.options.orderedList !== false) extensions.push(configureExtension(OrderedList, this.options.orderedList));
    if (this.options.bold !== false) extensions.push(configureExtension(Bold, this.options.bold));
    if (this.options.italic !== false) extensions.push(configureExtension(Italic, this.options.italic));
    if (this.options.code !== false) extensions.push(configureExtension(Code, this.options.code));
    if (this.options.strike !== false) extensions.push(configureExtension(Strike, this.options.strike));
    if (this.options.undoRedo !== false) extensions.push(configureExtension(UndoRedo, this.options.undoRedo));
    extensions.push(configureExtension(SmartInputRules, {}));

    return extensions;
  },
});

export default StarterKit;