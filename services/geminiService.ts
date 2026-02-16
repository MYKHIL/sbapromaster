import axios from 'axios';

// Remove direct GoogleGenAI logic. 
// We now proxy everything through our Vercel API to hide the API KEY.

export const generateTeacherRemark = async (studentName: string, performanceSummary: string, customPrompt?: string): Promise<string> => {
  const prompt = customPrompt || `Generate a brief, encouraging, and constructive teacher's remark for a student named ${studentName}. The student's performance is as follows: ${performanceSummary}. The remark should be about 15-25 words.`;

  try {
    const response = await axios.post('/api/gemini-proxy', {
      type: 'remark',
      prompt
    });

    return response.data.text || "Could not generate remark.";
  } catch (error) {
    console.error("Error generating remark via proxy:", error);
    return "Could not generate remark at this time.";
  }
};

export const enhanceImage = async (base64ImageData: string): Promise<string> => {
  const mimeTypeMatch = base64ImageData.match(/^data:(image\/\w+);base64,/);
  if (!mimeTypeMatch) {
    throw new Error("Invalid base64 image data format. Please upload a valid image.");
  }

  // We send the full base64 string (including header) or strip it? 
  // The proxy strips it. Let's send the full string or just the data.
  // The proxy expects 'image' property.

  const enhancementPrompt = `Your task is to professionally enhance the provided image for use on a school report card. Analyze the content and apply the appropriate edits based on whether it is a student's portrait, a signature, or a school logo.

**1. If the image is a student's portrait:**
   - **Goal:** Edit the photo to look as if it were taken in a professional photography studio with high-end equipment. The final result should be studio-quality, suitable for a passport or official ID.
   - **Camera & Studio Simulation:** Enhance the image as if it were captured with a Sony A7 IV camera using a prime G Master lens. Simulate a professional studio environment with soft, diffused three-point lighting to create a flattering and realistic portrait.
   - **Background:** Completely remove the original background and replace it with a solid, uniform, pure white background. The result must be clean and professional.
   - **Lighting & Color:** Adjust the lighting to be balanced and even, removing harsh shadows from the face. Correct the color balance to ensure natural and realistic skin tones. Enhance brightness and contrast for a clear, vibrant look.
   - **Composition:** Crop and center the subject so their head and shoulders are clearly visible, and they are facing forward.
   - **Quality:** Subtly sharpen the focus on the subject's face. Remove minor blemishes if possible, but maintain a natural appearance. Do not apply any artistic filters.

**2. If the image is a signature or a logo:**
   - **Goal:** Digitize and restore the image to a vector-like quality, as if it were professionally scanned and remastered in a design studio.
   - **Studio Quality Simulation:** Treat the image as if it's being prepared for high-resolution printing. Lines should be smooth, crisp, and artifact-free.
   - **Background:** Completely remove the original background (including any paper texture, shadows, or noise) and replace it with a solid, uniform, pure white background (#FFFFFF).
   - **Enhancement:** Increase the thickness and boldness of the lines to ensure they are solid and clear. Convert signatures to a single, solid, dark color (e.g., black or dark blue). For logos, restore the original colors, making them vibrant and consistent.
   - **Clean-up:** Remove all smudges, pixelation, and compression artifacts. Ensure the edges are sharp and well-defined.

**3. Final Output Rules (Apply to all):**
   - **Preserve Proportions:** Do not stretch or distort the main subject. Maintain the original aspect ratio.
   - **Image Only:** Your response MUST contain only the final, edited image. Do not include any text, explanations, or chat.`;

  try {
    const response = await axios.post('/api/gemini-proxy', {
      type: 'image',
      image: base64ImageData,
      prompt: enhancementPrompt
    });

    // Parse the candidates to find the image
    // The proxy returns { text, candidates }
    const candidates = response.data.candidates;

    if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    throw new Error("No image was returned from the AI enhancement service.");

  } catch (error) {
    console.error("Error enhancing image via proxy:", error);
    throw new Error("Could not enhance image at this time.");
  }
};