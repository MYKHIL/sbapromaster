import { useMemo } from 'react';
import { useData, DataContextType } from '../context/DataContext';
import type { Student, Assessment, Grade, Subject } from '../types';
import { getNumericGradeMap, calculateAggregateScore } from '../utils/gradingUtils';

export const getGradeAndRemark = (mark: number, grades: Grade[]): { grade: string, remark: string } => {
    const roundedMark = Math.round(mark);
    const sortedGrades = [...grades].sort((a, b) => b.minScore - a.minScore);
    const gradeInfo = sortedGrades.find(g => roundedMark >= g.minScore && roundedMark <= g.maxScore);
    return {
        grade: gradeInfo?.name || 'N/A',
        remark: gradeInfo?.remark || 'N/A'
    };
};

export const formatScore = (score: number): string => {
    if (score === 0) return '-';
    // Rounds to one decimal place and converts to string, removing trailing .0.
    return Number(score.toFixed(1)).toString();
};

export const getOrdinal = (n: number) => {
    if (n <= 0) return '-';
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

interface ClassReportCacheEntry {
    studentsRef: any[];
    scoresRef: any[];
    subjectsRef: any[];
    assessmentsRef: any[];
    gradesRef: any[];
    reportCards: Record<number, any>;
}

const classReportCache: Record<string, ClassReportCacheEntry> = {};

export const calculateReportData = (student: Student, data: DataContextType) => {
    const { students, subjects, assessments, grades, getStudentScores, scores } = data;
    const className = student.class;

    // Check cache to reuse precomputed class reports
    const cached = classReportCache[className];
    if (
        cached &&
        cached.studentsRef === students &&
        cached.scoresRef === scores &&
        cached.subjectsRef === subjects &&
        cached.assessmentsRef === assessments &&
        cached.gradesRef === grades &&
        cached.reportCards[student.id]
    ) {
        return cached.reportCards[student.id];
    }

    const classmates = students.filter(s => s.class === className);
    const classmateIds = new Set(classmates.map(c => c.id));

    const relevantSubjectIds = new Set<number>();
    scores.forEach(score => {
        if (classmateIds.has(score.studentId)) {
            // FIX: Only include subject if there is ACTUAL data (non-empty strings)
            // This prevents "cleared" scores (['']) from triggering the subject to appear
            // @ts-ignore
            const hasValidData = score.assessmentScores && Object.values(score.assessmentScores).some((val: any) => Array.isArray(val) && val.some((s: string) => s && typeof s === 'string' && s.trim() !== ''));

            if (hasValidData) {
                relevantSubjectIds.add(score.subjectId);
            }
        }
    });
    const relevantSubjects = subjects.filter(subject => relevantSubjectIds.has(subject.id));

    const examAssessments = assessments.filter(a => a.name.toLowerCase().includes('exam'));
    const classAssessments = assessments.filter(a => !a.name.toLowerCase().includes('exam'));
    const totalClassWeight = classAssessments.reduce((sum, a) => sum + a.weight, 0);
    const examWeightValue = examAssessments.reduce((sum, a) => sum + a.weight, 0);

    const calculateAssessmentTypeScore = (studentId: number, subjectId: number, specificAssessments: Assessment[]) => {
        return specificAssessments.reduce((total, assessment) => {
            const scores = getStudentScores(studentId, subjectId, assessment.id);
            if (!scores || scores.length === 0) return total;

            const isExam = assessment.name.toLowerCase().includes('exam');

            if (isExam) {
                // EXAM LOGIC: Average scores (which are out of 100) and convert to actual weight
                const sumOfScores = scores.reduce((sum, scoreStr) => {
                    const s = (scoreStr || '').toString();
                    if (!s.includes('/')) return sum;
                    return sum + (Number(s.split('/')[0]) || 0);
                }, 0);
                if (scores.length === 0) return total;
                const averageScoreOutOf100 = sumOfScores / scores.length;
                const finalExamScore = (averageScoreOutOf100 / 100) * assessment.weight;
                return total + finalExamScore;

            } else {
                // CLASSWORK LOGIC: Sum weighted scores based on their individual max scores
                const totalScore = scores.reduce((sum, scoreStr) => {
                    const s = (scoreStr || '').toString();
                    if (!s.includes('/')) return sum;
                    return sum + (Number(s.split('/')[0]) || 0);
                }, 0);
                const totalMaxPossibleScore = scores.reduce((sum, scoreStr) => {
                    const s = (scoreStr || '').toString();
                    if (!s.includes('/')) return sum + assessment.weight;
                    return sum + (Number(s.split('/')[1]) || assessment.weight);
                }, 0);

                if (totalMaxPossibleScore === 0) return total;

                const weightedScore = (totalScore / totalMaxPossibleScore) * assessment.weight;
                return total + weightedScore;
            }
        }, 0);
    };

    // Calculate student subject scores once for all classmates in this class
    const studentSubjectScores: Record<number, Record<number, { classScore: number; examScore: number; totalScore: number }>> = {};
    classmates.forEach(classmate => {
        studentSubjectScores[classmate.id] = {};
        relevantSubjects.forEach(subject => {
            const classScore = calculateAssessmentTypeScore(classmate.id, subject.id, classAssessments);
            const examScore = calculateAssessmentTypeScore(classmate.id, subject.id, examAssessments);
            studentSubjectScores[classmate.id][subject.id] = {
                classScore,
                examScore,
                totalScore: classScore + examScore
            };
        });
    });

    const allStudentSubjectScores: { [subjectId: number]: { studentId: number; totalScore: number }[] } = {};

    relevantSubjects.forEach(subject => {
        allStudentSubjectScores[subject.id] = classmates.map(classmate => {
            return {
                studentId: classmate.id,
                totalScore: studentSubjectScores[classmate.id][subject.id]?.totalScore || 0
            };
        }).sort((a, b) => b.totalScore - a.totalScore);
    });

    // Calculate overall class positions based on total marks across all subjects
    const overallClassScores = classmates.map(classmate => {
        const overallTotalScore = relevantSubjects.reduce((total, subject) => {
            return total + (studentSubjectScores[classmate.id][subject.id]?.totalScore || 0);
        }, 0);
        return { studentId: classmate.id, overallTotalScore };
    }).sort((a, b) => b.overallTotalScore - a.overallTotalScore);

    const overallPositions: Record<number, number> = {};
    if (overallClassScores.length > 0) {
        let rank = 1;
        for (let i = 0; i < overallClassScores.length; i++) {
            if (i > 0 && overallClassScores[i].overallTotalScore < overallClassScores[i - 1].overallTotalScore) {
                rank = i + 1;
            }
            overallPositions[overallClassScores[i].studentId] = rank;
        }
    }

    const numericGradeMap = getNumericGradeMap(grades);
    const leastGradeValue = numericGradeMap.size > 0 ? Math.max(...numericGradeMap.values()) : 9;

    const computedReportCards: Record<number, any> = {};

    classmates.forEach(classmate => {
        const results = relevantSubjects.map(subject => {
            const scores = studentSubjectScores[classmate.id][subject.id] || { classScore: 0, examScore: 0, totalScore: 0 };
            const { classScore, examScore, totalScore } = scores;

            if (totalScore === 0) {
                return {
                    subject: subject.subject,
                    classScore: 0,
                    examScore: 0,
                    totalScore: 0,
                    grade: '-',
                    remark: '-',
                    position: 0,
                };
            }

            const { grade, remark } = getGradeAndRemark(totalScore, grades);

            const sortedScores = allStudentSubjectScores[subject.id] || [];
            let position = 0;
            let rank = 1;
            for (let i = 0; i < sortedScores.length; i++) {
                if (i > 0 && sortedScores[i].totalScore < sortedScores[i - 1].totalScore) {
                    rank = i + 1;
                }
                if (sortedScores[i].studentId === classmate.id) {
                    position = rank;
                    break;
                }
            }

            return { subject: subject.subject, classScore, examScore, totalScore, grade, remark, position };
        });

        const studentGradesMap = new Map<string, string>();
        results.forEach(r => {
            if (r.grade !== '-' && r.grade !== 'N/A') {
                studentGradesMap.set(r.subject, r.grade);
            }
        });

        const finalAggregateScore = calculateAggregateScore(
            studentGradesMap,
            relevantSubjects,
            numericGradeMap,
            leastGradeValue
        );

        const summary = results
            .map(r => `${r.subject}: ${r.grade} (${r.remark}, ${getOrdinal(r.position)} in class)`)
            .join(', ');

        const studentTotalScore = overallClassScores.find(s => s.studentId === classmate.id)?.overallTotalScore || 0;
        const studentOverallPosition = overallPositions[classmate.id] || 0;

        computedReportCards[classmate.id] = {
            subjectResults: results,
            totalClassWeight,
            examWeight: examWeightValue,
            performanceSummary: summary,
            aggregateScore: finalAggregateScore,
            overallPosition: studentOverallPosition,
            totalScore: studentTotalScore,
        };
    });

    // Cache the class report cards
    classReportCache[className] = {
        studentsRef: students,
        scoresRef: scores,
        subjectsRef: subjects,
        assessmentsRef: assessments,
        gradesRef: grades,
        reportCards: computedReportCards
    };

    return computedReportCards[student.id];
};

export const useReportCardData = (student: Student) => {
    const data = useData();
    // We cannot just pass 'data' directly because useReportCardData is a hook and calculateReportData is a pure function.
    // However, for optimization, we want to memoize the calculation based on dependencies.

    const { subjectResults, totalClassWeight, examWeight, performanceSummary, aggregateScore, overallPosition, totalScore } = useMemo(() => {
        return calculateReportData(student, data);
    }, [student, data]); // data changes whenever any context state changes, which is what we want.

    return { subjectResults, totalClassWeight, examWeight, performanceSummary, aggregateScore, overallPosition, totalScore, formatScore, getOrdinal };
};