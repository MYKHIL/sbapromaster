import { useMemo } from 'react';
import { useData } from '../context/DataContext';

export interface MissingItem {
    studentName: string;
    missingDetails: string[]; // e.g., ["Math", "English"] or ["Conduct", "Interest"]
}

export const useClassStatistics = (classId?: string | number) => {
    const { students, subjects, assessments, getStudentScores, reportData, getReportData, classes } = useData();

    return useMemo(() => {
        if (!classId || !students || !classes) return { missingScores: [], missingRemarks: [], className: '' };

        const targetClass = classes.find(c => c.id === Number(classId) || c.name === classId);
        if (!targetClass) return { missingScores: [], missingRemarks: [], className: '' };

        const className = targetClass.name;
        const classStudents = students.filter(s => s.class === className);

        // --- Scores ---
        const missingScores: MissingItem[] = [];
        const relevantSubjects = subjects; // Filter by class subjects if needed, for now assume all

        classStudents.forEach(student => {
            const studentMissingSubjects: string[] = [];

            relevantSubjects.forEach(sub => {
                // Check if ANY assessment is missing for this subject
                let isSubjectComplete = true;
                // Ideally we check per assessment, but for summary we can check if at least one assessment is done? 
                // Or rather, checking if ALL assessments are done.
                // ScoreSummary checks if score exists.

                let completedCount = 0;
                assessments.forEach(assessment => {
                    const score = getStudentScores(student.id, sub.id, assessment.id);
                    if (score && score.length > 0 && score[0] !== '') {
                        completedCount++;
                    }
                });

                // If completedCount < expected, it's missing something
                // For simpler notification logic: Let's assume we want "Subject Completion".
                if (assessments.length > 0 && completedCount < assessments.length) {
                    studentMissingSubjects.push(sub.subject);
                }
            });

            if (studentMissingSubjects.length > 0) {
                missingScores.push({
                    studentName: student.name,
                    missingDetails: studentMissingSubjects
                });
            }
        });

        // --- Remarks ---
        const missingRemarks: MissingItem[] = [];
        const requiredFields = ['attendance', 'conduct', 'interest', 'attitude', 'teacherRemark'];
        const fieldLabels: Record<string, string> = {
            attendance: 'Attendance',
            conduct: 'Conduct',
            interest: 'Interest',
            attitude: 'Attitude',
            teacherRemark: 'Teacher Remark'
        };

        classStudents.forEach(student => {
            const rData = getReportData ? getReportData(student.id) : reportData?.find(r => r.studentId === student.id);
            const missingFields: string[] = [];

            if (rData) {
                requiredFields.forEach(field => {
                    const val = rData[field as keyof typeof rData];
                    if (!val || (typeof val === 'string' && val.trim() === '')) {
                        missingFields.push(fieldLabels[field]);
                    }
                });
            } else {
                requiredFields.forEach(field => missingFields.push(fieldLabels[field]));
            }

            if (missingFields.length > 0) {
                missingRemarks.push({
                    studentName: student.name,
                    missingDetails: missingFields
                });
            }
        });

        return {
            className,
            missingScores,
            missingRemarks
        };
    }, [classId, students, subjects, assessments, getStudentScores, reportData, getReportData, classes]);
};
