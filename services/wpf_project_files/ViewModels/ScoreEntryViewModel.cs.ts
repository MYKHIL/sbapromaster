
export const content = `
using CommunityToolkit.Mvvm.ComponentModel;
using SBAProMaster.WPF.Data.Models;
using System.Collections.ObjectModel;

namespace SBAProMaster.WPF.ViewModels;

public partial class ScoreEntryViewModel : ObservableObject
{
    [ObservableProperty]
    private ObservableCollection<Class> _classes = new();

    [ObservableProperty]
    private Class? _selectedClass;

    [ObservableProperty]
    private ObservableCollection<Subject> _subjects = new();

    [ObservableProperty]
    private Subject? _selectedSubject;
    
    [ObservableProperty]
    private ObservableCollection<Student> _studentsInClass = new();

    [ObservableProperty]
    private ObservableCollection<Assessment> _assessments = new();
}
`;