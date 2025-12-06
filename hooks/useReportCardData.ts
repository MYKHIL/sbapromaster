import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import type { Student, Assessment, Grade, Subject } from '../types';

const getGradeAndRemark = (mark: number, grades: Grade[]): { grade: string, remark: string } => {
    const roundedMark = Math.round(mark);
    const sortedGrades = [...grades].sort((a, b) => b.minScore - a.minScore);
    const gradeInfo = sortedGrades.find(g => roundedMark >= g.minScore && roundedMark <= g.maxScore);
    return {
        grade: gradeInfo?.name || 'N/A',
        remark: gradeInfo?.remark || 'N/A'
    };
};

const formatScore = (score: number): string => {
    if (score === 0) return '-';
    // Rounds to one decimal place and converts to string, removing trailing .0.
    return Number(score.toFixed(1)).toString();
};

const getOrdinal = (n: number) => {
    if (n <= 0) return '-';
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const useReportCardData = (student: Student) => {
    const { students, subjects, assessments, grades, getStudentScores, scores } = useData();

    const numericGradeMap = useMemo(() => {
        const sortedGrades = [...grades].sort((a, b) => b.maxScore - a.maxScore);
        const map = new Map<string, number>();
        sortedGrades.forEach((grade, index) => {
            map.set(grade.name, index + 1);
        });
        return map;
    }, [grades]);

    const { subjectResults, totalClassWeight, examWeight, performanceSummary, aggregateScore, overallPosition, totalScore } = useMemo(() => {
        const classmates = students.filter(s => s.class === student.class);
        const classmateIds = new Set(classmates.map(c => c.id));

        const relevantSubjectIds = new Set<number>();
        scores.forEach(score => {
            if (classmateIds.has(score.studentId)) {
                relevantSubjectIds.add(score.subjectId);
            }
        });
        const relevantSubjects = subjects.filter(subject => relevantSubjectIds.has(subject.id));
        
        const examAssessment = assessments.find(a => a.name.toLowerCase().includes('exam'));
        const classAssessments = assessments.filter(a => !examAssessment || a.id !== examAssessment.id);
        const totalClassWeight = classAssessments.reduce((sum, a) => sum + a.weight, 0);
        const examWeightValue = examAssessment?.weight || 0;

        const calculateAssessmentTypeScore = (studentId: number, subjectId: number, specificAssessments: Assessment[]) => {
            return specificAssessments.reduce((total, assessment) => {
                const scores = getStudentScores(studentId, subjectId, assessment.id);
                if (!scores || scores.length === 0) return total;
                
                const isExam = assessment.name.toLowerCase().includes('exam');

                if (isExam) {
                    // EXAM LOGIC: Average scores (which are out of 100) and convert to actual weight
                    const sumOfScores = scores.reduce((sum, scoreStr) => sum + Number(scoreStr.split('/')[0]), 0);
                    if (scores.length === 0) return total;
                    const averageScoreOutOf100 = sumOfScores / scores.length;
                    const finalExamScore = (averageScoreOutOf100 / 100) * assessment.weight;
                    return total + finalExamScore;

                } else {
                    // CLASSWORK LOGIC: Sum weighted scores based on their individual max scores
                    const totalScore = scores.reduce((sum, scoreStr) => sum + Number(scoreStr.split('/')[0]), 0);
                    const totalMaxPossibleScore = scores.reduce((sum, scoreStr) => sum + (Number(scoreStr.split('/')[1]) || assessment.weight), 0);
                    
                    if (totalMaxPossibleScore === 0) return total;
                
                    const weightedScore = (totalScore / totalMaxPossibleScore) * assessment.weight;
                    return total + weightedScore;
                }
            }, 0);
        };

        const allStudentSubjectScores: { [subjectId: number]: { studentId: number; totalScore: number }[] } = {};

        relevantSubjects.forEach(subject => {
            allStudentSubjectScores[subject.id] = classmates.map(classmate => {
                const classScore = calculateAssessmentTypeScore(classmate.id, subject.id, classAssessments);
                const examScore = examAssessment ? calculateAssessmentTypeScore(classmate.id, subject.id, [examAssessment]) : 0;
                return { studentId: classmate.id, totalScore: classScore + examScore };
            }).sort((a, b) => b.totalScore - a.totalScore);
        });
        
        // Calculate overall class position based on total marks across all subjects
        const overallClassScores = classmates.map(classmate => {
            const overallTotalScore = relevantSubjects.reduce((total, subject) => {
                const studentScoreInfo = allStudentSubjectScores[subject.id]?.find(s => s.studentId === classmate.id);
                return total + (studentScoreInfo?.totalScore || 0);
            }, 0);
            return { studentId: classmate.id, overallTotalScore };
        }).sort((a, b) => b.overallTotalScore - a.overallTotalScore);

        const studentTotalScore = overallClassScores.find(s => s.studentId === student.id)?.overallTotalScore || 0;

        let studentOverallPosition = 0;
        if (overallClassScores.length > 0) {
            let rank = 1;
            for (let i = 0; i < overallClassScores.length; i++) {
                if (i > 0 && overallClassScores[i].overallTotalScore < overallClassScores[i - 1].overallTotalScore) {
                    rank = i + 1;
                }
                if (overallClassScores[i].studentId === student.id) {
                    studentOverallPosition = rank;
                    break;
                }
            }
        }

        const results = relevantSubjects.map(subject => {
            const classScore = calculateAssessmentTypeScore(student.id, subject.id, classAssessments);
            const examScore = examAssessment ? calculateAssessmentTypeScore(student.id, subject.id, [examAssessment]) : 0;
            const totalScore = classScore + examScore;

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

            const sortedScores = allStudentSubjectScores[subject.id];
            let position = 0;
            let rank = 1;
            for (let i = 0; i < sortedScores.length; i++) {
                if (i > 0 && sortedScores[i].totalScore < sortedScores[i-1].totalScore) {
                    rank = i + 1;
                }
                if (sortedScores[i].studentId === student.id) {
                    position = rank;
                    break;
                }
            }

            return { subject: subject.subject, classScore, examScore, totalScore, grade, remark, position };
        });
        
        // Calculate Aggregate Score
        const coreSubjectGrades: number[] = [];
        const electiveSubjectGrades: number[] = [];

        // Find all core subjects taken by the class
        const coreSubjectsForClass = relevantSubjects.filter(s => s.type === 'Core');
        
        // Find all subjects the current student has a valid score/grade for
        const studentTakenSubjects = new Set(
            results.filter(r => r.totalScore > 0).map(r => r.subject)
        );

        // Populate grades for subjects the student actually took
        results.forEach(result => {
            if (!studentTakenSubjects.has(result.subject)) return;

            const subjectInfo = subjects.find(s => s.subject === result.subject);
            const numericGrade = numericGradeMap.get(result.grade);

            if (subjectInfo && numericGrade) {
                if (subjectInfo.type === 'Core') {
                    coreSubjectGrades.push(numericGrade);
                } else if (subjectInfo.type === 'Elective') {
                    electiveSubjectGrades.push(numericGrade);
                }
            }
        });
        
        let coreSum = coreSubjectGrades.reduce((a, b) => a + b, 0);

        // Handle missing core subjects by assigning the least possible grade
        if (numericGradeMap.size > 0) {
            // FIX: Using `reduce` is a safer way to find the maximum grade value (worst grade).
            // It avoids a type inference issue seen with `Math.max` and the spread operator.
            const leastGradeValue = [...numericGradeMap.values()].reduce((max, v) => Math.max(max, v), 0);
            
            coreSubjectsForClass.forEach(coreSubject => {
                if (!studentTakenSubjects.has(coreSubject.subject)) {
                    // Student is missing this core subject that the class takes, apply penalty
                    coreSum += leastGradeValue;
                }
            });
        }
        
        const bestElectives = electiveSubjectGrades.sort((a, b) => a - b).slice(0, 2);
        const electiveSum = bestElectives.reduce((a, b) => a + b, 0);
        const finalAggregateScore = coreSum + electiveSum;


        const summary = results
            .map(r => `${r.subject}: ${r.grade} (${r.remark}, ${getOrdinal(r.position)} in class)`)
            .join(', ');

        return { 
            subjectResults: results, 
            totalClassWeight, 
            examWeight: examWeightValue,
            performanceSummary: summary,
            aggregateScore: finalAggregateScore,
            overallPosition: studentOverallPosition,
            totalScore: studentTotalScore,
        };

    }, [student, students, subjects, assessments, grades, getStudentScores, scores, numericGradeMap]);
    
    return { subjectResults, totalClassWeight, examWeight, performanceSummary, aggregateScore, overallPosition, totalScore, formatScore, getOrdinal };
};