import { openai } from '@/lib/openai';
import { db } from '@/db';

export const generateNewPdfFromOpenAi = async (originalPdfUrl: string, text: string, url: string, userId: string) => {
  try {
    // Define your custom prompt
    const prompt = `
    Based on the original PDF at the following URL: ${originalPdfUrl},
    and the following additional text: ${text},
    generate a new PDF document. If there is a supplementary URL provided: ${url},
    incorporate relevant content from there as well.
    `;

    // Use OpenAI API to generate new PDF content (this is a simplified example)
    const response = await openai.completions.create({
      model: 'gpt-3.5-turbo',
      prompt: prompt,
      max_tokens: 1000,
    });

    const newPdfContent = response.choices[0].text;

    // Save the new PDF content to your database (or a file storage)
    const generatedPdf = await db.file.create({
      data: {
        url: newPdfContent, // This should be the actual URL or path where the PDF is stored
        userId: userId, // Ensure you associate the PDF with the correct user
      },
    });

    return generatedPdf.id;
  } catch (error) {
    console.error('Error in generateNewPdfFromOpenAi:', error);
    throw new Error('Failed to generate new PDF');
  }
};
