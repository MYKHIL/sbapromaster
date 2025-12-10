import React, { useEffect, useState } from 'react';

const BrowserCompatibilityModal: React.FC = () => {
    const [showModal, setShowModal] = useState(false);
    const [browserInfo, setBrowserInfo] = useState({
        name: 'Unknown',
        version: 'Unknown',
        isSupported: true
    });

    useEffect(() => {
        const userAgent = navigator.userAgent;
        let browserName = 'Unknown Browser';
        let browserVersion = 'Unknown';
        let isSupported = true;

        // Detect browser
        if (userAgent.indexOf('Chrome') > -1 && userAgent.indexOf('Edg') === -1) {
            browserName = 'Google Chrome';
            const match = userAgent.match(/Chrome\/(\d+)/);
            browserVersion = match ? match[1] : 'Unknown';
            isSupported = true; // Chrome is supported
        } else if (userAgent.indexOf('Edg') > -1) {
            browserName = 'Microsoft Edge';
            const match = userAgent.match(/Edg\/(\d+)/);
            browserVersion = match ? match[1] : 'Unknown';
            isSupported = true; // Edge (Chromium) is supported
        } else if (userAgent.indexOf('Firefox') > -1) {
            browserName = 'Mozilla Firefox';
            const match = userAgent.match(/Firefox\/(\d+)/);
            browserVersion = match ? match[1] : 'Unknown';
            isSupported = false; // Firefox may have issues
        } else if (userAgent.indexOf('Safari') > -1) {
            browserName = 'Safari';
            const match = userAgent.match(/Version\/(\d+)/);
            browserVersion = match ? match[1] : 'Unknown';
            isSupported = false; // Safari may have issues
        } else if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident') > -1) {
            browserName = 'Internet Explorer';
            isSupported = false; // IE is not supported
        } else if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) {
            browserName = 'Opera';
            const match = userAgent.match(/OPR\/(\d+)/);
            browserVersion = match ? match[1] : 'Unknown';
            isSupported = false; // Opera may have issues
        }

        setBrowserInfo({ name: browserName, version: browserVersion, isSupported });

        // Show modal ONLY if browser is not supported
        if (!isSupported) {
            setShowModal(true);
        }
    }, []);

    if (!showModal) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black bg-opacity-80 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full ring-4 ring-red-500">
                {/* Header - Pulsing */}
                <div className="p-6 bg-red-600 text-white rounded-t-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-white opacity-10 animate-pulse"></div>
                    <div className="flex items-center gap-3 relative z-10">
                        <svg
                            className="w-12 h-12 flex-shrink-0 animate-pulse"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                        <div>
                            <h2 className="text-2xl font-bold">⚠️ Unsupported Browser</h2>
                            <p className="text-sm opacity-90 mt-1">Please switch to Google Chrome</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Current Browser Info */}
                    <div className="bg-red-50 border-2 border-red-300 p-4 rounded-lg">
                        <h3 className="font-bold text-red-900 mb-2 text-lg">🔴 Current Browser Detected:</h3>
                        <div className="bg-white p-3 rounded border-2 border-red-200">
                            <p className="font-bold text-red-800 text-xl">{browserInfo.name}</p>
                            <p className="text-sm text-red-600">Version: {browserInfo.version}</p>
                        </div>
                    </div>

                    {/* Warning Message */}
                    <div className="bg-yellow-50 border-2 border-yellow-400 p-4 rounded-lg">
                        <p className="text-yellow-900 font-bold mb-2 text-base">
                            ⚠️ This browser may have display errors or compatibility issues with this application.
                        </p>
                        <p className="text-yellow-800 font-semibold text-sm">
                            For the best experience and to avoid errors, please use <strong className="text-yellow-900">Google Chrome</strong>.
                        </p>
                    </div>

                    {/* Recommended Browser */}
                    <div className="bg-blue-50 border-2 border-blue-500 p-5 rounded-lg">
                        <h3 className="font-bold text-blue-900 mb-3 text-lg flex items-center gap-2">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.5 19h-1v-1h1v1zm.5-2.5h-2v-6h2v6zm0-7h-2v-2h2v2z" />
                            </svg>
                            ✅ Recommended Browser:
                        </h3>
                        <div className="bg-white p-4 rounded-lg border-2 border-blue-300 mb-3">
                            <div className="flex items-center gap-3">
                                <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none">
                                    <circle cx="24" cy="24" r="24" fill="#4285F4" />
                                    <path d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" fill="#EA4335" />
                                    <path d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" fill="#4285F4" />
                                    <path d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.81 16.91 0 20.35 0 24c0 3.65.81 7.09 2.56 10.22l7.97-5.63z" fill="#FBBC05" />
                                    <path d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48z" fill="#34A853" />
                                </svg>
                                <div>
                                    <p className="font-bold text-blue-900 text-xl">Google Chrome</p>
                                    <p className="text-sm text-blue-700">Fast, secure, and fully supported</p>
                                </div>
                            </div>
                        </div>
                        <a
                            href="https://www.google.com/chrome/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-200 text-center shadow-md hover:shadow-lg"
                        >
                            📥 Download Google Chrome (Free)
                        </a>
                    </div>

                    {/* Important Notice */}
                    <div className="bg-gray-100 border-2 border-gray-400 p-4 rounded-lg">
                        <p className="text-gray-900 font-bold text-sm">
                            ⚡ <strong>IMPORTANT:</strong> Using an unsupported browser may cause:
                        </p>
                        <ul className="text-gray-800 text-xs mt-2 ml-4 list-disc space-y-1">
                            <li>Visual display errors and broken layouts</li>
                            <li>Features not working correctly</li>
                            <li>PDF generation failures</li>
                            <li>Data synchronization issues</li>
                        </ul>
                    </div>

                    {/* Critical Warning - Non-dismissible */}
                    <div className="bg-red-100 border-2 border-red-500 p-4 rounded-lg">
                        <p className="text-red-900 font-bold text-sm text-center">
                            ⚠️ This message will remain visible until you switch to Google Chrome
                        </p>
                        <p className="text-red-800 text-xs text-center mt-1">
                            The application may not function correctly in your current browser
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrowserCompatibilityModal;
