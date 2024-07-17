import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/db';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import PDFDocument from 'pdfkit';
import blobStream from 'blob-stream';
import pino from 'pino';
console.log("Reached generate-pdf.ts")
const logger = pino({
  level: 'info',
  prettyPrint: true,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  try {
    const body = req.body;
    logger.info('Received request body:', body);

    const { getUser } = getKindeServerSession();
    const user = getUser();
    logger.info('User session:', user);

    const { id: userId } = user;

    if (!userId) {
      logger.warn('Unauthorized access attempt');
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    console.log("reached point 1")

    const { fileId, text } = body;
    logger.info('Fetching file with ID:', fileId);

    const file = await db.file.findFirst({
      where: {
        id: fileId,
        userId,
      },
    });
     console.log("reached point 2")
    if (!file) {
      logger.warn('File not found:', fileId);
      res.status(404).json({ message: 'File not found' });
      return;
    }

    logger.info('File found:', file);

    // Logic to generate a new PDF based on 'text' and existing PDF
    const generatedPdfUrl = await generateNewPdf(text);
    logger.info({ generatedPdfUrl }, 'Generated PDF URL');

    if (generatedPdfUrl) {
      res.status(200).json({ generatedId: generatedPdfUrl });
    } else {
      logger.error('Error generating PDF');
      res.status(500).json({ message: 'Error generating PDF' });
    }
  } catch (error) {
    logger.error({ error }, 'Error in POST handler');
    res.status(500).json({ message: 'Internal server error' });
  }
}

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
