
export const content = `
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using SBAProMaster.WPF.Data.Models;
using System.Collections.ObjectModel;

namespace SBAProMaster.WPF.ViewModels;

public partial class AssessmentTypesViewModel : ObservableObject
{
    [ObservableProperty]
    private ObservableCollection<Assessment> _assessments = new();

    [ObservableProperty]
    private Assessment? _selectedAssessment;

    [ObservableProperty]
    private bool _isModalOpen;

    [RelayCommand]
    private void OpenAddModal()
    {
        SelectedAssessment = new Assessment(0, "", 10);
        IsModalOpen = true;
    }

    [RelayCommand]
    private void OpenEditModal(Assessment assessment)
    {
        SelectedAssessment = assessment; // Or a copy for editing
        IsModalOpen = true;
    }

    [RelayCommand]
    private void SaveAssessment()
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