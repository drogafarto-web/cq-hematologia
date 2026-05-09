/**
 * StripUploadComponent.tsx
 * Phase 5 Task 05-03: IA Strip Image Upload UI
 *
 * Features:
 * - Desktop file picker (JPG/PNG, max 5MB)
 * - Mobile PWA camera integration
 * - Image preview + metadata display
 * - Classify button with loading state
 * - Dark-first design (Tailwind)
 */

import React, { useState, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
import { functions, storage } from '@shared/firebase';
import type { Classification } from '../types';

interface StripUploadProps {
  labId: string;
  runId: string;
  testKit: 'HIV' | 'Dengue' | 'Syphilis' | 'COVID' | 'HCG';
  onClassificationComplete: (result: ClassificationResult) => void;
}

interface ImageMetadata {
  width: number;
  height: number;
  fileSize: number;
  filename: string;
  mimeType: string;
  isCamera: boolean;
}

interface ClassificationResult {
  classification: Classification;
  confidence: number;
  reasoning: string;
  flaggedForManualReview: boolean;
  recommendedAction: 'AUTO_SAVE' | 'MANUAL_REVIEW';
}

/**
 * StripUploadComponent: Upload and classify immunology test strips
 */
export const StripUploadComponent: React.FC<StripUploadProps> = ({
  labId,
  runId,
  testKit,
  onClassificationComplete,
}) => {
  // State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [metadata, setMetadata] = useState<ImageMetadata | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [error, setError] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);

  /**
   * Handle file selection from file picker or camera
   */
  const handleFileSelected = async (file: File) => {
    setError('');

    // Validate file type
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('Only JPEG and PNG images are supported');
      return;
    }

    // Validate file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`);
      return;
    }

    setSelectedFile(file);

    // Read image for preview and metadata
    const reader = new FileReader();
    reader.onload = async (e) => {
      const img = e.target?.result as string;
      setPreview(img);

      // Extract image dimensions
      const imgElement = new Image();
      imgElement.onload = () => {
        setMetadata({
          width: imgElement.width,
          height: imgElement.height,
          fileSize: file.size,
          filename: file.name,
          mimeType: file.type,
          isCamera: file.name.includes('camera') || file.name.startsWith('blob'),
        });
      };
      imgElement.src = img;
    };

    reader.readAsDataURL(file);
  };

  /**
   * Resize image to 1080p width while preserving aspect ratio
   */
  const resizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1080;

          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = (height * MAX_WIDTH) / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Failed to resize image'));
              }
            },
            'image/jpeg',
            0.95
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  /**
   * Upload image to Firebase Storage and classify
   */
  const handleClassify = async () => {
    if (!selectedFile || !metadata) {
      setError('No image selected');
      return;
    }

    setIsClassifying(true);
    setError('');

    try {
      // Step 1: Resize image
      setUploadProgress(10);
      const resizedBlob = await resizeImage(selectedFile);

      // Step 2: Upload to Firebase Storage
      setUploadProgress(30);
      const timestamp = Date.now();
      const imagePath = `labs/${labId}/imuno-ias-dev/${runId}/${timestamp}.jpg`;
      const imageRef = ref(storage, imagePath);

      await uploadBytes(imageRef, resizedBlob, {
        contentType: 'image/jpeg',
        customMetadata: {
          originalName: selectedFile.name,
          testKit,
          uploadedAt: new Date().toISOString(),
        },
      });

      // Step 3: Get signed URL (24h expiry)
      setUploadProgress(50);
      const imageBytes = await getBytes(imageRef);
      const imageBase64 = Buffer.from(imageBytes).toString('base64');

      // For now, construct the signed URL request (in production, use getSignedUrl)
      // This is a simplified version - actual implementation would use Cloud Function
      const imageUrl = `https://firebasestorage.googleapis.com/v0/b/hmatologia2.appspot.com/o/${encodeURIComponent(imagePath)}?alt=media`;

      // Step 4: Call Gemini classification
      setUploadProgress(70);
      const classifyStripGemini = httpsCallable(functions, 'classifyStripGemini');

      const result = await classifyStripGemini({
        labId,
        runId,
        imageUrl,
        testKit,
      });

      setUploadProgress(100);

      // Return result to parent
      onClassificationComplete(result.data as ClassificationResult);

      // Reset form
      setTimeout(() => {
        setSelectedFile(null);
        setPreview('');
        setMetadata(null);
        setUploadProgress(0);
      }, 500);
    } catch (err) {
      setError(
        `Classification failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
      setIsClassifying(false);
    }
  };

  /**
   * Trigger file picker
   */
  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  /**
   * Trigger camera (PWA)
   */
  const handleOpenCamera = () => {
    cameraInputRef.current?.click();
  };

  /**
   * Reset form
   */
  const handleCancel = () => {
    setSelectedFile(null);
    setPreview('');
    setMetadata(null);
    setError('');
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      {/* Upload area */}
      {!preview ? (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center bg-gray-900">
            <div className="text-gray-400 mb-4">
              <svg
                className="mx-auto h-12 w-12 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-lg font-medium">Upload {testKit} Test Strip</p>
              <p className="text-sm text-gray-500 mt-1">
                JPEG or PNG, max 5MB
              </p>
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={handlePickFile}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition"
              >
                Choose File
              </button>
              <button
                onClick={handleOpenCamera}
                className="px-6 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition"
              >
                Take Photo
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) handleFileSelected(file);
              }}
              className="hidden"
            />

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0];
                if (file) handleFileSelected(file);
              }}
              className="hidden"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900 border border-red-700 rounded-lg text-red-100 text-sm">
              {error}
            </div>
          )}
        </div>
      ) : (
        /* Image preview */
        <div className="space-y-4">
          <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-contain"
            />
          </div>

          {/* Metadata */}
          {metadata && (
            <div className="grid grid-cols-2 gap-2 p-3 bg-gray-900 rounded-lg text-sm text-gray-400">
              <div>
                <span className="font-medium">Dimensions:</span>
                {metadata.width} × {metadata.height}px
              </div>
              <div>
                <span className="font-medium">Size:</span>
                {(metadata.fileSize / 1024).toFixed(1)}KB
              </div>
              <div>
                <span className="font-medium">Format:</span>
                {metadata.mimeType.split('/')[1].toUpperCase()}
              </div>
              <div>
                <span className="font-medium">Source:</span>
                {metadata.isCamera ? 'Camera' : 'File'}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleClassify}
              disabled={isClassifying}
              className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
            >
              {isClassifying ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Classifying... {uploadProgress}%
                </span>
              ) : (
                'Classify Image'
              )}
            </button>
            <button
              onClick={handleCancel}
              disabled={isClassifying}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition"
            >
              Cancel
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-900 border border-red-700 rounded-lg text-red-100 text-sm">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StripUploadComponent;
