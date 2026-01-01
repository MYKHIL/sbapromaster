import { db } from './firebase';
import {
    doc,
    setDoc,
    collection,
    writeBatch,
    increment,
    serverTimestamp,
    query,
    where,
    getDocs
} from "firebase/firestore";
import {
    Student,
    Subject,
    Class,
    Assessment,
    Score,
    SchoolSettings,
    User,
    AppDataType
} from '../../types';

export interface SimulationStats {
    reads: number;
    writes: number;
    errors: number;
    activeUsers: number;
}

export class SimulationEngine {
    private docId: string = "";
    private schoolName: string = "";
    private stats: SimulationStats = { reads: 0, writes: 0, errors: 0, activeUsers: 0 };
    private onLog: (message: string) => void;
    private onStatsUpdate: (stats: SimulationStats) => void;
    private onWorkUpdate: (work: any) => void;
    private isRunning: boolean = false;
    private isPaused: boolean = false;

    constructor(
        onLog: (msg: string) => void,
        onStatsUpdate: (stats: SimulationStats) => void,
        onWorkUpdate: (work: any) => void
    ) {
        this.onLog = onLog;
        this.onStatsUpdate = onStatsUpdate;
        this.onWorkUpdate = onWorkUpdate;
    }

    private log(msg: string) {
        this.onLog(`[${new Date().toLocaleTimeString()}] ${msg}`);
    }

    private getDocId(schoolName: string): string {
        return schoolName.toLowerCase().replace(/\s+/g, '_') + '_2025_Term_1';
    }

    private updateStats(delta: Partial<SimulationStats>) {
        this.stats = { ...this.stats, ...delta };
        this.onStatsUpdate(this.stats);
    }

    async setupDummySchool(schoolName: string) {
        this.schoolName = schoolName;
        this.docId = this.getDocId(schoolName);
        this.log(`Setting up school: ${schoolName} (ID: ${this.docId})`);

        const schoolData: AppDataType = {
            settings: {
                schoolName,
                district: "Simulation District",
                address: "123 Simulation St",
                academicYear: "2025",
                academicTerm: "Term 1",
                vacationDate: "2025-04-01",
                reopeningDate: "2025-05-01",
                headmasterName: "Admin Bot",
                logo: "",
                headmasterSignature: "",
            },
            students: [],
            subjects: [
                { id: 1, subject: 'English', type: 'Core', facilitator: '', signature: '' },
                { id: 2, subject: 'Math', type: 'Core', facilitator: '', signature: '' },
                { id: 3, subject: 'Science', type: 'Core', facilitator: '', signature: '' }
            ],
            classes: [
                { id: 1, name: 'JHS 1', teacherName: 'Teacher 1', teacherSignature: '' },
                { id: 2, name: 'JHS 2', teacherName: 'Teacher 2', teacherSignature: '' }
            ],
            grades: [
                { id: 1, name: '1', minScore: 80, maxScore: 100, remark: 'Ex' },
                { id: 2, name: '2', minScore: 0, maxScore: 79, remark: 'Pass' }
            ],
            assessments: [
                { id: 1, name: 'Class Work', weight: 10 },
                { id: 2, name: 'Exam', weight: 50 }
            ],
            scores: [],
            reportData: [],
            classData: []
        };

        try {
            await setDoc(doc(db, "schools", this.docId), schoolData);

            // Create subscription to satisfy security rules
            const baseId = this.docId.split('_')[0];
            await setDoc(doc(db, "subscriptions", baseId), {
                expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
                activationHash: "c93a215026f36ac783bcac8ba5e4bbea1c3cdb6c79d3824f9712143c44dbb0f3"
            });

            this.updateStats({ writes: this.stats.writes + 2 });
            this.log("School and Subscription created successfully.");
            return true;
        } catch (e: any) {
            this.log(`Error creating school: ${e.message}`);
            this.updateStats({ errors: this.stats.errors + 1 });
            return false;
        }
    }

    async createDummyData(studentCount: number, teacherCount: number) {
        this.log(`Creating ${studentCount} students and ${teacherCount} teachers...`);
        const batch = writeBatch(db);

        // Students
        for (let i = 1; i <= studentCount; i++) {
            const studentId = Date.now() + i;
            const student: Student = {
                id: studentId,
                name: `Student ${i}`,
                indexNumber: `IDX-${i}`,
                gender: i % 2 === 0 ? 'Male' : 'Female',
                class: i % 2 === 0 ? 'JHS 1' : 'JHS 2',
                dateOfBirth: '2010-01-01',
                age: '15',
                picture: ''
            };
            const sDoc = doc(collection(db, "schools", this.docId, "students"), studentId.toString());
            batch.set(sDoc, student);
        }

        // Teachers (Users)
        const users: User[] = [];
        for (let i = 1; i <= teacherCount; i++) {
            const userId = Date.now() + 1000 + i;
            users.push({
                id: userId,
                name: `Teacher ${i}`,
                role: 'Teacher',
                allowedClasses: ['JHS 1', 'JHS 2'],
                allowedSubjects: ['English', 'Math', 'Science'],
                passwordHash: 'dummy'
            });
        }

        const schoolRef = doc(db, "schools", this.docId);
        batch.update(schoolRef, { users });

        try {
            await batch.commit();
            this.updateStats({ writes: this.stats.writes + studentCount + 1 });
            this.log("Dummy data created.");
        } catch (e: any) {
            this.log(`Error creating dummy data: ${e.message}`);
            this.updateStats({ errors: this.stats.errors + 1 });
        }
    }

