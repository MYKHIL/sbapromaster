/**
 * Compresses a Base64 image string by resizing and adjusting quality.
 * AGGRESSIVE COMPRESSION: Optimized for bucket storage (target: 10-20KB per image)
 * @param base64Str The raw Base64 string from FileReader
 * @param maxWidth Maximum width (default 150px for bucket-safe profile photos)
 * @param maxHeight Maximum height (default 150px for bucket-safe profile photos)
 * @param quality JPEG quality (0.1 to 1.0, default 0.7 for aggressive compression)
 * @returns Promise resolving to the compressed Base64 string
 */
export const compressImage = (base64Str: string, maxWidth = 120, maxHeight = 120, quality = 0.6): Promise<string> => {
    return new Promise((resolve, reject) => {
        // If not a valid base64 image, return as-is
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

            // Resize logic (maintain aspect ratio)
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
                // Compress to JPEG
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
