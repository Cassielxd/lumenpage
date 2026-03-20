export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    const shouldAppendJs =
      error?.code === "ERR_MODULE_NOT_FOUND" &&
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !specifier.endsWith(".js") &&
      !specifier.endsWith(".json") &&
      !specifier.endsWith(".node");

    if (!shouldAppendJs) {
      throw error;
    }

    return defaultResolve(`${specifier}.js`, context, defaultResolve);
  }
}
