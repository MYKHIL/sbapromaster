/**
 * Upscales or compresses an image to ensure good quality for ImgBB hosting
 * MIN_DIMENSION: Minimum width/height to ensure good quality (default 600px)
 * MAX_SIZE: Maximum file size in bytes (5MB)
 * @param base64Str The raw Base64 string from FileReader
 * @param minDimension Minimum dimension to upscale to (default 600px)
 * @param quality JPEG quality (0.1 to 1.0, default 0.9 for high quality)
 * @returns Promise resolving to the processed Base64 string
 */
export const processImageForUpload = (
    base64Str: string,
    minDimension = 600,
    quality = 0.9
): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!base64Str || !base64Str.startsWith('data:image')) {
            resolve(base64Str);
            return;
        }

        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions (upscale if too small, preserve if good size)
            const currentMin = Math.min(width, height);

            if (currentMin < minDimension) {
                // Upscale to minimum dimension
                const scale = minDimension / currentMin;
                width = Math.round(width * scale);
                height = Math.round(height * scale);
                console.log(`[Image Processing] Upscaling from ${img.width}x${img.height} to ${width}x${height}`);
            } else {
                console.log(`[Image Processing] Preserving original size ${width}x${height}`);
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Enable high-quality image smoothing
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                const processedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(processedBase64);
            } else {
                reject(new Error("Canvas context is null"));
            }
        };
        img.onerror = (err) => reject(err);
    });
};

/**
 * Legacy compression function for backward compatibility
 * DEPRECATED: Use processImageForUpload instead
 */
export const compressImage = (
    base64Str: string,
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.85
): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!base64Str || !base64Str.startsWith('data:image')) {
            resolve(base64Str);
            return;
        }

        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Resize logic (maintain aspect ratio, only downscale)
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
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            } else {
                reject(new Error("Canvas context is null"));
            }
        };
        img.onerror = (err) => reject(err);
    });
};

/**
 * Get the size of a base64 string in bytes
 * @param base64String - The base64 data URI
 * @returns Size in bytes
 */
export const getBase64Size = (base64String: string): number => {
    if (!base64String) return 0;

    // Remove data URI prefix if present
    const base64Data = base64String.split(',')[1] || base64String;

    // Calculate size (base64 encoding increases size by ~33%)
    return Math.ceil((base64Data.length * 3) / 4);
};

/**
 * Format bytes to human-readable string
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.2 MB")
 */
export const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Validates file size is under 5MB
 * @param file - File object from input
 * @returns true if valid, false if too large
 */
export const validateImageSize = (file: File): boolean => {
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
        alert(`Image too large! Maximum size is 5MB. Your image is ${formatBytes(file.size)}.`);
        return false;
    }
    return true;
};

/**
 * Upload a base64 image to ImgBB and return the direct URL
 * Auto-compresses only if image exceeds 5MB (rare with client-side validation)
 * @param base64Str - The base64 string (with or without prefix)
 * @returns Promise resolving to the URL or null if failed
 */
export const uploadToImgBB = async (base64Str: string): Promise<string | null> => {
    try {
        const MAX_SIZE = 5 * 1024 * 1024;
        let imageToUpload = base64Str;
        const originalSize = getBase64Size(base64Str);

        // Only compress if exceeds 5MB (shouldn send happen with client validation)
        if (originalSize > MAX_SIZE) {
            console.log(`[ImgBB] Image too large (${formatBytes(originalSize)}). Compressing...`);
            imageToUpload = await compressImage(base64Str, 1200, 1200, 0.8);
            const newSize = getBase64Size(imageToUpload);

            if (newSize > MAX_SIZE) {
                console.log(`[ImgBB] Still too large (${formatBytes(newSize)}). Using aggressive compression...`);
                imageToUpload = await compressImage(base64Str, 800, 800, 0.7);
                const finalSize = getBase64Size(imageToUpload);

                if (finalSize > MAX_SIZE) {
                    console.error(`[ImgBB] Cannot compress below 5MB (${formatBytes(finalSize)}). Upload aborted.`);
                    return null;
                }
            }
            console.log(`[ImgBB] Compressed to ${formatBytes(getBase64Size(imageToUpload))}.`);
        }

        // Remove data URI prefix if present
        const cleanBase64 = imageToUpload.replace(/^data:image\/\w+;base64,/, '');

        const formData = new FormData();
        formData.append('image', cleanBase64);
        formData.append('key', '832ff651dde06b7313e9306c75542b99');

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData,
        });

        const json = await response.json();

        if (json.success && json.data && json.data.url) {
            return json.data.url;
        } else {
            console.error('[ImgBB] Upload failed:', json);
            return null;
        }
    } catch (error) {
        console.error('[ImgBB] Network error:', error);
        return null;
    }
};
