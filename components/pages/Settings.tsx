import React, { useState } from 'react';
import CameraCapture from '../CameraCapture';
import { useData } from '../../context/DataContext';
import { enhanceImage } from '../../services/geminiService';
import { AI_FEATURES_ENABLED } from '../../constants';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import { useUser } from '../../context/UserContext';

const LOGO_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iOCIgZmlsbD0iI0YzRjRGNyIvPgo8cGF0aCBkPSJNNjQgMzBMMzQgNTBWOTRIOTRWNTBMNjQgMzBaIiBzdHJva2U9IiNEMUQ1REIiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik03OCA5OFY2OEM3OCA2NC42ODYzIDc1LjMxMzcgNjIgNzIgNjJINTZDNTAuNjg2MyA2MiA1MCA2NC42ODYzIDUwIDY4Vjk4IiBzdHJva2U9IiNEMUQ1REIiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjx0ZXh0IHg9IjY0IiB5PSIxMTQiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOUNBM0FGIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5VcGxvYWQgU2Nob29sIExvZ288L3RleHQ+Cjwvc3ZnPg==';
const SIGNATURE_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTUwIDUwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0yIDI1LjVDMiAyNS41IDE1LjUgMTUuNSAyOS41IDI4QzQzLjUgNDAuNSA1MyAyNS41IDY2LjUgMjAuNUM4MCAxNS41IDg4LjUgMjkgMTAwIDI5QzExMS41IDI5IDEyMyAxNS41IDEzNyAyOS41IiBzdHJva2U9IiM5Y2EzYWYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+';

const EnhanceButton: React.FC<{ isEnhancing: boolean }> = ({ isEnhancing }) => (
  <>
    {isEnhancing ? (
      <>
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Enhancing...
      </>
    ) : (
      <>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        Enhance with AI
      </>
    )}
  </>
);

const Settings: React.FC = () => {
  const { currentUser } = useUser();
  const isAdmin = currentUser?.role === 'Admin';
  const { settings, updateSettings } = useData();
  const [isEnhancingLogo, setIsEnhancingLogo] = useState(false);
  const [isEnhancingSignature, setIsEnhancingSignature] = useState(false);

  const inputStyles = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    updateSettings({ [name]: value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'headmasterSignature') => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        updateSettings({ [field]: event.target?.result as string });
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCameraCapture = (imageData: string, field: 'logo' | 'headmasterSignature') => {
    updateSettings({ [field]: imageData });
  };

  const handleClearImage = (field: 'logo' | 'headmasterSignature') => {
    updateSettings({ [field]: '' });
  };

  const handleEnhance = async (field: 'logo' | 'headmasterSignature', setLoading: (loading: boolean) => void) => {
    const currentImage = settings[field];
    if (!currentImage) {
      alert("Please upload an image first.");
      return;
    }
    setLoading(true);
    try {
      const enhancedImage = await enhanceImage(currentImage);
      updateSettings({ [field]: enhancedImage });
    } catch (error) {
      console.error(error);
      alert((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ReadOnlyWrapper allowedRoles={['Admin', 'Teacher', 'Guest']}>
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-800">School Setup</h1>

        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 space-y-6">
          <h2 className="text-xl font-bold text-gray-700 border-b pb-2">School Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
              <input type="text" name="schoolName" value={settings.schoolName} onChange={handleChange} className={inputStyles} disabled={!isAdmin} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
              <input type="text" name="district" value={settings.district} onChange={handleChange} className={inputStyles} disabled={!isAdmin} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea name="address" value={settings.address} onChange={handleChange} className={inputStyles} rows={3} disabled={!isAdmin} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
              <input type="text" name="academicYear" value={settings.academicYear} onChange={handleChange} className={inputStyles} disabled={!isAdmin} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Term</label>
              <input type="text" name="academicTerm" value={settings.academicTerm} onChange={handleChange} className={inputStyles} disabled={!isAdmin} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vacation Date</label>
              <input type="date" name="vacationDate" value={settings.vacationDate} onChange={handleChange} className={inputStyles} disabled={!isAdmin} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reopening Date</label>
              <input type="date" name="reopeningDate" value={settings.reopeningDate} onChange={handleChange} className={inputStyles} disabled={!isAdmin} />
            </div>
          </div>

          <hr />

          <h2 className="text-xl font-bold text-gray-700 border-b pb-2">Branding &amp; Signatures</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Headmaster's Name</label>
              <input type="text" name="headmasterName" value={settings.headmasterName || ''} onChange={handleChange} className={inputStyles} disabled={!isAdmin} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Logo</label>
              <div className="flex items-center space-x-4">
                <img src={settings.logo || LOGO_PLACEHOLDER} alt="Logo Preview" className="h-32 w-32 object-contain border p-2 rounded-lg bg-gray-50" />
                {isAdmin && (
                  <div className="space-y-2 w-full">
                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'logo')} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    <CameraCapture onCapture={(img) => handleCameraCapture(img, 'logo')} label="Take Logo Photo" />
                    {settings.logo && (
                      <button
                        type="button"
                        onClick={() => handleClearImage('logo')}
                        className="delete-button flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium w-full justify-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Clear Logo
                      </button>
                    )}
                  </div>
                )}
              </div>
              {AI_FEATURES_ENABLED && isAdmin && (
                <div className="mt-2">
                  <button type="button" onClick={() => handleEnhance('logo', setIsEnhancingLogo)} disabled={!settings.logo || isEnhancingLogo} className="flex items-center text-sm bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-semibold hover:bg-indigo-200 disabled:bg-gray-200 disabled:text-gray-500 transition-colors">
                    <EnhanceButton isEnhancing={isEnhancingLogo} />
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Headmaster's Signature</label>
              <div className="flex items-center space-x-4">
                <img src={settings.headmasterSignature || SIGNATURE_PLACEHOLDER} alt="Signature Preview" className="h-12 w-36 object-contain border p-1 rounded-md bg-gray-50" />
                {isAdmin && (
                  <div className="space-y-2 w-full">
                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'headmasterSignature')} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    <CameraCapture onCapture={(img) => handleCameraCapture(img, 'headmasterSignature')} label="Take Signature Photo" />
                    {settings.headmasterSignature && (
                      <button
                        type="button"
                        onClick={() => handleClearImage('headmasterSignature')}
                        className="delete-button flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium w-full justify-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Clear Signature
                      </button>
                    )}
                  </div>
                )}
              </div>
              {AI_FEATURES_ENABLED && isAdmin && (
                <div className="mt-2">
                  <button type="button" onClick={() => handleEnhance('headmasterSignature', setIsEnhancingSignature)} disabled={!settings.headmasterSignature || isEnhancingSignature} className="flex items-center text-sm bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-semibold hover:bg-indigo-200 disabled:bg-gray-200 disabled:text-gray-500 transition-colors">
                    <EnhanceButton isEnhancing={isEnhancingSignature} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ReadOnlyWrapper>
  );
};

export default Settings;