
export const content = `
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SBAProMaster.WPF.Data.Models;
using System.Collections.ObjectModel;

namespace SBAProMaster.WPF.ViewModels;

public partial class StudentsViewModel : ObservableObject
{
    [ObservableProperty]
    private ObservableCollection<Student> _students = new();

    [ObservableProperty]
    private Student? _selectedStudent;

    [ObservableProperty]
    private bool _isModalOpen;

    [ObservableProperty]
    private string? _searchQuery;

    [RelayCommand]
    private void OpenAddModal()
    {
        SelectedStudent = new Student(0, "", "", "Male", "", "2010-01-01", "", null);
        IsModalOpen = true;
    }

    [RelayCommand]
    private void OpenEditModal(Student student)
    {
        SelectedStudent = student; // In a real app, you might want to create a copy for editing
        IsModalOpen = true;
    }

    [RelayCommand]
    private void SaveStudent()
    {
        // Add save/update logic here
        IsModalOpen = false;
    }

    [RelayCommand]
    private void CloseModal()
    {
        IsModalOpen = false;
    }
}
`;