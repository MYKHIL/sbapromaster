
export const content = `
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SBAProMaster.WPF.Data.Models;
using System.Collections.ObjectModel;

namespace SBAProMaster.WPF.ViewModels;

public partial class ClassesViewModel : ObservableObject
{
    [ObservableProperty]
    private ObservableCollection<Class> _classes = new();

    [ObservableProperty]
    private Class? _selectedClass;

    [ObservableProperty]
    private bool _isModalOpen;
    
    [ObservableProperty]
    private string? _searchQuery;

    [RelayCommand]
    private void OpenAddModal()
    {
        SelectedClass = new Class(0, "", "", null);
        IsModalOpen = true;
    }

    [RelayCommand]
    private void OpenEditModal(Class cls)
    {
        SelectedClass = cls; // Or a copy for editing
        IsModalOpen = true;
    }

    [RelayCommand]
    private void SaveClass()
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