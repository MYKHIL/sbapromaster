import initSqlJs from 'sql.js/dist/sql-wasm';
import type { Database } from 'sql.js';
import type { Student, Subject, Class, Grade, Assessment, Score, SchoolSettings, ReportSpecificData, ClassSpecificData } from '../types';

// A type for the full application data context
type AppData = {
    settings: SchoolSettings;
    students: Student[];
    subjects: Subject[];
    classes: Class[];
    grades: Grade[];
    assessments: Assessment[];
    scores: Score[];
    reportData: ReportSpecificData[];
    classData: ClassSpecificData[];
};

export interface ImportDiagnostics {
    records: { total: number; skipped: number };
    comments: { total: number; skipped: number };
    skippedReasons: string[];
}

export interface ImportResult {
    data: Partial<AppData>;
    diagnostics: ImportDiagnostics;
}

/**
 * Normalizes various date string formats into a standard YYYY-MM-DD format.
 * Handles formats like 'dd/mm/yyyy', 'Month dd, yyyy', and ISO strings.
 * @param dateStr The date string to normalize.
 * @returns A date string in YYYY-MM-DD format, or the original string if parsing fails.
 */
function normalizeDateString(dateStr: any): string {
    if (!dateStr || typeof dateStr !== 'string' || dateStr.trim() === '') {
        return '';
    }
    const trimmedDateStr = dateStr.trim();

    // First, try standard ISO format (YYYY-MM-DD) which Date.parse handles well.
    // Also handles things like "Month Day, Year"
    const d = new Date(trimmedDateStr);
    if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        // Check for reasonable year range to avoid parsing '20-08-2010' as year 20
        if (year > 1900 && year < 2100) {
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
    }

    // Handle DD/MM/YYYY or DD-MM-YYYY
    const dmy = trimmedDateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmy) {
        const day = dmy[1].padStart(2, '0');
        const month = dmy[2].padStart(2, '0');
        const year = dmy[3];
        // Validate by creating a date object. This handles invalid dates like 32/13/2024.
        const testDate = new Date(`${year}-${month}-${day}T00:00:00`);
        if (!isNaN(testDate.getTime())) {
            return `${year}-${month}-${day}`;
        }
    }

    // If it's just a year, don't format it.
    if (/^\d{4}$/.test(trimmedDateStr)) {
        return trimmedDateStr;
    }

    console.warn(`Could not normalize date string: "${trimmedDateStr}". Using it as-is.`);
    return trimmedDateStr;
}

/**
 * Calculates age from a date of birth string.
 * @param dobString The date of birth string in YYYY-MM-DD format.
 * @returns The calculated age as a string, or an empty string if invalid or age < 1.
 */
function calculateAge(dobString: string): string {
    if (!dobString || !/^\d{4}-\d{2}-\d{2}$/.test(dobString)) return '';
    try {
        const dob = new Date(dobString + 'T00:00:00'); // Ensure it's parsed as local time
        const today = new Date();

        if (isNaN(dob.getTime()) || dob.getTime() > today.getTime()) {
            return '';
        }

        let age = today.getFullYear() - dob.getFullYear();
        const monthDifference = today.getMonth() - dob.getMonth();
        if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        return age >= 1 ? age.toString() : '';
    } catch (e) {
        console.error("Age calculation failed for DOB:", dobString, e);
        return '';
    }
}


