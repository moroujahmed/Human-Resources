CREATE TABLE "interview_panel_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "interview_id" UUID NOT NULL,
    "reviewer_user_id" UUID NOT NULL,
    "score" DECIMAL(3,2) NOT NULL,
    "feedback" TEXT NOT NULL,
    "recommendation" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "interview_panel_reviews_score_check" CHECK ("score" >= 1 AND "score" <= 5),
    CONSTRAINT "interview_panel_reviews_recommendation_check" CHECK ("recommendation" IN ('COMPLETED', 'ADVANCE', 'REJECT')),
    CONSTRAINT "interview_panel_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_interview_panel_reviews_reviewer"
ON "interview_panel_reviews"("interview_id", "reviewer_user_id");

ALTER TABLE "interview_panel_reviews"
ADD CONSTRAINT "interview_panel_reviews_interview_id_fkey"
FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "interview_panel_reviews"
ADD CONSTRAINT "interview_panel_reviews_reviewer_user_id_fkey"
FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
