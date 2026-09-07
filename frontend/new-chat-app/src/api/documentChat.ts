import { API_ENDPOINTS } from "@/utils/api";
import axiosInstance from "@/api/axios";

export interface UploadResult {
  success: boolean;
  message: string;
  document_key: string;
}

export const ALLOWED_DOCUMENT_EXTENSIONS = [".txt", ".pdf"] as const;
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export function validateDocument(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!ALLOWED_DOCUMENT_EXTENSIONS.some((ext) => name.endsWith(ext))) {
    return "පෙළ (.txt) හෝ PDF ගොනු පමණක් උඩුගත කළ හැක.";
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return "ගොනුව ඉතා විශාලය (උපරිමය 20MB).";
  }
  return null;
}

/**
 * Upload a document and get back the key that identifies it in later chats.
 *
 * Uses XHR rather than fetch because it is the only way to observe upload
 * progress, which the drop zone shows while a large PDF is in flight.
 */
export function uploadDocument(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadResult);
        } catch {
          reject(new Error("Malformed response from the document service"));
        }
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.open("POST", API_ENDPOINTS.FRAMEWORK_UPLOAD);
    const token = localStorage.getItem("subasa_access_token");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  });
}

export async function chatWithDocument(
  message: string,
  documentKey: string,
): Promise<string> {
  const response = await axiosInstance.post<{ response: string }>(
    API_ENDPOINTS.FRAMEWORK_CHAT,
    { message, document_key: documentKey },
  );
  return response.data.response;
}
