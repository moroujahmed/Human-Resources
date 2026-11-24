import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { OnModuleDestroy } from "@nestjs/common";

@Injectable()
export class PrivateStorageService implements OnModuleDestroy {
  private cachedClient: S3Client | null | undefined;

  private client(): S3Client | null {
    if (this.cachedClient !== undefined) return this.cachedClient;
    const endpoint = process.env.S3_ENDPOINT;
    if (!endpoint || !process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) {
      this.cachedClient = null;
      return this.cachedClient;
    }
    this.cachedClient = new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      endpoint,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
      },
    });
    return this.cachedClient;
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const client = this.client();
    if (!client) throw new ServiceUnavailableException("PRIVATE_STORAGE_NOT_CONFIGURED");
    await client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    }));
    return key;
  }

  async signedDownloadUrl(key: string, originalFilename: string): Promise<string> {
    const client = this.client();
    if (!client) throw new ServiceUnavailableException("PRIVATE_STORAGE_NOT_CONFIGURED");
    const safeName = originalFilename.replace(/[\r\n"\\/]/g, "_").slice(0, 180) || "application-file";
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      ResponseCacheControl: "private, no-store",
    });
    return getSignedUrl(client, command, { expiresIn: 120 });
  }

  async delete(key: string): Promise<void> {
    const client = this.client();
    if (!client) return;
    await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
  }

  onModuleDestroy(): void {
    this.cachedClient?.destroy();
  }
}
