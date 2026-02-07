

import JSZip from 'jszip';

// Import all file contents from the new modular structure
import { content as csprojContent } from './wpf_project_files/root/SBAProMaster.WPF.csproj';
import { content as nugetContent } from './wpf_project_files/root/NuGet.Config';
import { content as readmeContent } from './wpf_project_files/root/README.md';
import { content as appXamlContent } from './wpf_project_files/root/App.xaml';
import { content as appXamlCsContent } from './wpf_project_files/root/App.xaml.cs';
import { content as mainWindowXamlContent } from './wpf_project_files/root/MainWindow.xaml';
import { content as mainWindowXamlCsContent } from './wpf_project_files/root/MainWindow.xaml.cs';
import { icoData } from './wpf_project_files/root/app.ico';

import { content as customThemeContent } from './wpf_project_files/Styles/CustomTheme.xaml';
import { content as modelsContent } from './wpf_project_files/Data/Models.cs';
import { content as appDbContextContent } from './wpf_project_files/Data/AppDbContext.cs';
import { content as databaseServiceContent } from './wpf_project_files/Services/DatabaseService.cs';

import { content as inverseBooleanConverterContent } from './wpf_project_files/Converters/InverseBooleanConverter.cs';

import { content as mainViewModelContent } from './wpf_project_files/ViewModels/MainViewModel.cs';
import { content as dashboardViewModelContent } from './wpf_project_files/ViewModels/DashboardViewModel.cs';
import { content as studentsViewModelContent } from './wpf_project_files/ViewModels/StudentsViewModel.cs';
import { content as subjectsViewModelContent } from './wpf_project_files/ViewModels/SubjectsViewModel.cs';
import { content as classesViewModelContent } from './wpf_project_files/ViewModels/ClassesViewModel.cs';
import { content as gradingSystemViewModelContent } from './wpf_project_files/ViewModels/GradingSystemViewModel.cs';
import { content as assessmentTypesViewModelContent } from './wpf_project_files/ViewModels/AssessmentTypesViewModel.cs';
import { content as scoreEntryViewModelContent } from './wpf_project_files/ViewModels/ScoreEntryViewModel.cs';
import { content as reportViewerViewModelContent } from './wpf_project_files/ViewModels/ReportViewerViewModel.cs';
import { content as settingsViewModelContent } from './wpf_project_files/ViewModels/SettingsViewModel.cs';
import { content as dataManagementViewModelContent } from './wpf_project_files/ViewModels/DataManagementViewModel.cs';

import { content as sidebarViewXamlContent } from './wpf_project_files/Views/SidebarView.xaml';
import { content as sidebarViewCsContent } from './wpf_project_files/Views/SidebarView.xaml.cs';
import { content as dashboardViewXamlContent } from './wpf_project_files/Views/DashboardView.xaml';
import { content as dashboardViewCsContent } from './wpf_project_files/Views/DashboardView.xaml.cs';
import { content as studentsViewXamlContent } from './wpf_project_files/Views/StudentsView.xaml';
import { content as studentsViewCsContent } from './wpf_project_files/Views/StudentsView.xaml.cs';
import { content as subjectsViewXamlContent } from './wpf_project_files/Views/SubjectsView.xaml';
import { content as subjectsViewCsContent } from './wpf_project_files/Views/SubjectsView.xaml.cs';
import { content as classesViewXamlContent } from './wpf_project_files/Views/ClassesView.xaml';
import { content as classesViewCsContent } from './wpf_project_files/Views/ClassesView.xaml.cs';
import { content as gradingSystemViewXamlContent } from './wpf_project_files/Views/GradingSystemView.xaml';
import { content as gradingSystemViewCsContent } from './wpf_project_files/Views/GradingSystemView.xaml.cs';
import { content as assessmentTypesViewXamlContent } from './wpf_project_files/Views/AssessmentTypesView.xaml';
import { content as assessmentTypesViewCsContent } from './wpf_project_files/Views/AssessmentTypesView.xaml.cs';
import { content as scoreEntryViewXamlContent } from './wpf_project_files/Views/ScoreEntryView.xaml';
import { content as scoreEntryViewCsContent } from './wpf_project_files/Views/ScoreEntryView.xaml.cs';
import { content as reportViewerXamlContent } from './wpf_project_files/Views/ReportViewer.xaml';
import { content as reportViewerCsContent } from './wpf_project_files/Views/ReportViewer.xaml.cs';
import { content as settingsViewXamlContent } from './wpf_project_files/Views/SettingsView.xaml';
import { content as settingsViewCsContent } from './wpf_project_files/Views/SettingsView.xaml.cs';
import { content as dataManagementViewXamlContent } from './wpf_project_files/Views/DataManagementView.xaml';
import { content as dataManagementViewCsContent } from './wpf_project_files/Views/DataManagementView.xaml.cs';

