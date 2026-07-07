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

const LOGO_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iOCIgZmlsbD0iI0YzRjRGNyIvPgo8cGF0aCBkPSJNNjQgMzBMMzQgNTBWOTRIOTRWNTBMNjQgMzBaIiBzdHJva2U9IiNEMUQ1REIiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik07OCA5OFY2OEM3OCA2NC42ODYzIDc1LjMxMzcgNjIgNzIgNjJINTZDNTAuNjg2MyA2MiA1MCA2NC42ODYzIDUwIDY4Vjk4IiBzdHJva2U9IiNEMUQ1REIiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjx0ZXh0IHg9IjY0IiB5PSIxMTQiIGZvbnQtZmFtaWx5PSJzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmaWxsPSIjOUNBM0FGIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5VcGxvYWQgU2Nob29sIExvZ288L3RleHQ+Cjwvc3ZnPg==';
const SIGNATURE_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTUwIDUwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxwYXRoIGQ9Ik0yIDI1LjVDMiAyNS41IDE1LjUgMTUuNSAyOS41IDI4QzQzLjUgNDAuNSA1MyAyNS41IDY2LjUgMjAuNUM4MCAxNS41IDg4LjUgMjkgMTAwIDI5QzExMS41IDI5IDEyMyAxNS41IDEzNyAyOS41IiBzdHJva2U9IiM5Y2EzYWYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+Cjwvc3ZnPg==';

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

  const [sigContextMenu, setSigContextMenu] = useState<{ x: number; y: number; type: 'logo' | 'signature' } | null>(null);
  const sigLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sigContextMenuRef = useRef<HTMLDivElement>(null);

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
    setIsUploadingSignature(true);
    try {
      const url = await processAndUploadImage(dataUrl);
      setFormData(prev => ({ ...prev, headmasterSignature: url }));
      updateSettings({ headmasterSignature: url });
    } catch (error) {
      console.error("[Settings] ❌ Signature upload failed", error);
      alert("Failed to upload signature. Please try again.");
    } finally {
      setIsUploadingSignature(false);
    }
  }, [updateSettings]);

  const downloadImage = useCallback(async () => {
    if (!sigContextMenu) return;
    const type = sigContextMenu.type;
    const src = type === 'logo' ? settings.logo : settings.headmasterSignature;
    if (!src) return;
    
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

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  if (!settings) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  const inputStyles = "mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 text-sm";

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

  const vacationRef = React.useRef<HTMLInputElement | null>(null);
  const reopeningRef = React.useRef<HTMLInputElement | null>(null);

  const handleDateClick = (ref: React.RefObject<HTMLInputElement | null>) => {
    try {
      if (ref.current) {
        ref.current.showPicker();
      }
    } catch (error) {
      console.error("Error opening date picker:", error);
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
          setFormData(prev => ({ ...prev, [field]: url } as any));
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
      updateSettings({ [field]: url } as any);
    } catch (error) {
      console.error(`${field} camera capture failed`, error);
      alert(`Failed to upload captured ${isLogo ? 'logo' : 'signature'}.`);
    } finally {
      isLogo ? setIsUploadingLogo(false) : setIsUploadingSignature(false);
    }
  };

  const handleClearImage = (field: 'logo' | 'headmasterSignature') => {
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
      <div className="max-w-5xl mx-auto space-y-6 px-4 py-4 md:py-8">
        <div className="flex items-center justify-between border-b pb-4">
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">School Setup Master</h1>
        </div>

        <div className="space-y-6">
          {/* SECTION 1: SCHOOL PROFILE & DETAILS (Logo integrated here) */}
          <section className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
              <span className="p-1 bg-blue-50 text-blue-600 rounded">🏫</span> 
              School Profile &amp; Location
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Core Details Inputs */}
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">School Name {isSettingDirty('schoolName') && <UnsavedBadge />}</label>
                  <input type="text" name="schoolName" value={formData.schoolName} onChange={handleChange} className={`${inputStyles} ${isSettingDirty('schoolName') ? 'bg-amber-50 border-amber-500' : ''}`} disabled={!isAdmin} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">District {isSettingDirty('district') && <UnsavedBadge />}</label>
                  <input type="text" name="district" value={formData.district} onChange={handleChange} className={`${inputStyles} ${isSettingDirty('district') ? 'bg-amber-50 border-amber-500' : ''}`} disabled={!isAdmin} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Circuit {isSettingDirty('circuit') && <UnsavedBadge />}</label>
                  <input type="text" name="circuit" value={formData.circuit || ''} onChange={handleChange} className={`${inputStyles} ${isSettingDirty('circuit') ? 'bg-amber-50 border-amber-500' : ''}`} disabled={!isAdmin} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Address {isSettingDirty('address') && <UnsavedBadge />}</label>
                  <textarea name="address" value={formData.address} onChange={handleChange} className={`${inputStyles} ${isSettingDirty('address') ? 'bg-amber-50 border-amber-500' : ''}`} rows={2} disabled={!isAdmin} />
                </div>
              </div>

              {/* School Logo Media Box - Connected directly to School Details */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">School Identity Logo {isSettingDirty('logo') && <UnsavedBadge />}</label>
                <div className="flex sm:flex-col items-center gap-4 sm:items-stretch">
                  <div className="relative mx-auto flex-shrink-0">
                    <img
                      src={settings.logo || LOGO_PLACEHOLDER}
                      alt="Logo Preview"
                      title={settings.logo ? 'Right-click or long-press to download' : undefined}
                      className={`h-28 w-28 object-contain border p-2 rounded-lg bg-white shadow-sm transition-colors ${isSettingDirty('logo') ? 'border-amber-500' : ''} ${settings.logo ? 'cursor-context-menu' : ''} ${isUploadingLogo ? 'opacity-40 animate-pulse' : ''}`}
                      onContextMenu={(e) => handleImageContextMenu(e, 'logo')}
                      onTouchStart={(e) => handleImageTouchStart(e, 'logo')}
                      onTouchEnd={handleSigTouchEnd}
                      onTouchMove={handleSigTouchEnd}
                      draggable={false}
                    />
                    {isUploadingLogo && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-6 w-6 border-4 border-blue-600 border-t-transparent animate-spin rounded-full"></div>
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="space-y-1.5 flex-1 w-full text-xs">
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'logo')} disabled={isUploadingLogo} className="block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50" />
                      <CameraCapture onCapture={(img) => handleCameraCapture(img, 'logo')} label={isUploadingLogo ? "Uploading..." : "Camera Scan"} />
                      {settings.logo && (
                        <button type="button" onClick={() => handleClearImage('logo')} disabled={isUploadingLogo} className="flex items-center justify-center px-3 py-1 bg-red-50 text-red-700 border border-red-100 rounded hover:bg-red-100 transition-colors w-full font-medium">
                          Remove Logo
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {AI_FEATURES_ENABLED && isAdmin && settings.logo && (
                  <button type="button" onClick={() => handleEnhance('logo', setIsEnhancingLogo)} disabled={isEnhancingLogo} className="w-full flex items-center justify-center text-xs bg-indigo-50 text-indigo-800 py-1.5 px-3 rounded font-semibold hover:bg-indigo-100 transition-colors">
                    <EnhanceButton isEnhancing={isEnhancingLogo} />
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 2: TERM DATES & CALENDAR */}
          <section className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
              <span className="p-1 bg-amber-50 text-amber-600 rounded">📅</span> 
              Academic Term &amp; Timeline
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Academic Year {isSettingDirty('academicYear') && <UnsavedBadge />}</label>
                <input type="text" name="academicYear" value={formData.academicYear} onChange={handleChange} className={`${inputStyles} ${isSettingDirty('academicYear') ? 'bg-amber-50 border-amber-500' : ''}`} disabled={!isAdmin} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Academic Term {isSettingDirty('academicTerm') && <UnsavedBadge />}</label>
                <input type="text" name="academicTerm" value={formData.academicTerm} onChange={handleChange} className={`${inputStyles} ${isSettingDirty('academicTerm') ? 'bg-amber-50 border-amber-500' : ''}`} disabled={!isAdmin} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Vacation Date {isSettingDirty('vacationDate') && <UnsavedBadge />}</label>
                <div className="relative">
                  <input ref={vacationRef} type="date" name="vacationDate" value={formData.vacationDate} onChange={handleChange} className="absolute opacity-0 pointer-events-none w-0 h-0" tabIndex={-1} disabled={!isAdmin} />
                  <div onClick={() => isAdmin && handleDateClick(vacationRef)} className={`${inputStyles} flex items-center justify-between ${!isAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-blue-400'} ${isSettingDirty('vacationDate') ? 'bg-amber-50 border-amber-500' : ''}`}>
                    <span className="truncate">{formData.vacationDate ? formatDateString(formData.vacationDate) : 'Select date'}</span>
                    <span className="text-gray-400 text-xs">📅</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Reopening Date {isSettingDirty('reopeningDate') && <UnsavedBadge />}</label>
                <div className="relative">
                  <input ref={reopeningRef} type="date" name="reopeningDate" value={formData.reopeningDate} onChange={handleChange} className="absolute opacity-0 pointer-events-none w-0 h-0" tabIndex={-1} disabled={!isAdmin} />
                  <div onClick={() => isAdmin && handleDateClick(reopeningRef)} className={`${inputStyles} flex items-center justify-between ${!isAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-blue-400'} ${isSettingDirty('reopeningDate') ? 'bg-amber-50 border-amber-500' : ''}`}>
                    <span className="truncate">{formData.reopeningDate ? formatDateString(formData.reopeningDate) : 'Select date'}</span>
                    <span className="text-gray-400 text-xs">📅</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Term Countdown Banner */}
            {(settings.vacationDate || settings.reopeningDate) && (
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100 mt-2">
                {(() => {
                  const now = new Date();
                  now.setHours(0, 0, 0, 0);
                  const vacation = formData.vacationDate ? new Date(formData.vacationDate + 'T00:00:00') : null;
                  const reopening = formData.reopeningDate ? new Date(formData.reopeningDate + 'T00:00:00') : null;

                  if (vacation && reopening && reopening < vacation) {
                    return (
                      <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
                        ⚠️ Reopening date (next term) must follow the current vacation date.
                      </p>
                    );
                  }

                  const calculateTimeDifference = (targetDate: Date) => {
                    const diffMs = targetDate.getTime() - now.getTime();
                    const isPast = diffMs < 0;
                    const totalDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
                    const weeks = Math.floor(totalDays / 7);
                    const days = totalDays % 7;
                    return { weeks, days, totalDays, isPast };
                  };

                  let targetDate: Date | null = null;
                  let label = '';
                  if (vacation && now < vacation) { targetDate = vacation; label = '🏖️ Time until vacation (this term)'; }
                  else if (reopening && now < reopening) { targetDate = reopening; label = '🎓 Time until school reopens'; }
                  else if (reopening) { targetDate = reopening; label = '📅 System elapsed since reopening'; }
                  else if (vacation) { targetDate = vacation; label = '📅 System elapsed since vacation'; }

                  if (!targetDate) return null;
                  const { weeks, days, totalDays } = calculateTimeDifference(targetDate);

                  return (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase text-indigo-900 tracking-wider">{label}</span>
                      <span className="text-sm font-black text-indigo-700 bg-white px-2.5 py-1 rounded shadow-sm border border-indigo-100">
                        {weeks > 0 ? `${weeks}w ` : ''}{days}d ({totalDays} total days)
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </section>

          {/* SECTION 3: PERSONNEL & BRANDING SIGNATURES */}
          <section className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
              <span className="p-1 bg-purple-50 text-purple-600 rounded">🖋️</span> 
              Administration Validation
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Personnel Title Inputs */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Headmaster / Headmistress Name {isSettingDirty('headmasterName') && <UnsavedBadge />}</label>
                <input type="text" name="headmasterName" value={formData.headmasterName || ''} onChange={handleChange} className={inputStyles} disabled={!isAdmin} placeholder="Enter Administrator Full Name" />
              </div>

              {/* Signature Management Canvas */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Authorized Headmaster Signature</label>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative bg-white border rounded-md p-2 shadow-sm flex-shrink-0">
                    <img
                      src={settings.headmasterSignature || SIGNATURE_PLACEHOLDER}
                      alt="Signature Preview"
                      title={settings.headmasterSignature ? 'Right-click or long-press to download' : undefined}
                      className={`h-14 w-40 object-contain transition-colors ${isSettingDirty('headmasterSignature') ? 'border-amber-500' : ''} ${settings.headmasterSignature ? 'cursor-context-menu' : ''} ${isUploadingSignature ? 'opacity-40 animate-pulse' : ''}`}
                      onContextMenu={(e) => handleImageContextMenu(e, 'signature')}
                      onTouchStart={(e) => handleImageTouchStart(e, 'signature')}
                      onTouchEnd={handleSigTouchEnd}
                      onTouchMove={handleSigTouchEnd}
                      draggable={false}
                    />
                    {isUploadingSignature && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                        <div className="h-5 w-5 border-2 border-indigo-600 border-t-transparent animate-spin rounded-full"></div>
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full text-xs">
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'headmasterSignature')} disabled={isUploadingSignature} className="sm:col-span-2 block w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700" />
                      <button type="button" onClick={() => setShowSignaturePad(true)} disabled={isUploadingSignature} className="flex items-center justify-center px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded hover:bg-indigo-100 font-medium">
                        ✏️ Draw Digital
                      </button>
                      <CameraCapture onCapture={(img) => handleCameraCapture(img, 'headmasterSignature')} label="📷 Snapshot" />
                      {settings.headmasterSignature && (
                        <button type="button" onClick={() => handleClearImage('headmasterSignature')} disabled={isUploadingSignature} className="sm:col-span-2 flex items-center justify-center px-3 py-1 bg-red-50 text-red-700 border border-red-100 rounded hover:bg-red-100 font-medium">
                          Clear Current Signature
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {AI_FEATURES_ENABLED && isAdmin && settings.headmasterSignature && (
                  <button type="button" onClick={() => handleEnhance('headmasterSignature', setIsEnhancingSignature)} disabled={isEnhancingSignature} className="w-full flex items-center justify-center text-xs bg-indigo-50 text-indigo-800 py-1.5 px-3 rounded font-semibold hover:bg-indigo-100 transition-colors">
                    <EnhanceButton isEnhancing={isEnhancingSignature} />
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Popups & Modals Context elements */}
      {showSignaturePad && (
        <SignaturePad onSave={handleSignatureDrawSave} onClose={() => setShowSignaturePad(false)} />
      )}

      {sigContextMenu && (
        <div ref={sigContextMenuRef} className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 min-w-[180px] overflow-hidden" style={{ top: sigContextMenu.y, left: sigContextMenu.x }}>
          <button className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors gap-2.5" onClick={downloadImage}>
            📥 Download {sigContextMenu.type === 'logo' ? 'Logo' : 'Signature'}
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button className="flex items-center w-full px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition-colors gap-2.5" onClick={() => setSigContextMenu(null)}>
            ❌ Close
          </button>
        </div>
      )}
    </ReadOnlyWrapper>
  );
};

export default Settings;