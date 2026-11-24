CREATE UNIQUE INDEX "uq_performance_reviews_employee_period"
ON "performance_reviews"("employee_id", "review_period");
