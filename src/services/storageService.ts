/**
 * Storage Service: High-performance Persistent Storage for Audio & Media Blobs
 * Uses Cloudinary for persistent, scalable cloud storage.
 */

export class StorageService {
  /**
   * Internal helper to upload to Cloudinary using Unsigned Uploads via REST API.
   */
  private static async uploadToCloudinary(file: Blob | File, resourceType: 'auto' | 'image' | 'video'): Promise<string> {
    const cloudName = (import.meta as any).env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = (import.meta as any).env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error('Cloudinary configuration is missing in environment variables.');
    }

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Cloudinary upload failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.secure_url;
  }

  /**
   * Save an audio Blob (or File) to Cloudinary
   * @returns The secure HTTPS URL of the uploaded audio.
   */
  public static async saveAudioBlob(id: string, blob: Blob | File): Promise<string> {
    // Cloudinary treats audio files as 'video' resource type
    return this.uploadToCloudinary(blob, 'video');
  }

  /**
   * Save an image Blob (or File) to Cloudinary
   * @returns The secure HTTPS URL of the uploaded image.
   */
  public static async saveImageBlob(id: string, blob: Blob | File): Promise<string> {
    return this.uploadToCloudinary(blob, 'image');
  }

  /**
   * Resolve any URL into a playable URL string
   * (Since we now use direct HTTPS Cloudinary URLs, this is just a passthrough, 
   * but kept for backwards compatibility with the rest of the app).
   */
  public static async resolveMediaUrl(url: string): Promise<string> {
    return url;
  }

  /**
   * Delete media
   * Note: Deleting from Cloudinary client-side requires a signature and is not supported 
   * via unsigned uploads. For a fully robust solution, this should be done via a secure backend.
   * We will mock this or leave it as a no-op for now.
   */
  public static async deleteMedia(keyWithPrefix: string): Promise<void> {
    console.warn('Deleting media directly from client is not supported with unsigned Cloudinary uploads.');
    return Promise.resolve();
  }
}
