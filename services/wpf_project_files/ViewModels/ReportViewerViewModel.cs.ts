
export const content = `
using CommunityToolkit.Mvvm.ComponentModel;
using SBAProMaster.WPF.Data.Models;
using System.Collections.ObjectModel;

namespace SBAProMaster.WPF.ViewModels;

public partial class ReportViewerViewModel : ObservableObject
{
    [ObservableProperty]
    private ObservableCollection<Class> _classes = new();
    
    [ObservableProperty]
    private Class? _selectedClass;

    [ObservableProperty]
    private ObservableCollection<Student> _studentsInClass = new();
    
    [ObservableProperty]
    private Student? _selectedStudent;

    [ObservableProperty]
    private ObservableCollection<Student> _reportsToDisplay = new();

    [ObservableProperty]
    private bool _isCustomizationPanelOpen;
}
`;