ALTER TABLE "job_offers"
ADD COLUMN "response_token_hash" CHAR(64);

CREATE UNIQUE INDEX "uq_job_offers_response_token_hash"
ON "job_offers"("response_token_hash");
