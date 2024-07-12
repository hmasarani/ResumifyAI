import { db } from '@/db';
import { openai } from '@/lib/openai';
import { getPineconeClient } from '@/lib/pinecone';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { NextRequest } from 'next/server';
import PDFDocument from 'pdfkit';
import blobStream from 'blob-stream';
import pino from 'pino';

const logger = pino({
  level: 'info', // Adjust the log level as needed (e.g., 'debug', 'error')
  prettyPrint: true, // Enable pretty printing for console logs (optional)
});

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    logger.info({ body }, 'Received request body');

    const { getUser } = getKindeServerSession();
    const user = getUser();
    logger.info({ user }, 'User session');

    const { id: userId } = user;

    if (!userId) {
      logger.warn('Unauthorized access attempt');
      return new Response('Unauthorized', { status: 401 });
    }

    const { fileId, text } = body;
    logger.info({ fileId }, 'Fetching file with ID');

    const file = await db.file.findFirst({
      where: {
        id: fileId,
        userId,
      },
    });

    if (!file) {
      logger.warn({ fileId }, 'File not found');
      return new Response('File not found', { status: 404 });
    }

    logger.info({ file }, 'File found');

    // Logic to generate a new PDF based on 'text' and existing PDF
    const generatedPdfUrl = await generateNewPdf(text);
    logger.info({ generatedPdfUrl }, 'Generated PDF URL');

    if (generatedPdfUrl) {
      // Respond with the URL to download the generated PDF
      return new Response(JSON.stringify({ generatedId: generatedPdfUrl }), { status: 200 });
    } else {
      logger.error('Error generating PDF');
      return new Response('Error generating PDF', { status: 500 });
    }
  } catch (error) {
    logger.error({ error }, 'Error in POST handler');
    return new Response('Internal server error', { status: 500 });
  }
};

async function generateNewPdf(newText: string): Promise<string | null> {
  try {
    logger.info({ newText }, 'Generating new PDF with text');

    // Create a new PDF document
    const doc = new PDFDocument();
    const stream = doc.pipe(blobStream());

    // Add text to the PDF
    doc.text(newText, {
      align: 'left',
    });

    // Finalize the PDF and end the stream
    doc.end();

    // Wait for the stream to finish and get the blob
    return new Promise((resolve, reject) => {
      stream.on('finish', function () {
        const blob = stream.toBlob('application/pdf');
        const downloadUrl = URL.createObjectURL(blob);
        logger.info({ downloadUrl }, 'PDF generation finished. Download URL');
        resolve(downloadUrl);
      });

      stream.on('error', function (err) {
        logger.error({ err }, 'Error in PDF stream');
        reject(err);
      });
    });
  } catch (error) {
    logger.error({ error }, 'Error generating PDF');
    return null;
  }
}
