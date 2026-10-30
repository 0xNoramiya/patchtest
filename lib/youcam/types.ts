/** The eight SD concerns PatchTest requests. 5 to 8 SD concerns cost 12 units. */
export const SD_CONCERNS = [
  "acne",
  "redness",
  "oiliness",
  "moisture",
  "age_spot",
  "wrinkle",
  "texture",
  "skin_type",
] as const;

export type SdConcern = (typeof SD_CONCERNS)[number];

export type FitzpatrickScale = "I" | "II" | "III" | "IV" | "V" | "VI";

/**
 * One item of `data.results.output`. `raw_score` and `ui_score` both run 1 to 100
 * where higher is healthier. PatchTest decides on `raw_score` only: YouCam
 * documents `ui_score` as adjusted upward to be more favorable.
 */
export type SkinOutputItem = {
  type: string;
  region?: string;
  raw_score: number;
  ui_score: number;
  score?: number;
  mask_urls?: string[];
};

export type TaskStatus = "running" | "success" | "error";

export type SkinAnalysisResult = {
  task_status: TaskStatus;
  error?: string | null;
  error_message?: string;
  results?: { output: SkinOutputItem[] };
};

export type FitzpatrickResult = {
  task_status: TaskStatus;
  error?: string | null;
  error_message?: string;
  results?: { fitzpatrick_scale: FitzpatrickScale; timed?: number };
};

export type FileApiResponse = {
  status: number;
  data: {
    files: Array<{
      content_type: string;
      file_name: string;
      file_id: string;
      requests: Array<{ method: string; url: string; headers: Record<string, string> }>;
    }>;
  };
};

/** Image validation failures the engine reports, mapped to shopper-facing text. */
export const IMAGE_ERROR_MESSAGES: Record<string, string> = {
  error_src_face_too_small: "Move closer so your face fills most of the frame.",
  error_src_face_out_of_bound: "Center your face so none of it is cut off.",
  error_lighting_dark: "Find brighter, even light and try again.",
  error_below_min_image_size: "That photo is too small. Use at least 480 pixels on the short side.",
  error_exceed_max_image_size: "That photo is too large.",
  error_face_position_invalid: "Center your face so none of it is cut off.",
  error_face_position_too_small: "Move closer so your face fills most of the frame.",
  error_face_position_out_of_boundary: "Move back slightly so your whole face is in frame.",
  error_insufficient_lighting: "Find brighter, even light and try again.",
  error_face_angle_invalid: "Look straight at the camera and keep your head level.",
  error_no_face: "No face was found in that photo.",
  error_pose: "Look straight at the camera and keep your head level.",
};

export function shopperMessageFor(code: string | null | undefined): string {
  if (!code) return "That scan could not be completed. Try another photo.";
  return IMAGE_ERROR_MESSAGES[code] ?? "That photo could not be analyzed. Try another one.";
}
