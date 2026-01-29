import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { compressImageToBlob } from './imageCompression';

/**
 * Uploads an image file to Firebase Storage and returns the download URL
 * @param file The image file to upload
 * @param userId The user ID (for path construction)
 * @param recipeId The recipe ID (for unique file naming)
 * @param maxWidth Maximum width in pixels (default: 800)
 * @param maxHeight Maximum height in pixels (default: 800)
 * @param quality JPEG quality 0-1 (default: 0.7)
 * @returns Promise with the Firebase Storage download URL
 */
export const uploadRecipeImage = async (
    file: File,
    userId: string,
    recipeId: string,
    maxWidth: number = 800,
    maxHeight: number = 800,
    quality: number = 0.7
): Promise<string> => {
    try {
        // 1. Compress the image to a Blob
        const blob = await compressImageToBlob(file, maxWidth, maxHeight, quality);

        // 2. Determine file extension from MIME type
        const mimeType = blob.type || 'image/jpeg';
        const ext = mimeType.split('/')[1] || 'jpg';

        // 3. Create Storage reference with unique path
        const storageRef = ref(storage, `users/${userId}/recipe-images/${recipeId}.${ext}`);

        // 4. Upload to Firebase Storage
        await uploadBytes(storageRef, blob, {
            contentType: mimeType,
            cacheControl: 'public, max-age=31536000' // 1 year cache
        });

        // 5. Get and return download URL
        const downloadURL = await getDownloadURL(storageRef);

        console.log(`✅ Uploaded recipe image: ${(blob.size / 1024).toFixed(1)}KB`);
        return downloadURL;
    } catch (error) {
        console.error('Failed to upload recipe image:', error);
        throw new Error('Failed to upload image to Storage. Please try again.');
    }
};