    async startLoadTest(schoolName: string, userCount: number, intensity: number) {
        this.schoolName = schoolName;
        this.docId = this.getDocId(schoolName);

        if (!this.docId || this.docId.startsWith('_')) {
            this.log("Error: Invalid School Name. Cannot derive Document ID.");
            return;
        }

        this.isRunning = true;
        this.log(`Starting load test for ${schoolName} with ${userCount} users...`);
        this.updateStats({ activeUsers: userCount });

        const workers = [];
        for (let i = 0; i < userCount; i++) {
            workers.push(this.simulateUserAction(i, intensity));
        }

        await Promise.all(workers);
        this.isRunning = false;
        this.log("Load test completed.");
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
        this.updateStats({ activeUsers: 0 });
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        this.log(this.isPaused ? "Simulation Paused." : "Simulation Resumed.");
        return this.isPaused;
    }

    private async simulateUserAction(userId: number, intensity: number) {
        while (this.isRunning) {
            try {
                // Simulate human delay
                const delay = Math.random() * (3000 / intensity) + (500 / intensity);
                await new Promise(r => setTimeout(r, delay));

                if (this.isPaused) {
                    await new Promise(r => {
                        const check = setInterval(() => {
                            if (!this.isPaused || !this.isRunning) {
                                clearInterval(check);
                                r(null);
                            }
                        }, 500);
                    });
                    if (!this.isRunning) break;
                }

                // 1. "Navigate" to Score Entry (Read)
                this.log(`Teacher ${userId}: Navigating to JHS 1 - English...`);
                await new Promise(r => setTimeout(r, 500 / intensity));

                const q = query(collection(db, "schools", this.docId, "students"), where("class", "==", "JHS 1"));
                const snap = await getDocs(q);
                this.updateStats({ reads: this.stats.reads + 1 });

                // 2. "Select" a student and "Type" scores (Write)
                if (snap.docs.length > 0) {
                    const randomStudent = snap.docs[Math.floor(Math.random() * snap.docs.length)].data() as Student;
                    this.log(`Teacher ${userId}: Selecting student ${randomStudent.name}...`);
                    await new Promise(r => setTimeout(r, 800 / intensity));

                    const scoreValue = Math.floor(Math.random() * 10).toString();
                    const examValue = Math.floor(Math.random() * 50).toString();

                    const reportWork = (typing: string, status: string, cw = "", ex = "") => {
                        this.onWorkUpdate({
                            id: userId,
                            name: randomStudent.name,
                            subject: 'English',
                            typing,
                            status,
                            cw,
                            ex
                        });
                    };

                    reportWork('none', 'thinking');
                    await new Promise(r => setTimeout(r, 800 / intensity));

                    reportWork('cw', 'typing');
                    await new Promise(r => setTimeout(r, 1200 / intensity));

                    reportWork('ex', 'typing', scoreValue);
                    await new Promise(r => setTimeout(r, 1500 / intensity));

                    this.log(`Teacher ${userId}: Typing score '${scoreValue}' for ${randomStudent.name}...`);

                    const scoreId = `${randomStudent.id}-1`; // Fixed subject ID for simplicity
                    const sDoc = doc(collection(db, "schools", this.docId, "scores"), scoreId);

                    const score: Score = {
                        id: scoreId,
                        studentId: randomStudent.id,
                        subjectId: 1,
                        assessmentScores: {
                            1: [scoreValue],
                            5: [examValue]
                        }
                    };

                    reportWork('none', 'saving', scoreValue, examValue);
                    await setDoc(sDoc, score, { merge: true });
                    this.updateStats({ writes: this.stats.writes + 1 });
                    this.log(`Teacher ${userId}: Saved record for ${randomStudent.name} ✅`);
                    reportWork('none', 'done', scoreValue, examValue);
                }

            } catch (e: any) {
                this.updateStats({ errors: this.stats.errors + 1 });
                this.log(`Worker ${userId} error: ${e.message}`);
            }
        }
    }
}
