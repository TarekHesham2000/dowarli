/**
 * توافر الوحدة للإيجار — منفصل عن properties.status (active / pending / rejected).
 * يُزامَن مع عمود availability_status في قاعدة البيانات.
 * البلاغات الفردية في جدول `reports`؛ `report_count` و`under_review_at` و`last_action_by_broker` على `properties`.
 */
export type AvailabilityStatus = "available" | "rented" | "under_review";

export const AVAILABILITY_DEFAULT: AvailabilityStatus = "available";