import { content as reportCardViewXamlContent } from './wpf_project_files/Controls/ReportCardView.xaml';
import { content as reportCardViewCsContent } from './wpf_project_files/Controls/ReportCardView.xaml.cs';
import { content as fitTextBlockCsContent } from './wpf_project_files/Controls/FitTextBlock.cs';

// Assemble the file dictionary from the imported modules
const wpfFiles: { [path: string]: string } = {
  "SBAProMaster.WPF.csproj": csprojContent,
  "NuGet.Config": nugetContent,
  "README.md": readmeContent,
  "App.xaml": appXamlContent,
  "App.xaml.cs": appXamlCsContent,
  "MainWindow.xaml": mainWindowXamlContent,
  "MainWindow.xaml.cs": mainWindowXamlCsContent,
  "Styles/CustomTheme.xaml": customThemeContent,
  "Data/Models.cs": modelsContent,
  "Data/AppDbContext.cs": appDbContextContent,
  "Services/DatabaseService.cs": databaseServiceContent,
  "Converters/InverseBooleanConverter.cs": inverseBooleanConverterContent,
  "ViewModels/MainViewModel.cs": mainViewModelContent,
  "ViewModels/DashboardViewModel.cs": dashboardViewModelContent,
  "ViewModels/StudentsViewModel.cs": studentsViewModelContent,
  "ViewModels/SubjectsViewModel.cs": subjectsViewModelContent,
  "ViewModels/ClassesViewModel.cs": classesViewModelContent,
  "ViewModels/GradingSystemViewModel.cs": gradingSystemViewModelContent,
  "ViewModels/AssessmentTypesViewModel.cs": assessmentTypesViewModelContent,
  "ViewModels/ScoreEntryViewModel.cs": scoreEntryViewModelContent,
  "ViewModels/ReportViewerViewModel.cs": reportViewerViewModelContent,
  "ViewModels/SettingsViewModel.cs": settingsViewModelContent,
  "ViewModels/DataManagementViewModel.cs": dataManagementViewModelContent,
  "Views/SidebarView.xaml": sidebarViewXamlContent,
  "Views/SidebarView.xaml.cs": sidebarViewCsContent,
  "Views/DashboardView.xaml": dashboardViewXamlContent,
  "Views/DashboardView.xaml.cs": dashboardViewCsContent,
  "Views/StudentsView.xaml": studentsViewXamlContent,
  "Views/StudentsView.xaml.cs": studentsViewCsContent,
  "Views/SubjectsView.xaml": subjectsViewXamlContent,
  "Views/SubjectsView.xaml.cs": subjectsViewCsContent,
  "Views/ClassesView.xaml": classesViewXamlContent,
  "Views/ClassesView.xaml.cs": classesViewCsContent,
  "Views/GradingSystemView.xaml": gradingSystemViewXamlContent,
  "Views/GradingSystemView.xaml.cs": gradingSystemViewCsContent,
  "Views/AssessmentTypesView.xaml": assessmentTypesViewXamlContent,
  "Views/AssessmentTypesView.xaml.cs": assessmentTypesViewCsContent,
  "Views/ScoreEntryView.xaml": scoreEntryViewXamlContent,
  "Views/ScoreEntryView.xaml.cs": scoreEntryViewCsContent,
  "Views/ReportViewer.xaml": reportViewerXamlContent,
  "Views/ReportViewer.xaml.cs": reportViewerCsContent,
  "Views/SettingsView.xaml": settingsViewXamlContent,
  "Views/SettingsView.xaml.cs": settingsViewCsContent,
  "Views/DataManagementView.xaml": dataManagementViewXamlContent,
  "Views/DataManagementView.xaml.cs": dataManagementViewCsContent,
  "Controls/ReportCardView.xaml": reportCardViewXamlContent,
  "Controls/ReportCardView.xaml.cs": reportCardViewCsContent,
  "Controls/FitTextBlock.cs": fitTextBlockCsContent,
};

export async function generateWpfProject(): Promise<Blob> {
    const zip = new JSZip();

    for (const path of Object.keys(wpfFiles)) {
        zip.file(path, wpfFiles[path].trim());
    }

    // Decode the base64 icon data and add it to the zip as a binary file
    const icoBuffer = Uint8Array.from(atob(icoData), c => c.charCodeAt(0));
    zip.file("app.ico", icoBuffer);

    return zip.generateAsync({ type: 'blob' });
}