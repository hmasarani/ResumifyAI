import PdfRenderer from '@/components/PdfRenderer';
import { db } from '@/db';
import { getUserSubscriptionPlan } from '@/lib/stripe';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { notFound, redirect } from 'next/navigation';

interface PageProps {
  params: {
    fileid: string;
    generatedid: string;
  };
}

const GeneratedPage = async ({ params }: PageProps) => {
  const { fileid, generatedid } = params;

  const { getUser } = getKindeServerSession();
  const user = getUser();

  if (!user || !user.id) {
    redirect(`/auth-callback?origin=dashboard/${fileid}/generated/${generatedid}`);
  }

  const originalFile = await db.file.findFirst({
    where: {
      id: fileid,
      userId: user.id,
    },
  });

  const generatedFile = await db.file.findFirst({
    where: {
      id: generatedid,
      userId: user.id,
    },
  });

  if (!originalFile || !generatedFile) notFound();

  const plan = await getUserSubscriptionPlan();

  return (
    <div className='flex-1 justify-between flex flex-col h-[calc(100vh-3.5rem)]'>
      <div className='mx-auto w-full max-w-8xl grow lg:flex xl:px-2'>
        <div className='flex-1 xl:flex'>
          <div className='px-4 py-6 sm:px-6 lg:pl-8 xl:flex-1 xl:pl-6'>
            <h2>Original PDF</h2>
            <PdfRenderer url={originalFile.url} />
            <h2>Generated PDF</h2>
            <PdfRenderer url={generatedFile.url} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneratedPage;
