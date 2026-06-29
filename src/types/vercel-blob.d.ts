declare module "@vercel/blob" {
  export type BlobAccess = "public" | "private";

  export type BlobPutResult = {
    url: string;
    pathname: string;
  };

  export type BlobGetResult = {
    url: string;
    pathname: string;
    size: number;
    uploadedAt: Date;
    contentType: string;
    contentDisposition: string;
    cacheControl: string;
    statusCode: number;
    stream: ReadableStream<Uint8Array> | null;
  } | null;

  export function put(
    pathname: string,
    body: Blob | ArrayBuffer | ArrayBufferView | Buffer | string,
    options?: {
      access?: BlobAccess;
      contentType?: string;
      addRandomSuffix?: boolean;
    },
  ): Promise<BlobPutResult>;

  export function get(
    url: string,
    options?: { access?: BlobAccess },
  ): Promise<BlobGetResult>;

  export function del(url: string): Promise<void>;
}

declare module "@vercel/blob/client" {
  export type ClientUploadResult = {
    url: string;
    pathname: string;
  };

  export function upload(
    pathname: string,
    body: Blob,
    options: {
      access?: "public" | "private";
      handleUploadUrl: string;
      contentType?: string;
    },
  ): Promise<ClientUploadResult>;

  export function handleUpload(input: {
    request: Request;
    body: unknown;
    onBeforeGenerateToken: (pathname: string) => Promise<{
      allowedContentTypes?: string[];
      maximumSizeInBytes?: number;
      addRandomSuffix?: boolean;
    }>;
    onUploadCompleted?: (payload: {
      blob: { url: string; pathname: string };
    }) => Promise<void>;
  }): Promise<unknown>;
}
