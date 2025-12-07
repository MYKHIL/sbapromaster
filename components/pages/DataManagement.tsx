import React, { useState, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { useUser } from '../../context/UserContext';
import { updateUsers } from '../../services/firebaseService';
import { exportDatabase, importDatabase } from '../../services/databaseService';
import { generateWpfProject } from '../../services/wpfProjectGenerator';
import ConfirmationModal from '../ConfirmationModal';
import AdminSetup from '../AdminSetup';
import { DEV_TOOLS_ENABLED, WHATSAPP_DEVELOPER_NUMBER } from '../../constants';
import type { User } from '../../types';

const DataManagement: React.FC = () => {
    const dataContext = useData();
    const { settings, loadImportedData, saveToCloud, schoolId } = dataContext;
    const { currentUser, users, setUsers } = useUser();
    const [processingAction, setProcessingAction] = useState<'import' | 'export' | 'generate_wpf' | 'share' | null>(null);
    const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning'; details?: string[]; detailsTitle?: string; } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // State for import confirmation modal
    const [fileToImport, setFileToImport] = useState<File | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    // State for share modal
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customNumber, setCustomNumber] = useState('');

    // State for the post-download "Ready to Share" modal
    const [isReadyToShareModalOpen, setIsReadyToShareModalOpen] = useState(false);
    const [whatsAppUrlToOpen, setWhatsAppUrlToOpen] = useState('');
    const [shareFileName, setShareFileName] = useState('');

    // State for cloud save confirmation
    const [isCloudSaveModalOpen, setIsCloudSaveModalOpen] = useState(false);

    // State for user management
    const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);


    const buttonStyles = "flex items-center justify-center bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-wait";

    const handleExport = async () => {
        setProcessingAction('export');
        setFeedback({ message: 'Generating database file...', type: 'info' });
        try {
            const fileData = await exportDatabase(dataContext);
            const blob = new Blob([fileData], { type: 'application/x-sqlite3' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${settings.schoolName.replace(/ /g, '_')}_SBA_Backup.sdlx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setFeedback({ message: 'Database exported successfully!', type: 'success' });
        } catch (error) {
            console.error("Export failed:", error);
            setFeedback({ message: `Database export failed: ${(error as Error).message}`, type: 'error' });
        } finally {
            setProcessingAction(null);
        }
    };

    const handleImportClick = () => {
        setFeedback(null);
        fileInputRef.current?.click();
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (e.target) e.target.value = ''; // Reset input immediately to allow re-selection

        if (file) {
            setFileToImport(file);
            setIsConfirmModalOpen(true);
        }
    };

    const handleConfirmImport = () => {
        if (fileToImport) {
            processImport(fileToImport);
        }
        setIsConfirmModalOpen(false);
        setFileToImport(null);
    };

    const handleCancelImport = () => {
        setIsConfirmModalOpen(false);
        setFileToImport(null);
        setFeedback({ message: 'Import cancelled by user.', type: 'warning' });
        setTimeout(() => setFeedback(null), 3000);
    };

    const processImport = async (fileToImport: File) => {
        if (!fileToImport.name.toLowerCase().endsWith('.sdlx')) {
            setFeedback({ message: "Invalid file type. Please select an '.sdlx' file.", type: 'error' });
            return;
        }

        setProcessingAction('import');
        setFeedback({ message: 'Reading file...', type: 'info' });

        try {
            const arrayBuffer = await fileToImport.arrayBuffer();
            const dbFile = new Uint8Array(arrayBuffer);

            setFeedback({ message: 'Processing database... This may take a moment.', type: 'info' });
            await new Promise(resolve => setTimeout(resolve, 50)); // Allow UI to render feedback

            const { data: importedData, diagnostics } = await importDatabase(dbFile);

            setFeedback({ message: 'Updating application data...', type: 'info' });
            loadImportedData(importedData);

            const totalSkipped = diagnostics.records.skipped + diagnostics.comments.skipped;
            const totalRecords = diagnostics.records.total + diagnostics.comments.total;

            if (totalSkipped > 0) {
                setFeedback({
                    message: `Import partially successful. ${totalRecords - totalSkipped} of ${totalRecords} data points loaded. ${totalSkipped} were skipped.`,
                    type: 'warning',
                    detailsTitle: 'Details of skipped records:',
                    details: diagnostics.skippedReasons
                });
            } else {
                setFeedback({ message: 'Database imported successfully! All data has been updated.', type: 'success' });
            }

            // Prompt to save to cloud if logged in
            if (schoolId) {
                setIsCloudSaveModalOpen(true);
            }
        } catch (error) {
            console.error("Import processing failed:", error);
            const errorMessage = error instanceof Error ? `Import failed: ${error.message}` : "An unknown error occurred during import.";
            setFeedback({ message: errorMessage, type: 'error' });
        } finally {
            setProcessingAction(null);
        }
    };

    const handleShare = async (phoneNumber: string) => {
        setIsShareModalOpen(false);
        setProcessingAction('share');
        setFeedback({ message: 'Generating database file for sharing...', type: 'info' });

        try {
            const fileData = await exportDatabase(dataContext);
            const blob = new Blob([fileData], { type: 'application/x-sqlite3' });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const fileName = `${settings.schoolName.replace(/ /g, '_')}_SBA_Backup.sdlx`;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            const message = `Here is my SBA Pro Master database backup file. Please attach the file that was just downloaded.`;
            const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

            // Prepare for the "Ready to Share" modal
            setWhatsAppUrlToOpen(whatsappUrl);
            setShareFileName(fileName);
            setIsReadyToShareModalOpen(true);
            setFeedback(null); // Clear the "Generating..." feedback

        } catch (error) {
            console.error("Share failed:", error);
            setFeedback({ message: `Sharing failed: ${(error as Error).message}`, type: 'error' });
        } finally {
            setProcessingAction(null);
            setShowCustomInput(false);
            setCustomNumber('');
        }
    };

    const handleConfirmCloudSave = async () => {
        setIsCloudSaveModalOpen(false);
        setFeedback({ message: 'Saving imported data to cloud...', type: 'info' });
        try {
            await saveToCloud();
            setFeedback({ message: 'Data saved to cloud successfully!', type: 'success' });
        } catch (error) {
            console.error("Cloud save failed:", error);
            setFeedback({ message: 'Failed to save data to cloud.', type: 'error' });
        }
    };

    const handleCancelCloudSave = () => {
        setIsCloudSaveModalOpen(false);
    };

    const handleUserManagementSave = async (updatedUsers: User[], shouldClose: boolean = true) => {
        if (!schoolId) {
            setFeedback({ message: 'Cannot save users: No active school session', type: 'error' });
            return;
        }

        setFeedback({ message: 'Saving user management changes...', type: 'info' });
        try {
            await updateUsers(schoolId, updatedUsers);
            setUsers(updatedUsers);
            if (shouldClose) {
                setIsUserManagementOpen(false);
            }
            setFeedback({ message: 'User management changes saved successfully!', type: 'success' });
        } catch (error) {
            console.error('Failed to save users:', error);
            setFeedback({ message: 'Failed to save user changes', type: 'error' });
        }
    };

    const generateWpfPrompt = () => {
        const prompt = [
            `# Blueprint: Recreate "SBA Pro Master" as a Native WPF Application`,
            ``,
            `## 1. High-Level Goal`,
            ``,
            `Act as an expert C# WPF developer specializing in UI/UX and modern desktop application architecture. Create a complete, fully-functional, and visually polished native Windows desktop application using WPF that is a **perfect, 1-to-1 replica** of the "SBA Pro Master" web application. The final product must be indistinguishable from the original in terms of layout, styling, fonts, colors, animations, and all interactive behaviors.`,
            ``,
            `## 2. Core Technologies & Architecture`,
            ``,
            `*   **Language & Framework:** C# 12, .NET 8 WPF.`,
            `*   **Architecture:** **Model-View-ViewModel (MVVM)** is mandatory. Use the \`CommunityToolkit.Mvvm\` library for MVVM patterns (\`[ObservableProperty]\`, \`[RelayCommand]\`).`,
            `*   **UI Toolkit:** Use **Material Design in XAML** (\`MaterialDesignThemes\`) to achieve the modern aesthetic. Configure its theme to match the specific colors outlined below.`,
            `*   **Database:** Use **SQLite** via **Entity Framework Core (SQLite Provider)**. The primary database should be \`sba_pro_master.db\`. You must also implement logic to import from and export to a legacy SQLite format with a specific schema (see Database section).`,
            `*   **Dependency Injection:** Use \`Microsoft.Extensions.DependencyInjection\` to structure the application.`,
            ``,
            `## 3. Global Styles, Theme, and Typography`,
            ``,
            `### 3.1. Color Palette (Material Design Theme)`,
            `*   **Primary Blue:** \`#2563EB\``,
            `*   **Background Gray:** \`#F9FAFB\``,
            `*   **Card/Surface White:** \`#FFFFFF\``,
            `*   **Primary Text:** \`#1F2937\``,
            `*   **Secondary Text:** \`#4B5563\``,
            `*   **Borders:** \`#E5E7EB\``,
            `*   **Danger/Delete Red:** \`#DC2626\``,
            ``,
            `### 3.2. Typography`,
            `*   **Primary Font:** **Segoe UI** (standard for Windows).`,
            `*   **Report Card Font:** **Times New Roman**. This is critical and must only be used within the \`ReportCardView.xaml\` control.`,
            ``,
            `## 4. Main Window Shell and Navigation`,
            ``,
            `### 4.1. SidebarView.xaml - Detailed Behavior`,
            `*   **Structure:** A \`Grid\` as the root. A \`ToggleButton\` can control the collapsed/expanded state, or it can be purely mouse-driven.`,
            `*   **Collapsible Behavior:** Expanded \`Width\`: \`256\`, Collapsed \`Width\`: \`80\`. Animate this width change over 300ms using a \`CubicEase\`.`,
            `*   **Triggers:** Use \`EventTrigger\`s for \`MouseEnter\` (to expand) and \`MouseLeave\` (to collapse).`,
            `*   **Content Fading:** The "SBA Pro Master" \`TextBlock\` and the icon labels must have their \`Opacity\` animated from 1 to 0 during collapse, and 0 to 1 during expansion (duration 200ms). When collapsed, their \`Visibility\` must be \`Collapsed\`.`,
            `*   **Navigation Items (\`ListBox\`):** \`ListBoxItem\` style must have a \`Trigger\` for \`IsSelected="True"\` setting \`Background\` to Primary Blue and \`Foreground\` to White, with a \`CornerRadius\` of 8. A \`Trigger\` for \`IsMouseOver\` (when not selected) should change background to light blue (\`#DBEAFE\`).`,
            ``,
            `## 5. Page-by-Page UI/UX Deep Dive`,
            ``,
            `### 5.1. Global Behaviors`,
            `*   **Modals:** When a modal opens, the main window background must be dimmed. The modal must appear with a **fade-in and scale-up transform** over 200ms.`,
            `*   **CRUD Pages (Students, Subjects, etc.):** Use a consistent layout with a top search bar, an "Add New" button, and a main \`DataGrid\`. The \`DataGrid\`'s action column must contain two icon-only buttons for Edit (blue pencil) and Delete (red trash can).`,
            ``,
            `### 5.2. Dashboard Page`,
            `*   **Stat Cards:** On \`IsMouseOver\`, apply a \`ScaleTransform\` to **1.05** over 200ms.`,
            ``,
            `### 5.3. Score Entry Page`,
            `*   **DataGrid:** Columns are dynamically generated based on assessments. The last column is a "Total" column.`,
            `*   **Custom Cell Templates:**`,
            `    *   **Multiple Scores Cell:** If a student has >1 score for an assessment, the cell shows a button-like \`TextBlock\` with the calculated score and a sub-text like "(3 scores)". Clicking it opens the multi-score modal.`,
            `    *   **Single Score Cell:** For 0 or 1 score, the cell contains an inline \`TextBox\` and a small "+" \`Button\`. The \`TextBox\` saves on \`LostFocus\` or Enter key. The "+" button opens the multi-score modal.`,
            ``,
            `### 5.4. Report Viewer Page`,
            `*   **Floating Action Button (FAB):** A circular, blue button (\`Width="56"\`, \`Height="56"\`) in the bottom-right corner with a Print icon and a \`DropShadowEffect\`. On \`IsMouseOver\`, it must scale to **1.1**.`,
            `*   **Report Customization Panel (The Slide-Out):**`,
            `    *   **Layering:** This panel must exist in an overlay \`Grid\` on top of the main content.`,
            `    *   **Structure & Appearance:** A \`Border\` with \`Width="384"\`. Its \`Background\` must be a semi-transparent brush (\`#FFFFFFCC\`) with a \`BlurEffect\` (\`Radius="10"\`) to blur the content underneath.`,
            `    *   **Animation:** The panel's position is controlled by a \`TranslateTransform\`. Expanded State: \`X = 0\`. Collapsed State: \`X = 352\` (Width - 32px Tab Size). Animate the \`X\` property over 500ms with an \`ExponentialEase\`.`,
            `    *   **Triggers:** The state is controlled by a ViewModel property. This property is changed by \`MouseEnter\`/\`MouseLeave\` on the panel. To prevent collapsing while typing, the \`MouseLeave\` trigger must be ignored if \`IsKeyboardFocusWithin\` is true on the panel.`,
            ``,
            `### 5.5. The Report Card (\`ReportCardView.xaml\`) - CRITICAL BLUEPRINT`,
            `This is the most complex visual component. It must be a **pixel-perfect** recreation. Create a \`UserControl\` with a fixed size of **794x1123 pixels** (A4 at 96 DPI). Use a root \`Grid\` with a 4px black \`Border\`. The font for **ALL** text inside this control must be **Times New Roman**.`,
            ``,
            `**Layout Structure (Root Grid):**`,
            `Define rows for each major section: Header, Student Details, Academic Performance, Grading Key, Remarks, and Signatures/Footer.`,
            ``,
            `*   **Row 0: Header:** \`Height="Auto"\`. Contains a \`Grid\` with 3 columns (\`*\`, \`2*\`, \`*\`).`,
            `    *   Col 0: School Logo (\`Image\`, \`Width="160"\`, \`Height="128"\`).`,
            `    *   Col 1: \`StackPanel\` with \`TextBlock\`s for School Name (\`FontSize="28"\`, \`FontWeight="Bold"\`), Address, and "TERMINAL REPORT" (\`FontSize="20"\`, \`FontWeight="SemiBold"\`).`,
            ``,
            `*   **Row 1: Student Details:** \`Height="Auto"\`. Contains a main \`Grid\` with 2 columns (\`*\`, \`Auto\`).`,
            `    *   Col 0: Contains nested \`Grid\`s for the info layout (Name, Year, Class, etc.).`,
            `    *   **INTELLIGENT RESIZING & DOTTED UNDERLINES:** Each data field (e.g., student's name) must be a \`Grid\` with a label \`TextBlock\` and a \`Border\` for the value. The \`Border\` has only a \`BorderThickness="0,0,0,1"\` and a dotted \`StrokeDashArray\`. The value inside this \`Border\` is a \`TextBlock\` that MUST implement **intelligent text resizing**.`,
            `    *   **Resizing Logic:** Create a custom control or attached property. It must check if the \`TextBlock\`'s \`ActualWidth\` exceeds its container's \`ActualWidth\`. If it does, programmatically reduce the \`FontSize\` in small decrements (e.g., 0.5pt) until it fits. The text must **never wrap**. This is the "smart resizing" feature.`,
            `    *   Col 1: Student Picture (\`Image\` within a \`Border\`, \`Width="128"\`, \`Height="160"\`, \`BorderThickness="2"\`).`,
            ``,
            `*   **Row 2: Academic Performance:** \`Height="*"\`. This row takes up the remaining flexible space to vertically center the table. Use a \`Grid\` for the table, not a \`DataGrid\`, for precise layout control. All cells have a 1px black \`Border\`.`,
            ``,
            `*   **Row 3: Grading Key:** \`Height="Auto"\`. A \`Border\` with a black background and white text for the header. Inside, a \`UniformGrid\` or \`Grid\` with 4 columns displays the grading scale.`,
            ``,
            `*   **Row 4: Remarks:** Height="Auto". A StackPanel of "Dotted Underline" controls for: Attendance, Conduct, Interest, Attitude, and Class Teacher's Remarks.`,
            ``,
            `*   **Row 5: Signatures:** \`Height="Auto"\`. A \`Grid\` with 3 columns for Teacher Signature, Headmaster Signature, and the School Stamp box (a dashed \`Border\`).`,
            ``,
            `*   **Layering/Footer:** The "Printed on..." footer text must be placed in a \`Canvas\` or an overlay \`Grid\` at the absolute bottom, slightly outside the main black border.`,
            ``,
            `## 6. Data Models`,
            `Define C# record types for all entities: \`Student\`, \`Subject\`, \`Class\`, \`Grade\`, \`Assessment\`, \`ScoreEntry\`, \`SchoolSettings\`, \`ReportSpecificData\`, \`ClassSpecificData\`. Image data should be \`byte[]\`.`,
            ``,
            `## 7. Database Schema for .sdlx Import/Export`,
            `The application must be able to import from and export to a legacy SQLite database file (\`.sdlx\`) with the following exact schema. This is a critical compatibility requirement.`,
            '```sql',
            `CREATE TABLE Assessment (ID integer primary key autoincrement, Name varchar (900), Basis varchar(900), TargetValue varchar (900), SumTarget varchar (900));`,
            `CREATE TABLE Comments (ID integer primary key autoincrement, Student varchar (900), IndexNumber varchar (900), Class varchar (900), Attendance varchar (900), Outof varchar (900), Conduct varchar (900), Attitude varchar (900), TeacherRemarks varchar (900), HeadRemarks varchar (900));`,
            `CREATE TABLE Grades (ID integer primary key autoincrement, Grade varchar (900), MinimumValue varchar (900), MaximumValue varchar (900), Remarks varchar (900), "GradeValue" TEXT);`,
            `CREATE TABLE Records (ID integer primary key autoincrement, Class varchar (900), Student varchar (900), IndexNumber varchar (900), Subject varchar (900), AssessmentType varchar (900), Score varchar (900), AssessmentBasis varchar (900));`,
            `CREATE TABLE Settings (ID integer primary key autoincrement, SchoolName varchar (900), District varchar (900), Address varchar (900), AcademicYear varchar (900), VacationDate varchar (900), ReopeningDate varchar (900), AcademicTerm varchar (900), LogoPath BLOB, HeadSignaturePath BLOB, DatabaseGuid varchar(64), HeadmasterName TEXT, ShowPromotionStatus INTEGER, "RecentActivityLimit" INTEGER, MaxRecentActivities INTEGER, LeftRightNavigate INTEGER, LastSelectedSubjectID INTEGER, LastSelectedClass TEXT, ReportEditorIsExpanded INTEGER, ReportEditorWidth REAL, MainWindowWidth REAL, MainWindowHeight REAL, MainWindowLeft REAL, MainWindowTop REAL, MainWindowState TEXT, ScoreEntryInstructionsExpanded INTEGER, ScoreEntryOverlayOffsetX REAL, ScoreEntryOverlayOffsetY REAL);`,
            `CREATE TABLE Student (ID integer primary key autoincrement, Name varchar (900), Gender varchar (900), IndexNumber varchar (900), Class varchar (900), DateOfBirth varchar (900), Picture BLOB, Age varchar (900), "Promotions" TEXT);`,
            `CREATE TABLE Subjects (ID integer primary key autoincrement, Subject varchar (900), Type varchar (900), Facilitator varchar (900), Signature BLOB, "SubjectName" TEXT);`,
            `CREATE TABLE TeacherSignature (ID integer primary key autoincrement, Class varchar (900), TeacherSignaturePath BLOB, TeacherName TEXT);`,
            '```',
            ``,
            `## 8. Data Mapping Logic (Import/Export)`,
            `This logic is complex and must be implemented precisely.`,
            ``,
            `### Import Logic (Reading from .sdlx)`,
            `1.  **Direct Mappings:** Read from \`Student\`, \`Subjects\`, \`Grades\`, \`Assessment\`, and \`Settings\` tables. Convert \`BLOB\` to \`byte[]\`. Normalize all dates to "YYYY-MM-DD" and calculate \`Age\`.`,
            `2.  **Derived Classes:** Create \`Class\` entities from the \`TeacherSignature\` table.`,
            `3.  **Score Aggregation:** Iterate through every row in the \`Records\` table. For each row, find the matching Student, Subject, and Assessment (use Dictionaries for performance). Construct a score string "score/basis". Find or create a single \`Score\` object for the Student-Subject pair and add the score string to the correct assessment list inside it.`,
            `4.  **Report Data Aggregation:** Iterate the \`Comments\` table. Find the matching student. Create a \`ReportSpecificData\` object. **CRITICAL MAPPING:** The app's "Interest" field maps to the database's \`HeadRemarks\` column. Create a \`ClassSpecificData\` object, mapping the \`Outof\` column to \`totalSchoolDays\`.`,
            ``,
            `### Export Logic (Writing to .sdlx)`,
            `1.  Reverse the process above.`,
            `2.  **Score De-normalization:** For each \`Score\` object, loop through its internal dictionary. For every score string in the list for an assessment, write a **separate row** into the \`Records\` table.`,
            `3.  **Comments:** For each \`ReportSpecificData\` object, write one row to the \`Comments\` table, mapping "Interest" back to the \`HeadRemarks\` column.`,
            ``,
            `## 9. Final Output`,
            ``,
            `Generate the complete C# and XAML code, structured into folders: \`Views\`, \`ViewModels\`, \`Models\`, \`Services\`, \`Controls\`, \`Styles\`. The code must be well-commented, follow MVVM best practices, and be ready to compile and run.`,
        ].join('\n');

        const blob = new Blob([prompt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'SBA_Pro_Master_WPF_Recreation_Prompt.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setFeedback({ message: 'Detailed WPF recreation prompt downloaded successfully!', type: 'success' });
        setTimeout(() => setFeedback(null), 4000);
    };

    const handleGenerateWpfProject = async () => {
        setProcessingAction('generate_wpf');
        setFeedback({ message: 'Generating WPF project files... This may take a few moments.', type: 'info' });
        try {
            const blob = await generateWpfProject();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'SBAProMaster_WPF_Project.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setFeedback({ message: 'WPF project generated and downloaded successfully!', type: 'success' });
        } catch (error) {
            console.error("WPF Project generation failed:", error);
            setFeedback({ message: `WPF project generation failed: ${(error as Error).message}`, type: 'error' });
        } finally {
            setProcessingAction(null);
        }
    };


    const FeedbackPanel = () => {
        if (!feedback) return null;

        const colors = {
            success: 'bg-green-100 border-green-300 text-green-800',
            error: 'bg-red-100 border-red-300 text-red-800',
            info: 'bg-blue-100 border-blue-300 text-blue-800',
            warning: 'bg-yellow-100 border-yellow-300 text-yellow-800',
        };

        const icons = {
            success: <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
            error: <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>,
            info: <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>,
            warning: <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.636-1.1 2.252-1.1 2.888 0l6.294 10.874c.636 1.1-.176 2.527-1.444 2.527H3.407c-1.268 0-2.08-1.427-1.444-2.527L8.257 3.099zM9 12a1 1 0 112 0 1 1 0 01-2 0zm1-4a1 1 0 00-1 1v2a1 1 0 102 0V9a1 1 0 00-1-1z" clipRule="evenodd" /></svg>,
        };

        return (
            <div className={`fixed top-28 right-6 z-50 w-full max-w-md p-4 rounded-xl shadow-lg border animate-fade-in-scale ${colors[feedback.type]}`}>
                <div className="flex items-start justify-between">
                    <div className="flex items-start flex-grow">
                        <div className="flex-shrink-0 mr-3 mt-1">{icons[feedback.type]}</div>
                        <div className="flex-grow">
                            <p className="font-bold">{feedback.message}</p>
                            {feedback.details && feedback.details.length > 0 && (
                                <div className="mt-2 text-sm">
                                    {feedback.detailsTitle && <p className="font-semibold">{feedback.detailsTitle}</p>}
                                    <ul className="space-y-1 max-h-40 overflow-y-auto bg-black/5 p-2 rounded-md mt-1">
                                        {feedback.details.map((detail, index) => (
                                            <li key={index}>{detail}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                    <button onClick={() => setFeedback(null)} className="ml-4 -mt-1 -mr-1 p-1 rounded-full hover:bg-black/10 transition-colors flex-shrink-0">
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        );
    }

    const ReadyToShareModal = () => {
        if (!isReadyToShareModalOpen) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 animate-fade-in-scale">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md m-4">
                    <h3 className="text-lg leading-6 font-bold text-gray-900 flex items-center">
                        <svg className="h-6 w-6 text-green-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        Ready to Share!
                    </h3>
                    <div className="mt-4 text-sm text-gray-600 space-y-3">
                        <p>Your file <code className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs">{shareFileName}</code> has been saved to your browser's "Downloads" folder.</p>
                        <div>
                            <p className="font-semibold mb-1">Final Steps:</p>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>Click the "Open WhatsApp" button below.</li>
                                <li>Find the new WhatsApp tab in your browser.</li>
                                <li>Click the attach icon (📎), select your file, and send!</li>
                            </ol>
                        </div>
                    </div>
                    <div className="mt-6 flex flex-col-reverse sm:flex-row-reverse gap-3">
                        <button
                            onClick={() => {
                                if (whatsAppUrlToOpen) {
                                    window.open(whatsAppUrlToOpen, '_blank');
                                }
                                setIsReadyToShareModalOpen(false);
                            }}
                            className="w-full sm:w-auto flex items-center justify-center bg-green-500 text-white px-4 py-2 rounded-lg shadow font-semibold hover:bg-green-600 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
                            </svg>
                            Open WhatsApp
                        </button>
                        <button
                            onClick={() => setIsReadyToShareModalOpen(false)}
                            className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    };


    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Data Management</h1>

            <FeedbackPanel />

            <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 space-y-6">
                <h2 className="text-xl font-bold text-gray-700 border-b pb-2">Import & Export</h2>
                <p className="text-gray-600">
                    You can back up all your school's data into a single `.sdlx` file. This file can be stored securely and used to restore your data on this or another computer.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
                    <div>
                        <h3 className="font-semibold text-gray-800">Import Data</h3>
                        <p className="text-sm text-gray-500 mb-2">Load data from an .sdlx database file. <strong className="text-red-600">This will overwrite all current data.</strong></p>
                        <input
                            type="file"
                            accept=".sdlx"
                            onChange={handleFileSelect}
                            disabled={!!processingAction}
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            aria-hidden="true"
                        />
                        <button onClick={handleImportClick} disabled={!!processingAction} className={buttonStyles}>
                            {processingAction === 'import' ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : 'Import Database File'}
                        </button>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-800">Export Data</h3>
                        <p className="text-sm text-gray-500 mb-2">Save all current data to an .sdlx database file as a backup.</p>
                        <button onClick={handleExport} disabled={!!processingAction} className={buttonStyles}>
                            {processingAction === 'export' ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : 'Download Database File'}
                        </button>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-800">Share Backup</h3>
                        <p className="text-sm text-gray-500 mb-2">Share the database file with a contact via WhatsApp.</p>
                        <button
                            onClick={() => setIsShareModalOpen(true)}
                            disabled={!!processingAction}
                            className="flex items-center justify-center bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-wait"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
                            </svg>
                            Share Database File
                        </button>
                    </div>
                </div>
            </div>

            {currentUser && currentUser.role === 'Admin' && (
                <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 space-y-6">
                    <h2 className="text-xl font-bold text-gray-700 border-b pb-2">User Management</h2>
                    <p className="text-gray-600">
                        Manage user accounts, roles, and permissions for your school.
                    </p>

                    <div className="pt-4">
                        <button
                            onClick={() => setIsUserManagementOpen(true)}
                            className="flex items-center justify-center bg-purple-600 text-white px-6 py-3 rounded-lg shadow hover:bg-purple-700 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            Manage Users
                        </button>
                    </div>
                </div>
            )}

            {DEV_TOOLS_ENABLED && (
                <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 space-y-6">
                    <h2 className="text-xl font-bold text-gray-700 border-b pb-2">Developer Tools</h2>
                    <p className="text-gray-600">
                        Generate developer assets to recreate this application on other platforms.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        <div>
                            <h3 className="font-semibold text-gray-800">WPF App Recreation Prompt</h3>
                            <p className="text-sm text-gray-500 mb-2">Downloads a comprehensive .txt file with instructions for an AI to build a WPF version of SBA Pro Master.</p>
                            <button onClick={generateWpfPrompt} disabled={!!processingAction} className={buttonStyles}>
                                Download Prompt (.txt)
                            </button>
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800">WPF Project Source Code</h3>
                            <p className="text-sm text-gray-500 mb-2">Generates all C# and XAML source code for the WPF application and bundles it into a downloadable .zip file.</p>
                            <button onClick={handleGenerateWpfProject} disabled={!!processingAction} className={buttonStyles}>
                                {processingAction === 'generate_wpf' ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Generating...
                                    </>
                                ) : 'Generate Project (.zip)'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 rounded-md">
                <h4 className="font-bold">Important Notice</h4>
                <ul className="list-disc list-inside mt-2 text-sm">
                    <li>Always keep your backup file in a safe place.</li>
                    <li>Importing a file will replace everything, including settings, students, scores, and report card data.</li>
                    <li>Ensure you are importing a valid `.sdlx` file generated by this application. A partially successful import may indicate inconsistencies in your backup file.</li>
                </ul>
            </div>
            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={handleCancelImport}
                onConfirm={handleConfirmImport}
                title="Confirm Data Import"
                message={`This will overwrite all current data with the contents of '${fileToImport?.name}'. This action cannot be undone.`}
                variant="danger"
                confirmText="Import & Overwrite"
            />
            <ConfirmationModal
                isOpen={isCloudSaveModalOpen}
                onClose={handleCancelCloudSave}
                onConfirm={handleConfirmCloudSave}
                title="Save to Cloud?"
                message="Do you want to save the imported data to the cloud? This will overwrite the current cloud backup for your school."
                variant="info"
                confirmText="Save to Cloud"
            />
            {isShareModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 animate-fade-in-scale">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md m-4">
                        <h3 className="text-lg leading-6 font-bold text-gray-900">Share Database via WhatsApp</h3>
                        <p className="text-sm text-gray-600 mt-2">
                            This will download a backup of your database. You'll then be redirected to WhatsApp to send the file.
                        </p>

                        {!showCustomInput ? (
                            <div className="mt-4 space-y-3">
                                <button
                                    onClick={() => handleShare(WHATSAPP_DEVELOPER_NUMBER)}
                                    className="w-full flex items-center justify-center bg-green-500 text-white px-4 py-3 rounded-lg shadow font-semibold hover:bg-green-600 transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
                                    </svg>
                                    Send to Developer
                                </button>
                                <button
                                    onClick={() => setShowCustomInput(true)}
                                    className="w-full bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-semibold"
                                >
                                    Send to a Custom Number
                                </button>
                            </div>
                        ) : (
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700">Enter WhatsApp Number</label>
                                <input
                                    type="tel"
                                    placeholder="e.g. 233241234567"
                                    value={customNumber}
                                    onChange={(e) => setCustomNumber(e.target.value.replace(/\D/g, ''))}
                                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                />
                                <button
                                    onClick={() => handleShare(customNumber)}
                                    disabled={!customNumber.trim()}
                                    className="w-full mt-3 flex items-center justify-center bg-green-500 text-white px-4 py-3 rounded-lg shadow font-semibold hover:bg-green-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                                >
                                    Share Now
                                </button>
                            </div>
                        )}

                        <div className="mt-5 sm:mt-4 text-right">
                            <button
                                type="button"
                                className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm"
                                onClick={() => {
                                    setIsShareModalOpen(false);
                                    setShowCustomInput(false);
                                    setCustomNumber('');
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {isUserManagementOpen && (
                <AdminSetup
                    mode="management"
                    users={users}
                    currentUser={currentUser}
                    onComplete={(users) => handleUserManagementSave(users, true)} // Complete/Close
                    onUpdate={(users) => handleUserManagementSave(users, false)} // Update/Keep Open
                    onCancel={() => setIsUserManagementOpen(false)}
                />
            )}
            <ReadyToShareModal />
        </div>
    );
};

export default DataManagement;