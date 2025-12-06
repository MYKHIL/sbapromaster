
export const content = `
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SBAProMaster.WPF.Data.Models;
using System.Collections.ObjectModel;

namespace SBAProMaster.WPF.ViewModels;

public partial class SubjectsViewModel : ObservableObject
{
    [ObservableProperty]
    private ObservableCollection<Subject> _subjects = new();

    [ObservableProperty]
    private Subject? _selectedSubject;
    
    [ObservableProperty]
    private bool _isModalOpen;

    [ObservableProperty]
    private string? _searchQuery;
    
    [RelayCommand]
    private void OpenAddModal()
    {
        SelectedSubject = new Subject(0, "", "Core", "", null);
        IsModalOpen = true;
    }

    [RelayCommand]
    private void OpenEditModal(Subject subject)
    {
        SelectedSubject = subject; // Or a copy for editing
        IsModalOpen = true;
    }

    [RelayCommand]
    private void SaveSubject()
    {
        // Add save logic here
        IsModalOpen = false;
    }
    
    [RelayCommand]
    private void CloseModal()
    {
        IsModalOpen = false;
    }
}
`;