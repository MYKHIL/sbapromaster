import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  variant?: 'danger' | 'info';
  confirmText?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message, variant = 'danger', confirmText }) => {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  const theme = {
    iconBg: isDanger ? 'bg-red-100' : 'bg-blue-100',
    iconColor: isDanger ? 'text-red-600' : 'text-blue-600',
    buttonBg: isDanger ? 'bg-red-600' : 'bg-blue-600',
    buttonHoverBg: isDanger ? 'hover:bg-red-700' : 'hover:bg-blue-700',
    buttonFocusRing: isDanger ? 'focus:ring-red-500' : 'focus:ring-blue-500',
  };

  const icon = isDanger ? (
    <svg className={`h-6 w-6 ${theme.iconColor}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ) : (
    <svg className={`h-6 w-6 ${theme.iconColor}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md m-4 animate-fade-in-scale">
        <div className="sm:flex sm:items-start">
            <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${theme.iconBg} sm:mx-0 sm:h-10 sm:w-10`}>
                {icon}
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg leading-6 font-bold text-gray-900" id="modal-title">{title}</h3>
                <div className="mt-2">
                    <p className="text-sm text-gray-600">{message}</p>
                </div>
            </div>
        </div>
        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 ${theme.buttonBg} text-base font-medium text-white ${theme.buttonHoverBg} focus:outline-none focus:ring-2 focus:ring-offset-2 ${theme.buttonFocusRing} sm:ml-3 sm:w-auto sm:text-sm`}
            onClick={onConfirm}
          >
            {confirmText || (isDanger ? 'Delete' : 'Confirm')}
          </button>
          <button
            type="button"
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;