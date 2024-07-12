import fetch from 'node-fetch'; // Assuming you are using Node.js with node-fetch
import { db } from '@/db';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { getPineconeClient } from '@/lib/pinecone';
import { getUserSubscriptionPlan } from '@/lib/stripe';
import { PLANS } from '@/config/stripe';

const f = createUploadthing();

const middleware = async () => {
  const { getUser } = getKindeServerSession();
  const user = getUser();

  if (!user || !user.id) throw new Error('Unauthorized');

  const subscriptionPlan = await getUserSubscriptionPlan();

  return { subscriptionPlan, userId: user.id };
};

const onUploadComplete = async ({
  metadata,
  file,
}: {
  metadata: Awaited<ReturnType<typeof middleware>>;
  file: {
    key: string;
    name: string;
    url: string;
  };
}) => {
  const isFileExist = await db.file.findFirst({
    where: {
      key: file.key,
    },
  });

  if (isFileExist) return;

  const createdFile = await db.file.create({
    data: {
      key: file.key,
      name: file.name,
      userId: metadata.userId,
      url: `https://utfs.io/f/${file.key}`, // Adjust URL format if necessary
      uploadStatus: 'PROCESSING',
    },
  });

  try {
    // Download the file from the original location
    const response = await fetch(file.url, {
      method: 'GET',
      headers: {
        // Add any necessary headers here if needed
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Failed to download file. Status: ${response.status}`);
    }

    const blob = await response.blob();
    const loader = new PDFLoader(blob);
    const pageLevelDocs = await loader.load();
    const pagesAmt = pageLevelDocs.length;

    const { subscriptionPlan } = metadata;
    const { isSubscribed } = subscriptionPlan;

    const isProExceeded =
      pagesAmt > PLANS.find((plan) => plan.name === 'Pro')!.pagesPerPdf;
    const isFreeExceeded =
      pagesAmt > PLANS.find((plan) => plan.name === 'Free')!.pagesPerPdf;

    if ((isSubscribed && isProExceeded) || (!isSubscribed && isFreeExceeded)) {
      await db.file.update({
        data: {
          uploadStatus: 'FAILED',
        },
        where: {
          id: createdFile.id,
        },
      });
      console.log('Failed to upload due to plan limitations.');
      return;
    }

    // Upload the file to the new location (utfs.io)
    const uploadResponse = await fetch(`https://utfs.io/f/${file.key}`, {
      method: 'PUT', // Adjust HTTP method as per your upload method (PUT/POST)
      headers: {
        // Add any necessary headers here, e.g., authorization headers
        'Content-Type': 'application/pdf', // Adjust content type as needed
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload file. Status: ${uploadResponse.status}`);
    }

    // Vectorize and index the entire document
    const pinecone = await getPineconeClient();
    const pineconeIndex = pinecone.Index('quill');

    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    await PineconeStore.fromDocuments(pageLevelDocs, embeddings, {
      pineconeIndex,
      namespace: createdFile.id,
    });

    await db.file.update({
      data: {
        uploadStatus: 'SUCCESS',
      },
      where: {
        id: createdFile.id,
      },
    });
  } catch (err) {
    console.error('Error during file processing:', err);

    if (err instanceof Response) {
      console.error('HTTP Response error:', err.status, err.statusText);
      const errorText = await err.text();
      console.error('Error text:', errorText);
    }

    await db.file.update({
      data: {
        uploadStatus: 'FAILED',
      },
      where: {
        id: createdFile.id,
      },
    });
  }
};

export const ourFileRouter = {
  freePlanUploader: f({ pdf: { maxFileSize: '4MB' } })
    .middleware(middleware)
    .onUploadComplete(onUploadComplete),
  proPlanUploader: f({ pdf: { maxFileSize: '16MB' } })
    .middleware(middleware)
    .onUploadComplete(onUploadComplete),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
