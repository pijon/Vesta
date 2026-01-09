import React, { useRef } from 'react';

interface ImageInputProps {
  onImageSelect: (base64: string, mimeType: string) => void;
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

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

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

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get just base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const ImageInput: React.FC<ImageInputProps> = ({
  onImageSelect,
  onError,
  disabled = false,
  className = ''
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    try {
      const base64 = await fileToBase64(file);
      onImageSelect(base64, file.type);
    } catch (err) {
      console.error('Error reading file:', err);
      onError('Failed to read image. Please try again.');
    } finally {
      // Clear input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        onChange={handleFileSelect}
        disabled={disabled}
        className="hidden"
        aria-label="Select food image"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-white transition-all shadow-sm ${
          disabled
            ? 'bg-slate-300 cursor-not-allowed'
            : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
        }`}
      >
        <CameraIcon />
        <span>{disabled ? 'Analyzing...' : 'Take or Upload Photo'}</span>
      </button>
    </div>
  );
};
