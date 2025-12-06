import { GoogleGenAI, Modality } from "@google/genai";

// Ensure the API key is handled according to the guidelines.
// Using Vite's import.meta.env for browser compatibility
const API_KEY = import.meta.env.VITE_API_KEY;

if (!API_KEY) {
  console.warn("Gemini API key not found. AI features will be disabled.");
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export const generateTeacherRemark = async (studentName: string, performanceSummary: string, customPrompt?: string): Promise<string> => {
  if (!ai) {
    return "AI service is not available.";
  }

  const prompt = customPrompt || `Generate a brief, encouraging, and constructive teacher's remark for a student named ${studentName}. The student's performance is as follows: ${performanceSummary}. The remark should be about 15-25 words.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error generating remark with Gemini API:", error);
    return "Could not generate remark at this time.";
  }
};

export const enhanceImage = async (base64ImageData: string): Promise<string> => {
  if (!ai) {
    throw new Error("AI service is not available.");
  }

  const mimeTypeMatch = base64ImageData.match(/^data:(image\/\w+);base64,/);
  if (!mimeTypeMatch) {
    throw new Error("Invalid base64 image data format. Please upload a valid image.");
  }
  const mimeType = mimeTypeMatch[1];
  const pureBase64 = base64ImageData.substring(mimeTypeMatch[0].length);

  const imagePart = {
    inlineData: {
      mimeType,
      data: pureBase64,
    },
  };

  const textPart = {
    text: `Your task is to professionally enhance the provided image for use on a school report card. Analyze the content and apply the appropriate edits based on whether it is a student's portrait, a signature, or a school logo.

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
   - **Image Only:** Your response MUST contain only the final, edited image. Do not include any text, explanations, or chat.`,
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image was returned from the AI enhancement service.");

  } catch (error) {
    console.error("Error enhancing image with Gemini API:", error);
    throw new Error("Could not enhance image at this time.");
  }
};