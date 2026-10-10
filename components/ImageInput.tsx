import React, { useRef, useState } from 'react';
import { uploadRecipeImage } from '../utils/storageUtils';
import { auth } from '../services/firebase';
import { Camera } from 'lucide-react';

interface ImageInputProps {
  recipeId: string; // Required for unique file naming
  onImageSelect: (downloadURL: string) => void; // Now returns Storage URL
  onError: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB limit for raw input, though we'll compress it


export const ImageInput: React.FC<ImageInputProps> = ({
  recipeId,
  onImageSelect,
  onError,
  disabled = false,
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      onError('Choose a photo: JPEG, PNG, WebP or HEIC.');
      return;
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE) {
      onError('That photo is too large. Choose one under 10 MB.');
      return;
    }

    // Check authentication
    const userId = auth.currentUser?.uid;
    if (!userId) {
      onError('Sign in again to upload photos.');
      return;
    }

    setIsUploading(true);
    try {
      // Upload compressed image to Firebase Storage
      const downloadURL = await uploadRecipeImage(file, userId, recipeId, 800, 800, 0.7);

      // Return the Storage URL
      onImageSelect(downloadURL);
    } catch (err) {
      console.error('Error uploading image:', err);
      onError("That photo couldn't be uploaded. Try again.");
    } finally {
      setIsUploading(false);
      // Clear input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const isDisabled = disabled || isUploading;

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleFileSelect}
        disabled={isDisabled}
        className="hidden"
        aria-label="Select food image"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isDisabled}
        className="btn-secondary btn-block"
      >
        {isUploading ? <span className="spinner spinner-sm" aria-hidden="true" /> : <Camera size={18} aria-hidden="true" />}
        <span>{isUploading ? 'Uploading…' : disabled ? 'Working…' : 'Take or upload a photo'}</span>
      </button>
    </div>
  );
};

