/**
 * Compresses a Base64 image string by resizing and adjusting quality.
 * @param base64Str The raw Base64 string from FileReader
 * @param maxWidth Maximum width (default 600px)
 * @param maxHeight Maximum height (default 600px)
 * @param quality JPEG quality (0.1 to 1.0, default 0.7)
 * @returns Promise resolving to the compressed Base64 string
 */
export const compressImage = (base64Str: string, maxWidth = 600, maxHeight = 600, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Resize logic
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
