"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const MAX_CHARACTER_LIMIT = 5000;
const MAX_URL_LENGTH = 100;

interface InputFieldsProps {
  fileid: string;
}

const InputFields: React.FC<InputFieldsProps> = ({ fileid }) => {
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const router = useRouter();

  const handleGenerateClick = async () => {
    // Basic validation
    if (!textInput && !urlInput) {
      alert('Please enter text or provide a URL.');
      return;
    }

    // Validate URL input if provided
    if (urlInput) {
      if (!isValidUrl(urlInput)) {
        alert('Please enter a valid URL starting with http or https and not exceeding 100 characters.');
        return;
      }

      const isAccessible = await checkUrlAccessibility(urlInput);
      if (!isAccessible) {
        alert('The provided URL is not accessible.');
        return;
      }
    }

    // Call the API to generate a new PDF
    try {
      console.log("API Endpoint reached");

      const response = await fetch('/api/message/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textInput,
          fileId: fileid,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status code ${response.status}`);
      }

      console.log("API Endpoint hit!");
      const data = await response.json();
      const { generatedId } = data;
      router.push(`/dashboard/${fileid}/generated/${generatedId}`);
    } catch (error) {
      console.log("API endpoint not hit!");
      console.error('Error generating PDF:', error);
      alert('An error occurred while generating the PDF. Please try again.');
    }
  };

  const isValidUrl = (url: string) => {
    if (url.length > MAX_URL_LENGTH) return false;
    try {
      const newUrl = new URL(url);
      return newUrl.protocol === 'http:' || newUrl.protocol === 'https:';
    } catch (error) {
      return false;
    }
  };

  const checkUrlAccessibility = async (url: string) => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  const handleTextInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Limit text input to maximum characters
    const newText = e.target.value.slice(0, MAX_CHARACTER_LIMIT);
    setTextInput(newText);
  };

  const handleUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Limit URL input to maximum characters
    const newUrl = e.target.value.slice(0, MAX_URL_LENGTH);
    setUrlInput(newUrl);
  };

  return (
    <div className='flex flex-col items-center mt-4'>
      {/* Text area */}
      <textarea
        value={textInput}
        onChange={handleTextInputChange}
        rows={6} // Adjust rows as needed
        className='block w-full max-w-lg p-2 border border-gray-300 rounded-md shadow-sm sm:text-sm mb-2 min-h-[100px]'
        placeholder='Enter text...'
      />

      {/* Character counter */}
      <p className='relative left-0 text-sm text-gray-500 mb-4'>
        {`${textInput.length}/${MAX_CHARACTER_LIMIT}`}
      </p>

      {/* URL input */}
      <input
        type='text'
        value={urlInput}
        onChange={handleUrlInputChange}
        className='block w-full max-w-lg p-2 border border-gray-300 rounded-md shadow-sm sm:text-sm mb-4'
        placeholder='Enter URL...'
      />

      {/* Generate button */}
      <button
        onClick={handleGenerateClick}
        className='py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
      >
        Generate
      </button>
    </div>
  );
};

export default InputFields;
