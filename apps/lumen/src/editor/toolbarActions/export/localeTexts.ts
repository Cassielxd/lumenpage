import { createPlaygroundI18n, type PlaygroundLocale } from "../../i18n";

export const resolveExportLocaleTexts = (locale: PlaygroundLocale) =>
  createPlaygroundI18n(locale).exportActions;
