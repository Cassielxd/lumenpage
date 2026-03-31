# lumenpage-extension-ai

AI assistant runtime extension for LumenPage.

It keeps the editor-side contract small:

- the extension owns provider/runtime/storage lifecycle
- apps pass in a provider function
- UI layers call the storage API or editor commands

The bundled demo provider is local and deterministic. Replace it with a real model
provider in app code when needed.
