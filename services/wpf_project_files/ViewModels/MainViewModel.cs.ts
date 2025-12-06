
export const content = `
using CommunityToolkit.Mvvm.ComponentModel;
using System;
using System.Collections.ObjectModel;
using System.Linq;

namespace SBAProMaster.WPF.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly Func<Type, object> _viewModelFactory;

    [ObservableProperty]
    private object? _currentViewModel;
    
    [ObservableProperty]
    private NavItem? _selectedNavItem;
    
    public ObservableCollection<NavItem> NavItems { get; }

    public MainViewModel(Func<Type, object> viewModelFactory)
    {
        _viewModelFactory = viewModelFactory;
        
        NavItems = new ObservableCollection<NavItem>
        {
            new("Dashboard", typeof(DashboardViewModel), "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"),
            new("School Setup", typeof(SettingsViewModel), "M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"),
            new("Teachers", typeof(ClassesViewModel), "M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"),
            new("Subjects", typeof(SubjectsViewModel), "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"),
            new("Students", typeof(StudentsViewModel), "M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"),
            new("Grading System", typeof(GradingSystemViewModel), "M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.153.24c-1.355 0-2.697-.44-3.75-1.25M12 4.5c-2.291 0-4.545.16-6.75.47m-6.75-.47c-1.01.143-2.01.317-3 .52m3-.52L2.62 15.696c-.122.499.106 1.028.589 1.202a5.989 5.989 0 002.153.24c1.355 0 2.697-.44 3.75-1.25M12 4.5v15.75"),
            new("Assessment Types", typeof(AssessmentTypesViewModel), "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"),
            new("Score Entry", typeof(ScoreEntryViewModel), "M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"),
            new("Report Viewer", typeof(ReportViewerViewModel), "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"),
            new("Data Management", typeof(DataManagementViewModel), "M3 13.125C3 12.504 3.504 12 4.125 12h15.75c.621 0 1.125.504 1.125 1.125v6.75C21 20.496 20.496 21 19.875 21H4.125A1.125 1.125 0 013 19.875v-6.75zM3 8.625C3 8.004 3.504 7.5 4.125 7.5h15.75c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 013 11.25V8.625zM3 4.125C3 3.504 3.504 3 4.125 3h15.75c.621 0 1.125.504 1.125 1.125v2.25C21 6.996 20.496 7.5 19.875 7.5H4.125A1.125 1.125 0 013 6.375V4.125z"),
        };
        
        // This is the correct way to initialize. 
        // Setting the property triggers OnSelectedNavItemChanged, which handles setting the CurrentViewModel.
        // This centralizes navigation logic and ensures PropertyChanged notifications are sent.
        SelectedNavItem = NavItems.FirstOrDefault();
    }

    partial void OnSelectedNavItemChanged(NavItem? value)
    {
        if (value is null) return;
        CurrentViewModel = _viewModelFactory(value.ViewModelType);
    }
}

public record NavItem(string Name, Type ViewModelType, string IconPath);
`;