
export const content = `
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SBAProMaster.WPF.Data.Models;
using System.Collections.ObjectModel;

namespace SBAProMaster.WPF.ViewModels;

public partial class GradingSystemViewModel : ObservableObject
{
    [ObservableProperty]
    private ObservableCollection<Grade> _grades = new();

    [ObservableProperty]
    private Grade? _selectedGrade;

    [ObservableProperty]
    private bool _isModalOpen;

    [ObservableProperty]
    private string _scaleStatus = "The grading scale is complete and covers 0% to 100%.";
    
    [ObservableProperty]
    private bool _isScaleValid = true;

    [RelayCommand]
    private void OpenAddModal()
    {
        SelectedGrade = new Grade(0, "", 0, 100, "");
        IsModalOpen = true;
    }

    [RelayCommand]
    private void OpenEditModal(Grade grade)
    {
        SelectedGrade = grade; // Or a copy for editing
        IsModalOpen = true;
    }

    [RelayCommand]
    private void SaveGrade()
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