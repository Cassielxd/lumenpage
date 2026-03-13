export type SignatureDialogRequest = {
  defaultSigner?: string;
};

export type SignatureDialogResult = {
  src: string;
  signer: string;
  signedAt: string;
  width: number;
  height: number;
  strokeWidth?: number;
  strokeColor?: string;
  backgroundColor?: string;
};

export type RequestToolbarSignatureDialog = (
  request: SignatureDialogRequest
) => Promise<SignatureDialogResult | null>;
