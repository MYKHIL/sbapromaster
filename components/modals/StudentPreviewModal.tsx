import React from 'react';
import { Student } from '../../types';

interface StudentPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    students: Student[];
}

const StudentPreviewModal: React.FC<StudentPreviewModalProps> = ({ isOpen, onClose, title, students }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-xl text-white">{title}</h3>
                        <p className="text-blue-100 text-xs mt-0.5 font-medium uppercase tracking-wider">{students.length} Students found</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-white/80 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">
                    {students.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <p className="text-lg font-medium">No students found in this category.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Student Name</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Gender</th>
                                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Class</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {students.map((student, index) => (
                                    <tr key={student.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                                            {String(index + 1).padStart(2, '0')}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                {student.picture ? (
                                                    <img src={student.picture} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                                                ) : (
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${student.gender === 'Male' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                                                        {student.name.charAt(0)}
                                                    </div>
                                                )}
                                                <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-700">{student.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                student.gender === 'Male' 
                                                ? 'bg-blue-100 text-blue-700' 
                                                : 'bg-rose-100 text-rose-700'
                                            }`}>
                                                {student.gender}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-600 font-medium bg-gray-100 px-2 py-1 rounded text-xs">
                                                {student.class}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all text-sm font-bold shadow-sm active:scale-95"
                    >
                        Close Preview
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StudentPreviewModal;
