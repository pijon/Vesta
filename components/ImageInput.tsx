import React, { useRef, useState } from 'react';
import { uploadRecipeImage } from '../utils/storageUtils';
import { auth } from '../services/firebase';

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

const CameraIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

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
      onError('Please select a valid image file (JPEG, PNG, WebP, HEIC)');
      return;
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE) {
      onError('Image too large. Please select an image under 10MB.');
      return;
    }

    // Check authentication
    const userId = auth.currentUser?.uid;
    if (!userId) {
      onError('You must be logged in to upload images.');
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
      onError('Failed to upload image. Please try again.');
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
        className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-white transition-all shadow-sm ${isDisabled
          ? 'bg-muted/30 cursor-not-allowed'
          : 'bg-primary hover:bg-primary-hover active:scale-95'
          }`}
      >
        {isUploading ? (
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <CameraIcon />
        )}
        <span>
          {isUploading
            ? 'Uploading to Cloud...'
            : disabled
              ? 'Analyzing...'
              : 'Take or Upload Photo'}
        </span>
      </button>
    </div>
  );
};

