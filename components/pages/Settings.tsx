import React, { useState, useEffect, useRef, useCallback } from 'react';
import CameraCapture from '../CameraCapture';
import SignaturePad from '../SignaturePad';
import { useData } from '../../context/DataContext';
import { enhanceImage } from '../../services/geminiService';
import { AI_FEATURES_ENABLED } from '../../constants';
import ReadOnlyWrapper from '../ReadOnlyWrapper';
import { useUser } from '../../context/UserContext';

import { processAndUploadImage, validateImageSize, triggerDownload } from '../../utils/imageUtils';
import { SchoolSettings } from '../../types';

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

const UnsavedBadge = () => (
  <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-yellow-400 text-black leading-none rounded inline-block translate-y-[-1px]">
    Unsaved
  </span>
);

const Settings: React.FC = () => {
  const { currentUser } = useUser();
  const isAdmin = currentUser?.role === 'Admin';
  const { settings, updateSettings, saveSettings, isDirty, isSettingDirty, isSyncing, isOnline } = useData();
  const [isEnhancingLogo, setIsEnhancingLogo] = useState(false);
  const [isEnhancingSignature, setIsEnhancingSignature] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const [formData, setFormData] = useState<SchoolSettings>(settings);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  // Context menu state for logo and signature image download
  const [sigContextMenu, setSigContextMenu] = useState<{ x: number; y: number; type: 'logo' | 'signature' } | null>(null);
  const sigLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sigContextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sigContextMenu && sigContextMenuRef.current && !sigContextMenuRef.current.contains(e.target as Node)) {
        setSigContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sigContextMenu]);

  const handleSignatureDrawSave = useCallback(async (dataUrl: string) => {
    console.log(`[Settings] 🖌️ Received signature from pad. Length: ${dataUrl.length}`);
    setIsUploadingSignature(true);
    try {
      const url = await processAndUploadImage(dataUrl);
      console.log(`[Settings] ✅ Signature processed/uploaded. Local Update:`, url);
      // Update local form state and context, then persist
        setFormData(prev => ({ ...prev, headmasterSignature: url }));
        // Mark as dirty only — do NOT auto-save to cloud. User will trigger save.
        updateSettings({ headmasterSignature: url });
    } catch (error) {
      console.error("[Settings] ❌ Signature upload failed", error);
      alert("Failed to upload signature. Please try again.");
    } finally {
      setIsUploadingSignature(false);
    }
  }, [updateSettings, saveSettings]);

  const downloadImage = useCallback(async () => {
    if (!sigContextMenu) return;
    const type = sigContextMenu.type;
    const src = type === 'logo' ? settings.logo : settings.headmasterSignature;
    if (!src) return;
    
    // Use the cross-origin friendly download utility
    const filename = type === 'logo' ? 'school-logo.png' : 'headmaster-signature.png';
    await triggerDownload(src, filename);
    
    setSigContextMenu(null);
  }, [sigContextMenu, settings.logo, settings.headmasterSignature]);

  const handleImageContextMenu = useCallback((e: React.MouseEvent, type: 'logo' | 'signature') => {
    const src = type === 'logo' ? settings.logo : settings.headmasterSignature;
    if (!src) return;
    e.preventDefault();
    setSigContextMenu({ x: e.clientX, y: e.clientY, type });
  }, [settings.logo, settings.headmasterSignature]);

  const handleImageTouchStart = useCallback((e: React.TouchEvent, type: 'logo' | 'signature') => {
    const src = type === 'logo' ? settings.logo : settings.headmasterSignature;
    if (!src) return;
    sigLongPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      setSigContextMenu({ x: touch.clientX, y: touch.clientY, type });
    }, 500);
  }, [settings.logo, settings.headmasterSignature]);

  const handleSigTouchEnd = useCallback(() => {
    if (sigLongPressTimer.current) {
      clearTimeout(sigLongPressTimer.current);
      sigLongPressTimer.current = null;
    }
  }, []);

  // Synchronize local form data when settings change (reverts, remote loads, etc.)
  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  // Defensive check: if somehow settings is undefined, show loading state
  // This shouldn't normally happen but can occur during hot module reload
  if (!settings) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Loading settings...</p>
          <p className="text-xs text-gray-500 mt-2">If this persists, try refreshing the page</p>
        </div>
      </div>
    );
  }

  const inputStyles = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500";

  // Format date to readable string
  const formatDateString = (dateString: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    updateSettings({ [name]: value });
  };



  // Update handlers inside Settings component
  const vacationRef = React.useRef<HTMLInputElement | null>(null);
  const reopeningRef = React.useRef<HTMLInputElement | null>(null);

  const handleDateClick = (ref: React.RefObject<HTMLInputElement | null>) => {
    try {
      if (ref.current) {
        ref.current.showPicker();
      }
    } catch (error) {
      console.error("Error opening date picker:", error);
      // Fallback: try to focus/click if showPicker fails (though rare on modern browsers)
      ref.current?.focus();
      ref.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo' | 'headmasterSignature') => {
    if (e.target.files && e.target.files[0]) {
      if (!validateImageSize(e.target.files[0])) {
        e.target.value = '';
        return;
      }

      const isLogo = field === 'logo';
      isLogo ? setIsUploadingLogo(true) : setIsUploadingSignature(true);

      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawBase64 = event.target?.result as string;
        try {
          const url = await processAndUploadImage(rawBase64);
          // Update formData and context then persist
          setFormData(prev => ({ ...prev, [field]: url } as any));
          // Mark updated image locally and mark settings dirty; do not persist immediately
          updateSettings({ [field]: url } as any);
        } catch (error) {
          console.error(`${field} upload failed`, error);
          alert(`Failed to upload ${isLogo ? 'logo' : 'signature'}. Please try again.`);
        } finally {
          isLogo ? setIsUploadingLogo(false) : setIsUploadingSignature(false);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCameraCapture = async (imageData: string, field: 'logo' | 'headmasterSignature') => {
    const isLogo = field === 'logo';
    isLogo ? setIsUploadingLogo(true) : setIsUploadingSignature(true);
    try {
      const url = await processAndUploadImage(imageData);
      setFormData(prev => ({ ...prev, [field]: url } as any));
      // Mark dirty only; do not auto-save
      updateSettings({ [field]: url } as any);
    } catch (error) {
      console.error(`${field} camera capture upload failed`, error);
      alert(`Failed to upload captured ${isLogo ? 'logo' : 'signature'}.`);
    } finally {
      isLogo ? setIsUploadingLogo(false) : setIsUploadingSignature(false);
    }
  };

  const handleClearImage = (field: 'logo' | 'headmasterSignature') => {
    // Clear locally and mark dirty (do not persist to cloud automatically)
    setFormData(prev => ({ ...prev, [field]: '' } as any));
    updateSettings({ [field]: '' } as any);
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
      setFormData(prev => ({ ...prev, [field]: enhancedImage } as any));
      // Mark enhanced image dirty only
      updateSettings({ [field]: enhancedImage } as any);
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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">School Setup</h1>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 space-y-6">
          <h2 className="text-xl font-bold text-gray-700 border-b pb-2">School Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Name {isSettingDirty('schoolName') && <UnsavedBadge />}</label>
              <input type="text" name="schoolName" value={formData.schoolName} onChange={handleChange} className={`${inputStyles} ${isSettingDirty('schoolName') ? 'bg-amber-50 border-amber-500' : ''}`} disabled={!isAdmin} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">District {isSettingDirty('district') && <UnsavedBadge />}</label>
              <input type="text" name="district" value={formData.district} onChange={handleChange} className={`${inputStyles} ${isSettingDirty('district') ? 'bg-amber-50 border-amber-500' : ''}`} disabled={!isAdmin} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Circuit {isSettingDirty('circuit') && <UnsavedBadge />}</label>
              <input type="text" name="circuit" value={formData.circuit || ''} onChange={handleChange} className={`${inputStyles} ${isSettingDirty('circuit') ? 'bg-amber-50 border-amber-500' : ''}`} disabled={!isAdmin} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address {isSettingDirty('address') && <UnsavedBadge />}</label>
              <textarea name="address" value={formData.address} onChange={handleChange} className={`${inputStyles} ${isSettingDirty('address') ? 'bg-amber-50 border-amber-500' : ''}`} rows={3} disabled={!isAdmin} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year {isSettingDirty('academicYear') && <UnsavedBadge />}</label>
              <input type="text" name="academicYear" value={formData.academicYear} onChange={handleChange} className={`${inputStyles} ${isSettingDirty('academicYear') ? 'bg-amber-50 border-amber-500' : ''}`} disabled={!isAdmin} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Academic Term {isSettingDirty('academicTerm') && <UnsavedBadge />}</label>
              <input type="text" name="academicTerm" value={formData.academicTerm} onChange={handleChange} className={`${inputStyles} ${isSettingDirty('academicTerm') ? 'bg-amber-50 border-amber-500' : ''}`} disabled={!isAdmin} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vacation Date (This Term) {isSettingDirty('vacationDate') && <UnsavedBadge />}</label>
              <div className="relative">
                <input
                  ref={vacationRef}
                  type="date"
                  name="vacationDate"
                  value={formData.vacationDate}
                  onChange={handleChange}
                  className="absolute opacity-0 pointer-events-none w-0 h-0"
                  tabIndex={-1}
                  disabled={!isAdmin}
                />
                <div
                  onClick={() => isAdmin && handleDateClick(vacationRef)}
                  className={`${inputStyles} flex items-center justify-between ${!isAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-blue-400 transition-colors'} ${isSettingDirty('vacationDate') ? 'bg-amber-50 border-amber-500' : ''}`}
                >
                  <span className={formData.vacationDate ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                    {formData.vacationDate ? formatDateString(formData.vacationDate) : 'Select vacation date'}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reopening Date (Next Term) {isSettingDirty('reopeningDate') && <UnsavedBadge />}</label>
              <div className="relative">
                <input
                  ref={reopeningRef}
                  type="date"
                  name="reopeningDate"
                  value={formData.reopeningDate}
                  onChange={handleChange}
                  className="absolute opacity-0 pointer-events-none w-0 h-0"
                  tabIndex={-1}
                  disabled={!isAdmin}
                />
                <div
                  onClick={() => isAdmin && handleDateClick(reopeningRef)}
                  className={`${inputStyles} flex items-center justify-between ${!isAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-blue-400 transition-colors'} ${isSettingDirty('reopeningDate') ? 'bg-amber-50 border-amber-500' : ''}`}
                >
                  <span className={formData.reopeningDate ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                    {formData.reopeningDate ? formatDateString(formData.reopeningDate) : 'Select reopening date'}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Weeks Calculator */}
          {(settings.vacationDate || settings.reopeningDate) && (
            <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              {(() => {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                const vacation = formData.vacationDate ? new Date(formData.vacationDate + 'T00:00:00') : null;
                const reopening = formData.reopeningDate ? new Date(formData.reopeningDate + 'T00:00:00') : null;

                // Validation: Check if reopening date is before vacation date
                if (vacation && reopening && reopening < vacation) {
                  return (
                    <div className="flex items-start space-x-2 text-red-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="font-semibold">Invalid Date Configuration</p>
                        <p className="text-sm">Reopening date (next term) must be after the vacation date (this term).</p>
                      </div>
                    </div>
                  );
                }

                // Calculate time difference
                const calculateTimeDifference = (targetDate: Date) => {
                  const nowMs = now.getTime();
                  const targetMs = targetDate.getTime();
                  const diffMs = targetMs - nowMs;
                  const isPast = diffMs < 0;
                  const absDiffMs = Math.abs(diffMs);
                  const totalDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));

                  let start = new Date(now);
                  let end = new Date(targetDate);

                  if (isPast) {
                    [start, end] = [end, start];
                  }

                  let tempDate = new Date(start);

                  // 1. Calculate Full Years
                  let years = 0;
                  while (true) {
                    let nextYear = new Date(tempDate);
                    nextYear.setFullYear(tempDate.getFullYear() + 1);
                    if (nextYear <= end) {
                      years++;
                      tempDate = nextYear;
                    } else {
                      break;
                    }
                  }

                  // 2. Calculate Full Months
                  let months = 0;
                  while (true) {
                    let nextMonth = new Date(tempDate);
                    nextMonth.setMonth(tempDate.getMonth() + 1);
                    if (nextMonth <= end) {
                      months++;
                      tempDate = nextMonth;
                    } else {
                      break;
                    }
                  }

                  // 3. Calculate remaining days between modified start and end
                  const remainingMs = end.getTime() - tempDate.getTime();
                  const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));

                  // 4. Split remaining days into Weeks and Days
                  const weeks = Math.floor(remainingDays / 7);
                  const days = remainingDays % 7;

                  return { years, months, weeks, days, totalDays, isPast };
                };

                // Determine which date to show
                let targetDate: Date | null = null;
                let label = '';
                let icon = '';

                if (vacation && now < vacation) {
                  // Show countdown to vacation
                  targetDate = vacation;
                  label = '🏖️ Time until vacation (this term)';
                  icon = 'countdown';
                } else if (reopening && now < reopening) {
                  // Show countdown to reopening
                  targetDate = reopening;
                  label = '🎓 Time until school reopens (next term)';
                  icon = 'countdown';
                } else if (reopening) {
                  // Past both dates, show time since reopening
                  targetDate = reopening;
                  label = '📅 Time since reopening date';
                  icon = 'past';
                } else if (vacation) {
                  // Only vacation date set and it's past
                  targetDate = vacation;
                  label = '📅 Time since vacation date';
                  icon = 'past';
                }

                if (!targetDate) {
                  return null;
                }

                const { years, months, weeks, days, totalDays, isPast } = calculateTimeDifference(targetDate);

                const parts = [];
                if (years > 0) parts.push(`${years} year${years !== 1 ? 's' : ''}`);
                if (months > 0) parts.push(`${months} month${months !== 1 ? 's' : ''}`);
                if (weeks > 0) parts.push(`${weeks} week${weeks !== 1 ? 's' : ''}`);
                if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);

                const timeString = parts.length > 0 ? parts.join(', ') : '0 days';

                return (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {icon === 'countdown' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                      )}
                      <p className="font-semibold text-gray-800">{label}</p>
                    </div>
                    <div className="pl-7">
                      <p className="text-2xl font-bold text-indigo-700">{timeString}</p>
                      <p className="text-sm text-gray-600 mt-1">({totalDays} total day{totalDays !== 1 ? 's' : ''})</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <hr />

          <h2 className="text-xl font-bold text-gray-700 border-b pb-2">Branding &amp; Signatures</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Headmaster's Name {isSettingDirty('headmasterName') && <UnsavedBadge />}</label>
              <input type="text" name="headmasterName" value={formData.headmasterName || ''} onChange={handleChange} className={`${inputStyles} ${isSettingDirty('headmasterName') ? 'bg-amber-50 border-amber-500' : ''}`} disabled={!isAdmin} />
            </div>
            <div>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <img
                    src={settings.logo || LOGO_PLACEHOLDER}
                    alt="Logo Preview"
                    title={settings.logo ? 'Right-click or long-press to download' : undefined}
                    className={`h-32 w-32 object-contain border p-2 rounded-lg bg-gray-50 transition-colors ${isSettingDirty('logo') ? 'border-amber-500' : ''} ${settings.logo ? 'cursor-context-menu' : ''} ${isUploadingLogo ? 'opacity-40 animate-pulse' : ''}`}
                    onContextMenu={(e) => handleImageContextMenu(e, 'logo')}
                    onTouchStart={(e) => handleImageTouchStart(e, 'logo')}
                    onTouchEnd={handleSigTouchEnd}
                    onTouchMove={handleSigTouchEnd}
                    draggable={false}
                  />
                  {isUploadingLogo && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent animate-spin rounded-full"></div>
                    </div>
                  )}
                  {isSettingDirty('logo') && !isUploadingLogo && (
                    <span className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase tracking-wider">UNSAVED</span>
                  )}
                </div>
                {isAdmin && (
                  <div className="space-y-2 w-full">
                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'logo')} disabled={isUploadingLogo} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50" />
                    <CameraCapture onCapture={(img) => handleCameraCapture(img, 'logo')} label={isUploadingLogo ? "Uploading..." : "Take Logo Photo"} />
                    {settings.logo && (
                      <button
                        type="button"
                        onClick={() => handleClearImage('logo')}
                        disabled={isUploadingLogo}
                        className="delete-button flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium w-full justify-center disabled:opacity-50"
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
                {/* Signature preview with right-click / long-press to download */}
                <div className="relative flex-shrink-0">
                  <img
                    src={settings.headmasterSignature || SIGNATURE_PLACEHOLDER}
                    alt="Signature Preview"
                    title={settings.headmasterSignature ? 'Right-click or long-press to download' : undefined}
                    className={`h-12 w-36 object-contain border p-1 rounded-md bg-gray-50 transition-colors ${isSettingDirty('headmasterSignature') ? 'border-amber-500' : ''} ${settings.headmasterSignature ? 'cursor-context-menu' : ''} ${isUploadingSignature ? 'opacity-40 animate-pulse' : ''}`}
                    onContextMenu={(e) => handleImageContextMenu(e, 'signature')}
                    onTouchStart={(e) => handleImageTouchStart(e, 'signature')}
                    onTouchEnd={handleSigTouchEnd}
                    onTouchMove={handleSigTouchEnd}
                    draggable={false}
                  />
                  {isUploadingSignature && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-5 w-5 border-2 border-indigo-600 border-t-transparent animate-spin rounded-full"></div>
                    </div>
                  )}
                  {isSettingDirty('headmasterSignature') && !isUploadingSignature && (
                    <span className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase tracking-wider">UNSAVED</span>
                  )}
                </div>
                {isAdmin && (
                  <div className="space-y-2 w-full">
                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'headmasterSignature')} disabled={isUploadingSignature} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50" />
                    <CameraCapture onCapture={(img) => handleCameraCapture(img, 'headmasterSignature')} label={isUploadingSignature ? "Uploading..." : "Take Signature Photo"} />
                    {/* Draw signature button */}
                    <button
                      type="button"
                      onClick={() => setShowSignaturePad(true)}
                      disabled={isUploadingSignature}
                      className="flex items-center px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors text-sm font-medium w-full justify-center disabled:opacity-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                      {isUploadingSignature ? "Uploading..." : "Draw Signature"}
                    </button>
                    {settings.headmasterSignature && (
                      <button
                        type="button"
                        onClick={() => handleClearImage('headmasterSignature')}
                        disabled={isUploadingSignature}
                        className="delete-button flex items-center px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors text-sm font-medium w-full justify-center disabled:opacity-50"
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

      {/* Signature drawing pad modal */}
      {showSignaturePad && (
        <SignaturePad
          onSave={handleSignatureDrawSave}
          onClose={() => setShowSignaturePad(false)}
        />
      )}

      {/* Signature context menu (right-click / long-press) */}
      {sigContextMenu && (
        <div
          ref={sigContextMenuRef}
          className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 min-w-[180px] overflow-hidden"
          style={{ top: sigContextMenu.y, left: sigContextMenu.x }}
        >
          <button
            className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors gap-2.5"
            onClick={downloadImage}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download {sigContextMenu.type === 'logo' ? 'Logo' : 'Signature'}
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            className="flex items-center w-full px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors gap-2.5"
            onClick={() => setSigContextMenu(null)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </button>
        </div>
      )}
    </ReadOnlyWrapper>
  );
};

export default Settings;