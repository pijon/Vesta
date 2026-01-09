
/**
 * Compresses and resizes an image file to ensure it fits within Firestore limits.
 * 
 * @param file The image file to compress
 * @param maxWidth Maximum width of the output image
 * @param maxHeight Maximum height of the output image
 * @param quality Quality of the JPEG compression (0.0 - 1.0)
 * @returns Promise resolving to the base64 string of the compressed image
 */
export const compressImage = (
    file: File,
    maxWidth: number = 800,
    maxHeight: number = 800,
    quality: number = 0.7
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions while maintaining aspect ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                // Convert to base64 string with JPEG compression
                // remove the "data:image/jpeg;base64," prefix to match existing behavior if needed, 
                // but usually we want the prefix.
                // Looking at ImageInput.tsx: 
                // const base64 = result.split(',')[1];
                // So we should return just the base64 data without prefix to be consistent with existing fileToBase64

                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                const base64 = dataUrl.split(',')[1];
                resolve(base64);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};