// Helper to initialize the SQL.js database
async function getDb(data?: Uint8Array): Promise<Database> {
    try {
        const SQL = await initSqlJs({
            // FIX: Point to a reliable CDN for the sql-wasm.wasm file. The previous URL was incorrect.
            locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${file}`
        });
        return data ? new SQL.Database(data) : new SQL.Database();
    } catch (e) {
        console.error("SQL.js initialization failed:", e);
        // FIX: Provide more specific error messages for import vs. export failures.
        const errorMessage = e instanceof Error ? e.message : String(e);
        if (data) {
            // This error happens during an import.
            throw new Error(`The provided file is not a valid SQLite database or it is corrupted. Error: ${errorMessage}`);
        } else {
            // This error happens during an export.
            throw new Error(`Failed to initialize the database engine for export. This is likely a network issue preventing a required file from loading. Please check your internet connection. Error: ${errorMessage}`);
        }
    }
}

// --- Base64 and BLOB Conversion Utilities ---
function base64ToUint8Array(base64DataUrl: string): Uint8Array | null {
    if (!base64DataUrl || !base64DataUrl.startsWith('data:')) return null;
    try {
        const pureBase64 = base64DataUrl.substring(base64DataUrl.indexOf(',') + 1);
        const binaryString = atob(pureBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    } catch (e) {
        console.error("Failed to convert base64 to Uint8Array", e);
        return null;
    }
}

function uint8ArrayToBase64(bytes: Uint8Array, mimeType: string = 'image/png'): string {
    if (!bytes || bytes.byteLength === 0) return '';
    try {
        let binary = '';
        const len = bytes.byteLength;
        // Limit max processing size to avoids Hanging/Crashing on massive blobs (e.g > 2MB)
        if (len > 2 * 1024 * 1024) {
            console.warn(`[databaseService] BLOB too large to process (${(len / 1024 / 1024).toFixed(2)} MB). Skipping.`);
            return '';
        }

        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = `data:${mimeType};base64,${btoa(binary)}`;

        // Firestore Field Limit Check (approx 1MB, but we set safe limit to 500KB for nested fields)
        if (base64.length > 500 * 1024) {
            console.warn(`[databaseService] Generated Base64 image too large (${(base64.length / 1024).toFixed(2)} KB). Skipping to prevent database error.`);
            return '';
        }

        return base64;
    } catch (e) {
        console.error("Failed to convert Uint8Array to base64", e);
        return '';
    }
}

// --- Database Schema ---
const CREATE_TABLE_STATEMENTS = `
    CREATE TABLE Assessment (ID integer primary key autoincrement, Name varchar (900), Basis varchar(900), TargetValue varchar (900), SumTarget varchar (900));
    CREATE TABLE Comments (ID integer primary key autoincrement, Student  varchar (900), IndexNumber varchar (900), Class varchar (900), Attendance varchar (900), Outof varchar (900), Conduct varchar (900), Attitude varchar (900), TeacherRemarks varchar (900), HeadRemarks varchar (900));
    CREATE TABLE Grades (ID integer primary key autoincrement, Grade varchar (900), MinimumValue varchar (900), MaximumValue varchar (900), Remarks varchar (900), "GradeValue" TEXT);
    CREATE TABLE Records (ID integer primary key autoincrement, Class varchar (900), Student varchar (900), IndexNumber varchar (900), Subject varchar (900), AssessmentType varchar (900), Score varchar (900), AssessmentBasis varchar (900));
    CREATE TABLE Settings (ID integer primary key autoincrement, SchoolName  varchar (900), District  varchar (900), Address  varchar (900), AcademicYear  varchar (900), VacationDate  varchar (900), ReopeningDate  varchar (900), AcademicTerm  varchar (900), LogoPath BLOB, HeadSignaturePath BLOB, DatabaseGuid varchar(64), HeadmasterName TEXT, ShowPromotionStatus INTEGER DEFAULT 0, "RecentActivityLimit" INTEGER, MaxRecentActivities INTEGER DEFAULT 10, LeftRightNavigate INTEGER DEFAULT 1, LastSelectedSubjectID INTEGER DEFAULT 0, LastSelectedClass TEXT DEFAULT '', ReportEditorIsExpanded INTEGER DEFAULT 1, ReportEditorWidth REAL DEFAULT 400, MainWindowWidth REAL DEFAULT 1200, MainWindowHeight REAL DEFAULT 800, MainWindowLeft REAL DEFAULT 0.0, MainWindowTop REAL DEFAULT 0.0, MainWindowState TEXT DEFAULT 'Normal', ScoreEntryInstructionsExpanded INTEGER DEFAULT 1, ScoreEntryOverlayOffsetX REAL DEFAULT 0, ScoreEntryOverlayOffsetY REAL DEFAULT 0);
    CREATE TABLE Student (ID integer primary key autoincrement, Name  varchar (900), Gender  varchar (900), IndexNumber  varchar (900), Class  varchar (900), DateOfBirth  varchar (900), Picture BLOB, Age  varchar (900), "Promotions" TEXT);
    CREATE TABLE Subjects (ID integer primary key autoincrement, Subject  varchar (900), Type  varchar (900), Facilitator  varchar (900), Signature BLOB, "SubjectName" TEXT);
    CREATE TABLE TeacherSignature (ID integer primary key autoincrement, Class  varchar (900), TeacherSignaturePath BLOB, TeacherName TEXT);
`;

/**
 * Exports the application's current state to an SQLite database file.
 * @param data The complete application data from the context.
 * @returns A Uint8Array representing the SQLite database file.
 */
export async function exportDatabase(data: AppData): Promise<Uint8Array> {
    const db = await getDb();
    db.exec(CREATE_TABLE_STATEMENTS);

    try {
        // Settings
        const settings = data.settings;
        db.prepare(`
            INSERT INTO Settings (ID, SchoolName, District, Address, AcademicYear, VacationDate, ReopeningDate, AcademicTerm, LogoPath, HeadSignaturePath, HeadmasterName)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run([
            settings.schoolName, settings.district, settings.address, settings.academicYear,
            settings.vacationDate, settings.reopeningDate, settings.academicTerm,
            base64ToUint8Array(settings.logo), base64ToUint8Array(settings.headmasterSignature),
            settings.headmasterName
        ]);

        // Students, Subjects, TeacherSignatures, Grades, Assessments
        // CRITICAL: Preserve IDs during export to ensure synchronization consistency
        data.students.forEach(s => db.prepare('INSERT INTO Student (ID, Name, Gender, IndexNumber, Class, DateOfBirth, Picture, Age, Promotions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run([s.id, s.name, s.gender, s.indexNumber, s.class, s.dateOfBirth, base64ToUint8Array(s.picture), s.age, null]));
        data.subjects.forEach(s => db.prepare('INSERT INTO Subjects (ID, Subject, Type, Facilitator, Signature, SubjectName) VALUES (?, ?, ?, ?, ?, ?)').run([s.id, s.subject, s.type, s.facilitator, base64ToUint8Array(s.signature), null]));
        data.classes.forEach(c => db.prepare('INSERT INTO TeacherSignature (ID, Class, TeacherSignaturePath, TeacherName) VALUES (?, ?, ?, ?)').run([c.id, c.name, base64ToUint8Array(c.teacherSignature), c.teacherName]));
        data.grades.forEach(g => db.prepare('INSERT INTO Grades (ID, Grade, MinimumValue, MaximumValue, Remarks, GradeValue) VALUES (?, ?, ?, ?, ?, ?)').run([g.id, g.name, g.minScore.toString(), g.maxScore.toString(), g.remark, null]));
        data.assessments.forEach(a => db.prepare('INSERT INTO Assessment (ID, Name, Basis, TargetValue, SumTarget) VALUES (?, ?, ?, ?, ?)').run([a.id, a.name, null, a.weight.toString(), null]));


        // Records (Scores)
        const studentMap = new Map(data.students.map(s => [s.id, s]));
        const subjectMap = new Map(data.subjects.map(s => [s.id, s]));
        const assessmentMap = new Map(data.assessments.map(a => [a.id, a]));
        data.scores.forEach(score => {
            const student = studentMap.get(score.studentId);
            const subject = subjectMap.get(score.subjectId);
            if (!student || !subject) return;

            Object.entries(score.assessmentScores).forEach(([assessmentId, scoreValues]) => {
                const assessment = assessmentMap.get(Number(assessmentId));
                if (!assessment) return;

                scoreValues.forEach(scoreValue => {
                    db.prepare('INSERT INTO Records (Class, Student, IndexNumber, Subject, AssessmentType, Score, AssessmentBasis) VALUES (?, ?, ?, ?, ?, ?, ?)').run([
                        student.class, student.name, student.indexNumber, subject.subject, assessment.name, scoreValue, ''
                    ]);
                });
            });
        });

        // Comments (Report Data)
        data.reportData.forEach(rd => {
            const student = studentMap.get(rd.studentId);
            if (!student) return;
            const classInfo = data.classes.find(c => c.name === student.class);
            const classData = classInfo ? data.classData.find(cd => cd.classId === classInfo.id) : undefined;
            db.prepare('INSERT INTO Comments (Student, IndexNumber, Class, Attendance, Outof, Conduct, Attitude, TeacherRemarks, HeadRemarks) VALUES (?,?,?,?,?,?,?,?,?)').run([
                student.name, student.indexNumber, student.class, rd.attendance, classData?.totalSchoolDays || '', rd.conduct, rd.attitude, rd.teacherRemark, rd.interest
            ]);
        });


    } catch (e) {
        console.error("Error during DB export population:", e);
        throw new Error("Failed to populate database for export.");
    }

    return db.export();
}


/**
 * Imports data from an SQLite database file and transforms it into the application's state structure.
 * @param dbFile A Uint8Array representing the SQLite database file.
 * @returns An object containing all the application data and import diagnostics.
 */
export async function importDatabase(dbFile: Uint8Array): Promise<ImportResult> {
    const db = await getDb(dbFile);
    const importedData: Partial<AppData> = {};
    const diagnostics: ImportDiagnostics = {
        records: { total: 0, skipped: 0 },
        comments: { total: 0, skipped: 0 },
        skippedReasons: [],
    };
    const reasonCounts = new Map<string, number>();

    try {
        const query = (sql: string): any[] => {
            const results = [];
            try {
                const stmt = db.prepare(sql);
                while (stmt.step()) {
                    results.push(stmt.getAsObject());
                }
                stmt.free();
            } catch (e) {
                console.warn(`Query failed, table might not exist: ${sql}`, e);
            }
            return results;
        };

        // Settings
        const settingsRes = query('SELECT * FROM Settings LIMIT 1')[0];
        if (settingsRes) {
            importedData.settings = {
                schoolName: String(settingsRes.SchoolName || ''),
                district: String(settingsRes.District || ''),
                address: String(settingsRes.Address || ''),
                academicYear: String(settingsRes.AcademicYear || ''),
                academicTerm: String(settingsRes.AcademicTerm || ''),
                vacationDate: normalizeDateString(settingsRes.VacationDate),
                reopeningDate: normalizeDateString(settingsRes.ReopeningDate),
                headmasterName: String(settingsRes.HeadmasterName || ''),
                // Restore logo/signature with robust size checks
                logo: uint8ArrayToBase64(settingsRes.LogoPath),
                headmasterSignature: uint8ArrayToBase64(settingsRes.HeadSignaturePath),
                // Ensure new config fields have defaults if missing from old DBs
                isDataEntryLocked: Boolean(settingsRes.IsDataEntryLocked),
                autoAssignIndexNumbers: Boolean(settingsRes.AutoAssignIndexNumbers),
                indexNumberGlobalPrefix: String(settingsRes.IndexNumberGlobalPrefix || ''),
                indexNumberGlobalSuffix: String(settingsRes.IndexNumberGlobalSuffix || ''),
                indexNumberCounterDigits: Number(settingsRes.IndexNumberCounterDigits) || 3,
                indexNumberPerClass: Boolean(settingsRes.IndexNumberPerClass),
                indexNumberAutoSort: Boolean(settingsRes.IndexNumberAutoSort),
                indexNumberGlobalCounter: Number(settingsRes.IndexNumberGlobalCounter) || 0,
                allowStudentProgressView: Boolean(settingsRes.AllowStudentProgressView),
                isPromotionTerm: Boolean(settingsRes.ShowPromotionStatus) // Map ShowPromotionStatus to isPromotionTerm
            };
        }

        importedData.students = query('SELECT * FROM Student').map((r: any): Student => {
            const dateOfBirth = normalizeDateString(r.DateOfBirth);
            return {
                id: r.ID,
                name: r.Name,
                indexNumber: r.IndexNumber,
                gender: r.Gender,
                class: r.Class,
                dateOfBirth: dateOfBirth,
                age: calculateAge(dateOfBirth),
                picture: uint8ArrayToBase64(r.Picture),
            };
        });
        importedData.subjects = query('SELECT * FROM Subjects').map((r: any): Subject => ({ id: r.ID, subject: r.Subject, type: r.Type, facilitator: r.Facilitator, signature: uint8ArrayToBase64(r.Signature) }));

        // Classes (from TeacherSignature table)
        importedData.classes = query('SELECT * FROM TeacherSignature').map((r: any): Class => ({
            id: r.ID,
            name: r.Class,
            teacherName: r.TeacherName || '',
            teacherSignature: uint8ArrayToBase64(r.TeacherSignaturePath),
        }));


        importedData.grades = query('SELECT * FROM Grades').map((r: any): Grade => ({ id: r.ID, name: r.Grade, minScore: Number(r.MinimumValue), maxScore: Number(r.MaximumValue), remark: r.Remarks }));
        importedData.assessments = query('SELECT * FROM Assessment').map((r: any): Assessment => ({ id: r.ID, name: r.Name, weight: Number(r.TargetValue || r.Basis || 0) }));

        // Check if essential data was loaded. If not, the DB schema might be wrong.
        if (!importedData.students?.length && !importedData.subjects?.length) {
            throw new Error("The database file does not contain any student or subject data, or the table names are incorrect.");
        }

        // Complex Mappings with robust, whitespace-insensitive lookups
        const recordsFromDb = query('SELECT * FROM Records');
        diagnostics.records.total = recordsFromDb.length;

        const studentMap = new Map((importedData.students || []).map(s => [s.indexNumber?.trim(), s]));
        const subjectMap = new Map((importedData.subjects || []).map(s => [s.subject?.trim(), s]));
        const assessmentMap = new Map((importedData.assessments || []).map(a => [a.name?.trim(), a]));
        const scoresMap = new Map<string, Score>();

        recordsFromDb.forEach((rec: any) => {
            const student = studentMap.get(rec.IndexNumber?.trim());
            const subject = subjectMap.get(rec.Subject?.trim());
            const assessment = assessmentMap.get(rec.AssessmentType?.trim() || rec['Assessment Type']?.trim()); // Handle column name with space
            if (!student || !subject || !assessment) {
                diagnostics.records.skipped++;
                let reasonKey: string;
                if (!student) reasonKey = `Student with Index No. '${rec.IndexNumber || 'N/A'}' not found`;
                else if (!subject) reasonKey = `Score record for '${student.name}': Subject '${rec.Subject || 'N/A'}' not found`;
                else reasonKey = `Score record for '${student.name}': Assessment '${rec.AssessmentType || rec['Assessment Type'] || 'N/A'}' not found`;
                reasonCounts.set(reasonKey, (reasonCounts.get(reasonKey) || 0) + 1);
                return;
            }

            const rawScore = String(rec.Score || '').trim();
            if (rawScore === '') {
                // Skip records with no score value. This is not an error, just empty data.
                return;
            }

            let scoreValue: string;
            const rawBasis = String(rec.AssessmentBasis || '').trim();

            // Case 1: Old format with explicit basis (e.g., Score: 15, AssessmentBasis: 20)
            if (rawBasis !== '') {
                scoreValue = `${rawScore}/${rawBasis}`;
            }
            // Case 2: New format where score is already "x/y" (e.g., Score: "15/20")
            else if (rawScore.includes('/')) {
                scoreValue = rawScore;
            }
            // Case 3: Score is a single number, basis must be inferred from assessment weight
            else {
                const basis = assessment.name.toLowerCase().includes('exam') ? 100 : assessment.weight;
                scoreValue = `${rawScore}/${basis}`;
            }

            // Validate the created scoreValue 'x/y' to ensure both parts are numbers
            const parts = scoreValue.split('/');
            if (parts.length !== 2 || isNaN(parseFloat(parts[0])) || isNaN(parseFloat(parts[1]))) {
                diagnostics.records.skipped++;
                const reasonKey = `Score record for '${student.name}' skipped: Invalid score format ('${scoreValue}').`;
                reasonCounts.set(reasonKey, (reasonCounts.get(reasonKey) || 0) + 1);
                return;
            }

            const scoreId = `${student.id}-${subject.id}`;

            const existing = scoresMap.get(scoreId);
            if (existing) {
                if (existing.assessmentScores[assessment.id]) {
                    existing.assessmentScores[assessment.id].push(scoreValue);
                } else {
                    existing.assessmentScores[assessment.id] = [scoreValue];
                }
            } else {
                scoresMap.set(scoreId, {
                    id: scoreId, studentId: student.id, subjectId: subject.id,
                    assessmentScores: { [assessment.id]: [scoreValue] }
                });
            }
        });
        importedData.scores = Array.from(scoresMap.values());

        const commentsFromDb = query('SELECT * FROM Comments');
        diagnostics.comments.total = commentsFromDb.length;
        const classMap = new Map((importedData.classes || []).map(c => [c.name?.trim(), c]));
        importedData.reportData = [];
        importedData.classData = [];
        const classDataMap = new Map<number, ClassSpecificData>();

        commentsFromDb.forEach((com: any) => {
            const student = studentMap.get(com.IndexNumber?.trim());
            if (!student) {
                diagnostics.comments.skipped++;
                const reasonKey = `Comment record skipped: Student with Index No. '${com.IndexNumber || 'N/A'}' not found`;
                reasonCounts.set(reasonKey, (reasonCounts.get(reasonKey) || 0) + 1);
                return;
            }

            importedData.reportData?.push({
                studentId: student.id,
                attendance: com.Attendance,
                conduct: com.Conduct,
                interest: com.HeadRemarks,
                attitude: com.Attitude,
                teacherRemark: com.TeacherRemarks,
            });

            const classInfo = classMap.get(student.class?.trim());
            if (classInfo && !classDataMap.has(classInfo.id)) {
                classDataMap.set(classInfo.id, {
                    classId: classInfo.id,
                    totalSchoolDays: com.Outof,
                });
            }
        });
        importedData.classData = Array.from(classDataMap.values());

        for (const [reason, count] of reasonCounts.entries()) {
            diagnostics.skippedReasons.push(`${reason} (${count} instance${count > 1 ? 's' : ''}).`);
        }


        // Final check: if we had records but skipped all of them, it's a total failure.
        if (diagnostics.records.total > 0 && diagnostics.records.skipped === diagnostics.records.total) {
            throw new Error("Data mapping failed completely. None of the score records in the file could be matched to students, subjects, or assessments in the same file. Please ensure the backup file is not corrupt.");
        }

    } catch (e) {
        console.error("Error during DB import parsing:", e);
        if (e instanceof Error) {
            throw e; // re-throw the specific error
        }
        throw new Error("Failed to parse database file. It may be corrupt or have an incompatible schema.");
    }

    return { data: importedData, diagnostics };
}