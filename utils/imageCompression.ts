/**
 * Compresses and resizes an image to reduce file size for Firestore storage
 * @param file The image file to compress
 * @param maxWidth Maximum width in pixels (default: 800)
 * @param maxHeight Maximum height in pixels (default: 800)
 * @param quality JPEG quality 0-1 (default: 0.8)
 * @returns Promise with compressed base64 string (without data URL prefix)
 */
export const compressImage = (
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        // Create canvas for resizing
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw resized image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed JPEG
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // Convert blob to base64
            const blobReader = new FileReader();
            blobReader.onload = () => {
              const result = blobReader.result as string;
              const base64 = result.split(',')[1]; // Remove data URL prefix
              resolve(base64);
            };
            blobReader.onerror = () => reject(new Error('Failed to read compressed image'));
            blobReader.readAsDataURL(blob);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

/**
 * Estimates the size of a base64 string in bytes
 */
export const getBase64Size = (base64: string): number => {
  // Remove data URL prefix if present
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;

  // Base64 encoding increases size by ~33%, so decode to get actual size
  const padding = (cleanBase64.match(/=/g) || []).length;
  return (cleanBase64.length * 3) / 4 - padding;
};

/**
 * Formats bytes to human-readable string
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};
