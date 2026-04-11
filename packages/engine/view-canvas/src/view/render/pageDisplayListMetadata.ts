export const syncRendererPageDisplayListMetadata = ({
  page,
  displayList,
  getPageLayoutVersionToken,
  setPageRenderSignature,
  setPageRenderSignatureVersion,
}: {
  page: any;
  displayList: { signature: number | null } | null;
  getPageLayoutVersionToken: (page: any) => number | null;
  setPageRenderSignature: (page: any, signature: number | null) => void;
  setPageRenderSignatureVersion: (page: any, version: number | null) => void;
}) => {
  if (!page) {
    return;
  }

  const layoutVersion = getPageLayoutVersionToken(page);
  setPageRenderSignature(page, displayList?.signature ?? null);
  if (layoutVersion != null) {
    setPageRenderSignatureVersion(page, layoutVersion);
  }
};
